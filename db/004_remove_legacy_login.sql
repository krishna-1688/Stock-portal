-- =============================================================================
-- 004_remove_legacy_login.sql  —  run about ONE WEEK after the new frontend
-- (the one that uses login_v2) is live.
--
-- The old login() and platform_login() functions have no brute-force
-- protection; 003 left them in place only so browsers still running the old
-- app could log in. Removing them closes that gap.
--
-- Effect on anyone still on a very old cached app: their login shows an
-- error once; reloading the page loads the new version, which works.
-- =============================================================================

begin;

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'login_v2' and pronamespace = 'public'::regnamespace) then
    raise exception 'login_v2 does not exist — run 003 first. Nothing was changed.';
  end if;
end $$;

drop function if exists public.login(text, text);
drop function if exists public.platform_login(text, text);

commit;
