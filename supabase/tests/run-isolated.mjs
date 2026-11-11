import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// No server, socket, URL, credential, project or network input. Fresh WASM DB only.
// Install the pinned test dependency separately in ignored validation tooling.
const packageEntry = resolve(process.argv[2] ?? 'validation/tenant-database-tooling/node_modules/@electric-sql/pglite/dist/index.js')
const { PGlite } = await import(pathToFileURL(packageEntry).href)
const db = new PGlite()
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const migrations = readdirSync(new URL('../migrations/', import.meta.url)).filter(name => name.endsWith('.sql')).sort()
assert.equal(migrations.length, 2, 'Review the runner when another migration is added')
try {
  await db.exec(read('./bootstrap.sql'))
  for (const name of migrations) await db.exec(read('../migrations/' + name))
  const results = [...await db.exec(read('./tenant-policy.test.sql')), ...await db.exec(read('./default-privileges.test.sql'))]
  const rows = results.flatMap(result => result.rows ?? [])
  for (const row of rows) if (row.result) console.log(row.result)
  console.log('PASS isolated PostgreSQL WASM policies/constraints with mocked Auth roles; this run does not test hosted Supabase.')
} finally {
  await db.close()
}



