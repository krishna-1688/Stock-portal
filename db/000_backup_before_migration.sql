-- =============================================================================
-- 000_backup_before_migration.sql  —  run this FIRST
--
-- Copies every table into a separate schema "backup_pre_multitenant" inside
-- the same database. Nothing in the live tables is touched. Takes seconds.
--
-- The last statement prints row counts for the live tables and the copies
-- side by side. They must match before you continue to 001.
--
-- To restore a table later (only if ever needed):
--   truncate public.<table> cascade;
--   insert into public.<table> select * from backup_pre_multitenant.<table>;
-- To delete the backup once you're happy (a few weeks later):
--   drop schema backup_pre_multitenant cascade;
-- =============================================================================

begin;

create schema backup_pre_multitenant;
revoke all on schema backup_pre_multitenant from public, anon, authenticated;

create table backup_pre_multitenant.users                  as table public.users;
create table backup_pre_multitenant.sessions               as table public.sessions;
create table backup_pre_multitenant.agencies               as table public.agencies;
create table backup_pre_multitenant.products               as table public.products;
create table backup_pre_multitenant.stock_submissions      as table public.stock_submissions;
create table backup_pre_multitenant.stock_submission_items as table public.stock_submission_items;

commit;

select 'users' as table_name, (select count(*) from public.users) as live, (select count(*) from backup_pre_multitenant.users) as backup
union all select 'sessions', (select count(*) from public.sessions), (select count(*) from backup_pre_multitenant.sessions)
union all select 'agencies', (select count(*) from public.agencies), (select count(*) from backup_pre_multitenant.agencies)
union all select 'products', (select count(*) from public.products), (select count(*) from backup_pre_multitenant.products)
union all select 'stock_submissions', (select count(*) from public.stock_submissions), (select count(*) from backup_pre_multitenant.stock_submissions)
union all select 'stock_submission_items', (select count(*) from public.stock_submission_items), (select count(*) from backup_pre_multitenant.stock_submission_items);
