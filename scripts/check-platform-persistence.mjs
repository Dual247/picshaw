import assert from 'node:assert/strict'
import vm from 'node:vm'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

// Fresh local PostgreSQL WASM only. No URLs, credentials, network or hosted target.
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2] ?? 'validation/tenant-database-tooling/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db = new PGlite()
function load(name, dependencies = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(`lib/platform/${name}.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, module: { exports }, Date, Intl, URL, Response, AbortSignal,
    fetch: () => { throw Error('REAL NETWORK FORBIDDEN') }, require: name => {
      if (name === 'server-only') return {}
      if (name === 'node:crypto') return { randomUUID }
      if (name in dependencies) return dependencies[name]
      throw Error(`Unexpected dependency ${name}`)
    },
  })
  return exports
}
const core = load('core'), gsc = load('gsc', { './core': core }), journey = load('journey', { './core': core })
const persistence = load('persistence', { './core': core, './gsc': gsc, './journey': journey })
const copy = value => JSON.parse(JSON.stringify(value))
const sourceTime = new Date('2026-11-10T12:00:00Z')
const windows = core.completedWindows(sourceTime, 2)
const observation = (clicks, impressions, keys = []) => ({ keys, clicks, impressions, ctr: impressions ? clicks / impressions : 0, position: impressions ? 10 : null })
function source(request) {
  const prior = request.window.start === windows.prior.start
  const rows = request.dimensions.length === 0 ? [observation(prior ? 200 : 40, prior ? 4000 : 2000)]
    : request.dimensions[0] === 'date' ? [request.window.start, request.window.end].map(date => observation(prior ? 100 : 20, prior ? 2000 : 1000, [date]))
      : [observation(prior ? 100 : 20, 1000, ["https://example.com/a?q=';DROP%20TABLE%20reports;--"])]
  return { id: request.snapshotId, organizationId: request.organizationId, propertyId: request.propertyId, runId: request.runId,
    source: 'google-search-console', retrievedAt: sourceTime.toISOString(), timezone: core.GSC_TIMEZONE,
    window: { ...request.window }, searchType: 'web', filters: [], dimensions: [...request.dimensions], dataState: 'final', coverage: 'available-rows', warnings: [], rows }
}
let tests = 0
async function test(name, fn) { await fn(); tests++; console.log(`PASS ${name}`) }
async function fixture(options = {}) {
  const actorId = randomUUID(), organizationId = randomUUID(), connectionId = randomUUID(), sessionId = randomUUID()
  const selection = { organizationId, connectionId, propertyId: 'sc-domain:example.com' }
  const expiresAt = Date.now() + 300_000
  await db.exec('reset role')
  await db.query('insert into auth.users(id) values ($1)', [actorId])
  await db.query('insert into public.organizations(id,name) values ($1,$2)', [organizationId, 'Synthetic persistence test'])
  await db.query('insert into public.organization_memberships(organization_id,user_id,role) values ($1,$2,$3)', [organizationId, actorId, options.role ?? 'owner'])
  await db.query('insert into public.google_connections(organization_id,id,label,created_by) values ($1,$2,$3,$4)', [organizationId, connectionId, 'Synthetic metadata only', actorId])
  await db.query('insert into persistence_test.sessions(actor_id,session_id,expires_at) values ($1,$2,to_timestamp($3/1000.0))', [actorId, sessionId, expiresAt])
  await db.exec('set role service_role')
  const queries = [], releases = [], networkChecks = [], sources = []
  let queue = Promise.resolve(), acquired = 0
  const database = { acquire: async () => {
    const previous = queue
    let unlock
    queue = new Promise(resolve => { unlock = resolve })
    await previous
    acquired++
    return {
      query: async (sql, parameters = []) => {
        queries.push({ sql, parameters: copy(parameters) })
        await options.beforeQuery?.(sql, parameters)
        const result = await db.query(sql, parameters)
        await options.afterQuery?.(sql, parameters, result)
        return result
      },
      release: async discard => {
        releases.push(discard)
        if (discard) { try { await db.query('rollback') } catch { /* Emulate closing a failed physical connection. */ } }
        unlock()
        await options.release?.(discard)
      },
    }
  } }
  const authority = {
    verify: async () => {
      networkChecks.push(queries.length)
      return options.verify ? options.verify({ actorId, sessionId, expiresAt }, networkChecks.length) : { actorId, sessionId, expiresAt }
    },
    lockCurrent: async (transaction, identity) => {
      if (options.lockCurrent) return options.lockCurrent(transaction, identity)
      const result = await transaction.query(`select actor_id, session_id, extract(epoch from expires_at)*1000 as expires_at
        from persistence_test.sessions where actor_id = $1::uuid and session_id = $2::uuid
        and revoked_at is null and expires_at > clock_timestamp() for share`, [identity.actorId, identity.sessionId])
      if (result.rows.length !== 1) throw Error('Synthetic revoked session')
      return { actorId: result.rows[0].actor_id, sessionId: result.rows[0].session_id, expiresAt: Number(result.rows[0].expires_at) }
    },
  }
  const service = persistence.createPersistentSearchJourney({ database, authority, ...(options.clock ? { now: options.clock } : {}), journey: {
    resolver: { resolve: async selected => ({ ...selected, actorId: options.sourceActor ?? actorId }) },
    reader: { readSnapshot: async request => { const value = source(request); sources.push(value); await options.modifySource?.(value, sources.length - 1); return value } },
    now: () => sourceTime, days: 2,
  } })
  const counts = async () => {
    const result = {}
    for (const table of ['source_runs', 'source_snapshots', 'recommended_actions', 'reports']) result[table] = Number((await db.query(`select count(*) as count from public.${table} where organization_id = $1`, [organizationId])).rows[0].count)
    return result
  }
  return { actorId, organizationId, connectionId, sessionId, selection, queries, releases, networkChecks, sources, counts, prepare: (input = selection) => service.prepare(input), acquired: () => acquired }
}
const noArtifacts = { source_runs: 0, source_snapshots: 0, recommended_actions: 0, reports: 0 }
try {
  await db.exec(readFileSync('supabase/tests/bootstrap.sql', 'utf8'))
  const migrations = readdirSync('supabase/migrations').filter(name => name.endsWith('.sql')).sort()
  assert.equal(migrations.filter(name => name.endsWith('_tenant_foundation.sql')).length, 1, 'Exactly one tenant foundation is required')
  for (const name of migrations) await db.exec(readFileSync(`supabase/migrations/${name}`, 'utf8'))

  // Session authority is explicitly synthetic. No auth.sessions permission is added
  // to the actual schema, and no hosted session implementation is implied.
  await db.exec(`create schema persistence_test;
    create table persistence_test.sessions(actor_id uuid, session_id uuid primary key, expires_at timestamptz, revoked_at timestamptz);
    grant usage on schema persistence_test to service_role;
    grant select, update on persistence_test.sessions to service_role;`)

  await test('actual SQL commits exact run, six immutable snapshots, actions and private report atomically', async () => {
    const h = await fixture(), prepared = await h.prepare()
    assert.equal(prepared.status, 'prepared')
    assert.equal(h.acquired(), 0, 'Collection must not open a database transaction')
    assert.deepEqual(await h.counts(), noArtifacts)
    const receipt = await prepared.commit()
    assert.equal(receipt.status, 'committed')
    assert.equal(receipt.runId, prepared.review.runId)
    assert.deepEqual(await h.counts(), { source_runs: 1, source_snapshots: 6, recommended_actions: 3, reports: 1 })
    const report = (await db.query('select * from public.reports where organization_id=$1 and id=$2', [h.organizationId, receipt.reportId])).rows[0]
    assert.equal(report.snapshot_id, prepared.review.snapshots.current.page.id)
    assert.equal(report.prior_snapshot_id, prepared.review.snapshots.prior.page.id)
    assert.equal(report.created_by, h.actorId)
    assert.equal(h.networkChecks.length, 2)
    assert.ok(h.networkChecks.every(position => position === 0), 'Network authentication must precede BEGIN')
    assert.ok(h.queries.some(query => query.sql.includes('organization_memberships') && query.sql.includes('for share')))
    assert.ok(h.queries.some(query => query.sql.includes('google_connections') && query.sql.includes('for update')))
    assert.ok(h.queries.some(query => query.sql.includes('persistence_test.sessions') && query.sql.includes('for share')))
    assert.ok(h.queries.every(query => !query.sql.includes('DROP%20TABLE')), 'Provider values must never be interpolated into SQL')
    assert.deepEqual(h.releases, [false])
  })
  await test('replaying the same server capability verifies every stored row and returns the same report', async () => {
    const h = await fixture(), prepared = await h.prepare(), first = await prepared.commit(), before = await h.counts(), second = await prepared.commit()
    assert.equal(second.status, 'already_committed')
    assert.equal(second.reportId, first.reportId)
    assert.deepEqual(await h.counts(), before)
    assert.equal(h.networkChecks.length, 3, 'Replay must reauthenticate')
  })
  await test('simultaneous retries serialize and commit only one exact cohort', async () => {
    const h = await fixture(), prepared = await h.prepare()
    const result = await Promise.all([prepared.commit(), prepared.commit()])
    assert.deepEqual(result.map(item => item.status).sort(), ['already_committed', 'committed'])
    assert.equal(result[0].reportId, result[1].reportId)
    assert.deepEqual(await h.counts(), { source_runs: 1, source_snapshots: 6, recommended_actions: 3, reports: 1 })
  })
  await test('failures at every insert stage roll back all earlier artifacts', async () => {
    for (const table of ['source_runs', 'source_snapshots', 'recommended_actions', 'reports']) {
      const h = await fixture({ beforeQuery: sql => { if (sql.startsWith(`insert into public.${table}`)) throw Error('private SQL detail') } })
      const prepared = await h.prepare()
      await assert.rejects(prepared.commit(), error => error.code === 'PERSISTENCE_FAILED' && !error.message.includes('private'))
      assert.deepEqual(await h.counts(), noArtifacts)
      assert.equal(h.releases.at(-1), true)
      assert.ok(h.queries.some(query => query.sql === 'rollback'))
    }
  })
  await test('late replay-verification failure rolls back the otherwise complete cohort', async () => {
    const h = await fixture({ afterQuery: (sql, _parameters, result) => { if (sql.includes('public.reports actual')) result.rows[0].matches = false } })
    const prepared = await h.prepare()
    await assert.rejects(prepared.commit(), error => error.code === 'IDEMPOTENCY_CONFLICT')
    assert.deepEqual(await h.counts(), noArtifacts)
  })
  await test('lost COMMIT confirmation is unknown and exact replay safely reconciles without duplication', async () => {
    let first = true
    const h = await fixture({ afterQuery: sql => { if (sql === 'commit' && first) { first = false; throw Error('connection disappeared after commit') } } })
    const prepared = await h.prepare()
    await assert.rejects(prepared.commit(), error => error.code === 'COMMIT_OUTCOME_UNKNOWN')
    assert.deepEqual(await h.counts(), { source_runs: 1, source_snapshots: 6, recommended_actions: 3, reports: 1 })
    assert.equal((await prepared.commit()).status, 'already_committed')
    assert.deepEqual(await h.counts(), { source_runs: 1, source_snapshots: 6, recommended_actions: 3, reports: 1 })
  })
  await test('failed rollback is explicit and failed connections are discarded', async () => {
    const h = await fixture({ beforeQuery: sql => { if (sql.startsWith('insert into public.source_snapshots') || sql === 'rollback') throw Error('connection failure') } })
    const prepared = await h.prepare()
    await assert.rejects(prepared.commit(), error => error.code === 'ROLLBACK_UNCONFIRMED')
    assert.deepEqual(await h.counts(), noArtifacts)
    assert.equal(h.releases.at(-1), true)
  })
  await test('pool release error cannot disguise a confirmed commit as a failed transaction', async () => {
    const h = await fixture({ release: () => { throw Error('pool cleanup error') } }), prepared = await h.prepare()
    assert.equal((await prepared.commit()).status, 'committed')
    assert.equal((await h.counts()).source_runs, 1)
  })
  await test('member and viewer roles cannot commit imports', async () => {
    for (const role of ['member', 'viewer']) {
      const h = await fixture({ role }), prepared = await h.prepare()
      await assert.rejects(prepared.commit(), error => error.code === 'UNAUTHORIZED')
      assert.deepEqual(await h.counts(), noArtifacts)
    }
    const h = await fixture({ role: 'admin' }), prepared = await h.prepare()
    assert.equal((await prepared.commit()).status, 'committed')
  })
  await test('membership revocation, role downgrade and connection disconnect after collection deny commit', async () => {
    for (const mutation of [
      h => db.query('update public.organization_memberships set revoked_at=clock_timestamp() where organization_id=$1', [h.organizationId]),
      h => db.query("update public.organization_memberships set role='viewer' where organization_id=$1", [h.organizationId]),
      h => db.query("update public.google_connections set status='disconnected' where organization_id=$1", [h.organizationId]),
      h => db.query("update public.google_connections set status='reconnect_required' where organization_id=$1", [h.organizationId]),
    ]) {
      const h = await fixture(), prepared = await h.prepare()
      await mutation(h)
      await assert.rejects(prepared.commit(), error => error.code === 'UNAUTHORIZED')
      assert.deepEqual(await h.counts(), noArtifacts)
    }
  })
  await test('cross-tenant and wrong-connection selections are denied independently of the collection resolver', async () => {
    const h = await fixture(), other = await fixture()
    for (const input of [{ ...h.selection, connectionId: other.connectionId }, other.selection]) {
      const prepared = await h.prepare(input)
      await assert.rejects(prepared.commit(), error => error.code === 'UNAUTHORIZED')
    }
    assert.deepEqual(await h.counts(), noArtifacts)
    assert.deepEqual(await other.counts(), noArtifacts)
  })
  await test('a previously committed run still requires current authority on retry', async () => {
    const h = await fixture(), prepared = await h.prepare()
    await prepared.commit()
    await db.query("update public.google_connections set status='disconnected' where organization_id=$1", [h.organizationId])
    await assert.rejects(prepared.commit(), error => error.code === 'UNAUTHORIZED')
    assert.equal((await h.counts()).source_runs, 1)
  })
  await test('revoked session denied by transaction-local authority despite still-valid identity token', async () => {
    const h = await fixture(), prepared = await h.prepare()
    await db.query('update persistence_test.sessions set revoked_at=clock_timestamp() where session_id=$1', [h.sessionId])
    await assert.rejects(prepared.commit(), error => error.code === 'UNAUTHORIZED')
    assert.equal(h.networkChecks.length, 2)
    assert.deepEqual(await h.counts(), noArtifacts)
  })
  await test('identity or session changed during collection fails before acquiring DB session', async () => {
    for (const field of ['actorId', 'sessionId']) {
      const h = await fixture({ verify: (identity, count) => count === 1 ? identity : { ...identity, [field]: randomUUID() } })
      const prepared = await h.prepare()
      await assert.rejects(prepared.commit(), error => error.code === 'UNAUTHORIZED')
      assert.equal(h.acquired(), 0)
      assert.deepEqual(await h.counts(), noArtifacts)
    }
  })
  await test('missing/expired identity and unsupported session lock never permit a write', async () => {
    const h = await fixture({ verify: identity => ({ ...identity, expiresAt: 0 }) })
    await assert.rejects(h.prepare(), error => error.code === 'UNAUTHORIZED')
    assert.equal(h.sources.length, 0)
    for (const value of [undefined, { actorId: randomUUID(), sessionId: randomUUID(), expiresAt: Date.now() + 10000 }]) {
      const h = await fixture({ lockCurrent: async () => value }), prepared = await h.prepare()
      await assert.rejects(prepared.commit(), error => error.code === 'UNAUTHORIZED')
      assert.deepEqual(await h.counts(), noArtifacts)
    }
  })
  await test('session expiry while transaction is in progress causes rollback before COMMIT', async () => {
    let expired = false
    const h = await fixture({ clock: () => expired ? Date.now() + 600000 : Date.now(), afterQuery: sql => { if (sql.includes('public.reports actual')) expired = true } })
    const prepared = await h.prepare()
    await assert.rejects(prepared.commit(), error => error.code === 'UNAUTHORIZED')
    assert.deepEqual(await h.counts(), noArtifacts)
  })
  await test('resolver cannot substitute another actor and unavailable collection never opens a transaction', async () => {
    const h = await fixture({ sourceActor: randomUUID() })
    await assert.rejects(h.prepare(), error => error.code === 'UNAUTHORIZED')
    assert.equal(h.sources.length, 0)
    const bad = await fixture({ modifySource: (_source, i) => { if (i === 3) throw new core.PlatformError('PROVIDER_UNAVAILABLE', 'secret') } })
    const result = await bad.prepare()
    assert.equal(result.status, 'unavailable')
    assert.equal(bad.acquired(), 0)
    assert.deepEqual(await bad.counts(), noArtifacts)
  })
  await test('incomplete reviewed evidence persists with all six snapshots and no invented actions', async () => {
    const h = await fixture({ modifySource: (value, i) => { if (i === 1) value.rows = value.rows.slice(0, 1) } })
    const prepared = await h.prepare()
    assert.equal(prepared.review.status, 'incomplete')
    assert.equal(prepared.review.comparison, null)
    await prepared.commit()
    assert.deepEqual(await h.counts(), { source_runs: 1, source_snapshots: 6, recommended_actions: 0, reports: 1 })
  })
  await test('missing prior-page evidence maps to SQL NULL rather than a JSON null value', async () => {
    const h = await fixture({ modifySource: (value, i) => { if (i === 5) value.rows = [] } }), prepared = await h.prepare()
    assert.equal(prepared.review.actions.length, 1)
    assert.equal(prepared.review.actions[0].prior, null)
    await prepared.commit()
    const rows = (await db.query('select prior_row is null as absent from public.recommended_actions where organization_id=$1', [h.organizationId])).rows
    assert.equal(rows.length, 1)
    assert.equal(rows[0].absent, true)
  })
  await test('source mutations and arbitrary commit arguments cannot alter retained reviewed evidence', async () => {
    const h = await fixture(), prepared = await h.prepare()
    assert.ok(Object.isFrozen(prepared))
    assert.throws(() => { prepared.review.snapshots.current.page.rows[0].clicks = 900 }, TypeError)
    h.sources[2].rows[0].clicks = 900
    await prepared.commit({ actorId: randomUUID(), runId: randomUUID(), snapshots: [] })
    const actual = await db.query('select rows from public.source_snapshots where organization_id=$1 and id=$2', [h.organizationId, prepared.review.snapshots.current.page.id])
    assert.equal(actual.rows[0].rows[0].clicks, 20)
  })
  await test('incomplete pre-existing run is an idempotency conflict, never silently completed', async () => {
    const h = await fixture(), prepared = await h.prepare(), review = prepared.review
    await db.query(`insert into public.source_runs(organization_id,id,connection_id,property_id,current_start,current_end,prior_start,prior_end,created_by)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [h.organizationId, review.runId, h.connectionId, h.selection.propertyId, review.windows.current.start, review.windows.current.end, review.windows.prior.start, review.windows.prior.end, h.actorId])
    await assert.rejects(prepared.commit(), error => error.code === 'IDEMPOTENCY_CONFLICT')
    assert.deepEqual(await h.counts(), { source_runs: 1, source_snapshots: 0, recommended_actions: 0, reports: 0 })
  })
  await test('unexpected report in an existing run is a conflict rather than an accepted replay', async () => {
    const h = await fixture(), prepared = await h.prepare()
    await prepared.commit()
    await db.query(`insert into public.reports(organization_id,id,run_id,property_id,snapshot_id,prior_snapshot_id,version,created_by)
      select organization_id,$1,run_id,property_id,snapshot_id,prior_snapshot_id,version,created_by from public.reports where organization_id=$2`, [randomUUID(), h.organizationId])
    await assert.rejects(prepared.commit(), error => error.code === 'IDEMPOTENCY_CONFLICT')
  })
  console.log(`${tests} persistence checks passed using actual isolated PostgreSQL WASM SQL. Synthetic source/session providers only; no hosted writes or live driver/session binding tested.`)
} finally { await db.close() }


