// 005: public demo shop (guarded, capped, resettable) + IP rate limiting.
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const DB_DIR = fileURLToPath(new URL('../', import.meta.url))
const sql = (f) => fs.readFileSync(`${DB_DIR}${f}`, 'utf8')
let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  FAIL', m) } }

const db = new PGlite({ extensions: { pgcrypto } })
await db.exec(`create role anon; create role authenticated;`)
await db.exec(sql('reference_production_schema.sql'))
await db.exec(`
  set search_path = public, extensions;
  insert into users(id,name,username,password_hash,role) values
    ('11111111-0000-0000-0000-000000000001','KK','kk',crypt('kkpass1',gen_salt('bf')),'super_admin'),
    ('11111111-0000-0000-0000-000000000003','Ravi','ravi',crypt('ravi123',gen_salt('bf')),'staff');
  insert into agencies(id,name,whatsapp_number) values ('22222222-0000-0000-0000-000000000001','Nestle','919800000001');
  insert into products(id,agency_id,name) values ('33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','KitKat');
  set search_path = public;`)
await db.exec(sql('001_multi_tenant.sql'))

const one = async (q, p = []) => (await db.query(q, p)).rows[0]
const all = async (q, p = []) => (await db.query(q, p)).rows
const err = async (q, p = []) => db.query(q, p).then(() => null, e => e.message)
const login = async (u, pw = 'demo1234') => (await one(`select login_v2($1,$2) r`, [u, pw])).r
const setIp = (ip) => db.query(`select set_config('request.headers', $1, false)`, [ip ? JSON.stringify({ 'cf-connecting-ip': ip, 'x-forwarded-for': `${ip}, 10.0.0.1` }) : ''])
const DEMO = '00000000-0000-0000-0000-0000000000de'

console.log('\n[005] preconditions')
ok(/Run 003/.test(await db.exec(sql('005_demo_shop_and_ip_rate_limit.sql')).then(() => '', e => e.message)), '005 refuses to run before 003')
await db.exec('rollback').catch(() => {})
await db.exec(sql('003_whatsapp_orders_and_hardening.sql'))
const shop1Before = {}
for (const t of ['users', 'agencies', 'products', 'stock_submissions', 'sessions']) shop1Before[t] = JSON.stringify(await all(`select * from ${t} order by id`))
await db.exec(sql('005_demo_shop_and_ip_rate_limit.sql'))
ok(true, '005 applied')
ok(/already been applied/.test(await db.exec(sql('005_demo_shop_and_ip_rate_limit.sql')).then(() => '', e => e.message)), '005 refuses to run twice')
await db.exec('rollback').catch(() => {})
for (const t of Object.keys(shop1Before)) {
  const rows = (await all(`select * from ${t} order by id`)).filter(r => !('shop_id' in r) || r.shop_id !== DEMO)
  const before = JSON.parse(shop1Before[t])
  const same = t === 'sessions' ? before.every(b => rows.some(r => r.id === b.id)) : JSON.stringify(rows) === JSON.stringify(before)
  ok(same, `Shop #1 ${t}: unchanged`)
}

console.log('\n[005] demo data')
const counts = await one(`select
  (select count(*)::int from agencies where shop_id=$1) a, (select count(*)::int from products where shop_id=$1) p,
  (select count(*)::int from stock_submissions where shop_id=$1) s, (select count(*)::int from whatsapp_orders where shop_id=$1) w,
  (select count(*)::int from users where shop_id=$1) u`, [DEMO])
ok(counts.a === 7 && counts.p === 54 && counts.u === 3, `7 agencies, 54 products, 3 users (${JSON.stringify(counts)})`)
ok(counts.s > 20 && counts.w > 5, `~10 days of stock history and past WhatsApp orders (${counts.s} / ${counts.w})`)
ok((await one(`select count(*)::int c from agencies where shop_id=$1 and whatsapp_number <> '910000000000'`, [DEMO])).c === 0, 'all demo agencies use the invalid WhatsApp number')
const sample = await one(`select message from whatsapp_orders where shop_id=$1 limit 1`, [DEMO])
ok(/Order from Demo Mart\*\n📅 \d{1,2} [A-Z][a-z]+ \d{4}\n/.test(sample.message), 'sample order message is well formed')

console.log('\n[005] demo logins & isolation')
const ds = await login('demo_super'), da = await login('demo_admin'), dt = await login('demo_staff')
ok(ds.ok && da.ok && dt.ok && ds.shop_name === 'Demo Mart' && ds.shop_code === 'demo', 'all three demo accounts log in to "Demo Mart"')
ok((await all(`select * from get_users($1)`, [ds.token])).length === 3, 'demo super admin sees only the 3 demo users')
ok((await all(`select * from get_all_products_admin($1)`, [ds.token])).every(p => p.name !== 'KitKat'), 'demo cannot see Shop #1 products')
const k = await login('kk', 'kkpass1')
ok((await all(`select * from get_all_agencies_admin($1)`, [k.token])).length === 1, 'Shop #1 cannot see demo agencies')
ok((await all(`select * from get_whatsapp_orders($1)`, [ds.token])).length === counts.w, 'demo order history visible to demo super admin')
ok((await all(`select * from get_agency_status($1)`, [da.token])).length === 7, 'demo agency status works')

console.log('\n[005] demo guard: users are read-only')
const demoUser = (await one(`select id from users where username='demo_staff'`)).id
for (const [label, q, p] of [
  ['create_user', `select create_user($1,'X','x_demo','xxxxxx','staff')`, [ds.token]],
  ['update_user', `select update_user($1,$2,'Hacked','demo_staff','staff')`, [ds.token, demoUser]],
  ['reset_password', `select reset_password($1,$2,'hacked1')`, [ds.token, demoUser]],
  ['deactivate_user', `select deactivate_user($1::text,$2::text)`, [ds.token, demoUser]],
  ['delete_user', `select delete_user($1,$2)`, [ds.token, demoUser]],
]) ok(/turned off in the demo/.test(await err(q, p)), `${label} blocked in demo`)
await db.exec(`insert into platform_admins(name,username,password_hash) values ('O','owner',extensions.crypt('ownerpass99',extensions.gen_salt('bf',10)))`)
const pt = (await one(`select platform_login_v2('owner','ownerpass99') r`)).r.token
ok(/turned off in the demo/.test(await err(`select platform_reset_user_password($1,$2,'hacked12')`, [pt, demoUser])), 'even the platform owner cannot change demo users (reset restores them)')
ok((await login('demo_staff')).ok, 'demo_staff password unchanged')
ok(!!(await one(`select create_user($1,'Shop1 New','shop1new','newpass1','staff') id`, [k.token])).id, 'Shop #1 user management unaffected by the demo guard')

console.log('\n[005] demo writes: allowed, capped, safe')
await db.query(`select create_agency($1,'Visitor Agency','919876543210')`, [ds.token])
ok((await one(`select whatsapp_number w from agencies where shop_id=$1 and name='Visitor Agency'`, [DEMO])).w === '910000000000', 'visitor-entered WhatsApp number replaced with the invalid one')
const va = (await one(`select id from agencies where shop_id=$1 and name='Visitor Agency'`, [DEMO])).id
ok(!!(await one(`select create_product($1,$2,'Visitor Product') id`, [ds.token, va])).id, 'visitor can add products')
const vp = (await one(`select id from products where agency_id=$1`, [va])).id
ok(!!(await one(`select submit_stock($1,$2,$3) id`, [dt.token, va, JSON.stringify([{ product_id: vp, quantity: 4 }])])).id, 'visitor staff can submit stock')
ok(!!(await one(`select log_whatsapp_order($1,$2,$3,'hi') id`, [da.token, va, JSON.stringify([{ name: 'Visitor Product', qty: 2, unit: 'pcs' }])])).id, 'visitor admin can send a WhatsApp order (logged)')
for (let i = 0; i < 32; i++) await db.query(`select create_agency($1,$2,null)`, [ds.token, `Flood ${i}`]).catch(() => {})
ok((await one(`select count(*)::int c from agencies where shop_id=$1`, [DEMO])).c === 40, 'demo capped at 40 agencies')
ok(/demo is full/.test(await err(`select create_agency($1,'One more',null)`, [ds.token])), 'cap error is friendly')
await db.query(`select create_agency($1,'Shop1 Agency',null)`, [k.token])
ok(true, 'Shop #1 has no cap')

console.log('\n[005] IP rate limiting')
await setIp('203.0.113.7')
for (let i = 0; i < 30; i++) await db.query(`select login_v2($1,'wrong')`, [`spray_${i}`])
const blocked = await login('kk', 'kkpass1')
ok(!blocked.ok && /from your network/.test(blocked.error), 'after 30 failures from one IP (any usernames), that IP is blocked — even with a correct password')
await setIp('198.51.100.9')
ok((await login('kk', 'kkpass1')).ok, 'other IPs are not affected')
ok((await one(`select ip from login_attempts where username='spray_0'`)).ip === '203.0.113.7', 'cf-connecting-ip is recorded (not the spoofable x-forwarded-for chain)')
await setIp(null)
ok((await login('kk', 'kkpass1')).ok, 'requests without an IP (SQL editor, cron) are not blocked')
await db.query(`delete from login_attempts`)
for (let i = 0; i < 10; i++) await db.query(`select login_v2('demo_staff','wrong')`)
ok((await login('demo_staff')).ok, 'demo accounts cannot be locked out by wrong passwords (public password)')
for (let i = 0; i < 8; i++) await db.query(`select login_v2('ravi','wrong')`)
ok(!(await login('ravi', 'ravi123')).ok, 'real accounts still lock after 8 wrong passwords')
await db.query(`delete from login_attempts`)
await setIp('192.0.2.50')
for (let i = 0; i < 10; i++) await db.query(`select platform_login_v2($1,'x')`, [`p${i}`])
ok(/Too many/.test((await one(`select platform_login_v2('owner','ownerpass99') r`)).r.error), 'owner login: IP blocked after 10 failures')
await setIp(null)

console.log('\n[005] reset')
await db.exec(`select reset_demo_shop()`)
const after = await one(`select (select count(*)::int from agencies where shop_id=$1) a, (select count(*)::int from products where shop_id=$1) p, (select count(*)::int from users where shop_id=$1) u`, [DEMO])
ok(after.a === 7 && after.p === 54 && after.u === 3, 'reset restores the sample data (visitor additions gone)')
ok((await login('demo_admin')).ok, 'demo logins work after reset')
ok((await one(`select count(*)::int c from agencies where shop_id <> $1`, [DEMO])).c === 2, 'reset never touches other shops')
ok((await one(`select has_function_privilege('anon', 'public.reset_demo_shop()', 'execute') x`)).x === false, 'anon cannot call reset_demo_shop')
ok((await one(`select count(*)::int c from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_schema='public'`)).c === 0, 'still no direct table access for anon')

console.log(`\n==== ${pass} passed, ${fail} failed ====`)
process.exit(fail ? 1 : 0)
