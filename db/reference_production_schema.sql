-- =============================================================================
-- reference_production_schema.sql
--
-- REFERENCE ONLY — DO NOT RUN ON PRODUCTION.
--
-- Exact replica of the production database as it was BEFORE the multi-tenant
-- migration (exported 2026-10-07 from information_schema / pg_proc /
-- pg_constraint). It exists so that:
--   1. the migration can be tested on a blank database first, and
--   2. we have a record of every original function for rollback / comparison.
-- =============================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto schema extensions;

-- ── tables ──────────────────────────────────────────────────────────────────

create table public.users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  username      text not null unique,
  password_hash text not null,
  role          text not null check (role = any (array['super_admin','admin','staff'])),
  created_at    timestamptz not null default now(),
  is_active     boolean not null default true
);

create table public.sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  token      uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index idx_sessions_token on public.sessions(token);

create table public.agencies (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  whatsapp_number text
);

create table public.products (
  id         uuid primary key default gen_random_uuid(),
  agency_id  uuid not null references public.agencies(id) on delete cascade,
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (agency_id, name)
);

create table public.stock_submissions (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references public.agencies(id) on delete restrict,
  submitted_by uuid not null references public.users(id) on delete restrict,
  submitted_at timestamptz not null default now()
);

create table public.stock_submission_items (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.stock_submissions(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete restrict,
  quantity      integer not null check (quantity >= 0)
);

alter table public.users                  enable row level security;
alter table public.sessions               enable row level security;
alter table public.agencies               enable row level security;
alter table public.products               enable row level security;
alter table public.stock_submissions      enable row level security;
alter table public.stock_submission_items enable row level security;

-- ── original functions (verbatim) ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._auth(p_token uuid, p_roles text[] DEFAULT NULL::text[])
 RETURNS TABLE(user_id uuid, user_name text, user_role text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
declare v_user_id uuid; v_name text; v_role text;
begin
  if p_token is null then raise exception 'Not logged in'; end if;
  select u.id, u.name, u.role into v_user_id, v_name, v_role
  from sessions s join users u on u.id = s.user_id
  where s.token = p_token and s.expires_at > now();
  if v_user_id is null then raise exception 'Session expired, please log in again'; end if;
  if p_roles is not null and not (v_role = any(p_roles)) then
    raise exception 'You do not have permission to do this';
  end if;
  return query select v_user_id, v_name, v_role;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_agency(p_token uuid, p_name text, p_whatsapp text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'extensions', 'public'
AS $function$
DECLARE v_role TEXT;
BEGIN
  SELECT u.role INTO v_role FROM sessions s JOIN users u ON u.id = s.user_id
  WHERE s.token = p_token AND s.expires_at > NOW();
  IF v_role IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF v_role != 'super_admin' THEN RAISE EXCEPTION 'Forbidden: super_admin only'; END IF;
  INSERT INTO agencies (name, whatsapp_number, is_active) VALUES (p_name, p_whatsapp, TRUE);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_product(p_token uuid, p_agency_id uuid, p_name text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_id uuid;
begin
  perform _auth(p_token, array['super_admin']);
  insert into products(agency_id, name) values (p_agency_id, trim(p_name)) returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'That agency already has a product with this name';
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_user(p_token uuid, p_name text, p_username text, p_password text, p_role text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
declare v_id uuid;
begin
  perform _auth(p_token, array['super_admin']);
  if length(trim(p_password)) < 6 then raise exception 'Password must be at least 6 characters'; end if;
  insert into users(name, username, password_hash, role)
  values (trim(p_name), lower(trim(p_username)), crypt(p_password, gen_salt('bf')), p_role)
  returning id into v_id;
  return v_id;
exception when unique_violation then raise exception 'That username is already taken';
end;
$function$;

CREATE OR REPLACE FUNCTION public.deactivate_user(p_token text, p_user_id text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE v_caller RECORD;
BEGIN
  SELECT u.id, u.role INTO v_caller FROM sessions s JOIN users u ON u.id = s.user_id
  WHERE s.token = p_token::uuid AND s.expires_at > NOW();
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or expired session'; END IF;
  IF v_caller.role != 'super_admin' THEN RAISE EXCEPTION 'Permission denied'; END IF;
  IF v_caller.id = p_user_id::uuid THEN RAISE EXCEPTION 'Cannot deactivate your own account'; END IF;
  UPDATE users SET is_active = false WHERE id = p_user_id::uuid;
  DELETE FROM sessions WHERE user_id = p_user_id::uuid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_agency(p_token uuid, p_agency_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  perform _auth(p_token, array['super_admin']);
  update agencies set is_active = false where id = p_agency_id;
  update products set is_active = false where agency_id = p_agency_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_product(p_token uuid, p_product_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  perform _auth(p_token, array['super_admin']);
  update products set is_active = false where id = p_product_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_user(p_token uuid, p_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_actor uuid;
begin
  select user_id into v_actor from _auth(p_token, array['super_admin']);
  if v_actor = p_user_id then raise exception 'You cannot delete your own account'; end if;
  delete from users where id = p_user_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_active_agencies(p_token uuid)
 RETURNS TABLE(id uuid, name text) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  perform _auth(p_token, array['super_admin','admin','staff']);
  return query select a.id, a.name from agencies a where a.is_active order by lower(a.name);
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_counts(p_token uuid)
 RETURNS TABLE(total_agencies bigint, updated_agencies bigint, pending_agencies bigint)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  perform _auth(p_token, array['super_admin','admin']);
  return query
  select count(*),
    count(*) filter (where latest.submitted_at is not null),
    count(*) filter (where latest.submitted_at is null)
  from agencies a
  left join lateral (
    select ss.submitted_at from stock_submissions ss
    where ss.agency_id = a.id order by ss.submitted_at desc limit 1
  ) latest on true
  where a.is_active;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_agency_products_with_qty(p_token uuid, p_agency_id uuid)
 RETURNS TABLE(id uuid, name text, quantity integer, submitted_at timestamp with time zone, submitted_by text)
 LANGUAGE plpgsql SECURITY DEFINER
AS $function$
declare v_submission_id uuid;
begin
  perform _auth(p_token, array['admin','super_admin']);
  select ss.id into v_submission_id from stock_submissions ss
  where ss.agency_id = p_agency_id and ss.submitted_at >= now() - interval '4 days'
  order by ss.submitted_at desc limit 1;
  if v_submission_id is null then
    return query
      select pr.id, pr.name, 0::integer, null::timestamptz, null::text
      from products pr where pr.agency_id = p_agency_id and pr.is_active order by lower(pr.name);
  else
    return query
      select pr.id, pr.name, coalesce(si.quantity, 0), ss.submitted_at, u.name
      from products pr
      left join stock_submission_items si on si.product_id = pr.id and si.submission_id = v_submission_id
      left join stock_submissions ss on ss.id = v_submission_id
      left join users u on u.id = ss.submitted_by
      where pr.agency_id = p_agency_id and pr.is_active
      order by lower(pr.name);
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_agency_status(p_token uuid)
 RETURNS TABLE(agency_id uuid, agency_name text, status text, last_updated_by text, last_updated_at timestamp with time zone)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  perform _auth(p_token, array['super_admin','admin']);
  return query
  select a.id, a.name,
    case when latest.submitted_at is null then 'Pending' else 'Updated' end,
    u.name, latest.submitted_at
  from agencies a
  left join lateral (
    select ss.submitted_at, ss.submitted_by from stock_submissions ss
    where ss.agency_id = a.id order by ss.submitted_at desc limit 1
  ) latest on true
  left join users u on u.id = latest.submitted_by
  where a.is_active order by lower(a.name);
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_agencies_admin(p_token uuid)
 RETURNS TABLE(id uuid, name text, is_active boolean, whatsapp_number text, created_at timestamp with time zone)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'extensions', 'public'
AS $function$
DECLARE v_role TEXT;
BEGIN
  SELECT u.role INTO v_role FROM sessions s JOIN users u ON u.id = s.user_id
  WHERE s.token = p_token AND s.expires_at > NOW();
  IF v_role IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF v_role NOT IN ('super_admin', 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY SELECT a.id, a.name, a.is_active, a.whatsapp_number, a.created_at FROM agencies a ORDER BY a.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_products_admin(p_token uuid)
 RETURNS TABLE(id uuid, name text, is_active boolean, agency_id uuid, agency_name text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  perform _auth(p_token, array['super_admin']);
  return query select pr.id, pr.name, pr.is_active, pr.agency_id, a.name
  from products pr join agencies a on a.id = pr.agency_id
  order by lower(a.name), lower(pr.name);
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_products_by_agency(p_token uuid, p_agency_id uuid)
 RETURNS TABLE(id uuid, name text) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  perform _auth(p_token, array['super_admin','admin','staff']);
  return query select pr.id, pr.name from products pr
  where pr.agency_id = p_agency_id and pr.is_active order by lower(pr.name);
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_recent_submissions(p_token uuid, p_limit integer DEFAULT 10)
 RETURNS TABLE(submission_id uuid, agency_name text, submitted_by_name text, submitted_at timestamp with time zone)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  perform _auth(p_token, array['super_admin','admin']);
  return query select ss.id, a.name, u.name, ss.submitted_at
  from stock_submissions ss
  join agencies a on a.id = ss.agency_id
  join users u on u.id = ss.submitted_by
  order by ss.submitted_at desc limit p_limit;
end;
$function$;

-- NOTE: production version had NO auth check (security hole).
CREATE OR REPLACE FUNCTION public.get_staff_submission_detail(p_token uuid, p_submission_id uuid)
 RETURNS TABLE(agency_name text, submitted_by_name text, submitted_at timestamp with time zone, product_name text, quantity bigint)
 LANGUAGE plpgsql SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT COALESCE(a.name, 'Unknown Agency')::TEXT, COALESCE(u.name, 'Staff Member')::TEXT,
    s.submitted_at::TIMESTAMPTZ, COALESCE(p.name, 'Unknown Product')::TEXT, COALESCE(si.quantity, 0)::BIGINT
  FROM stock_submissions s
  LEFT JOIN agencies a ON s.agency_id = a.id
  LEFT JOIN users u ON s.submitted_by = u.id
  LEFT JOIN stock_submission_items si ON s.id = si.submission_id
  LEFT JOIN products p ON si.product_id = p.id
  WHERE s.id = p_submission_id;
END;
$function$;

-- NOTE: production version had NO auth check (security hole).
CREATE OR REPLACE FUNCTION public.get_staff_submission_history(p_token uuid)
 RETURNS TABLE(id uuid, agency_name text, total_items bigint, date timestamp with time zone)
 LANGUAGE plpgsql SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT s.id, a.name::TEXT,
    COALESCE((SELECT SUM(quantity) FROM stock_submission_items WHERE submission_id = s.id), 0)::BIGINT,
    s.submitted_at::TIMESTAMPTZ
  FROM stock_submissions s JOIN agencies a ON s.agency_id = a.id
  ORDER BY s.submitted_at DESC LIMIT 50;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_submission_detail(p_token uuid, p_submission_id uuid)
 RETURNS TABLE(agency_name text, submitted_by_name text, submitted_at timestamp with time zone, product_name text, quantity integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  perform _auth(p_token, array['super_admin','admin']);
  return query
  select a.name, u.name, ss.submitted_at, pr.name, si.quantity
  from stock_submissions ss
  join agencies a on a.id = ss.agency_id
  join users u on u.id = ss.submitted_by
  join stock_submission_items si on si.submission_id = ss.id
  join products pr on pr.id = si.product_id
  where ss.id = p_submission_id order by lower(pr.name);
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_submission_history(p_token uuid, p_agency_id uuid)
 RETURNS TABLE(submission_id uuid, submitted_by_name text, submitted_at timestamp with time zone)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  perform _auth(p_token, array['super_admin','admin']);
  return query select ss.id, u.name, ss.submitted_at
  from stock_submissions ss join users u on u.id = ss.submitted_by
  where ss.agency_id = p_agency_id order by ss.submitted_at desc;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_super_admin_counts(p_token uuid)
 RETURNS TABLE(total_admins bigint, total_staff bigint, total_agencies bigint, total_products bigint, total_submissions bigint)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  perform _auth(p_token, array['super_admin']);
  return query select
    (select count(*) from users where role = 'admin'),
    (select count(*) from users where role = 'staff'),
    (select count(*) from agencies where is_active),
    (select count(*) from products where is_active),
    (select count(*) from stock_submissions);
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_today_submission(p_token uuid, p_agency_id uuid)
 RETURNS TABLE(product_id uuid, quantity integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
begin
  perform _auth(p_token, array['staff','admin','super_admin']);
  return query
    select si.product_id, si.quantity
    from stock_submissions ss
    join stock_submission_items si on si.submission_id = ss.id
    where ss.agency_id = p_agency_id and ss.submitted_at::date = current_date
    order by ss.submitted_at desc;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_users(p_token text)
 RETURNS TABLE(id uuid, name text, username text, role text, created_at timestamp with time zone, is_active boolean)
 LANGUAGE plpgsql SECURITY DEFINER
AS $function$
BEGIN
  PERFORM _auth(p_token::uuid, ARRAY['super_admin']);
  RETURN QUERY SELECT u.id, u.name, u.username, u.role, u.created_at, u.is_active
  FROM users u ORDER BY u.role, lower(u.name);
END;
$function$;

CREATE OR REPLACE FUNCTION public.login(p_username text, p_password text)
 RETURNS TABLE(token uuid, user_id uuid, name text, username text, role text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
declare v_user record; v_token uuid;
begin
  select u.* into v_user from users u where u.username = lower(trim(p_username));
  if v_user.id is null or v_user.password_hash <> crypt(p_password, v_user.password_hash) then
    raise exception 'Incorrect username or password';
  end if;
  delete from sessions s where s.user_id = v_user.id and s.expires_at < now();
  insert into sessions(user_id, expires_at) values (v_user.id, now() + interval '30 days')
  returning sessions.token into v_token;
  return query select v_token, v_user.id, v_user.name, v_user.username, v_user.role;
end;
$function$;

CREATE OR REPLACE FUNCTION public.logout(p_token uuid)
 RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$ delete from sessions where token = p_token; $function$;

CREATE OR REPLACE FUNCTION public.reactivate_user(p_token text, p_user_id text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE v_caller RECORD;
BEGIN
  SELECT u.id, u.role INTO v_caller FROM sessions s JOIN users u ON u.id = s.user_id
  WHERE s.token = p_token::uuid AND s.expires_at > NOW();
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or expired session'; END IF;
  IF v_caller.role != 'super_admin' THEN RAISE EXCEPTION 'Permission denied'; END IF;
  UPDATE users SET is_active = true WHERE id = p_user_id::uuid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_password(p_token uuid, p_user_id uuid, p_new_password text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
begin
  perform _auth(p_token, array['super_admin']);
  if length(trim(p_new_password)) < 6 then raise exception 'Password must be at least 6 characters'; end if;
  update users set password_hash = crypt(p_new_password, gen_salt('bf')) where id = p_user_id;
  delete from sessions s where s.user_id = p_user_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_stock(p_token uuid, p_agency_id uuid, p_items jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_user_id uuid; v_submission_id uuid; v_item jsonb;
begin
  select user_id into v_user_id from _auth(p_token, array['staff']);
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Enter at least one product quantity before submitting';
  end if;
  insert into stock_submissions(agency_id, submitted_by) values (p_agency_id, v_user_id) returning id into v_submission_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into stock_submission_items(submission_id, product_id, quantity)
    values (v_submission_id, (v_item->>'product_id')::uuid, (v_item->>'quantity')::integer);
  end loop;
  return v_submission_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_agency(p_token uuid, p_agency_id uuid, p_name text, p_is_active boolean, p_whatsapp text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'extensions', 'public'
AS $function$
DECLARE v_role TEXT;
BEGIN
  SELECT u.role INTO v_role FROM sessions s JOIN users u ON u.id = s.user_id
  WHERE s.token = p_token AND s.expires_at > NOW();
  IF v_role IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF v_role != 'super_admin' THEN RAISE EXCEPTION 'Forbidden: super_admin only'; END IF;
  UPDATE agencies SET name = p_name, is_active = p_is_active, whatsapp_number = p_whatsapp WHERE id = p_agency_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_product(p_token uuid, p_product_id uuid, p_name text, p_agency_id uuid, p_is_active boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  perform _auth(p_token, array['super_admin']);
  update products set name = trim(p_name), agency_id = p_agency_id, is_active = p_is_active where id = p_product_id;
exception when unique_violation then raise exception 'That agency already has a product with this name';
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_user(p_token uuid, p_user_id uuid, p_name text, p_username text, p_role text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  perform _auth(p_token, array['super_admin']);
  update users set name = trim(p_name), username = lower(trim(p_username)), role = p_role where id = p_user_id;
exception when unique_violation then raise exception 'That username is already taken';
end;
$function$;

CREATE OR REPLACE FUNCTION public.validate_session(p_token uuid)
 RETURNS TABLE(user_id uuid, name text, username text, role text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_user_id uuid;
begin
  select s.user_id into v_user_id from sessions s where s.token = p_token and s.expires_at > now();
  if v_user_id is null then raise exception 'Session expired'; end if;
  return query select u.id, u.name, u.username, u.role from users u where u.id = v_user_id;
end;
$function$;
