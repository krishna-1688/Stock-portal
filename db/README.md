# Database — multi-tenant go-live runbook

All business logic lives in Supabase SQL functions. This folder holds every
change to them, in order.

| File | What it is | Run on production? |
| --- | --- | --- |
| `reference_production_schema.sql` | Exact copy of production **before** multi-tenancy (tables + all 32 original functions). | **No.** Reference and testing only. |
| `000_backup_before_migration.sql` | Copies every table into schema `backup_pre_multitenant`. | Yes, step 2 |
| `001_multi_tenant.sql` | The migration: shops, `shop_id`, platform owner, shop-scoped functions, security fixes. | Yes, step 3 |
| `002_create_platform_owner.sql` | Creates **your** platform-owner login. | Yes, step 4 (edit first) |
| `003_whatsapp_orders_and_hardening.sql` | WhatsApp order history, login lockout, bcrypt cost 10, size limits. | Yes, after the new frontend is live |
| `004_remove_legacy_login.sql` | Removes the old unprotected `login()` / `platform_login()`. | Yes, about 1 week after 003 |
| `rollback_001.sql` | Emergency undo of 001. Refuses to run once a second shop exists. | Only if something goes wrong |
| `rollback_003.sql` | Emergency undo of 003 (deletes WhatsApp order history). | Only if something goes wrong |
| `tests/` | Runs all of the above on a local Postgres (PGlite): `npm run test:db` | — |

## How the existing client is protected

- Every existing row is attached to **Shop #1** (`00000000-0000-0000-0000-000000000001`,
  "Sampath Super Market"). No row is deleted or rewritten. The test suite checks
  every row byte for byte before and after.
- Every function keeps its exact name and parameters. The **currently deployed
  frontend keeps working** after the migration, and logged-in users stay logged in.
- Usernames stay globally unique, so nobody's login changes and no shop code is needed.
- The whole migration is one transaction: it either fully applies or changes nothing.
  It refuses to run twice.

### Behaviour changes the client WILL notice (all fixes)

| Before | After |
| --- | --- |
| Deactivated users could still log in. | They can't. Reactivate them in Manage Users if needed. |
| "Today" switched at 5:30 AM IST (server ran on UTC). | "Today" switches at midnight in the shop's timezone (Asia/Kolkata). |
| Updating a count the same day showed the *first* entry's numbers when re-opened. | It shows the latest entry. |
| Super Admin dashboard counted deactivated admins/staff. | It counts active users only. |
| Admin dashboard always showed 0 submitted today and "—" for products/submissions. | It shows real numbers. |
| Admin agency page always showed "In stock —". | It shows the latest stock (last 4 days). |
| Staff submission history/detail could be read **without logging in**. | Login required, own shop only. |

## Go-live steps

Do this when the shop is closed (e.g. late night). The SQL takes seconds.

1. **Run tests locally** (optional, already passing): `npm run test:db`
2. **Backup.** Supabase → SQL Editor → paste `000_backup_before_migration.sql` → Run.
   The result table must show `live` = `backup` for all 6 tables.
3. **Migrate.** Paste `001_multi_tenant.sql` → Run. Expect "Success. No rows returned".
   If it errors, nothing changed. Send me the error message.
4. **Create your platform login.** Open `002_create_platform_owner.sql`, replace
   name / username / password, paste → Run. Don't save the real password in the file.
5. **Check the old app still works.** Open the live app as the client would
   (staff, admin and super admin). Everything should look as before.
6. **Deploy the new frontend** (this repo, `main`).
7. **Check the new app:**
   - Client: log in as each role and check the shop name in the header,
     agency list, stock entry and the WhatsApp order message.
   - You: open `/platform/login`, sign in, and check that "Sampath Super Market"
     is listed with correct counts.
   - Create a test shop, log in as its super admin, and confirm you see **none**
     of Sampath's data. Then suspend the test shop.

## Status

| Step | Done |
| --- | --- |
| 000 backup | ✅ 2026-10-08 (counts matched: 5 users, 22 agencies, 1189 products, 13 submissions, 125 items) |
| 001 migration | ✅ 2026-10-08 (all counts matched after) |
| 002 platform owner | ✅ `krishna_kk` |
| Frontend `multi-tenant` branch | Preview verified; merge to `main` to go live |
| 003 | Pending: run after the merge |
| 004 | Pending: about one week after 003 |

## 003 / 004 steps

1. Merge the `multi-tenant` branch so the new frontend is live. It works with or
   without 003; logins fall back to the old function until 003 exists.
2. Run `003_whatsapp_orders_and_hardening.sql` in the SQL Editor. Expect "Success".
3. Log in once as each role. Send one WhatsApp order from an agency page and check
   it appears under Super Admin → WhatsApp Orders.
4. About a week later, run `004_remove_legacy_login.sql`.

## Onboarding a new shop

`/platform` → **+ New Shop** → name, code, timezone, support contact, and the first
super admin's name/username/password. Give those credentials to the shop owner.
They log in at the normal login page and create their own admins, staff,
agencies and products.

## If something goes wrong

- **Only the new frontend misbehaves:** redeploy the previous frontend
  (`git checkout pre-multitenant`). The migrated database works with it.
- **The database must go back:** run `rollback_001.sql`, then redeploy the
  `pre-multitenant` frontend. It only works while Sampath is the only shop.
  All Sampath data is kept, including anything entered after the migration.
- **Worst case:** restore tables from `backup_pre_multitenant` (instructions at
  the top of `000_backup_before_migration.sql`).

Remove the backup schema after a few weeks of stable running:
`drop schema backup_pre_multitenant cascade;`

## Rules for future changes

- Every new tenant table gets `shop_id uuid not null references shops(id)` (no default).
- Every function starts with `select * into me from _auth(p_token, array[...roles])`
  and filters every query by `me.shop_id`.
- Add a test in `tests/test_migration.mjs` proving shop 2 can't see or change shop 1's data.
