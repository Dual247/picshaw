import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const { PGlite } = await import(pathToFileURL(resolve('validation/tenant-database-tooling/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db = new PGlite()
const digest = n => n.toString(16).padStart(64, '0')
const consume = async (action = 'google', principal = digest(1)) =>
  (await db.query('select picshaw_admission_private.consume($1,$2) as allowed', [action, principal])).rows[0].allowed
const clear = () => db.exec('truncate picshaw_admission_private.buckets')
try {
  await db.exec(readFileSync('supabase/tests/bootstrap.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/20261110210013_tenant_foundation.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/20261110211020_public_table_sequence_defaults.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/20261111002801_auth_admission.sql', 'utf8'))
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await db.exec(`set role ${role}`)
    await assert.rejects(consume(), /permission denied/)
    await db.exec('reset role')
  }
  await db.exec('set role picshaw_admission')
  await assert.rejects(db.query('select * from picshaw_admission_private.buckets'), /permission denied/)
  await assert.rejects(db.query('select * from public.organizations'), /permission denied/)
  assert.equal((await db.query("select pg_has_role('picshaw_admission','picshaw_admission_owner','MEMBER') as member")).rows[0].member, false)
  await assert.rejects(consume('bogus'), /Invalid admission input/)
  await assert.rejects(consume('google', 'raw-ip-or-email'), /Invalid admission input/)
  assert.equal(await consume(), true)
  await db.exec('reset role')
  await clear()
  const callbackBurst = await Promise.all(Array.from({length: 10}, () => consume('callback')))
  assert.equal(callbackBurst.filter(Boolean).length, 8)
  await clear()
  const burst = await Promise.all(Array.from({length: 40}, () => consume()))
  assert.equal(burst.filter(Boolean).length, 8)
  const count = await db.query('select count(*)::int as count, max(used) as used from picshaw_admission_private.buckets')
  assert.equal(count.rows[0].count, 5)
  assert.equal(count.rows[0].used, 8)
  await clear()
  const actions = ['google','apple','sign-in']
  const crossAction = await Promise.all(Array.from({length: 30}, (_, n) => consume(actions[n % 3])))
  assert.equal(crossAction.filter(Boolean).length, 20)
  await clear()
  const global = await Promise.all(Array.from({length: 340}, (_, n) => consume('google', digest(n))))
  assert.equal(global.filter(Boolean).length, 300)
  assert.equal((await db.query('select count(*)::int as n from picshaw_admission_private.buckets')).rows[0].n, 902)
  await db.exec("update picshaw_admission_private.buckets set expires_at = clock_timestamp() - interval '1 second'")
  assert.equal(await consume(), true)
  assert.equal((await db.query('select count(*)::int as n from picshaw_admission_private.buckets')).rows[0].n, 5)
  await db.exec("update picshaw_admission_private.buckets set used = 100 where bucket like 'principal:hour:%'")
  assert.equal(await consume('apple'), false)
  await clear()
  await consume()
  await db.exec("update picshaw_admission_private.buckets set used = 3000 where bucket = 'global:hour'")
  assert.equal(await consume('apple', digest(2)), false)
  await clear()
  await db.exec('begin')
  assert.equal(await consume(), true)
  await db.exec('rollback')
  assert.equal((await db.query('select count(*)::int as n from picshaw_admission_private.buckets')).rows[0].n, 0)
  console.log('PASS admission ACLs, input constraints, burst/all-action/global/hour limits, cleanup/expiry, rollback; queued WASM concurrency only, not multi-session hosted contention.')
} finally { await db.close() }
