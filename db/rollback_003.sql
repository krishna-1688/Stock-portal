-- =============================================================================
-- rollback_003.sql  —  EMERGENCY ONLY: undo 003_whatsapp_orders_and_hardening.sql
--
-- Restores the 001 versions of the changed functions and removes everything
-- 003 added. WARNING: this deletes the WhatsApp order history table.
-- Passwords re-hashed at cost 10 keep working (bcrypt stores its cost).
-- If 004 was applied, run 001's login/platform_login definitions first.
-- One transaction.
-- =============================================================================

begin;

set local lock_timeout = '10s';

do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'whatsapp_orders') then
    raise exception 'Migration 003 is not applied. Nothing to roll back.';
  end if;
end $$;

drop function if exists public.get_whatsapp_orders(uuid, uuid, timestamptz, integer);
drop function if exists public.log_whatsapp_order(uuid, uuid, jsonb, text);
drop function if exists public.login_v2(text, text);
drop function if exists public.platform_login_v2(text, text);
drop table if exists public.whatsapp_orders;
drop table if exists public.login_attempts;

alter table public.users    drop constraint if exists users_name_len;
alter table public.users    drop constraint if exists users_username_len;
alter table public.agencies drop constraint if exists agencies_name_len;
alter table public.agencies drop constraint if exists agencies_whatsapp_len;
alter table public.products drop constraint if exists products_name_len;
alter table public.shops    drop constraint if exists shops_name_len;
alter table public.shops    drop constraint if exists shops_contact_len;

-- 001 versions (verbatim)
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
  values (trim(p_admin_name), lower(trim(p_admin_username)),
          crypt(p_admin_password, gen_salt('bf')), 'super_admin', v_shop);
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
  values (trim(p_name), lower(trim(p_username)), crypt(p_password, gen_salt('bf')), p_role, p_shop_id)
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
  update users set password_hash = crypt(p_new_password, gen_salt('bf')) where id = p_user_id;
  if not found then raise exception 'User not found'; end if;
  delete from sessions where user_id = p_user_id;
end;
$$;

drop function if exists public._login_locked(text, text, integer);
drop function if exists public._hash_is_weak(text);
drop function if exists public._hash_password(text);

commit;
