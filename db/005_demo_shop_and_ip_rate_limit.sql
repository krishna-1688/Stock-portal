-- =============================================================================
-- 005_demo_shop_and_ip_rate_limit.sql
--
-- 1. IP rate limiting on login: besides the per-username lockout from 003,
--    an IP address with too many failed logins (any usernames) is blocked for
--    15 minutes. Stops password spraying across many accounts.
-- 2. Public demo shop "Demo Mart" for GitHub visitors (see /demo in the app):
--      demo_super / demo_admin / demo_staff   password: demo1234
--    * completely separate shop — tenant isolation as for every shop
--    * users cannot be created/changed/deleted in the demo (database trigger)
--    * caps on agencies/products/submissions/orders so it can't be flooded
--    * demo agencies use an invalid WhatsApp number (no real person is messaged)
--    * reset_demo_shop() restores the sample data; scheduled nightly when the
--      pg_cron extension is enabled (see db/README.md)
--
-- SAFE FOR EXISTING SHOPS: their rows are untouched; every trigger returns
-- immediately for any shop other than Demo Mart. One transaction.
-- Requires 003.
-- =============================================================================

begin;

set local lock_timeout = '10s';

do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'login_attempts') then
    raise exception 'Run 003_whatsapp_orders_and_hardening.sql first. Nothing was changed.';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'login_attempts' and column_name = 'ip') then
    raise exception 'Migration 005 has already been applied. Nothing was changed.';
  end if;
  if exists (select 1 from public.users where username in ('demo_super', 'demo_admin', 'demo_staff')) then
    raise exception 'A real user already has a demo username (demo_super/demo_admin/demo_staff). Nothing was changed.';
  end if;
  if exists (select 1 from public.shops where code = 'demo') then
    raise exception 'A shop with code "demo" already exists. Nothing was changed.';
  end if;
end $$;

-- ── 1. IP rate limiting ─────────────────────────────────────────────────────

alter table public.login_attempts add column ip text;
create index login_attempts_ip_idx on public.login_attempts(ip, attempted_at desc) where ip is not null;

-- Client IP from the request headers PostgREST exposes. cf-connecting-ip is set
-- by Cloudflare in front of Supabase and can't be forged by the browser.
-- NULL when there is no HTTP request (SQL editor, cron, tests).
create function public._client_ip()
returns text language sql stable
as $$
  with h as (select nullif(current_setting('request.headers', true), '')::json as j)
  select nullif(trim(coalesce(j ->> 'cf-connecting-ip', j ->> 'x-real-ip', split_part(j ->> 'x-forwarded-for', ',', 1))), '')
  from h
$$;

create function public._ip_blocked(p_ip text, p_max integer)
returns boolean language sql stable security definer set search_path = public
as $$
  select p_ip is not null and (
    select count(*) >= p_max from login_attempts
    where ip = p_ip and attempted_at > now() - interval '15 minutes')
$$;

revoke all on function public._client_ip()                  from public, anon, authenticated;
revoke all on function public._ip_blocked(text, integer)    from public, anon, authenticated;

-- login_v2: as in 003, plus the IP limit. Demo accounts are exempt from the
-- per-username lock (their password is public, so anyone could lock them),
-- but not from the IP limit.
create or replace function public.login_v2(p_username text, p_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare
  v record;
  v_username text := lower(trim(coalesce(p_username, '')));
  v_ip text := _client_ip();
  v_token uuid;
begin
  delete from login_attempts where attempted_at < now() - interval '1 day';

  if _ip_blocked(v_ip, 30) then
    return jsonb_build_object('ok', false, 'error', 'Too many failed attempts from your network. Please wait 15 minutes and try again.');
  end if;

  select u.id, u.name, u.username, u.role, u.password_hash, u.is_active, u.shop_id,
         sh.name as shop_name, sh.code as shop_code, sh.is_active as shop_active, sh.support_contact
    into v
  from users u join shops sh on sh.id = u.shop_id
  where u.username = v_username;

  if v.shop_code is distinct from 'demo' and _login_locked('shop', v_username, 8) then
    return jsonb_build_object('ok', false, 'error', 'Too many failed attempts. Please wait 15 minutes and try again.');
  end if;

  if v.id is null or v.password_hash <> crypt(coalesce(p_password, ''), v.password_hash) then
    insert into login_attempts(kind, username, ip) values ('shop', v_username, v_ip);
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

create or replace function public.platform_login_v2(p_username text, p_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare
  v record;
  v_username text := lower(trim(coalesce(p_username, '')));
  v_ip text := _client_ip();
  v_token uuid;
begin
  delete from login_attempts where attempted_at < now() - interval '1 day';

  if _ip_blocked(v_ip, 10) or _login_locked('platform', v_username, 5) then
    return jsonb_build_object('ok', false, 'error', 'Too many failed attempts. Please wait 15 minutes and try again.');
  end if;

  select a.* into v from platform_admins a where a.username = v_username;
  if v.id is null or not v.is_active or v.password_hash <> crypt(coalesce(p_password, ''), v.password_hash) then
    insert into login_attempts(kind, username, ip) values ('platform', v_username, v_ip);
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

-- ── 2. demo shop ────────────────────────────────────────────────────────────

insert into public.shops (id, name, code, timezone, support_contact)
values ('00000000-0000-0000-0000-0000000000de', 'Demo Mart', 'demo', 'Asia/Kolkata', 'Demo — sample data resets every night');

create function public._is_demo_shop(p_shop_id uuid)
returns boolean language sql immutable
as $$ select p_shop_id = '00000000-0000-0000-0000-0000000000de'::uuid $$;

create function public._demo_resetting()
returns boolean language sql stable
as $$ select coalesce(current_setting('app.demo_reset', true), '') = 'on' $$;

-- users in the demo shop are read-only outside reset_demo_shop()
create function public._demo_guard_users()
returns trigger language plpgsql
as $$
begin
  if _demo_resetting() then return coalesce(new, old); end if;
  if (tg_op <> 'INSERT' and _is_demo_shop(old.shop_id)) or (tg_op <> 'DELETE' and _is_demo_shop(new.shop_id)) then
    raise exception 'Managing users is turned off in the demo.';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger demo_guard_users before insert or update or delete on public.users
  for each row execute function public._demo_guard_users();

-- row caps for the demo shop: tg_argv[0] = maximum rows
create function public._demo_guard_limit()
returns trigger language plpgsql
as $$
declare v_max integer := tg_argv[0]::integer; v_count integer;
begin
  if not _is_demo_shop(new.shop_id) or _demo_resetting() then return new; end if;
  execute format('select count(*) from %I.%I where shop_id = $1', tg_table_schema, tg_table_name)
    into v_count using new.shop_id;
  if v_count >= v_max then
    raise exception 'The demo is full (% max here). It resets every night.', v_max;
  end if;
  return new;
end;
$$;
create trigger demo_guard_limit before insert on public.agencies
  for each row execute function public._demo_guard_limit('40');
create trigger demo_guard_limit before insert on public.products
  for each row execute function public._demo_guard_limit('400');
create trigger demo_guard_limit before insert on public.stock_submissions
  for each row execute function public._demo_guard_limit('1000');
create trigger demo_guard_limit before insert on public.whatsapp_orders
  for each row execute function public._demo_guard_limit('1000');

-- demo agencies always get the invalid number, so WhatsApp never reaches a real person
create function public._demo_guard_whatsapp()
returns trigger language plpgsql
as $$
begin
  if _is_demo_shop(new.shop_id) then new.whatsapp_number := '910000000000'; end if;
  return new;
end;
$$;
create trigger demo_guard_whatsapp before insert or update on public.agencies
  for each row execute function public._demo_guard_whatsapp();

-- Wipes Demo Mart and loads fresh sample data (~10 days of history).
create function public.reset_demo_shop()
returns void language plpgsql security definer set search_path = public, extensions
as $$
declare
  d constant uuid := '00000000-0000-0000-0000-0000000000de';
  tz constant text := 'Asia/Kolkata';
  v_super uuid; v_admin uuid; v_staff uuid;
  v_agency uuid; v_sub uuid;
  a record; day integer; v_at timestamptz; v_items jsonb; v_msg text;
  catalog jsonb := '[
    {"name": "Amrut Dairy Distributors", "products": ["Toned Milk 500ml", "Full Cream Milk 1L", "Curd 400g", "Paneer 200g", "Butter 100g", "Ghee 500ml", "Buttermilk 200ml", "Cheese Slices 10pc"]},
    {"name": "Sunrise Biscuits & Snacks", "products": ["Glucose Biscuits 250g", "Cream Biscuits 120g", "Marie Biscuits 300g", "Salted Crackers 200g", "Potato Chips 52g", "Masala Namkeen 200g", "Butter Cookies 150g", "Chocolate Wafers 75g"]},
    {"name": "Golden Harvest Grains", "products": ["Basmati Rice 5kg", "Sona Masoori Rice 10kg", "Toor Dal 1kg", "Moong Dal 500g", "Chana Dal 1kg", "Wheat Atta 5kg", "Rava 500g", "Poha 500g"]},
    {"name": "CleanHome Supplies", "products": ["Detergent Powder 1kg", "Dishwash Bar 200g", "Floor Cleaner 1L", "Toilet Cleaner 500ml", "Bathing Soap 100g", "Shampoo Sachets 10pc", "Toothpaste 150g", "Hand Wash 200ml"]},
    {"name": "Fresh Sip Beverages", "products": ["Cola 750ml", "Orange Drink 600ml", "Mango Drink 1L", "Club Soda 750ml", "Packaged Water 1L", "Energy Drink 250ml", "Lemon Juice 200ml", "Tea Powder 250g"]},
    {"name": "Spice Route Masalas", "products": ["Turmeric Powder 100g", "Chilli Powder 200g", "Coriander Powder 200g", "Garam Masala 100g", "Sambar Powder 100g", "Mustard Seeds 100g", "Cumin Seeds 100g", "Iodised Salt 1kg"]},
    {"name": "Morning Bakery", "products": ["White Bread 400g", "Brown Bread 400g", "Burger Buns 6pc", "Milk Rusk 200g", "Cake Slice 50g", "Pav 8pc"]}
  ]';
begin
  perform set_config('app.demo_reset', 'on', true);

  delete from whatsapp_orders where shop_id = d;
  delete from stock_submission_items where submission_id in (select id from stock_submissions where shop_id = d);
  delete from stock_submissions where shop_id = d;
  delete from products where shop_id = d;
  delete from agencies where shop_id = d;
  delete from sessions where user_id in (select id from users where shop_id = d);
  delete from users where shop_id = d;
  delete from login_attempts where username in ('demo_super', 'demo_admin', 'demo_staff');

  insert into users(name, username, password_hash, role, shop_id) values ('Priya (Demo Owner)', 'demo_super', _hash_password('demo1234'), 'super_admin', d) returning id into v_super;
  insert into users(name, username, password_hash, role, shop_id) values ('Rahul (Demo Manager)', 'demo_admin', _hash_password('demo1234'), 'admin', d) returning id into v_admin;
  insert into users(name, username, password_hash, role, shop_id) values ('Arjun (Demo Staff)', 'demo_staff', _hash_password('demo1234'), 'staff', d) returning id into v_staff;

  for a in select value as j, ordinality as n from jsonb_array_elements(catalog) with ordinality loop
    insert into agencies(name, whatsapp_number, shop_id) values (a.j ->> 'name', '910000000000', d) returning id into v_agency;
    insert into products(agency_id, name, shop_id)
    select v_agency, p, d from jsonb_array_elements_text(a.j -> 'products') p;

    -- stock counts for the last 10 days (some days skipped); the last two
    -- agencies stay "pending" today so the status screen shows both states
    for day in 0..9 loop
      continue when day = 0 and a.n > 5;
      continue when day > 0 and random() < 0.25;
      v_at := ((now() at time zone tz)::date - day + time '09:00' + (random() * interval '150 minutes')) at time zone tz;
      continue when v_at > now();
      insert into stock_submissions(agency_id, submitted_by, shop_id, submitted_at)
      values (v_agency, v_staff, d, v_at) returning id into v_sub;
      insert into stock_submission_items(submission_id, product_id, quantity)
      select v_sub, pr.id, (random() * 40)::integer from products pr where pr.agency_id = v_agency;
    end loop;

    -- a few past WhatsApp orders for the history screen
    for day in 1..6 loop
      continue when (a.n + day) % 3 <> 0;
      v_at := ((now() at time zone tz)::date - day + time '11:30' + (random() * interval '90 minutes')) at time zone tz;
      select jsonb_agg(jsonb_build_object('product_id', pr.id, 'name', pr.name,
               'qty', 5 + (random() * 20)::integer, 'unit', (array['pcs','box','carton','pack'])[1 + (random() * 3)::integer]))
        into v_items
      from (select id, name from products where agency_id = v_agency order by random() limit 3 + (random() * 2)::integer) pr;
      select format(E'🛒 *Order from Demo Mart*\n📅 %s\n🏪 %s\n\n%s\n\nThank you!',
               to_char(v_at at time zone tz, 'FMDD FMMonth YYYY'), a.j ->> 'name',
               string_agg(format('• %s — %s %s', i ->> 'name', i ->> 'qty', i ->> 'unit'), E'\n'))
        into v_msg
      from jsonb_array_elements(v_items) i;
      insert into whatsapp_orders(shop_id, agency_id, agency_name, whatsapp_number, sent_by, items, message, sent_at)
      values (d, v_agency, a.j ->> 'name', '910000000000', v_admin, v_items, v_msg, v_at);
    end loop;
  end loop;
end;
$$;

revoke all on function public.reset_demo_shop() from public, anon, authenticated;
revoke all on function public._is_demo_shop(uuid) from public, anon, authenticated;
revoke all on function public._demo_resetting() from public, anon, authenticated;

select public.reset_demo_shop();

-- nightly reset at 02:00 IST, if pg_cron is enabled (Database → Extensions)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('reset-demo-shop', '30 20 * * *', 'select public.reset_demo_shop()');
  else
    raise notice 'pg_cron is not enabled: the demo will not reset automatically. See db/README.md.';
  end if;
end $$;

commit;
