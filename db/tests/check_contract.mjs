import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const db = new PGlite({ extensions: { pgcrypto } })
await db.exec(`create role anon; create role authenticated;`)
await db.exec(fs.readFileSync(`${ROOT}db/reference_production_schema.sql`, 'utf8'))
await db.exec(fs.readFileSync(`${ROOT}db/001_multi_tenant.sql`, 'utf8'))
const fns = {}
for (const r of (await db.query(`select proname, proargnames, proargmodes, pronargdefaults, pronargs from pg_proc where pronamespace='public'::regnamespace`)).rows) {
  const names = (r.proargnames ?? []).filter((_, i) => !r.proargmodes || ['i', 'b'].includes(r.proargmodes[i]))
  fns[r.proname] = { names, required: names.slice(0, r.pronargs - r.pronargdefaults) }
}
let bad = 0, n = 0
for (const f of fs.readdirSync(`${ROOT}src/services`)) {
  const src = fs.readFileSync(`${ROOT}src/services/${f}`, 'utf8')
  for (const m of src.matchAll(/rpc\('(\w+)',\s*(\{[\s\S]*?\})\s*\)/g)) {
    n++
    const keys = [...m[2].matchAll(/(p_\w+)\s*:/g)].map(k => k[1])
    const fn = fns[m[1]]
    const problems = !fn ? ['function missing'] : [
      ...keys.filter(k => !fn.names.includes(k)).map(k => `unknown arg ${k}`),
      ...fn.required.filter(k => !keys.includes(k)).map(k => `missing arg ${k}`)]
    if (problems.length) { bad++; console.log('BAD ', f, m[1], problems.join(', ')) }
  }
}
console.log(`${n} rpc calls checked, ${bad} problems`)
