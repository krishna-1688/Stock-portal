## What changed

## Why

## Checklist
- [ ] `npm run lint`, `npm run test:db` and `npm run build` pass
- [ ] Database changes are a new numbered file in `db/` (one transaction, refuses to run twice) with a rollback and tests
- [ ] Every new function checks `_auth(...)` and filters by `shop_id`
- [ ] Existing shops' data and logins are unaffected
