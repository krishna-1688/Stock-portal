// 003: WhatsApp order history + login lockout + hashing + limits, and its rollback.
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
    ('11111111-0000-0000-0000-000000000002','Anitha','anitha',crypt('anitha1',gen_salt('bf')),'admin'),
    ('11111111-0000-0000-0000-000000000003','Ravi','ravi',crypt('ravi123',gen_salt('bf')),'staff');
  insert into agencies(id,name,whatsapp_number) values ('22222222-0000-0000-0000-000000000001','Nestle','919800000001');
  insert into products(id,agency_id,name) values ('33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','KitKat');
  set search_path = public;`)

const one = async (q, p = []) => (await db.query(q, p)).rows[0]
const err = async (q, p = []) => db.query(q, p).then(() => null, e => e.message)
const NESTLE = '22222222-0000-0000-0000-000000000001'

console.log('\n[003] preconditions')
ok((await db.exec(sql('003_whatsapp_orders_and_hardening.sql')).then(() => null, e => e.message))?.includes('Run 001'), '003 refuses to run before 001')
await db.exec('rollback').catch(() => {})
await db.exec(sql('001_multi_tenant.sql'))
const tablesBefore = {}
for (const t of ['users', 'agencies', 'products', 'sessions', 'stock_submissions']) tablesBefore[t] = JSON.stringify((await db.query(`select * from ${t} order by id`)).rows)
const fnBefore = (await db.query(`select proname, pg_get_functiondef(oid) d from pg_proc where pronamespace='public'::regnamespace order by 1`)).rows

await db.exec(sql('003_whatsapp_orders_and_hardening.sql'))
ok(true, '003 applied')
ok((await db.exec(sql('003_whatsapp_orders_and_hardening.sql')).then(() => null, e => e.message))?.includes('already been applied'), '003 refuses to run twice')
await db.exec('rollback').catch(() => {})
for (const t of Object.keys(tablesBefore))
  ok(JSON.stringify((await db.query(`select * from ${t} order by id`)).rows) === tablesBefore[t], `${t}: unchanged by 003`)

console.log('\n[003] login: old function still works, v2 adds lockout + hash upgrade')
ok(!!(await one(`select token from login('kk','kkpass1')`))?.token, 'legacy login() still works (open browsers keep working)')
const weakBefore = (await one(`select password_hash h from users where username='ravi'`)).h
ok(weakBefore.startsWith('$2a$06$'), 'existing hash is weak (bcrypt cost 6)')
const v2 = (await one(`select login_v2('Ravi ', 'ravi123') r`)).r
ok(v2.ok && v2.token && v2.role === 'staff' && v2.shop_name === 'Sampath Super Market', 'login_v2 success returns session + shop')
ok((await one(`select password_hash h from users where username='ravi'`)).h.startsWith('$2a$10$'), 'hash upgraded to cost 10 on login')
ok((await one(`select login_v2('ravi', 'ravi123') r`)).r.ok, 'same password still works after upgrade (v2)')
ok(!!(await one(`select token from login('ravi','ravi123')`))?.token, 'same password still works after upgrade (legacy)')

for (let i = 0; i < 8; i++) await db.query(`select login_v2('anitha', 'wrong')`)
const locked = (await one(`select login_v2('anitha', 'anitha1') r`)).r
ok(!locked.ok && /Too many/.test(locked.error), 'after 8 wrong passwords even the right one is refused (locked 15 min)')
ok((await one(`select login_v2('kk', 'kkpass1') r`)).r.ok, 'other usernames are not affected')
await db.query(`update login_attempts set attempted_at = now() - interval '16 minutes' where username='anitha'`)
ok((await one(`select login_v2('anitha', 'anitha1') r`)).r.ok, 'unlocks after 15 minutes')
ok((await one(`select count(*)::int c from login_attempts where username='anitha'`)).c === 0, 'successful login clears failed attempts')
const bad = (await one(`select login_v2('nobody', 'x') r`)).r
ok(!bad.ok && bad.error === 'Incorrect username or password', 'unknown user → same message as wrong password')
await db.query(`update users set is_active=false where username='anitha'`)
ok(/deactivated/.test((await one(`select login_v2('anitha','anitha1') r`)).r.error), 'deactivated user refused by v2')
await db.query(`update users set is_active=true where username='anitha'`)

await db.exec(`insert into platform_admins(name, username, password_hash) values ('Owner','owner', extensions.crypt('ownerpass99', extensions.gen_salt('bf')))`)
for (let i = 0; i < 5; i++) await db.query(`select platform_login_v2('owner', 'nope')`)
ok(/Too many/.test((await one(`select platform_login_v2('owner','ownerpass99') r`)).r.error), 'platform owner locked after 5 wrong passwords')
await db.query(`delete from login_attempts`)
const pv2 = (await one(`select platform_login_v2('owner','ownerpass99') r`)).r
ok(pv2.ok && pv2.token, 'platform_login_v2 works')
ok((await one(`select password_hash h from platform_admins`)).h.startsWith('$2a$10$'), 'platform owner hash upgraded to cost 10')
ok((await one(`select login_v2('owner','ownerpass99') r`)).r.ok === false, 'platform owner still cannot use shop login')

console.log('\n[003] new passwords use cost 10')
const tSuper = (await one(`select login_v2('kk','kkpass1') r`)).r.token
await db.query(`select create_user($1,'New Staff','newstaff','newpass1','staff')`, [tSuper])
ok((await one(`select password_hash h from users where username='newstaff'`)).h.startsWith('$2a$10$'), 'create_user hashes at cost 10')
const shop2 = (await one(`select platform_create_shop($1,'Lakshmi','lakshmi','Asia/Kolkata',null,'Lakshmi','lakshmi','lakpass1') id`, [pv2.token])).id
ok((await one(`select password_hash h from users where username='lakshmi'`)).h.startsWith('$2a$10$'), 'platform_create_shop hashes at cost 10')

console.log('\n[003] WhatsApp order history')
const tAdmin = (await one(`select login_v2('anitha','anitha1') r`)).r.token
const tStaff = (await one(`select login_v2('ravi','ravi123') r`)).r.token
const items = JSON.stringify([{ product_id: '33333333-0000-0000-0000-000000000001', name: 'KitKat', qty: 12, unit: 'box', evil: 'x' }])
const oid = (await one(`select log_whatsapp_order($1,$2,$3,'🛒 Order from Sampath') id`, [tAdmin, NESTLE, items])).id
ok(!!oid, 'admin logs an order')
await db.query(`select log_whatsapp_order($1,$2,$3,'second')`, [tSuper, NESTLE, JSON.stringify([{ name: 'Munch', qty: 3, unit: 'pcs' }])])
ok(/permission/.test(await err(`select log_whatsapp_order($1,$2,$3,'x')`, [tStaff, NESTLE, items])), 'staff cannot log orders')
const list = (await db.query(`select * from get_whatsapp_orders($1)`, [tSuper])).rows
ok(list.length === 2 && list[0].message === 'second', 'super admin sees both orders, newest first')
const first = list.find(o => o.id === oid)
ok(first.agency_name === 'Nestle' && first.whatsapp_number === '919800000001' && first.sent_by_name === 'Anitha', 'order keeps agency, number and sender')
ok(first.item_count === 1 && Number(first.total_qty) === 12 && !('evil' in first.items[0]), 'items counted; unknown fields stripped')
ok((await db.query(`select * from get_whatsapp_orders($1, null, $2)`, [tSuper, list[0].sent_at])).rows.length === 1, '"load more" (p_before) pages correctly')
ok(/permission/.test(await err(`select * from get_whatsapp_orders($1)`, [tAdmin])), 'admin cannot browse history (super admin only)')
ok(/Not logged in/.test(await err(`select * from get_whatsapp_orders(null)`)), 'anonymous cannot browse history')
const t2 = (await one(`select login_v2('lakshmi','lakpass1') r`)).r.token
ok((await db.query(`select * from get_whatsapp_orders($1)`, [t2])).rows.length === 0, 'shop 2 sees none of shop 1\'s orders')
ok(/Agency not found/.test(await err(`select log_whatsapp_order($1,$2,$3,'x')`, [t2, NESTLE, items])), 'shop 2 cannot log an order against shop 1\'s agency')
ok(/at least one/.test(await err(`select log_whatsapp_order($1,$2,'[]','x')`, [tAdmin, NESTLE])), 'empty order rejected')
ok(/too long/.test(await err(`select log_whatsapp_order($1,$2,$3,$4)`, [tAdmin, NESTLE, items, 'x'.repeat(10001)])), 'oversized message rejected')

console.log('\n[003] limits')
ok(/agencies_name_len/.test(await err(`select create_agency($1, $2, null)`, [tSuper, 'A'.repeat(121)])), 'agency name > 120 chars rejected')
ok(/between 0 and 1,000,000/.test(await err(`select submit_stock($1,$2,$3)`, [tStaff, NESTLE, JSON.stringify([{ product_id: '33333333-0000-0000-0000-000000000001', quantity: 2000000 }])])), 'absurd quantity rejected')
ok(!!(await one(`select submit_stock($1,$2,$3) id`, [tStaff, NESTLE, JSON.stringify([{ product_id: '33333333-0000-0000-0000-000000000001', quantity: 7 }])])).id, 'normal stock submission still works')

console.log('\n[003] anonymous access')
ok((await one(`select count(*)::int c from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_schema='public'`)).c === 0, 'no direct table access for anon')
ok((await one(`select count(*)::int c from pg_proc p where proname in ('_hash_password','_hash_is_weak','_login_locked') and has_function_privilege('anon', p.oid, 'execute')`)).c === 0, 'helpers not callable by anon')

console.log('\n[004] remove legacy login')
await db.exec(sql('004_remove_legacy_login.sql'))
ok(/does not exist/.test(await err(`select * from login('kk','kkpass1')`)), 'legacy login() removed')
ok((await one(`select login_v2('kk','kkpass1') r`)).r.ok, 'login_v2 still works after 004')

console.log('\n[rollback_003] restores the 001 state')
// put the legacy logins back (rollback_003 header: "If 004 was applied, run 001's login definitions first")
const s001 = sql('001_multi_tenant.sql')
for (const name of ['login', 'platform_login']) {
  const m = s001.match(new RegExp(`create function public\\.${name}\\(.*?\\n\\$\\$;\\n`, 's'))
  await db.exec(m[0])
}
await db.exec(sql('rollback_003.sql'))
const fnAfter = (await db.query(`select proname, pg_get_functiondef(oid) d from pg_proc where pronamespace='public'::regnamespace order by 1`)).rows
const diff = fnBefore.filter((f, i) => JSON.stringify(f) !== JSON.stringify(fnAfter[i])).map(f => f.proname)
ok(fnAfter.length === fnBefore.length && diff.length === 0, `all ${fnBefore.length} functions identical to the 001 state${diff.length ? ' — differs: ' + diff : ''}`)
ok(!!(await one(`select token from login('ravi','ravi123')`))?.token, 'upgraded (cost 10) passwords still work after rollback')

console.log(`\n==== ${pass} passed, ${fail} failed ====`)
process.exit(fail ? 1 : 0)
