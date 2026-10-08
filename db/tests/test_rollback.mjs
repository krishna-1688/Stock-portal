// Backup → migrate → rollback must return the database to exactly the
// production schema, with all of Shop #1's data intact.
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const DB_DIR = fileURLToPath(new URL('../', import.meta.url))
const sql = (f) => fs.readFileSync(`${DB_DIR}${f}`, 'utf8')
let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  FAIL', m) } }

async function freshProd() {
  const db = new PGlite({ extensions: { pgcrypto } })
  await db.exec(`create role anon; create role authenticated;`)
  await db.exec(sql('reference_production_schema.sql'))
  await db.exec(`
    set search_path = public, extensions;
    insert into users(id,name,username,password_hash,role) values
      ('11111111-0000-0000-0000-000000000001','KK','kk',crypt('kkpass1',gen_salt('bf')),'super_admin'),
      ('11111111-0000-0000-0000-000000000003','Ravi','ravi',crypt('ravi123',gen_salt('bf')),'staff');
    insert into agencies(id,name) values ('22222222-0000-0000-0000-000000000001','Nestle');
    insert into products(id,agency_id,name) values ('33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','KitKat');
    insert into stock_submissions(id,agency_id,submitted_by) values ('44444444-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000003');
    insert into stock_submission_items(submission_id,product_id,quantity) values ('44444444-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001',4);
    set search_path = public;`)
  return db
}

const shape = async (db) => ({
  functions: (await db.query(`select proname, pg_get_functiondef(oid) d from pg_proc where pronamespace='public'::regnamespace order by 1`)).rows,
  columns: (await db.query(`select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' order by 1,2`)).rows,
  constraints: (await db.query(`select conrelid::regclass::text t, conname, pg_get_constraintdef(oid) d from pg_constraint where connamespace='public'::regnamespace order by 1,2`)).rows,
})
const rows = async (db, t) => (await db.query(`select * from public.${t} order by id`)).rows

console.log('\n[rollback] backup → migrate → use → rollback')
const db = await freshProd()
const before = await shape(db)
const usersBefore = JSON.stringify(await rows(db, 'users'))

const backupCounts = (await db.exec(sql('000_backup_before_migration.sql'))).at(-1).rows
ok(backupCounts.length === 6 && backupCounts.every(r => r.live === r.backup), 'backup: live and backup row counts match for all 6 tables')

await db.exec(sql('001_multi_tenant.sql'))
const tok = (await db.query(`select token from login('kk','kkpass1')`)).rows[0].token
await db.query(`select create_product($1, '22222222-0000-0000-0000-000000000001', 'Added after migration')`, [tok])

await db.exec(sql('rollback_001.sql'))
const after = await shape(db)
ok(JSON.stringify(after.functions) === JSON.stringify(before.functions), `all ${before.functions.length} functions identical to production originals`)
ok(JSON.stringify(after.columns) === JSON.stringify(before.columns), 'all columns identical to production')
ok(JSON.stringify(after.constraints) === JSON.stringify(before.constraints), 'all constraints identical to production')
ok(JSON.stringify(await rows(db, 'users')) === usersBefore, 'users unchanged')
ok((await rows(db, 'products')).some(p => p.name === 'Added after migration'), 'data entered after migration is kept')
ok((await db.query(`select token from login('kk','kkpass1')`)).rows.length === 1, 'original login works after rollback')
ok((await db.query(`select count(*)::int c from backup_pre_multitenant.users`)).rows[0].c === 2, 'backup schema still there')

console.log('\n[rollback] refused once another shop exists')
const db2 = await freshProd()
await db2.exec(sql('001_multi_tenant.sql'))
await db2.exec(`insert into shops(name, code) values ('Other', 'other')`)
const err = await db2.exec(sql('rollback_001.sql')).then(() => null, e => e.message)
await db2.exec('rollback').catch(() => {})
ok(err?.includes('Other shops exist'), 'rollback refused: ' + err)
ok((await db2.query(`select count(*)::int c from shops`)).rows[0].c === 2, 'nothing changed by the refused rollback')

console.log(`\n==== ${pass} passed, ${fail} failed ====`)
process.exit(fail ? 1 : 0)
