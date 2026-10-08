import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const DB_DIR = fileURLToPath(new URL('../', import.meta.url))
const db = new PGlite({ extensions: { pgcrypto } })
await db.exec(`set timezone = 'UTC'; create role anon; create role authenticated;`)

let pass = 0, fail = 0
const ok = (cond, msg) => { if (cond) { pass++; console.log('  PASS', msg) } else { fail++; console.log('  FAIL', msg) } }
const rpc = async (fn, args = {}) => {
  const keys = Object.keys(args)
  const sql = `select * from public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')})`
  return (await db.query(sql, keys.map(k => args[k]))).rows
}
const rpcErr = async (fn, args) => { try { await rpc(fn, args); return null } catch (e) { return e.message } }
const norm = rows => JSON.parse(JSON.stringify(rows))

// ── 1. baseline (= production today) ────────────────────────────────────────
await db.exec(fs.readFileSync(`${DB_DIR}reference_production_schema.sql`, 'utf8'))

// seed realistic data
await db.exec(`
set search_path = public, extensions;
insert into users(id,name,username,password_hash,role,is_active) values
 ('11111111-0000-0000-0000-000000000001','KK Owner','kk',crypt('kkpass1',gen_salt('bf')),'super_admin',true),
 ('11111111-0000-0000-0000-000000000002','Anitha Admin','anitha',crypt('anitha1',gen_salt('bf')),'admin',true),
 ('11111111-0000-0000-0000-000000000003','Ravi Staff','ravi',crypt('ravi123',gen_salt('bf')),'staff',true),
 ('11111111-0000-0000-0000-000000000004','Old Staff','oldstaff',crypt('old1234',gen_salt('bf')),'staff',false);
insert into agencies(id,name,is_active,whatsapp_number) values
 ('22222222-0000-0000-0000-000000000001','Nestle',true,'919800000001'),
 ('22222222-0000-0000-0000-000000000002','Britannia',true,null),
 ('22222222-0000-0000-0000-000000000003','Closed Agency',false,null);
insert into products(id,agency_id,name,is_active) values
 ('33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','KitKat 4F',true),
 ('33333333-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001','Maggi 70g',true),
 ('33333333-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000001','Old Product',false),
 ('33333333-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000002','Good Day',true);
-- yesterday, and two submissions "today" for Nestle (an early one and an update)
insert into stock_submissions(id,agency_id,submitted_by,submitted_at) values
 ('44444444-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000003', now() - interval '1 day'),
 ('44444444-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000003', now() - interval '2 minutes'),
 ('44444444-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000003', now() - interval '1 minute'),
 ('44444444-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000004', now() - interval '3 days');
insert into stock_submission_items(submission_id,product_id,quantity) values
 ('44444444-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001',5),
 ('44444444-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000001',10),
 ('44444444-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000002',20),
 ('44444444-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000001',11),
 ('44444444-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000002',21),
 ('44444444-0000-0000-0000-000000000004','33333333-0000-0000-0000-000000000004',7);
`)

const login = async (u, p) => (await rpc('login', { p_username: u, p_password: p }))[0]
const tSuper = (await login('kk', 'kkpass1')).token
const tAdmin = (await login('anitha', 'anitha1')).token
const tStaff = (await login('ravi', 'ravi123')).token
const NESTLE = '22222222-0000-0000-0000-000000000001'
const SUB3 = '44444444-0000-0000-0000-000000000003'

// every read the app makes, per role
const reads = async () => ({
  validate_super: await rpc('validate_session', { p_token: tSuper }),
  active_agencies: await rpc('get_active_agencies', { p_token: tStaff }),
  all_agencies: await rpc('get_all_agencies_admin', { p_token: tAdmin }),
  products_by_agency: await rpc('get_products_by_agency', { p_token: tStaff, p_agency_id: NESTLE }),
  all_products: await rpc('get_all_products_admin', { p_token: tSuper }),
  users: await rpc('get_users', { p_token: tSuper }),
  agency_status: await rpc('get_agency_status', { p_token: tAdmin }),
  admin_counts: await rpc('get_admin_counts', { p_token: tAdmin }),
  super_counts: await rpc('get_super_admin_counts', { p_token: tSuper }),
  recent: await rpc('get_recent_submissions', { p_token: tAdmin, p_limit: 50 }),
  history: await rpc('get_submission_history', { p_token: tAdmin, p_agency_id: NESTLE }),
  detail: await rpc('get_submission_detail', { p_token: tAdmin, p_submission_id: SUB3 }),
  with_qty: await rpc('get_agency_products_with_qty', { p_token: tAdmin, p_agency_id: NESTLE }),
  today: await rpc('get_today_submission', { p_token: tStaff, p_agency_id: NESTLE }),
  staff_history: await rpc('get_staff_submission_history', { p_token: tStaff }),
  staff_detail: await rpc('get_staff_submission_detail', { p_token: tStaff, p_submission_id: SUB3 }),
})

const tables = ['users', 'sessions', 'agencies', 'products', 'stock_submissions', 'stock_submission_items']
const dumpTables = async () => {
  const out = {}
  for (const t of tables) out[t] = norm((await db.query(`select * from public.${t} order by id`)).rows)
  return out
}

console.log('\n[1] Baseline — security holes that exist in production today')
ok((await rpcErr('get_staff_submission_detail', { p_token: null, p_submission_id: SUB3 })) === null,
  'BEFORE: get_staff_submission_detail works with NO token (hole confirmed)')
ok((await login('oldstaff', 'old1234'))?.token != null, 'BEFORE: deactivated user can log in (bug confirmed)')

const before = norm(await reads())
const tablesBefore = await dumpTables()

// ── 2. migrate ──────────────────────────────────────────────────────────────
console.log('\n[2] Apply 001_multi_tenant.sql')
await db.exec(fs.readFileSync(`${DB_DIR}001_multi_tenant.sql`, 'utf8'))
ok(true, 'migration ran without error')
const again = await db.exec(fs.readFileSync(`${DB_DIR}001_multi_tenant.sql`, 'utf8')).then(() => null, e => e.message)
await db.exec('rollback').catch(() => {})
ok(again?.includes('already been applied'), 'running it twice is refused: ' + again)

// ── 3. existing data untouched ──────────────────────────────────────────────
console.log('\n[3] Existing client data')
const tablesAfter = await dumpTables()
const SHOP1 = '00000000-0000-0000-0000-000000000001'
for (const t of tables) {
  const stripped = tablesAfter[t].map(({ shop_id, ...r }) => r)
  ok(JSON.stringify(stripped) === JSON.stringify(tablesBefore[t]), `${t}: every row identical (${tablesBefore[t].length} rows)`)
  if (tablesAfter[t][0] && 'shop_id' in tablesAfter[t][0])
    ok(tablesAfter[t].every(r => r.shop_id === SHOP1), `${t}: all rows belong to Shop #1`)
}

// ── 4. old frontend keeps working with existing logged-in sessions ──────────
console.log('\n[4] Same logins, same screens (compared field by field)')
const after = norm(await reads())
const intended = {
  validate_super: 'adds shop_id / shop_name / shop_code / support_contact',
  agency_status: 'adds submitted_today',
  admin_counts: 'adds submitted_today / total_products / total_submissions',
  super_counts: 'excludes deactivated users',
  today: 'returns only the latest submission of today (in shop timezone)',
}
for (const k of Object.keys(before)) {
  // compare only the fields the old frontend knows about
  const b = before[k], a = after[k].map(r => Object.fromEntries(Object.keys(b[0] ?? r).map(f => [f, r[f]])))
  const same = JSON.stringify(a) === JSON.stringify(b)
  if (same) ok(true, `${k}: identical`)
  else if (intended[k]) { ok(true, `${k}: changed ON PURPOSE — ${intended[k]}`); console.log('       before:', JSON.stringify(b)); console.log('       after: ', JSON.stringify(after[k])) }
  else { ok(false, `${k}: UNEXPECTED change`); console.log('       before:', JSON.stringify(b)); console.log('       after: ', JSON.stringify(after[k])) }
}
ok(after.today.length === 2 && after.today.find(r => r.product_id.endsWith('1')).quantity === 11,
  'today = the latest update (KitKat 11, not 10)')
ok(after.super_counts[0].total_staff === 1, 'staff count = 1 active staff')
ok(after.agency_status.find(r => r.agency_id === NESTLE).submitted_today === true, 'Nestle submitted_today = true')
ok(after.validate_super[0].shop_name === 'Sampath Super Market', 'session knows its shop: Sampath Super Market')

console.log('\n[5] Security fixes')
ok((await rpcErr('get_staff_submission_detail', { p_token: null, p_submission_id: SUB3 }))?.includes('Not logged in'), 'staff detail now requires login')
ok((await rpcErr('get_staff_submission_history', { p_token: null }))?.includes('Not logged in'), 'staff history now requires login')
ok((await rpcErr('login', { p_username: 'oldstaff', p_password: 'old1234' }))?.includes('deactivated'), 'deactivated user can no longer log in')
const leftover = (await db.query(`select s.token from sessions s join users u on u.id=s.user_id where u.username='oldstaff'`)).rows[0]?.token
ok((await rpcErr('get_active_agencies', { p_token: leftover }))?.includes('deactivated'), 'deactivated user\'s old session is rejected')
ok((await rpcErr('login', { p_username: 'kk', p_password: 'wrong' }))?.includes('Incorrect'), 'wrong password rejected')
const direct = await db.query(`insert into public.agencies(name) values ('NoShop')`).then(() => 'inserted', e => e.message)
ok(direct.includes('shop_id'), 'insert without shop_id is impossible (no silent default to Shop #1)')

// existing client still can write
const newProd = (await rpc('create_product', { p_token: tSuper, p_agency_id: NESTLE, p_name: 'Munch' }))[0]
ok(!!newProd, 'Shop #1 super admin can still create products')
const subId = (await rpc('submit_stock', { p_token: tStaff, p_agency_id: NESTLE, p_items: JSON.stringify([
  { product_id: '33333333-0000-0000-0000-000000000001', quantity: 3 }]) }))[0]
ok(!!subId, 'Shop #1 staff can still submit stock')

// ── 6. platform owner + second shop ────────────────────────────────────────
console.log('\n[6] Platform owner & new shop')
await db.exec(fs.readFileSync(`${DB_DIR}002_create_platform_owner.sql`, 'utf8')
  .replace(/'Your Name'/, `'Platform Owner'`).replace(/'owner'/, `'owner'`).replace(/'CHANGE-ME[^']*'/, `'ownerpass99'`))
ok((await rpcErr('platform_login', { p_username: 'kk', p_password: 'kkpass1' }))?.includes('Incorrect'), 'shop super admin can NOT log into platform')
ok((await rpcErr('login', { p_username: 'owner', p_password: 'ownerpass99' }))?.includes('Incorrect'), 'platform owner is not a shop user')
const pTok = (await rpc('platform_login', { p_username: 'owner', p_password: 'ownerpass99' }))[0].token
ok(!!pTok, 'platform owner logs in')
ok((await rpcErr('platform_list_shops', { p_token: tSuper }))?.includes('Session expired'), 'shop token rejected by platform RPCs')
ok((await rpcErr('get_users', { p_token: pTok }))?.includes('Session expired'), 'platform token rejected by shop RPCs')

const shop2 = (await rpc('platform_create_shop', { p_token: pTok, p_name: 'Lakshmi Stores', p_code: 'lakshmi',
  p_timezone: 'Asia/Kolkata', p_support_contact: '9999', p_admin_name: 'Lakshmi', p_admin_username: 'lakshmi', p_admin_password: 'lakpass1' }))[0].platform_create_shop
ok(!!shop2, 'shop 2 created with its super admin')
ok((await rpcErr('platform_create_shop', { p_token: pTok, p_name: 'X', p_code: 'x2', p_timezone: 'Asia/Kolkata',
  p_support_contact: null, p_admin_name: 'X', p_admin_username: 'kk', p_admin_password: 'xxxxxx' }))?.includes('username is already taken'), 'cannot reuse an existing username')
const shops = await rpc('platform_list_shops', { p_token: pTok })
ok(shops.length === 2 && shops[0].name === 'Sampath Super Market' && shops[0].staff === 1, 'platform sees both shops with counts')

const t2 = (await login('lakshmi', 'lakpass1')).token
await rpc('create_agency', { p_token: t2, p_name: 'Nestle', p_whatsapp: null })
ok(true, 'shop 2 can create an agency with the same name as shop 1 ("Nestle")')
const ag2 = (await rpc('get_active_agencies', { p_token: t2 }))
ok(ag2.length === 1, 'shop 2 sees only its own agency')
await rpc('create_user', { p_token: t2, p_name: 'S2 Staff', p_username: 's2staff', p_password: 's2pass1', p_role: 'staff' })
const t2s = (await login('s2staff', 's2pass1')).token
const p2 = (await rpc('create_product', { p_token: t2, p_agency_id: ag2[0].id, p_name: 'KitKat 4F' }))[0].create_product
await rpc('submit_stock', { p_token: t2s, p_agency_id: ag2[0].id, p_items: JSON.stringify([{ product_id: p2, quantity: 9 }]) })
ok(true, 'shop 2 staff submitted stock')

console.log('\n[7] Isolation — nothing leaks between shops')
const s1 = norm(await reads())
for (const k of ['active_agencies', 'all_agencies', 'all_products', 'users', 'recent', 'staff_history', 'agency_status'])
  ok(!JSON.stringify(s1[k]).includes('Lakshmi') && !JSON.stringify(s1[k]).includes('S2 Staff') && !JSON.stringify(s1[k]).includes(ag2[0].id),
    `shop 1 ${k}: no shop 2 data`)
ok((await rpc('get_users', { p_token: t2 })).length === 2, 'shop 2 users list = only its 2 users')
ok((await rpc('get_all_products_admin', { p_token: t2 })).length === 1, 'shop 2 products = only its 1 product')
ok((await rpc('get_recent_submissions', { p_token: t2, p_limit: 50 })).length === 1, 'shop 2 submissions = only its 1')
ok((await rpc('get_super_admin_counts', { p_token: t2 }))[0].total_submissions === 1, 'shop 2 counts are its own')

console.log('\n[8] Attacks from shop 2 against shop 1 (all must fail)')
const attacks = [
  ['update_agency', { p_token: t2, p_agency_id: NESTLE, p_name: 'Hacked', p_is_active: false, p_whatsapp: null }],
  ['delete_agency', { p_token: t2, p_agency_id: NESTLE }],
  ['create_product', { p_token: t2, p_agency_id: NESTLE, p_name: 'Evil' }],
  ['update_product', { p_token: t2, p_product_id: '33333333-0000-0000-0000-000000000001', p_name: 'X', p_agency_id: ag2[0].id, p_is_active: true }],
  ['delete_product', { p_token: t2, p_product_id: '33333333-0000-0000-0000-000000000001' }],
  ['update_user', { p_token: t2, p_user_id: '11111111-0000-0000-0000-000000000003', p_name: 'X', p_username: 'x', p_role: 'staff' }],
  ['reset_password', { p_token: t2, p_user_id: '11111111-0000-0000-0000-000000000001', p_new_password: 'hacked1' }],
  ['deactivate_user', { p_token: t2, p_user_id: '11111111-0000-0000-0000-000000000001' }],
  ['delete_user', { p_token: t2, p_user_id: '11111111-0000-0000-0000-000000000002' }],
  ['submit_stock', { p_token: t2s, p_agency_id: NESTLE, p_items: JSON.stringify([{ product_id: '33333333-0000-0000-0000-000000000001', quantity: 1 }]) }],
  ['submit_stock', { p_token: t2s, p_agency_id: ag2[0].id, p_items: JSON.stringify([{ product_id: '33333333-0000-0000-0000-000000000001', quantity: 1 }]) }],
]
for (const [fn, args] of attacks) {
  const e = await rpcErr(fn, args)
  ok(e !== null, `${fn} on shop 1 data → blocked (${e})`)
}
for (const [fn, args] of [
  ['get_submission_detail', { p_token: t2, p_submission_id: SUB3 }],
  ['get_staff_submission_detail', { p_token: t2s, p_submission_id: SUB3 }],
  ['get_submission_history', { p_token: t2, p_agency_id: NESTLE }],
  ['get_products_by_agency', { p_token: t2s, p_agency_id: NESTLE }],
  ['get_agency_products_with_qty', { p_token: t2, p_agency_id: NESTLE }],
  ['get_today_submission', { p_token: t2s, p_agency_id: NESTLE }],
]) ok((await rpc(fn, args)).length === 0, `${fn} on shop 1 ids → empty`)
ok(JSON.stringify((await dumpTables()).agencies.filter(a => a.shop_id === SHOP1).map(({ shop_id, ...r }) => r))
  === JSON.stringify(tablesBefore.agencies), 'shop 1 agencies still byte-identical after all attacks')

console.log('\n[9] Platform controls')
await rpc('platform_update_shop', { p_token: pTok, p_shop_id: shop2, p_name: 'Lakshmi Stores', p_timezone: 'Asia/Kolkata', p_support_contact: '9999', p_is_active: false })
ok((await rpcErr('get_active_agencies', { p_token: t2s })) !== null, 'suspended shop: existing sessions stop working')
ok((await rpcErr('login', { p_username: 'lakshmi', p_password: 'lakpass1' }))?.includes('suspended'), 'suspended shop: cannot log in')
ok((await rpc('get_active_agencies', { p_token: tStaff })).length === 2, 'shop 1 unaffected by suspending shop 2')
await rpc('platform_update_shop', { p_token: pTok, p_shop_id: shop2, p_name: 'Lakshmi Stores', p_timezone: 'Asia/Kolkata', p_support_contact: '9999', p_is_active: true })
const su = await rpc('platform_get_shop_users', { p_token: pTok, p_shop_id: shop2 })
await rpc('platform_reset_user_password', { p_token: pTok, p_user_id: su[0].id, p_new_password: 'newpass1' })
ok(!!(await login('lakshmi', 'newpass1')), 'platform owner reset shop 2 super admin password')
ok((await rpcErr('platform_update_shop', { p_token: pTok, p_shop_id: shop2, p_name: 'L', p_timezone: 'Mars/Base', p_support_contact: null, p_is_active: true }))?.includes('Unknown timezone'), 'bad timezone rejected')
ok((await rpcErr('update_user', { p_token: tSuper, p_user_id: '11111111-0000-0000-0000-000000000001', p_name: 'KK', p_username: 'kk', p_role: 'staff' }))?.includes('own role'), 'super admin cannot demote themself')
await rpc('platform_logout', { p_token: pTok })
ok((await rpcErr('platform_list_shops', { p_token: pTok })) !== null, 'platform logout ends the session')

console.log('\n[10] Anonymous access')
const priv = (await db.query(`select count(*)::int c from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_schema='public'`)).rows[0].c
ok(priv === 0, 'anon/authenticated have no direct table privileges')
const helpers = (await db.query(`select count(*)::int c from pg_proc p where proname in ('_auth','_shop_tz','_platform_auth') and has_function_privilege('anon', p.oid, 'execute')`)).rows[0].c
ok(helpers === 0, 'anon cannot call internal helper functions')

console.log(`\n==== ${pass} passed, ${fail} failed ====`)
process.exit(fail ? 1 : 0)
