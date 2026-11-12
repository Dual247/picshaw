import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import ts from 'typescript'
const loaded = new Map()
function load(name) {
  if (loaded.has(name)) return loaded.get(name)
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(`lib/platform/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, module: { exports }, Date, Intl, URL, Response, AbortSignal, fetch: () => { throw Error('REAL NETWORK FORBIDDEN') }, require: name => name === 'server-only' ? {} : name === 'node:crypto' ? { randomUUID } : load(name.replace('./', '')) })
  loaded.set(name, exports); return exports
}
const { createReportService } = load('report-service'), { completedWindows, GSC_TIMEZONE } = load('core'), { restoreReviewedBundle } = load('journey')
const copy = v => JSON.parse(JSON.stringify(v)), now = new Date('2026-11-11T16:00:00.000Z')
const actor = { id: randomUUID(), sessionId: randomUUID(), expiresAt: 9999999999 }, organizationId = randomUUID(), connectionId = randomUUID(), propertyId = 'sc-domain:example.com'
const identity = { actor, organizationId }
const selection = { organizationId, connectionId, propertyId }
const metric = (keys, clicks = 20, impressions = 100) => ({ keys, clicks, impressions, ctr: clicks / impressions, position: 10 })
function fixture(request) {
  const days = []
  for (let t = Date.parse(request.window.start); t <= Date.parse(request.window.end); t += 86400000) days.push(new Date(t).toISOString().slice(0, 10))
  const rows = request.dimensions.length === 0 ? [metric([], 560, 2800)] : request.dimensions[0] === 'date' ? days.map(day => metric([day])) : [metric(['https://example.com/a'])]
  return { id: request.snapshotId, runId: request.runId, organizationId: request.organizationId, propertyId: request.propertyId, source: 'google-search-console', retrievedAt: now.toISOString(), timezone: GSC_TIMEZONE, window: request.window, searchType: 'web', filters: [], dimensions: request.dimensions, dataState: 'final', coverage: 'available-rows', warnings: [], rows, accessToken: 'SECRET_EXTRA' }
}
function harness() {
  let operation = null, retained = null, reads = 0, lost = false, fail = false, authorized = true, incomplete = false, poison = false
  const calls = []
  const store = async (id, op, p) => {
    calls.push({ op, p: copy(p) })
    if (!authorized || id.actor.id !== actor.id || id.actor.sessionId !== actor.sessionId || id.organizationId !== organizationId) throw Error('SECRET_DATABASE_SESSION')
    if (op === 'claim') {
      if (operation?.state === 'completed') return { ...operation }
      if (operation?.state === 'running') return { ...operation, state: 'busy', lease: null }
      operation ??= { operationId: randomUUID(), reportId: randomUUID(), runId: randomUUID(), snapshotIds: Array.from({length:6},randomUUID), startedAt: now.toISOString(), generation: 1, windowEnd: p.windowEnd, selection }
      operation = { ...operation, state: 'running', lease: randomUUID(), leaseUntil: new Date(now.getTime() + 300000).toISOString() }
      return copy(operation)
    }
    if (op === 'fail') { operation.state = 'failed'; return {} }
    if (op === 'complete') {
      if (operation.state !== 'running' || p.lease !== operation.lease) throw Error('Stale lease')
      retained = { reportId: operation.reportId, runId: operation.runId, review: copy(p.review) }
      operation.state = 'completed'
      if (lost) { lost = false; throw Error('SECRET_COMMIT_REPLY_LOST') }
      return { state:'completed', reportId:operation.reportId, runId:operation.runId }
    }
    if (op === 'status') return operation
    if (op === 'read') {
      if (!retained) return null
      const result = copy(retained)
      if (poison) { result.token = 'SECRET_OUTER'; result.review.secret = 'SECRET_INNER'; result.review.actions = [{title:'FAKE_LEAD'}]; result.review.totals = 'FAKE_TOTAL'; result.review.snapshots.current.aggregate.secret = 'SECRET_SNAPSHOT'; result.review.snapshots.current.aggregate.rows[0].token = 'SECRET_ROW' }
      return result
    }
    throw Error('Unexpected operation')
  }
  const lifecycle = {
    status: async () => ({ status:'active',connectionId,selectedProperty:propertyId }),
    journeyResolver: () => ({resolve:async value => ({...value,actorId:actor.id})}),
    snapshotReader: async () => ({readSnapshot:async request => {reads++; if(fail)throw Error('SECRET_PROVIDER');const snap=fixture(request);if(incomplete&&request.dimensions[0]==='date')snap.rows.pop();return snap}}),
  }
  const service = createReportService({store,lifecycle,now:()=>now})
  return { service, calls, get operation(){return operation}, get retained(){return retained}, get reads(){return reads}, loseReply:()=>{lost=true}, failProvider:v=>{fail=v}, revoke:()=>{authorized=false}, incomplete:()=>{incomplete=true}, poison:()=>{poison=true}, store, lifecycle }
}
let count = 0
async function test(name, fn) { await fn(); count++; console.log(`PASS ${name}`) }
await test('one durable operation produces six real-source snapshots, exact IDs and no credential fields', async()=>{
  const h=harness(), result=await h.service.sync(identity)
  assert.equal(result.state,'completed');assert.equal(h.reads,6);assert.equal(result.report.review.status,'ready')
  assert.equal(result.report.review.runId,h.operation.runId)
  assert.equal(result.report.review.snapshots.current.aggregate.id,h.operation.snapshotIds[0])
  assert.equal(result.report.review.snapshots.prior.page.id,h.operation.snapshotIds[5])
  assert.equal(result.report.review.totals.current.metrics.clicks,560)
  assert.doesNotMatch(JSON.stringify(result),/SECRET|lease|token/i)
  await h.service.sync(identity);assert.equal(h.reads,6)
})
await test('lost completion acknowledgement replays retained report without refetch or failing committed run',async()=>{
  const h=harness();h.loseReply();await assert.rejects(h.service.sync(identity),/Check status/)
  assert.equal(h.operation.state,'completed');assert.equal(h.calls.filter(c=>c.op==='fail').length,0)
  const result=await h.service.sync(identity);assert.equal(result.state,'completed');assert.equal(h.reads,6)
})
await test('provider failure retains operation IDs for retry, and no partial report survives',async()=>{
  const h=harness();h.failProvider(true);assert.equal((await h.service.sync(identity)).state,'unavailable')
  const id=h.operation.runId;assert.equal(h.retained,null);assert.equal(h.operation.state,'failed')
  h.failProvider(false);assert.equal((await h.service.sync(identity)).report.runId,id)
})
await test('overlapping sync is busy and performs no second provider pass',async()=>{
  const h=harness();await h.store(identity,'claim',{windowEnd:completedWindows(now).current.end})
  assert.equal((await h.service.sync(identity)).state,'busy');assert.equal(h.reads,0)
})
await test('retained incomplete coverage is explicit with no comparison or actions',async()=>{
  const h=harness();h.incomplete();const result=await h.service.sync(identity)
  assert.equal(result.report.review.status,'incomplete');assert.equal(result.report.review.comparison,null);assert.equal(result.report.review.actions.length,0)
})
await test('private reads reauthorize every call, reject cross tenant/session and strip stale summaries/extra secrets',async()=>{
  const h=harness();await h.service.sync(identity);h.poison();const result=await h.service.read(identity)
  assert.equal(result.review.totals.current.metrics.clicks,560);assert.doesNotMatch(JSON.stringify(result),/SECRET|FAKE/)
  for(const wrong of [{...identity,organizationId:randomUUID()},{...identity,actor:{...actor,sessionId:randomUUID()}}])await assert.rejects(h.service.read(wrong))
  h.revoke();await assert.rejects(h.service.read(identity));await assert.rejects(h.service.status(identity))
})
await test('status response omits internal operation, lease, actor, generation and selection',async()=>{
  const h=harness();await h.service.sync(identity);const status=await h.service.status(identity)
  assert.deepEqual(Object.keys(status).sort(),['leaseUntil','reportId','startedAt','state'])
})
await test('corrupted manifests cannot be restored or exposed',async()=>{
  const h=harness();await h.service.sync(identity)
  for(const change of [v=>{v.snapshots.prior.page.id=v.snapshots.current.page.id},v=>{v.snapshots.current.page.organizationId=randomUUID()},v=>{v.snapshots.current.aggregate.rows[0].ctr=2},v=>{v.windows.current.end='2026-11-31'},v=>{delete v.snapshots.prior.daily}]){
    const v=copy(h.retained.review);change(v);assert.throws(()=>restoreReviewedBundle(v))
  }
})
console.log(`${count} report service checks passed. Mock transport and store only; no live network.`)
