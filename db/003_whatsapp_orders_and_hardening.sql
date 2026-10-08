-- =============================================================================
-- 003_whatsapp_orders_and_hardening.sql
--
-- 1. WhatsApp order history: every order an admin sends on WhatsApp is
--    recorded; the shop's super admin can browse it.
-- 2. Login brute-force protection: login_v2 / platform_login_v2 count failed
--    attempts and lock a username for 15 minutes after too many failures.
--    (The old login functions stay for already-open browsers; remove them
--    with 004 about a week after the new frontend is live.)
-- 3. Stronger password hashing: bcrypt cost 10 (was 6) for new passwords.
--    Existing users are upgraded automatically the next time they log in.
-- 4. Size limits on names, item lists and messages.
--
-- SAFE FOR THE EXISTING CLIENT: additive only. No data is changed (except
-- password hashes being re-hashed with the same password on login), every
-- existing function keeps its name, parameters and results.
-- One transaction; refuses to run twice. Requires 001.
-- =============================================================================

begin;

set local lock_timeout = '10s';

do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'shops') then
    raise exception 'Run 001_multi_tenant.sql first. Nothing was changed.';
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'whatsapp_orders') then
    raise exception 'Migration 003 has already been applied. Nothing was changed.';
  end if;
end $$;

-- ── 1. helpers ──────────────────────────────────────────────────────────────

create function public._hash_password(p_password text)
returns text language sql volatile security definer set search_path = public, extensions
as $$ select crypt(p_password, gen_salt('bf', 10)) $$;

-- true when a bcrypt hash was made with a cost below 10
create function public._hash_is_weak(p_hash text)
returns boolean language sql immutable
as $$ select p_hash ~ '^\$2[abxy]\$0[0-9]\$' $$;

create table public.login_attempts (
  id           bigserial primary key,
  kind         text not null check (kind in ('shop', 'platform')),
  username     text not null,
  attempted_at timestamptz not null default now()
);
create index login_attempts_lookup_idx on public.login_attempts(kind, username, attempted_at desc);
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;

create function public._login_locked(p_kind text, p_username text, p_max integer)
returns boolean language sql stable security definer set search_path = public
as $$
  select count(*) >= p_max from login_attempts
  where kind = p_kind and username = p_username and attempted_at > now() - interval '15 minutes'
$$;

revoke all on function public._hash_password(text)                  from public, anon, authenticated;
revoke all on function public._hash_is_weak(text)                   from public, anon, authenticated;
revoke all on function public._login_locked(text, text, integer)    from public, anon, authenticated;

-- ── 2. login with lockout (returns an error object instead of raising, so ──
--      the failed attempt is actually saved)

create function public.login_v2(p_username text, p_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare
  v record;
  v_username text := lower(trim(coalesce(p_username, '')));
  v_token uuid;
begin
  delete from login_attempts where attempted_at < now() - interval '1 day';

  if _login_locked('shop', v_username, 8) then
    return jsonb_build_object('ok', false, 'error', 'Too many failed attempts. Please wait 15 minutes and try again.');
  end if;

  select u.id, u.name, u.username, u.role, u.password_hash, u.is_active, u.shop_id,
         sh.name as shop_name, sh.code as shop_code, sh.is_active as shop_active, sh.support_contact
    into v
  from users u join shops sh on sh.id = u.shop_id
  where u.username = v_username;

  if v.id is null or v.password_hash <> crypt(coalesce(p_password, ''), v.password_hash) then
    insert into login_attempts(kind, username) values ('shop', v_username);
    return jsonb_build_object('ok', false, 'error', 'Incorrect username or password');
  end if;
  if not v.is_active then
    return jsonb_build_object('ok', false, 'error', 'Your account has been deactivated. Please contact your shop admin.');
  end if;
  if not v.shop_active then
    return jsonb_build_object('ok', false, 'error', 'This shop account is suspended. Please contact support.');
  end if;

  delete from login_attempts where kind = 'shop' and username = v_username;
  if _hash_is_weak(v.password_hash) then
    update users set password_hash = _hash_password(p_password) where id = v.id;
  end if;

  delete from sessions where expires_at < now();
  insert into sessions(user_id, expires_at) values (v.id, now() + interval '30 days')
  returning token into v_token;

  return jsonb_build_object(
    'ok', true, 'token', v_token, 'user_id', v.id, 'name', v.name, 'username', v.username,
    'role', v.role, 'shop_id', v.shop_id, 'shop_name', v.shop_name, 'shop_code', v.shop_code,
    'support_contact', v.support_contact);
end;
$$;

create function public.platform_login_v2(p_username text, p_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare
  v record;
  v_username text := lower(trim(coalesce(p_username, '')));
  v_token uuid;
begin
  delete from login_attempts where attempted_at < now() - interval '1 day';

  if _login_locked('platform', v_username, 5) then
    return jsonb_build_object('ok', false, 'error', 'Too many failed attempts. Please wait 15 minutes and try again.');
  end if;

  select a.* into v from platform_admins a where a.username = v_username;
  if v.id is null or not v.is_active or v.password_hash <> crypt(coalesce(p_password, ''), v.password_hash) then
    insert into login_attempts(kind, username) values ('platform', v_username);
    return jsonb_build_object('ok', false, 'error', 'Incorrect username or password');
  end if;

  delete from login_attempts where kind = 'platform' and username = v_username;
  if _hash_is_weak(v.password_hash) then
    update platform_admins set password_hash = _hash_password(p_password) where id = v.id;
  end if;

  delete from platform_sessions where expires_at < now();
  insert into platform_sessions(admin_id, expires_at) values (v.id, now() + interval '12 hours')
  returning token into v_token;

  return jsonb_build_object('ok', true, 'token', v_token, 'admin_id', v.id, 'name', v.name, 'username', v.username);
end;
$$;

-- ── 3. functions that set passwords → bcrypt cost 10 (bodies otherwise as 001)

create or replace function public.create_user(p_token uuid, p_name text, p_username text, p_password text, p_role text)
returns uuid language plpgsql security definer set search_path = public, extensions
as $$
declare me record; v_id uuid;
begin
  select * into me from _auth(p_token, array['super_admin']);
  if length(trim(p_password)) < 6 then raise exception 'Password must be at least 6 characters'; end if;
  insert into users(name, username, password_hash, role, shop_id)
  values (trim(p_name), lower(trim(p_username)), _hash_password(p_password), p_role, me.shop_id)
  returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'That username is already taken';
end;
$$;

create or replace function public.reset_password(p_token uuid, p_user_id uuid, p_new_password text)
returns void language plpgsql security definer set search_path = public, extensions
as $$
declare me record;
begin
  select * into me from _auth(p_token, array['super_admin']);
  if length(trim(p_new_password)) < 6 then raise exception 'Password must be at least 6 characters'; end if;
  update users set password_hash = _hash_password(p_new_password)
  where id = p_user_id and shop_id = me.shop_id;
  if not found then raise exception 'User not found'; end if;
  delete from sessions s where s.user_id = p_user_id;
end;
$$;

create or replace function public.platform_create_shop(
  p_token uuid, p_name text, p_code text, p_timezone text, p_support_contact text,
  p_admin_name text, p_admin_username text, p_admin_password text)
returns uuid language plpgsql security definer set search_path = public, extensions
as $$
declare v_shop uuid; v_code text := lower(trim(p_code));
begin
  perform _platform_auth(p_token);
  if coalesce(trim(p_name), '') = '' then raise exception 'Shop name is required'; end if;
  if v_code !~ '^[a-z0-9][a-z0-9-]{1,39}$' then
    raise exception 'Shop code must be 2–40 characters: lowercase letters, numbers and dashes';
  end if;
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Unknown timezone: %', p_timezone;
  end if;
  if coalesce(trim(p_admin_name), '') = '' or coalesce(trim(p_admin_username), '') = '' then
    raise exception 'Super admin name and username are required';
  end if;
  if length(trim(coalesce(p_admin_password, ''))) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;
  if exists (select 1 from shops where code = v_code) then raise exception 'That shop code is already taken'; end if;
  if exists (select 1 from users where username = lower(trim(p_admin_username))) then
    raise exception 'That username is already taken';
  end if;

  insert into shops(name, code, timezone, support_contact)
  values (trim(p_name), v_code, p_timezone, nullif(trim(p_support_contact), ''))
  returning id into v_shop;

  insert into users(name, username, password_hash, role, shop_id)
  values (trim(p_admin_name), lower(trim(p_admin_username)), _hash_password(p_admin_password), 'super_admin', v_shop);
  return v_shop;
end;
$$;

create or replace function public.platform_create_shop_user(
  p_token uuid, p_shop_id uuid, p_name text, p_username text, p_password text, p_role text)
returns uuid language plpgsql security definer set search_path = public, extensions
as $$
declare v_id uuid;
begin
  perform _platform_auth(p_token);
  if not exists (select 1 from shops where id = p_shop_id) then raise exception 'Shop not found'; end if;
  if length(trim(coalesce(p_password, ''))) < 6 then raise exception 'Password must be at least 6 characters'; end if;
  insert into users(name, username, password_hash, role, shop_id)
  values (trim(p_name), lower(trim(p_username)), _hash_password(p_password), p_role, p_shop_id)
  returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'That username is already taken';
end;
$$;

create or replace function public.platform_reset_user_password(p_token uuid, p_user_id uuid, p_new_password text)
returns void language plpgsql security definer set search_path = public, extensions
as $$
begin
  perform _platform_auth(p_token);
  if length(trim(coalesce(p_new_password, ''))) < 6 then raise exception 'Password must be at least 6 characters'; end if;
  update users set password_hash = _hash_password(p_new_password) where id = p_user_id;
  if not found then raise exception 'User not found'; end if;
  delete from sessions where user_id = p_user_id;
end;
$$;

-- ── 4. size limits ──────────────────────────────────────────────────────────
-- Added only if no existing row breaks them, so existing data is never blocked.
do $$
declare
  c record;
  v_bad bigint;
begin
  for c in select * from (values
    ('users',    'users_name_len',        'char_length(name) <= 100'),
    ('users',    'users_username_len',    'char_length(username) <= 50'),
    ('agencies', 'agencies_name_len',     'char_length(name) <= 120'),
    ('agencies', 'agencies_whatsapp_len', 'whatsapp_number is null or char_length(whatsapp_number) <= 20'),
    ('products', 'products_name_len',     'char_length(name) <= 200'),
    ('shops',    'shops_name_len',        'char_length(name) <= 120'),
    ('shops',    'shops_contact_len',     'support_contact is null or char_length(support_contact) <= 120')
  ) as t(tbl, con, expr)
  loop
    execute format('select count(*) from public.%I where not (%s)', c.tbl, c.expr) into v_bad;
    if v_bad = 0 then
      execute format('alter table public.%I add constraint %I check (%s)', c.tbl, c.con, c.expr);
    else
      raise notice 'Skipped % on % (% existing rows exceed it)', c.con, c.tbl, v_bad;
    end if;
  end loop;
end $$;

-- submit_stock: same as 001 plus limits on list size and quantity
create or replace function public.submit_stock(p_token uuid, p_agency_id uuid, p_items jsonb)
returns uuid language plpgsql security definer set search_path = public
as $$
declare me record; v_submission_id uuid;
begin
  select * into me from _auth(p_token, array['staff']);
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Enter at least one product quantity before submitting';
  end if;
  if jsonb_array_length(p_items) > 5000 then raise exception 'Too many items in one submission'; end if;
  if exists (select 1 from jsonb_array_elements(p_items) e
             where coalesce((e->>'quantity')::bigint, -1) not between 0 and 1000000) then
    raise exception 'Quantities must be between 0 and 1,000,000';
  end if;
  if not exists (select 1 from agencies where id = p_agency_id and shop_id = me.shop_id and is_active) then
    raise exception 'Agency not found';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where not exists (select 1 from products pr
                      where pr.id = (e->>'product_id')::uuid
                        and pr.agency_id = p_agency_id and pr.shop_id = me.shop_id)
  ) then
    raise exception 'Some products do not belong to this agency. Please refresh and try again.';
  end if;

  insert into stock_submissions(agency_id, submitted_by, shop_id)
  values (p_agency_id, me.user_id, me.shop_id) returning id into v_submission_id;

  insert into stock_submission_items(submission_id, product_id, quantity)
  select v_submission_id, (e->>'product_id')::uuid, (e->>'quantity')::integer
  from jsonb_array_elements(p_items) e;

  return v_submission_id;
end;
$$;

-- ── 5. WhatsApp order history ──────────────────────────────────────────────

create table public.whatsapp_orders (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops(id),
  agency_id       uuid not null,
  agency_name     text not null,            -- snapshot at send time
  whatsapp_number text,                     -- snapshot at send time
  sent_by         uuid not null,
  items           jsonb not null check (jsonb_typeof(items) = 'array'),
  message         text not null check (char_length(message) <= 10000),
  sent_at         timestamptz not null default now(),
  foreign key (agency_id, shop_id) references public.agencies(id, shop_id),
  foreign key (sent_by, shop_id)   references public.users(id, shop_id)
);
create index whatsapp_orders_shop_time_idx   on public.whatsapp_orders(shop_id, sent_at desc);
create index whatsapp_orders_agency_time_idx on public.whatsapp_orders(agency_id, sent_at desc);
alter table public.whatsapp_orders enable row level security;
revoke all on public.whatsapp_orders from anon, authenticated;

-- Called by the app right before WhatsApp opens.
-- p_items: [{ "product_id": uuid|null, "name": text, "qty": number, "unit": text }]
create function public.log_whatsapp_order(p_token uuid, p_agency_id uuid, p_items jsonb, p_message text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare me record; v_agency record; v_items jsonb; v_id uuid;
begin
  select * into me from _auth(p_token, array['admin','super_admin']);
  select a.id, a.name, a.whatsapp_number into v_agency
  from agencies a where a.id = p_agency_id and a.shop_id = me.shop_id;
  if v_agency.id is null then raise exception 'Agency not found'; end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'An order needs at least one item';
  end if;
  if jsonb_array_length(p_items) > 1000 then raise exception 'Too many items in one order'; end if;
  if char_length(coalesce(p_message, '')) > 10000 then raise exception 'Order message is too long'; end if;

  -- keep only known fields, with sane sizes
  select jsonb_agg(jsonb_build_object(
           'product_id', case when (e->>'product_id') ~* '^[0-9a-f-]{36}$' then e->>'product_id' end,
           'name', left(coalesce(e->>'name', ''), 200),
           'qty',  least(greatest(coalesce((e->>'qty')::numeric, 0), 0), 1000000),
           'unit', left(coalesce(e->>'unit', ''), 20)))
    into v_items
  from jsonb_array_elements(p_items) e;

  insert into whatsapp_orders(shop_id, agency_id, agency_name, whatsapp_number, sent_by, items, message)
  values (me.shop_id, v_agency.id, v_agency.name, v_agency.whatsapp_number, me.user_id, v_items, coalesce(p_message, ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- Super admin: newest first, optional agency filter, "load more" with p_before.
create function public.get_whatsapp_orders(
  p_token uuid, p_agency_id uuid default null, p_before timestamptz default null, p_limit integer default 50)
returns table(id uuid, agency_id uuid, agency_name text, whatsapp_number text, sent_by_name text,
              sent_at timestamptz, item_count integer, total_qty numeric, items jsonb, message text)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare me record;
begin
  select * into me from _auth(p_token, array['super_admin']);
  return query
  select o.id, o.agency_id, o.agency_name, o.whatsapp_number, u.name, o.sent_at,
         jsonb_array_length(o.items),
         coalesce((select sum((i->>'qty')::numeric) from jsonb_array_elements(o.items) i), 0),
         o.items, o.message
  from whatsapp_orders o
  left join users u on u.id = o.sent_by
  where o.shop_id = me.shop_id
    and (p_agency_id is null or o.agency_id = p_agency_id)
    and (p_before is null or o.sent_at < p_before)
  order by o.sent_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

commit;
