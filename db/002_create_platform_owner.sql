-- =============================================================================
-- 002_create_platform_owner.sql  —  create YOUR platform-owner login
--
-- Run once in Supabase → SQL Editor AFTER 001_multi_tenant.sql.
-- 1. Replace the three values below (name, username, password).
-- 2. Run it.
-- 3. Log in at  https://<your-app>/platform/login
--
-- This account is completely separate from shop users: it cannot log in on
-- the normal shop login page, and shop users cannot log in here.
-- There is deliberately NO public "sign up" function for this — the only way
-- to create a platform owner is running SQL in your Supabase dashboard.
--
-- Don't save the real password back into this file.
-- =============================================================================

insert into public.platform_admins (name, username, password_hash)
values (
  'Your Name',
  lower('owner'),
  extensions.crypt('CHANGE-ME-use-a-long-password', extensions.gen_salt('bf'))
);
