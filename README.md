<p align="center">
  <img src="public/icons/icon-192.png" width="88" alt="Stock Portal" />
</p>

<h1 align="center">Stock Portal</h1>

<p align="center">
  Daily stock counts, agency status and one-tap WhatsApp orders for retail shops.<br />
  Mobile-first PWA · multi-shop · built on React + Supabase.
</p>

<p align="center">
  <a href="https://stock-portal-kappa.vercel.app/demo"><b>▶ Try the live demo</b></a>
</p>

---

## Live demo

Open **[stock-portal-kappa.vercel.app/demo](https://stock-portal-kappa.vercel.app/demo)** and pick a role. You'll be
signed in to **Demo Mart**, a sample shop with 7 agencies, 54 products and 10 days of history.

| Role | Username | Password | Try this |
| --- | --- | --- | --- |
| Staff | `demo_staff` | `demo1234` | Open an agency, count stock with + / −, submit |
| Admin | `demo_admin` | `demo1234` | Agency status, current stock, send a WhatsApp order |
| Super Admin | `demo_super` | `demo1234` | Add agencies/products (bulk add), browse WhatsApp order history |

The demo is shared and **resets every night**. User management is read-only there, adding
data is capped, and WhatsApp orders go to a dummy number. Best on a phone; install it from the
browser menu to use it like an app.

## What it does

- **Staff** pick an agency and enter counts on their phone. Drafts survive interruptions,
  and they can update the same day.
- **Admins** see which agencies are updated or pending today, view current stock
  (low-stock highlighted), and build an order that opens in WhatsApp, pre-filled.
- **Super admins** manage users, agencies and products (including bulk add) and see every
  WhatsApp order that was sent.
- **Platform owner** (`/platform/login`) onboards new shops, suspends them, and manages any
  shop's users. This login is completely separate from shop logins.

## How it's built

- **Frontend:** React 19, Vite, Tailwind, installable PWA (`vite-plugin-pwa`), deployed on Vercel.
- **Backend:** Supabase Postgres. The browser never touches tables. It only calls
  `SECURITY DEFINER` SQL functions with a session token, and every table has RLS on with no policies.
- **Multi-tenant:** every row carries a `shop_id`; composite foreign keys make cross-shop
  references impossible, and every function filters by the caller's shop.
- **Security:** bcrypt (cost 10) passwords, per-username **and** per-IP login rate limiting,
  security headers + CSP, size limits on every input. See [`docs/SECURITY_AUDIT.md`](docs/SECURITY_AUDIT.md).
- **Tested:** `npm run test:db` builds a local Postgres (PGlite) replica of production and runs
  190+ checks, including cross-shop attack attempts, rollbacks and rate limits.

## Run it yourself

```bash
npm ci
cp .env.example .env     # your Supabase project URL + anon key
npm run dev
npm run test:db          # database tests, no Supabase account needed
```

Set up a fresh Supabase project by running the SQL in [`db/`](db/README.md) in order
(`reference_production_schema.sql` creates the base schema for a new project, then `001`, `003`, `005`).

## Project layout

```
src/
  pages/staff · admin · superadmin · platform   screens per role
  services/                                      one file per area, all calls are supabase.rpc(...)
  context/authContext.jsx                        session + current shop
db/                                              numbered migrations, rollbacks, runbook, tests
docs/SECURITY_AUDIT.md                           findings and their status
```
