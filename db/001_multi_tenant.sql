-- =============================================================================
-- 001_multi_tenant.sql  —  turn the single-shop portal into a multi-shop SaaS
--
-- SAFE FOR THE EXISTING CLIENT:
--   * Runs in ONE transaction. If any statement fails, nothing changes.
--   * No row is deleted or rewritten. Every existing row is attached to
--     "Shop #1" (id 00000000-0000-0000-0000-000000000001) through a column
--     default, which Postgres applies without rewriting data.
--   * Every RPC keeps its exact name and parameters, so the currently
--     deployed frontend keeps working before the new frontend is deployed.
--   * Usernames stay globally unique, so existing users log in exactly as
--     before (no shop code needed).
--
-- ALSO FIXES (affects the existing client, all for the better):
--   * get_staff_submission_detail / get_staff_submission_history had NO login
--     check — anyone with the public anon key could read submissions.
--   * Deactivated users could still log in.
--   * "Today" was computed in UTC; now uses the shop's timezone
--     (Asia/Kolkata for Shop #1).
--   * get_today_submission mixed every submission of the day; now returns
--     only the latest one, so a same-day update shows the updated numbers.
--   * submit_stock now rejects products that don't belong to the agency.
--
-- Run in Supabase → SQL Editor. Read db/README.md first.
-- =============================================================================

begin;

set local lock_timeout = '10s';

-- ── 0. guard: refuse to run twice ──────────────────────────────────────────
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'users' and column_name = 'shop_id') then
    raise exception 'Migration 001 has already been applied (users.shop_id exists). Nothing was changed.';
  end if;
end $$;

-- ── 1. shops (tenants) ──────────────────────────────────────────────────────
create table public.shops (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(trim(name)) > 0),
  code            text not null unique check (code ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  timezone        text not null default 'Asia/Kolkata',
  support_contact text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
alter table public.shops enable row level security;

-- Shop #1 = the existing client. Fixed id so every existing row maps to it.
insert into public.shops (id, name, code, timezone, support_contact)
values ('00000000-0000-0000-0000-000000000001', 'Sampath Super Market', 'sampath', 'Asia/Kolkata', 'kk');

-- ── 2. attach every existing row to Shop #1 ────────────────────────────────
-- A constant default is stored in the catalog: existing rows read it without
-- a table rewrite. The default is dropped again at the end of this script so
-- a future bug can never silently put a new shop's data into Shop #1.
alter table public.users             add column shop_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.shops(id);
alter table public.agencies          add column shop_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.shops(id);
alter table public.products          add column shop_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.shops(id);
alter table public.stock_submissions add column shop_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.shops(id);

-- ── 3. constraints: uniqueness per shop + cross-shop references impossible ─
-- Agency names were unique across the whole database; they must be unique
-- per shop so two shops can both have e.g. "Nestle".
alter table public.agencies drop constraint agencies_name_key;
alter table public.agencies add constraint agencies_shop_name_key unique (shop_id, name);

alter table public.agencies add constraint agencies_id_shop_key unique (id, shop_id);
alter table public.users    add constraint users_id_shop_key    unique (id, shop_id);

-- A product's agency, a submission's agency and a submission's author must
-- all be in the same shop as the row itself — enforced by the database.
alter table public.products add constraint products_agency_same_shop_fkey
  foreign key (agency_id, shop_id) references public.agencies(id, shop_id) on delete cascade;
alter table public.stock_submissions add constraint stock_submissions_agency_same_shop_fkey
  foreign key (agency_id, shop_id) references public.agencies(id, shop_id);
alter table public.stock_submissions add constraint stock_submissions_user_same_shop_fkey
  foreign key (submitted_by, shop_id) references public.users(id, shop_id);

-- ── 4. indexes (none existed beyond PK/unique) ─────────────────────────────
create index users_shop_idx                    on public.users(shop_id);
create index products_shop_idx                 on public.products(shop_id);
create index stock_submissions_shop_time_idx   on public.stock_submissions(shop_id, submitted_at desc);
create index stock_submissions_agency_time_idx on public.stock_submissions(agency_id, submitted_at desc);
create index stock_submissions_user_idx        on public.stock_submissions(submitted_by);
create index stock_submission_items_sub_idx    on public.stock_submission_items(submission_id);
create index sessions_user_idx                 on public.sessions(user_id);

-- ── 5. platform owner (you) — completely separate from shop users ──────────
create table public.platform_admins (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  username      text not null unique,
  password_hash text not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
create table public.platform_sessions (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid not null references public.platform_admins(id) on delete cascade,
  token      uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index platform_sessions_admin_idx on public.platform_sessions(admin_id);
alter table public.platform_admins   enable row level security;
alter table public.platform_sessions enable row level security;

-- ── 6. lock tables: the app only ever goes through SECURITY DEFINER RPCs ───
-- RLS (no policies) already blocks anon; revoking privileges is a second wall.
revoke all on public.users, public.sessions, public.agencies, public.products,
              public.stock_submissions, public.stock_submission_items,
              public.shops, public.platform_admins, public.platform_sessions
  from anon, authenticated;

-- =============================================================================
-- 7. internal helpers
-- =============================================================================

drop function public._auth(uuid, text[]);

create function public._auth(p_token uuid, p_roles text[] default null)
returns table(user_id uuid, user_name text, user_role text, shop_id uuid)
language plpgsql security definer set search_path = public, extensions
as $$
#variable_conflict use_column
declare v record;
begin
  if p_token is null then raise exception 'Not logged in'; end if;
  select u.id, u.name, u.role, u.shop_id, u.is_active as user_active, sh.is_active as shop_active
    into v
  from sessions s
  join users u  on u.id = s.user_id
  join shops sh on sh.id = u.shop_id
  where s.token = p_token and s.expires_at > now();
  if v.id is null then raise exception 'Session expired, please log in again'; end if;
  if not v.user_active then raise exception 'Your account has been deactivated'; end if;
  if not v.shop_active then raise exception 'This shop account is suspended. Please contact support.'; end if;
  if p_roles is not null and not (v.role = any(p_roles)) then
    raise exception 'You do not have permission to do this';
  end if;
  return query select v.id, v.name, v.role, v.shop_id;
end;
$$;

create function public._shop_tz(p_shop_id uuid)
returns text language sql stable security definer set search_path = public
as $$ select coalesce((select timezone from shops where id = p_shop_id), 'UTC') $$;

create function public._platform_auth(p_token uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if p_token is null then raise exception 'Not logged in'; end if;
  select a.id into v_id
  from platform_sessions s join platform_admins a on a.id = s.admin_id
  where s.token = p_token and s.expires_at > now() and a.is_active;
  if v_id is null then raise exception 'Session expired, please log in again'; end if;
  return v_id;
end;
$$;

revoke all on function public._auth(uuid, text[]) from public, anon, authenticated;
revoke all on function public._shop_tz(uuid)      from public, anon, authenticated;
revoke all on function public._platform_auth(uuid) from public, anon, authenticated;

-- =============================================================================
-- 8. auth RPCs (return type extended with shop info → drop + create)
-- =============================================================================

drop function public.login(text, text);
create function public.login(p_username text, p_password text)
returns table(token uuid, user_id uuid, name text, username text, role text,
              shop_id uuid, shop_name text, shop_code text, support_contact text)
language plpgsql security definer set search_path = public, extensions
as $$
#variable_conflict use_column
declare v record; v_token uuid;
begin
  select u.id, u.name, u.username, u.role, u.password_hash, u.is_active, u.shop_id,
         sh.name as shop_name, sh.code as shop_code, sh.is_active as shop_active, sh.support_contact
    into v
  from users u join shops sh on sh.id = u.shop_id
  where u.username = lower(trim(p_username));
  if v.id is null or v.password_hash <> crypt(p_password, v.password_hash) then
    raise exception 'Incorrect username or password';
  end if;
  if not v.is_active then raise exception 'Your account has been deactivated. Please contact your shop admin.'; end if;
  if not v.shop_active then raise exception 'This shop account is suspended. Please contact support.'; end if;
  delete from sessions s where s.user_id = v.id and s.expires_at < now();
  insert into sessions(user_id, expires_at) values (v.id, now() + interval '30 days')
  returning sessions.token into v_token;
  return query select v_token, v.id, v.name, v.username, v.role,
                      v.shop_id, v.shop_name, v.shop_code, v.support_contact;
end;
$$;

drop function public.validate_session(uuid);
create function public.validate_session(p_token uuid)
returns table(user_id uuid, name text, username text, role text,
              shop_id uuid, shop_name text, shop_code text, support_contact text)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare v record;
begin
  select u.id, u.name, u.username, u.role, u.is_active, u.shop_id,
         sh.name as shop_name, sh.code as shop_code, sh.is_active as shop_active, sh.support_contact
    into v
  from sessions s
  join users u  on u.id = s.user_id
  join shops sh on sh.id = u.shop_id
  where s.token = p_token and s.expires_at > now();
  if v.id is null then raise exception 'Session expired'; end if;
  if not v.is_active or not v.shop_active then raise exception 'Session expired'; end if;
  return query select v.id, v.name, v.username, v.role, v.shop_id, v.shop_name, v.shop_code, v.support_contact;
end;
$$;

-- logout(uuid) is unchanged.

-- =============================================================================
-- 9. users (super_admin of the shop)
-- =============================================================================

create or replace function public.get_users(p_token text)
returns table(id uuid, name text, username text, role text, created_at timestamptz, is_active boolean)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare me record;
begin
  select * into me from _auth(p_token::uuid, array['super_admin']);
  return query
  select u.id, u.name, u.username, u.role, u.created_at, u.is_active
  from users u where u.shop_id = me.shop_id
  order by u.role, lower(u.name);
end;
$$;

create or replace function public.create_user(p_token uuid, p_name text, p_username text, p_password text, p_role text)
returns uuid language plpgsql security definer set search_path = public, extensions
as $$
declare me record; v_id uuid;
begin
  select * into me from _auth(p_token, array['super_admin']);
  if length(trim(p_password)) < 6 then raise exception 'Password must be at least 6 characters'; end if;
  insert into users(name, username, password_hash, role, shop_id)
  values (trim(p_name), lower(trim(p_username)), crypt(p_password, gen_salt('bf')), p_role, me.shop_id)
  returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'That username is already taken';
end;
$$;

create or replace function public.update_user(p_token uuid, p_user_id uuid, p_name text, p_username text, p_role text)
returns void language plpgsql security definer set search_path = public
as $$
declare me record;
begin
  select * into me from _auth(p_token, array['super_admin']);
  if p_user_id = me.user_id and p_role is distinct from me.user_role then
    raise exception 'You cannot change your own role';
  end if;
  update users set name = trim(p_name), username = lower(trim(p_username)), role = p_role
  where id = p_user_id and shop_id = me.shop_id;
  if not found then raise exception 'User not found'; end if;
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
  update users set password_hash = crypt(p_new_password, gen_salt('bf'))
  where id = p_user_id and shop_id = me.shop_id;
  if not found then raise exception 'User not found'; end if;
  delete from sessions s where s.user_id = p_user_id;
end;
$$;

create or replace function public.deactivate_user(p_token text, p_user_id text)
returns void language plpgsql security definer set search_path = public
as $$
declare me record;
begin
  select * into me from _auth(p_token::uuid, array['super_admin']);
  if me.user_id = p_user_id::uuid then raise exception 'Cannot deactivate your own account'; end if;
  update users set is_active = false where id = p_user_id::uuid and shop_id = me.shop_id;
  if not found then raise exception 'User not found'; end if;
  delete from sessions where user_id = p_user_id::uuid;
end;
$$;

create or replace function public.reactivate_user(p_token text, p_user_id text)
returns void language plpgsql security definer set search_path = public
as $$
declare me record;
begin
  select * into me from _auth(p_token::uuid, array['super_admin']);
  update users set is_active = true where id = p_user_id::uuid and shop_id = me.shop_id;
  if not found then raise exception 'User not found'; end if;
end;
$$;

create or replace function public.delete_user(p_token uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare me record;
begin
  select * into me from _auth(p_token, array['super_admin']);
  if me.user_id = p_user_id then raise exception 'You cannot delete your own account'; end if;
  delete from users where id = p_user_id and shop_id = me.shop_id;
  if not found then raise exception 'User not found'; end if;
exception when foreign_key_violation then
  raise exception 'This user has stock submissions. Deactivate the user instead.';
end;
$$;

-- =============================================================================
-- 10. agencies
-- =============================================================================

create or replace function public.get_active_agencies(p_token uuid)
returns table(id uuid, name text)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare me record;
begin
  select * into me from _auth(p_token, array['super_admin','admin','staff']);
  return query select a.id, a.name from agencies a
  where a.shop_id = me.shop_id and a.is_active order by lower(a.name);
end;
$$;

create or replace function public.get_all_agencies_admin(p_token uuid)
returns table(id uuid, name text, is_active boolean, whatsapp_number text, created_at timestamptz)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare me record;
begin
  select * into me from _auth(p_token, array['super_admin','admin']);
  return query
  select a.id, a.name, a.is_active, a.whatsapp_number, a.created_at
  from agencies a where a.shop_id = me.shop_id order by a.name;
end;
$$;

create or replace function public.create_agency(p_token uuid, p_name text, p_whatsapp text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare me record;
begin
  select * into me from _auth(p_token, array['super_admin']);
  insert into agencies (name, whatsapp_number, is_active, shop_id)
  values (p_name, p_whatsapp, true, me.shop_id);
exception when unique_violation then raise exception 'An agency with this name already exists';
end;
$$;

create or replace function public.update_agency(p_token uuid, p_agency_id uuid, p_name text, p_is_active boolean, p_whatsapp text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare me record;
begin
  select * into me from _auth(p_token, array['super_admin']);
  update agencies set name = p_name, is_active = p_is_active, whatsapp_number = p_whatsapp
  where id = p_agency_id and shop_id = me.shop_id;
  if not found then raise exception 'Agency not found'; end if;
exception when unique_violation then raise exception 'An agency with this name already exists';
end;
$$;

create or replace function public.delete_agency(p_token uuid, p_agency_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare me record;
begin
  select * into me from _auth(p_token, array['super_admin']);
  update agencies set is_active = false where id = p_agency_id and shop_id = me.shop_id;
  if not found then raise exception 'Agency not found'; end if;
  update products set is_active = false where agency_id = p_agency_id and shop_id = me.shop_id;
end;
$$;

-- =============================================================================
-- 11. products
-- =============================================================================

create or replace function public.get_products_by_agency(p_token uuid, p_agency_id uuid)
returns table(id uuid, name text)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare me record;
begin
  select * into me from _auth(p_token, array['super_admin','admin','staff']);
  return query select pr.id, pr.name from products pr
  where pr.agency_id = p_agency_id and pr.shop_id = me.shop_id and pr.is_active
  order by lower(pr.name);
end;
$$;

create or replace function public.get_all_products_admin(p_token uuid)
returns table(id uuid, name text, is_active boolean, agency_id uuid, agency_name text)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare me record;
begin
  select * into me from _auth(p_token, array['super_admin']);
  return query select pr.id, pr.name, pr.is_active, pr.agency_id, a.name
  from products pr join agencies a on a.id = pr.agency_id
  where pr.shop_id = me.shop_id
  order by lower(a.name), lower(pr.name);
end;
$$;

create or replace function public.create_product(p_token uuid, p_agency_id uuid, p_name text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare me record; v_id uuid;
begin
  select * into me from _auth(p_token, array['super_admin']);
  if not exists (select 1 from agencies where id = p_agency_id and shop_id = me.shop_id) then
    raise exception 'Agency not found';
  end if;
  insert into products(agency_id, name, shop_id) values (p_agency_id, trim(p_name), me.shop_id)
  returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'That agency already has a product with this name';
end;
$$;

create or replace function public.update_product(p_token uuid, p_product_id uuid, p_name text, p_agency_id uuid, p_is_active boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare me record;
begin
  select * into me from _auth(p_token, array['super_admin']);
  if not exists (select 1 from agencies where id = p_agency_id and shop_id = me.shop_id) then
    raise exception 'Agency not found';
  end if;
  update products set name = trim(p_name), agency_id = p_agency_id, is_active = p_is_active
  where id = p_product_id and shop_id = me.shop_id;
  if not found then raise exception 'Product not found'; end if;
exception when unique_violation then raise exception 'That agency already has a product with this name';
end;
$$;

create or replace function public.delete_product(p_token uuid, p_product_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare me record;
begin
  select * into me from _auth(p_token, array['super_admin']);
  update products set is_active = false where id = p_product_id and shop_id = me.shop_id;
  if not found then raise exception 'Product not found'; end if;
end;
$$;

-- =============================================================================
-- 12. stock submissions
-- =============================================================================

create or replace function public.submit_stock(p_token uuid, p_agency_id uuid, p_items jsonb)
returns uuid language plpgsql security definer set search_path = public
as $$
declare me record; v_submission_id uuid;
begin
  select * into me from _auth(p_token, array['staff']);
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Enter at least one product quantity before submitting';
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

-- Latest submission made *today in the shop's timezone* for this agency.
create or replace function public.get_today_submission(p_token uuid, p_agency_id uuid)
returns table(product_id uuid, quantity integer)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare me record; v_tz text; v_sub uuid;
begin
  select * into me from _auth(p_token, array['staff','admin','super_admin']);
  v_tz := _shop_tz(me.shop_id);
  select ss.id into v_sub from stock_submissions ss
  where ss.agency_id = p_agency_id and ss.shop_id = me.shop_id
    and (ss.submitted_at at time zone v_tz)::date = (now() at time zone v_tz)::date
  order by ss.submitted_at desc limit 1;
  return query select si.product_id, si.quantity
  from stock_submission_items si where si.submission_id = v_sub;
end;
$$;

create or replace function public.get_agency_products_with_qty(p_token uuid, p_agency_id uuid)
returns table(id uuid, name text, quantity integer, submitted_at timestamptz, submitted_by text)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare me record; v_submission_id uuid;
begin
  select * into me from _auth(p_token, array['admin','super_admin']);
  select ss.id into v_submission_id from stock_submissions ss
  where ss.agency_id = p_agency_id and ss.shop_id = me.shop_id
    and ss.submitted_at >= now() - interval '4 days'
  order by ss.submitted_at desc limit 1;

  if v_submission_id is null then
    return query
      select pr.id, pr.name, 0::integer, null::timestamptz, null::text
      from products pr
      where pr.agency_id = p_agency_id and pr.shop_id = me.shop_id and pr.is_active
      order by lower(pr.name);
  else
    return query
      select pr.id, pr.name, coalesce(si.quantity, 0), ss.submitted_at, u.name
      from products pr
      left join stock_submission_items si on si.product_id = pr.id and si.submission_id = v_submission_id
      left join stock_submissions ss on ss.id = v_submission_id
      left join users u on u.id = ss.submitted_by
      where pr.agency_id = p_agency_id and pr.shop_id = me.shop_id and pr.is_active
      order by lower(pr.name);
  end if;
end;
$$;

drop function public.get_agency_status(uuid);
create function public.get_agency_status(p_token uuid)
returns table(agency_id uuid, agency_name text, status text, last_updated_by text,
              last_updated_at timestamptz, submitted_today boolean)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare me record; v_tz text;
begin
  select * into me from _auth(p_token, array['super_admin','admin']);
  v_tz := _shop_tz(me.shop_id);
  return query
  select a.id, a.name,
    case when latest.submitted_at is null then 'Pending' else 'Updated' end,
    u.name, latest.submitted_at,
    coalesce((latest.submitted_at at time zone v_tz)::date = (now() at time zone v_tz)::date, false)
  from agencies a
  left join lateral (
    select ss.submitted_at, ss.submitted_by from stock_submissions ss
    where ss.agency_id = a.id order by ss.submitted_at desc limit 1
  ) latest on true
  left join users u on u.id = latest.submitted_by
  where a.shop_id = me.shop_id and a.is_active
  order by lower(a.name);
end;
$$;

drop function public.get_admin_counts(uuid);
create function public.get_admin_counts(p_token uuid)
returns table(total_agencies bigint, updated_agencies bigint, pending_agencies bigint,
              submitted_today bigint, total_products bigint, total_submissions bigint)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare me record; v_tz text;
begin
  select * into me from _auth(p_token, array['super_admin','admin']);
  v_tz := _shop_tz(me.shop_id);
  return query
  select count(*),
    count(*) filter (where latest.submitted_at is not null),
    count(*) filter (where latest.submitted_at is null),
    count(*) filter (where (latest.submitted_at at time zone v_tz)::date = (now() at time zone v_tz)::date),
    (select count(*) from products p where p.shop_id = me.shop_id and p.is_active),
    (select count(*) from stock_submissions s where s.shop_id = me.shop_id)
  from agencies a
  left join lateral (
    select ss.submitted_at from stock_submissions ss
    where ss.agency_id = a.id order by ss.submitted_at desc limit 1
  ) latest on true
  where a.shop_id = me.shop_id and a.is_active;
end;
$$;

create or replace function public.get_recent_submissions(p_token uuid, p_limit integer default 10)
returns table(submission_id uuid, agency_name text, submitted_by_name text, submitted_at timestamptz)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare me record;
begin
  select * into me from _auth(p_token, array['super_admin','admin']);
  return query select ss.id, a.name, u.name, ss.submitted_at
  from stock_submissions ss
  join agencies a on a.id = ss.agency_id
  join users u on u.id = ss.submitted_by
  where ss.shop_id = me.shop_id
  order by ss.submitted_at desc limit least(greatest(coalesce(p_limit, 10), 1), 500);
end;
$$;

create or replace function public.get_submission_history(p_token uuid, p_agency_id uuid)
returns table(submission_id uuid, submitted_by_name text, submitted_at timestamptz)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare me record;
begin
  select * into me from _auth(p_token, array['super_admin','admin']);
  return query select ss.id, u.name, ss.submitted_at
  from stock_submissions ss join users u on u.id = ss.submitted_by
  where ss.agency_id = p_agency_id and ss.shop_id = me.shop_id
  order by ss.submitted_at desc;
end;
$$;

create or replace function public.get_submission_detail(p_token uuid, p_submission_id uuid)
returns table(agency_name text, submitted_by_name text, submitted_at timestamptz, product_name text, quantity integer)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare me record;
begin
  select * into me from _auth(p_token, array['super_admin','admin']);
  return query
  select a.name, u.name, ss.submitted_at, pr.name, si.quantity
  from stock_submissions ss
  join agencies a on a.id = ss.agency_id
  join users u on u.id = ss.submitted_by
  join stock_submission_items si on si.submission_id = ss.id
  join products pr on pr.id = si.product_id
  where ss.id = p_submission_id and ss.shop_id = me.shop_id
  order by lower(pr.name);
end;
$$;

-- Was unauthenticated. Now: logged-in user, own shop only. Keeps the current
-- behaviour of showing the shop's latest 50 submissions.
create or replace function public.get_staff_submission_history(p_token uuid)
returns table(id uuid, agency_name text, total_items bigint, date timestamptz)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare me record;
begin
  select * into me from _auth(p_token, array['staff','admin','super_admin']);
  return query
  select s.id, a.name::text,
    coalesce((select sum(si.quantity) from stock_submission_items si where si.submission_id = s.id), 0)::bigint,
    s.submitted_at
  from stock_submissions s join agencies a on a.id = s.agency_id
  where s.shop_id = me.shop_id
  order by s.submitted_at desc limit 50;
end;
$$;

-- Was unauthenticated. Now: logged-in user, own shop only.
create or replace function public.get_staff_submission_detail(p_token uuid, p_submission_id uuid)
returns table(agency_name text, submitted_by_name text, submitted_at timestamptz, product_name text, quantity bigint)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare me record;
begin
  select * into me from _auth(p_token, array['staff','admin','super_admin']);
  return query
  select coalesce(a.name, 'Unknown Agency')::text,
         coalesce(u.name, 'Staff Member')::text,
         s.submitted_at,
         coalesce(p.name, 'Unknown Product')::text,
         coalesce(si.quantity, 0)::bigint
  from stock_submissions s
  left join agencies a on s.agency_id = a.id
  left join users u on s.submitted_by = u.id
  left join stock_submission_items si on s.id = si.submission_id
  left join products p on si.product_id = p.id
  where s.id = p_submission_id and s.shop_id = me.shop_id;
end;
$$;

-- Counts now exclude deactivated users (matches the Manage Users screen).
create or replace function public.get_super_admin_counts(p_token uuid)
returns table(total_admins bigint, total_staff bigint, total_agencies bigint, total_products bigint, total_submissions bigint)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare me record;
begin
  select * into me from _auth(p_token, array['super_admin']);
  return query select
    (select count(*) from users u    where u.shop_id = me.shop_id and u.role = 'admin' and u.is_active),
    (select count(*) from users u    where u.shop_id = me.shop_id and u.role = 'staff' and u.is_active),
    (select count(*) from agencies a where a.shop_id = me.shop_id and a.is_active),
    (select count(*) from products p where p.shop_id = me.shop_id and p.is_active),
    (select count(*) from stock_submissions s where s.shop_id = me.shop_id);
end;
$$;

-- =============================================================================
-- 13. platform owner RPCs  (only usable with a platform_sessions token)
-- =============================================================================

create function public.platform_login(p_username text, p_password text)
returns table(token uuid, admin_id uuid, name text, username text)
language plpgsql security definer set search_path = public, extensions
as $$
#variable_conflict use_column
declare v record; v_token uuid;
begin
  select a.* into v from platform_admins a where a.username = lower(trim(p_username));
  if v.id is null or not v.is_active or v.password_hash <> crypt(p_password, v.password_hash) then
    raise exception 'Incorrect username or password';
  end if;
  delete from platform_sessions s where s.admin_id = v.id and s.expires_at < now();
  insert into platform_sessions(admin_id, expires_at) values (v.id, now() + interval '12 hours')
  returning platform_sessions.token into v_token;
  return query select v_token, v.id, v.name, v.username;
end;
$$;

create function public.platform_validate_session(p_token uuid)
returns table(admin_id uuid, name text, username text)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare v_id uuid;
begin
  v_id := _platform_auth(p_token);
  return query select a.id, a.name, a.username from platform_admins a where a.id = v_id;
end;
$$;

create function public.platform_logout(p_token uuid)
returns void language sql security definer set search_path = public
as $$ delete from platform_sessions where token = p_token $$;

create function public.platform_list_shops(p_token uuid)
returns table(id uuid, name text, code text, timezone text, support_contact text, is_active boolean,
              created_at timestamptz, super_admins bigint, admins bigint, staff bigint,
              agencies bigint, products bigint, submissions bigint, last_submission_at timestamptz)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
begin
  perform _platform_auth(p_token);
  return query
  select sh.id, sh.name, sh.code, sh.timezone, sh.support_contact, sh.is_active, sh.created_at,
    (select count(*) from users u where u.shop_id = sh.id and u.role = 'super_admin' and u.is_active),
    (select count(*) from users u where u.shop_id = sh.id and u.role = 'admin' and u.is_active),
    (select count(*) from users u where u.shop_id = sh.id and u.role = 'staff' and u.is_active),
    (select count(*) from agencies a where a.shop_id = sh.id and a.is_active),
    (select count(*) from products p where p.shop_id = sh.id and p.is_active),
    (select count(*) from stock_submissions s where s.shop_id = sh.id),
    (select max(s.submitted_at) from stock_submissions s where s.shop_id = sh.id)
  from shops sh
  order by sh.created_at;
end;
$$;

-- Creates a shop and its first super admin in one step.
create function public.platform_create_shop(
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
  values (trim(p_admin_name), lower(trim(p_admin_username)),
          crypt(p_admin_password, gen_salt('bf')), 'super_admin', v_shop);
  return v_shop;
end;
$$;

-- Suspending a shop logs out all of its users immediately.
create function public.platform_update_shop(
  p_token uuid, p_shop_id uuid, p_name text, p_timezone text, p_support_contact text, p_is_active boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform _platform_auth(p_token);
  if coalesce(trim(p_name), '') = '' then raise exception 'Shop name is required'; end if;
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Unknown timezone: %', p_timezone;
  end if;
  update shops set name = trim(p_name), timezone = p_timezone,
                   support_contact = nullif(trim(p_support_contact), ''), is_active = p_is_active
  where id = p_shop_id;
  if not found then raise exception 'Shop not found'; end if;
  if not p_is_active then
    delete from sessions s using users u where u.id = s.user_id and u.shop_id = p_shop_id;
  end if;
end;
$$;

create function public.platform_get_shop_users(p_token uuid, p_shop_id uuid)
returns table(id uuid, name text, username text, role text, is_active boolean, created_at timestamptz)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
begin
  perform _platform_auth(p_token);
  return query select u.id, u.name, u.username, u.role, u.is_active, u.created_at
  from users u where u.shop_id = p_shop_id
  order by case u.role when 'super_admin' then 0 when 'admin' then 1 else 2 end, lower(u.name);
end;
$$;

create function public.platform_create_shop_user(
  p_token uuid, p_shop_id uuid, p_name text, p_username text, p_password text, p_role text)
returns uuid language plpgsql security definer set search_path = public, extensions
as $$
declare v_id uuid;
begin
  perform _platform_auth(p_token);
  if not exists (select 1 from shops where id = p_shop_id) then raise exception 'Shop not found'; end if;
  if length(trim(coalesce(p_password, ''))) < 6 then raise exception 'Password must be at least 6 characters'; end if;
  insert into users(name, username, password_hash, role, shop_id)
  values (trim(p_name), lower(trim(p_username)), crypt(p_password, gen_salt('bf')), p_role, p_shop_id)
  returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'That username is already taken';
end;
$$;

create function public.platform_reset_user_password(p_token uuid, p_user_id uuid, p_new_password text)
returns void language plpgsql security definer set search_path = public, extensions
as $$
begin
  perform _platform_auth(p_token);
  if length(trim(coalesce(p_new_password, ''))) < 6 then raise exception 'Password must be at least 6 characters'; end if;
  update users set password_hash = crypt(p_new_password, gen_salt('bf')) where id = p_user_id;
  if not found then raise exception 'User not found'; end if;
  delete from sessions where user_id = p_user_id;
end;
$$;

create function public.platform_set_user_active(p_token uuid, p_user_id uuid, p_is_active boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform _platform_auth(p_token);
  update users set is_active = p_is_active where id = p_user_id;
  if not found then raise exception 'User not found'; end if;
  if not p_is_active then delete from sessions where user_id = p_user_id; end if;
end;
$$;

-- ── 14. remove the Shop #1 defaults (see step 2) ────────────────────────────
alter table public.users             alter column shop_id drop default;
alter table public.agencies          alter column shop_id drop default;
alter table public.products          alter column shop_id drop default;
alter table public.stock_submissions alter column shop_id drop default;

commit;
