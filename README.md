# Stock Portal

Multi-shop stock collection app. Staff count agency stock on their phones,
admins see what's been submitted and send WhatsApp orders, and each shop's
super admin manages its users, agencies and products. The platform owner
manages all shops.

## Roles

| Who | Logs in at | Can |
| --- | --- | --- |
| Platform owner | `/platform/login` | Create, edit and suspend shops; manage any shop's users and passwords |
| Super admin (per shop) | `/login` | Manage the shop's users, agencies and products, plus everything an admin can do |
| Admin (per shop) | `/login` | Agency status, history, stock view, WhatsApp orders |
| Staff (per shop) | `/login` | Enter stock counts, view history |

Every shop's data is isolated in the database (`shop_id` on every table, and
every function is scoped to the caller's shop). Usernames are unique across the
whole platform, so users only need a username and password.

## Stack

React 19 + Vite + Tailwind (PWA), Supabase Postgres. The browser only calls
`SECURITY DEFINER` SQL functions (`supabase.rpc`). Tables have RLS on and no
direct access.

## Development

```bash
npm ci
cp .env.example .env   # fill in Supabase URL + anon key
npm run dev
npm run test:db        # runs migration + isolation + rollback tests on local Postgres (PGlite)
```

Database changes and the go-live runbook: [`db/README.md`](db/README.md).
