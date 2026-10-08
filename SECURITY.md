# Security policy

Stock Portal is used by real shops, so security reports are taken seriously.

## Reporting a vulnerability

Please **don't open a public issue.** Instead use GitHub's private reporting:
**Security → Report a vulnerability** on this repository
([direct link](https://github.com/krishna-1688/Stock-portal/security/advisories/new)).

Please include what you found, steps to reproduce, and the impact you think it has.
You'll get a reply within a few days, and a fix will be prioritised by severity.

## Scope

In scope: the app at `stock-portal-kappa.vercel.app`, the database functions in [`db/`](db/), and
the code in this repository.

Testing rules:
- Use only the **public demo** (`/demo`, Demo Mart). Never try to access other shops' data or accounts.
- No denial-of-service, spam or automated flooding (the demo has caps and rate limits).
- Don't use social engineering or attack the hosting providers (Vercel, Supabase).

## What's already been reviewed

The full security audit, with every finding and its status, is in
[docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md).
