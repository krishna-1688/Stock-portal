# Security audit — Stock Portal

**Date:** 2026-10-08 · **Scope:** React frontend (`src/`), Supabase database (all 45 SQL functions,
6 tenant tables, RLS, grants), Vercel deploy config, git history, dependencies.
**Method:** code review of every RPC and page, a local Postgres replica of production with
attack tests (`npm run test:db`, 148 checks including cross-shop attacks), `npm audit`,
and a git history scan for secrets.

Status key: **Fixed (live)**, already in production · **Fixed (pending)**, written and tested,
ships with migration 003 / the `multi-tenant` branch · **Open**, needs a decision or outside setup.

## Summary

| # | Severity | Finding | Status |
| --- | --- | --- | --- |
| 1 | Critical | Staff submission history/detail readable **without logging in** | Fixed (live) |
| 2 | Critical | No shop isolation, so a second client would have seen the first client's data | Fixed (live) |
| 3 | High | Deactivated users could still log in | Fixed (live) |
| 4 | High | Unlimited password guessing on shop and owner logins | Fixed (pending: 003, then 004) |
| 5 | High | Weak password hashing (bcrypt cost 6) | Fixed (pending: 003, auto-upgrades) |
| 6 | High | No real backups (in-database copy only) | **Open** |
| 7 | High | Platform owner account: single password, was shared in chat | **Open: change password** |
| 8 | Medium | Session token in `localStorage` + no Content Security Policy | Partly fixed (CSP report-only) |
| 9 | Medium | Session tokens stored in plain text in the database | Open |
| 10 | Medium | No audit log of admin actions | Open |
| 11 | Medium | Missing browser security headers (clickjacking etc.) | Fixed (pending: branch) |
| 12 | Medium | No size limits on names, item lists, quantities | Fixed (pending: 003) |
| 13 | Medium | Lockout can be abused to lock a known user out for 15 min | Accepted trade-off |
| 14 | Medium | Shop users' minimum password length is 6 | Open |
| 15 | Low | `react-router` advisory (GHSA-qwww-vcr4-c8h2) | Fixed (pending: branch) |
| 16 | Low | Username enumeration (timing, "username taken" across shops) | Accepted |
| 17 | Low | Database error text (constraint names) shown to users | Open |
| 18 | Low | `.env` (anon key) in git history | No action needed |
| 19 | Low | Backup schema `backup_pre_multitenant` holds password hashes | Drop after a few weeks |
| 20 | Low | `supabase api.txt` on the Desktop | Check it (not opened by the audit) |
| 21 | Low | WhatsApp number inserted into a URL unescaped | Fixed (pending: branch) |
| 22 | Info | Staff can view the whole shop's submission history | Business decision |

## Details

### 1. Unauthenticated submission RPCs (Critical, fixed live)
`get_staff_submission_detail` and `get_staff_submission_history` had their login check
commented out ("DIAGNOSTIC MODE"). Anyone with the public anon key, which is in every
browser, could read all submissions. **Fix (001):** both now require a session and only
return the caller's shop.

### 2. No tenant isolation (Critical, fixed live)
Nothing in the schema knew about shops. **Fix (001):** `shop_id` on every tenant table,
composite foreign keys so rows can't reference another shop's agency/user, and every
function filters by the caller's shop. 11 cross-shop attack tests all blocked.

### 3. Deactivated users could log in (High, fixed live)
`login` and `_auth` ignored `is_active`; deactivation only ended current sessions.
**Fix (001):** checked on login and on every request; suspended shops are blocked the same way.

### 4. Unlimited password guessing (High, fixed pending)
Login errors were raised as exceptions, which roll back the transaction, so failed
attempts could not even be counted. **Fix (003):** `login_v2` / `platform_login_v2` return
errors instead of raising, record failures in `login_attempts`, and lock a username
for 15 minutes after **8** failures (shop) or **5** (owner). The frontend uses them
automatically. **Action:** run `004_remove_legacy_login.sql` about a week after go-live.
Until then the old `login()` remains as an unprotected path.

### 5. Weak password hashing (High, fixed pending)
`gen_salt('bf')` defaults to cost 6, about 16× cheaper to crack than the recommended 10.
**Fix (003):** new passwords use cost 10; existing hashes are upgraded transparently at
each user's next successful login (same password, nobody notices).

### 6. No real backups (High, open)
Supabase's free plan has no automatic backups. `backup_pre_multitenant` lives in the
same database, so it does not protect against project loss or accidental deletion.
**Recommendation:** upgrade to Supabase Pro (daily backups, optional point-in-time
recovery), or schedule a weekly `supabase db dump` to storage you control.

### 7. Platform owner account (High, open)
This account can create/suspend shops and reset any user's password. Its password was
pasted into a chat during setup. **Action now:** change it to a long passphrase:
```sql
update public.platform_admins
set password_hash = extensions.crypt('NEW-LONG-PASSPHRASE', extensions.gen_salt('bf', 10))
where username = 'krishna_kk';
```
**Later:** add a second factor (TOTP) for the owner login.

### 8. Token in localStorage, no CSP (Medium, partly fixed)
Any script injected into the page could read the session token. React escapes all
output and the code has no `dangerouslySetInnerHTML`/`eval`, so no injection point was
found, but there is no second line of defence. **Fix (branch):** a strict
Content-Security-Policy is sent in *report-only* mode. **Action:** after a week with no
CSP warnings in the browser console, rename the header in `vercel.json` from
`Content-Security-Policy-Report-Only` to `Content-Security-Policy`.

### 9. Plain-text session tokens in the database (Medium, open)
Tokens are random (122 bits) but stored as-is; a leaked backup would let someone use
live sessions. **Recommendation:** store `sha256(token)` and compare hashes.

### 10. No audit log (Medium, open)
There's no record of who reset a password, deactivated a user, or changed products.
**Recommendation:** an `audit_log` table written by the admin functions, visible to the
shop's super admin and the platform owner.

### 11. Browser security headers (Medium, fixed pending)
**Fix (`vercel.json`):** `X-Frame-Options: DENY` (no clickjacking), `nosniff`,
`Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`.

### 12. Size limits (Medium, fixed pending)
**Fix (003):** length limits on names/usernames/WhatsApp numbers (only added where no
existing row exceeds them), max 5,000 items and quantities 0–1,000,000 per submission,
WhatsApp orders capped at 1,000 items and a 10,000-character message.

### 13. Lockout abuse (Medium, accepted)
Someone who knows a username can lock it for 15 minutes by entering wrong passwords.
Per-IP limits would need an edge function in front of Supabase. Accepted for now.

### 14. Minimum password length 6 (Medium, open)
The owner console now requires 8+ for users it creates. Shop super admins can still set 6.
**Recommendation:** raise to 8 in `create_user`/`reset_password` and the Manage Users form.

### 15. Dependencies (Low, fixed pending)
`npm audit` reported a high advisory in `react-router` (affects RSC mode, which this
SPA does not use, so not exploitable here) plus dev-tool advisories. Updated with
`npm audit fix`; production dependencies now report **0 vulnerabilities**.

### 16. Username enumeration (Low, accepted)
Unknown usernames return slightly faster than wrong passwords, and "username already
taken" reveals that a name exists in some shop. Both are low risk with the lockout.

### 17. Raw database errors (Low, open)
Some errors surface constraint names (for example `agencies_name_len`). Not exploitable;
cosmetic. Map them to friendly messages when the functions are next touched.

### 18. `.env` in git history (Low, no action)
Removed from tracking. Old commits still contain it, but it only holds the **anon**
key (verified: JWT `role: anon`), which is public by design and in every page load.
No service-role key or database password was found anywhere in the repository history.

### 19. Backup schema (Low)
`backup_pre_multitenant` contains copies of password hashes. It isn't reachable from
the API, but drop it once you're confident: `drop schema backup_pre_multitenant cascade;`

### 20. `supabase api.txt` (Low, check)
A file with this name is on the Desktop. The audit did not open it. If it contains the
**service_role** key or the **database password**, move it into a password manager and
delete the file. Those two secrets bypass every protection above.

### 21. WhatsApp URL (Low, fixed pending)
The agency's number is now reduced to digits before building the `wa.me` link.

## What is already solid
- RLS enabled on every table, **no** policies, and all table privileges revoked from
  `anon`/`authenticated`: the browser can only call functions.
- Every function is `SECURITY DEFINER` with a fixed `search_path`; internal helpers
  (`_auth`, `_hash_password`, …) are not callable from the API.
- No dynamic SQL built from user input. Parameters are typed.
- Passwords hashed with bcrypt; session tokens are random UUIDs with expiry
  (30 days shop, 12 hours owner); password reset and deactivation end all sessions.
- Separate owner login with its own tables and sessions; shop tokens are rejected by
  owner functions and vice versa.
- The build fails if Supabase env vars are missing, so a bad config never goes live.

## Recommended order
1. Change the platform owner password (#7), today.
2. Merge the `multi-tenant` branch, then run `003` (#4, #5, #12).
3. One week later: run `004` (#4) and switch CSP to enforcing (#8).
4. Set up real backups (#6).
5. Next development round: audit log (#10), hashed session tokens (#9), password
   length 8 (#14), friendly errors (#17), owner 2FA (#7).
