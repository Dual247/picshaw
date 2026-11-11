import assert from 'node:assert/strict'
import vm from 'node:vm'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function load(name, dependencies = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(`lib/platform/${name}.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, module: { exports }, Date, Intl, URL, Response, AbortSignal,
    fetch: () => { throw Error('REAL NETWORK FORBIDDEN') },
    require: name => {
      if (name === 'server-only') return {}
      if (name === 'node:crypto') return { randomUUID }
      if (name in dependencies) return dependencies[name]
      throw Error(`Unexpected dependency: ${name}`)
    },
  })
  return exports
}
const core = load('core'), gsc = load('gsc', { './core': core }), journey = load('journey', { './core': core })
const copy = value => JSON.parse(JSON.stringify(value))
const ids = {
  actorId: '10000000-0000-4000-8000-000000000001',
  organizationId: '10000000-0000-4000-8000-000000000002',
  connectionId: '10000000-0000-4000-8000-000000000003',
}
const selection = { organizationId: ids.organizationId, connectionId: ids.connectionId, propertyId: 'sc-domain:example.com' }
const now = new Date('2026-11-10T12:00:00Z')
const windows = core.completedWindows(now, 2)
const row = (clicks, impressions, keys = [], position = impressions ? 10 : null) => ({ keys, clicks, impressions, ctr: impressions ? clicks / impressions : 0, position })
function fixture(request) {
  const prior = request.window.start === windows.prior.start
  const days = [request.window.start, request.window.end]
  const rows = request.dimensions.length === 0 ? [row(prior ? 200 : 40, prior ? 4000 : 2000)]
    : request.dimensions[0] === 'date' ? days.map(date => row(prior ? 100 : 20, prior ? 2000 : 1000, [date]))
      : [row(prior ? 100 : 20, 1000, ['https://example.com/a'])]
  return {
    id: request.snapshotId, organizationId: request.organizationId, propertyId: request.propertyId,
    runId: request.runId, source: 'google-search-console', retrievedAt: now.toISOString(),
    timezone: core.GSC_TIMEZONE, window: { ...request.window }, searchType: 'web', filters: [],
    dimensions: [...request.dimensions], dataState: 'final', coverage: 'available-rows', warnings: [], rows,
  }
}
function harness(options = {}) {
  const requests = [], sources = [], resolutions = []
  const reader = options.reader ?? { readSnapshot: async request => {
    requests.push(request)
    const source = fixture(request)
    sources.push(source)
    await options.modify?.(source, requests.length - 1, request, sources)
    return source
  } }
  const resolver = options.resolver ?? { resolve: async selected => {
    resolutions.push(selected)
    return { ...selected, actorId: ids.actorId }
  } }
  const service = journey.createSearchJourney({ resolver, reader, now: () => now, days: 2, ...options.dependencies })
  return { requests, sources, resolutions, run: (input = selection) => service.run(input) }
}
let count = 0
async function test(name, fn) { await fn(); count++; console.log(`PASS ${name}`) }
const noClaims = result => { assert.equal(result.comparison, null); assert.equal(result.actions.length, 0) }
const unavailable = result => { assert.equal(result.status, 'unavailable'); noClaims(result); assert.equal('snapshots' in result, false); assert.equal('totals' in result, false) }

await test('six trusted snapshots yield separate property totals and evidence-backed actions', async () => {
  const h = harness(), result = await h.run({ ...selection, actorId: 'attacker', runId: 'attacker', snapshotId: 'attacker' })
  assert.equal(result.status, 'ready')
  assert.equal(h.resolutions.length, 1)
  assert.equal(h.requests.length, 6)
  assert.deepEqual(copy(h.requests.map(request => request.dimensions)), [[], ['date'], ['page'], [], ['date'], ['page']])
  assert.ok(h.requests.every(request => request.actorId === ids.actorId && request.runId === result.runId))
  assert.equal(new Set([result.runId, ...h.requests.map(request => request.snapshotId)]).size, 7)
  assert.ok(h.requests.every(request => request.maxPages === 4))
  assert.equal(result.totals.current.metrics.clicks, 40)
  assert.equal(result.snapshots.current.page.rows[0].clicks, 20)
  assert.equal(result.comparison.clicks.absolute, -160)
  assert.equal(result.comparison.clicks.relative, -.8)
  assert.equal(result.actions.length, 3)
  assert.ok(result.actions.every(action => action.snapshotId === result.snapshots.current.page.id && action.priorSnapshotId === result.snapshots.prior.page.id))
})
await test('default requests retain the conservative 28-day Pacific windows', async () => {
  const h = harness({ dependencies: { days: undefined } })
  const result = await h.run()
  assert.deepEqual(copy(result.windows), copy(core.completedWindows(now)))
  assert.equal(result.status, 'incomplete')
  noClaims(result)
})
await test('missing daily date is unknown even when its presumed zero would reconcile totals', async () => {
  const h = harness({ modify: (source, i) => {
    if (i === 1) source.rows = [row(40, 2000, [source.window.start])]
  } })
  const result = await h.run()
  assert.equal(result.status, 'incomplete')
  assert.deepEqual(copy(result.coverage.current.missingDates), [windows.current.end])
  assert.equal(result.coverage.current.status, 'unknown')
  assert.equal(result.totals.current.metrics.clicks, 40)
  noClaims(result)
})
await test('entirely absent source rows remain unknown, not zero or a known empty site', async () => {
  const result = await harness({ modify: source => { source.rows = [] } }).run()
  assert.equal(result.status, 'incomplete')
  assert.equal(result.totals.current.metrics, null)
  assert.equal(result.totals.current.status, 'missing')
  assert.equal(result.coverage.current.missingDates.length, 2)
  noClaims(result)
})
function makeZero(source) {
  source.rows = source.dimensions[0] === 'page' ? [] : source.rows.map(observation => row(0, 0, observation.keys))
}
await test('explicit aggregate zeros do not make missing daily dates complete', async () => {
  const result = await harness({ modify: source => {
    makeZero(source)
    if (source.dimensions[0] === 'date') source.rows = []
  } }).run()
  assert.equal(result.status, 'incomplete')
  assert.equal(result.totals.current.metrics.clicks, 0)
  noClaims(result)
})
await test('known empty requires explicit all-day zero observations and aggregate rows', async () => {
  const result = await harness({ modify: makeZero }).run()
  assert.equal(result.status, 'empty')
  assert.equal(result.coverage.current.status, 'complete')
  assert.equal(result.comparison.clicks.absolute, 0)
  assert.equal(result.comparison.clicks.relative, null)
  assert.equal(result.comparison.positionChange, null)
  assert.equal(result.actions.length, 0)
})
await test('zero prior baseline has no percentage claim and no invented prior page evidence', async () => {
  const result = await harness({ modify: (source, i) => { if (i >= 3) makeZero(source) } }).run()
  assert.equal(result.status, 'ready')
  assert.equal(result.comparison.clicks.relative, null)
  assert.ok(result.actions.every(action => action.rule === 'ranking-opportunity' && action.prior === null))
})
await test('empty aggregate cannot be reconstructed from full daily or page rows', async () => {
  const result = await harness({ modify: (source, i) => { if (i === 0) source.rows = [] } }).run()
  assert.equal(result.status, 'incomplete')
  assert.equal(result.totals.current.metrics, null)
  noClaims(result)
})
await test('different available page sums never override aggregate totals or coverage', async () => {
  const result = await harness({ modify: source => {
    if (source.dimensions[0] === 'page') source.rows.push(row(200, 20000, ['https://example.com/another-page']))
  } }).run()
  assert.equal(result.status, 'ready')
  assert.equal(result.totals.current.metrics.clicks, 40)
  assert.equal(result.totals.current.metrics.impressions, 2000)
})
await test('no observed pages yields no actions without substituting page traffic', async () => {
  const result = await harness({ modify: source => { if (source.dimensions[0] === 'page') source.rows = [] } }).run()
  assert.equal(result.status, 'ready')
  assert.equal(result.actions.length, 0)
  assert.equal(result.totals.current.metrics.clicks, 40)
})
await test('every bounded grain suppresses all comparison and action claims', async () => {
  for (let index = 0; index < 6; index++) {
    const result = await harness({ modify: (source, i) => { if (i === index) source.coverage = 'bounded' } }).run()
    assert.equal(result.status, 'incomplete')
    assert.ok(result.coverage[index < 3 ? 'current' : 'prior'].reasons.includes('BOUNDED_SOURCE'))
    noClaims(result)
  }
})
await test('daily counts and weighted position must agree with property totals', async () => {
  for (const patch of [row(41, 2000), row(40, 2001), row(40, 2000, [], 11)]) {
    const result = await harness({ modify: (source, i) => { if (i === 0) source.rows = [patch] } }).run()
    assert.equal(result.status, 'inconsistent')
    assert.ok(result.coverage.current.reasons.includes('TOTALS_MISMATCH'))
    noClaims(result)
  }
})
await test('literal zero property activity contradicting observed page activity is inconsistent, without summing pages', async () => {
  for (const clicksOnly of [false, true]) {
    const result = await harness({ modify: (source, i) => {
      if (i > 1) return
      source.rows = source.rows.map(observation => row(0, clicksOnly ? observation.impressions : 0, observation.keys))
    } }).run()
    assert.equal(result.status, 'inconsistent')
    assert.ok(result.coverage.current.reasons.includes('CONFLICTING_ACTIVITY'))
    assert.equal(result.totals.current.metrics.clicks, 0)
    assert.equal(result.snapshots.current.page.rows[0].clicks, 20)
    noClaims(result)
  }
})
await test('harmless floating-point position rounding is accepted', async () => {
  const result = await harness({ modify: (source, i) => { if (i === 0) source.rows[0].position += 1e-8 } }).run()
  assert.equal(result.status, 'ready')
})
await test('unauthorized actor, tenant, connection or property prevents every source read', async () => {
  for (const value of [null, { ...selection, actorId: '' }, { ...selection, actorId: ids.actorId, organizationId: randomUUID() }, { ...selection, actorId: ids.actorId, connectionId: randomUUID() }, { ...selection, actorId: ids.actorId, propertyId: 'https://example.com/' }]) {
    const h = harness({ resolver: { resolve: async () => value } })
    await assert.rejects(h.run(), error => error.code === 'UNAUTHORIZED')
    assert.equal(h.requests.length, 0)
  }
})
await test('resolver failures are sanitized without making source reads', async () => {
  const h = harness({ resolver: { resolve: async () => { throw Error('secret resolver detail') } } })
  await assert.rejects(h.run(), error => error.code === 'UNAUTHORIZED' && !error.message.includes('secret'))
  assert.equal(h.requests.length, 0)
})
await test('malformed selectors fail before resolver and source calls', async () => {
  for (const patch of [{ organizationId: 'browser-value' }, { connectionId: '' }, { propertyId: 'javascript:alert(1)' }, { propertyId: 'sc-domain:example.com/evil' }, { propertyId: 'https://user:secret@example.com/' }, { propertyId: ' https://example.com/' }]) {
    const h = harness()
    await assert.rejects(h.run({ ...selection, ...patch }), error => error.code === 'INVALID_REQUEST')
    assert.equal(h.resolutions.length, 0)
    assert.equal(h.requests.length, 0)
  }
})
await test('bad or duplicate server-issued IDs fail before any source read', async () => {
  for (const newId of [() => 'browser-id', () => ids.actorId]) {
    const h = harness({ dependencies: { newId } })
    await assert.rejects(h.run(), error => error.code === 'INVALID_ID')
    assert.equal(h.requests.length, 0)
  }
})
await test('invalid server window and pagination options never read sources', async () => {
  for (const dependencies of [{ days: 0 }, { lagDays: 0 }, { maxPages: 11 }, { maxPages: 0 }]) {
    const h = harness({ dependencies })
    await assert.rejects(h.run())
    assert.equal(h.requests.length, 0)
  }
})
await test('all six snapshot identities and cohorts are checked against the trusted manifest', async () => {
  const patches = [
    { id: randomUUID() }, { organizationId: randomUUID() }, { propertyId: 'https://example.com/' },
    { runId: randomUUID() }, { source: 'demo' }, { timezone: 'UTC' }, { searchType: 'image' },
    { dataState: 'all' }, { filters: [{ country: 'usa' }] }, { dimensions: ['query'] },
    { window: windows.prior }, { window: { start: windows.current.start, end: windows.current.start } },
  ]
  for (const patch of patches) {
    const result = await harness({ modify: (source, i) => { if (i === 0) Object.assign(source, patch) } }).run()
    unavailable(result)
    assert.equal(result.code, 'SNAPSHOT_MISMATCH')
  }
  for (let index = 0; index < 6; index++) {
    const result = await harness({ modify: (source, i) => { if (i === index) source.runId = randomUUID() } }).run()
    unavailable(result)
    assert.equal(result.code, 'SNAPSHOT_MISMATCH')
  }
})
await test('invalid source rows and metadata are rejected rather than coerced', async () => {
  const mutations = [
    source => { source.rows[0].clicks = -1 }, source => { source.rows[0].impressions = NaN },
    source => { source.rows[0].clicks = .5 }, source => { source.rows[0].clicks = 2001 },
    source => { source.rows[0].ctr = .9 }, source => { source.rows[0].ctr = -1e-10 }, source => { source.rows[0].position = null },
    source => { source.rows[0].position = 0 }, source => { source.rows[0].position = Infinity },
    source => { source.rows[0].keys = ['unexpected'] }, source => { source.rows.push(copy(source.rows[0])) },
    source => { source.retrievedAt = '2026-02-30T12:00:00.000Z' }, source => { source.retrievedAt = '' }, source => { source.retrievedAt = '2026-11-07T12:00:00.000Z' },
    source => { source.warnings = [null] }, source => { source.coverage = 'unknown' },
    source => { source.coverage = { toString: () => 'available-rows' } }, source => { source.rows = null },
  ]
  for (const mutate of mutations) {
    const result = await harness({ modify: (source, i) => { if (i === 0) mutate(source) } }).run()
    unavailable(result)
    assert.equal(result.code, 'INVALID_SNAPSHOT')
  }
})
await test('daily keys must be unique valid dates within their exact window', async () => {
  for (const key of [windows.prior.end, '2026-02-30', 'not-a-date', '2026-11-07T00:00:00Z', windows.current.start]) {
    const result = await harness({ modify: (source, i) => { if (i === 1) source.rows[1].keys[0] = key } }).run()
    unavailable(result)
    assert.equal(result.code, 'INVALID_SNAPSHOT')
  }
})
await test('page links reject executable schemes, credentials, lookalike domains and invalid keys', async () => {
  for (const key of ['javascript:alert(1)', 'data:text/html,x', 'https://user:secret@example.com/', 'https://notexample.com/a', 'https://example.com.evil/a', 'https://evil.test/a', '', 'https://exa\nmple.com/a']) {
    const result = await harness({ modify: (source, i) => { if (i === 2) source.rows[0].keys[0] = key } }).run()
    unavailable(result)
  }
})
await test('domain properties allow genuine subdomains and URL-prefix properties preserve scheme and path', async () => {
  const domain = await harness({ modify: source => { if (source.dimensions[0] === 'page') source.rows[0].keys[0] = 'https://shop.example.com/a' } }).run()
  assert.equal(domain.status, 'ready')
  const prefix = { ...selection, propertyId: 'https://example.com/sub/' }
  for (const [key, allowed] of [['https://example.com/sub/a', true], ['https://example.com/a', false], ['http://example.com/sub/a', false], ['https://shop.example.com/sub/a', false], ['https://example.com/submarine/a', false]]) {
    const result = await harness({ modify: source => { if (source.dimensions[0] === 'page') source.rows[0].keys[0] = key } }).run(prefix)
    assert.equal(result.status, allowed ? 'ready' : 'unavailable')
    if (allowed) assert.equal(result.selection.propertyId, prefix.propertyId)
  }
})
await test('bound row count is checked independently of claimed source coverage', async () => {
  const result = await harness({ dependencies: { maxPages: 1 }, modify: (source, i) => {
    if (i === 2) source.rows = Array.from({ length: 1001 }, (_, n) => row(1, 10, [`https://example.com/${n}`]))
  } }).run()
  unavailable(result)
  assert.equal(result.code, 'INVALID_SNAPSHOT')
})
await test('provider failures stop immediately without partial results or raw error disclosure', async () => {
  for (const code of ['RECONNECT_REQUIRED', 'PROPERTY_ACCESS_DENIED', 'RATE_LIMITED', 'INVALID_RESPONSE', 'PROVIDER_UNAVAILABLE']) {
    const h = harness({ modify: (_source, i) => { if (i === 3) throw new core.PlatformError(code, 'secret provider detail') } })
    const result = await h.run()
    unavailable(result)
    assert.equal(result.code, code)
    assert.equal(h.requests.length, 4)
    assert.ok(!JSON.stringify(result).includes('secret'))
  }
})
await test('unexpected provider errors and spoofed error codes are sanitized', async () => {
  for (const error of [Error('token and body'), { code: 'RECONNECT_REQUIRED', message: 'token' }]) {
    const result = await harness({ modify: () => { throw error } }).run()
    unavailable(result)
    assert.equal(result.code, 'PROVIDER_UNAVAILABLE')
    assert.ok(!JSON.stringify(result).includes('token'))
  }
})
await test('authorization revoked during reading fails closed', async () => {
  const h = harness({ modify: (_source, i) => { if (i === 2) throw new core.PlatformError('UNAUTHORIZED', 'secret') } })
  await assert.rejects(h.run(), error => error.code === 'UNAUTHORIZED' && !error.message.includes('secret'))
  assert.equal(h.requests.length, 3)
})
await test('snapshots, action evidence, totals and references are copied and deeply immutable', async () => {
  const h = harness({ modify: (source, i, _request, sources) => {
    source.accessToken = 'discard-me'
    source.rows[0].privateToken = 'discard-me'
    if (i === 1) sources[0].rows[0].clicks = 999
  } })
  const result = await h.run()
  assert.equal(result.status, 'ready')
  assert.equal(result.totals.current.metrics.clicks, 40)
  assert.ok(!JSON.stringify(result).includes('discard-me'))
  h.sources[2].rows[0].keys[0] = 'https://attacker.test/'
  h.sources[2].window.start = '2000-01-01'
  assert.equal(result.actions[0].page, 'https://example.com/a')
  for (const value of [result, result.selection, result.windows.current, result.snapshots.current.page, result.snapshots.current.page.rows[0].keys, result.actions[0].current, result.totals.current.metrics]) assert.equal(Object.isFrozen(value), true)
  assert.throws(() => { result.actions[0].current.clicks = 99 }, TypeError)
  assert.throws(() => { result.snapshots.current.page.rows.push(row(1, 1)) }, TypeError)
})
await test('request and selector mutation cannot change authorized cohort or trusted references', async () => {
  const original = { ...selection }
  const h = harness({ resolver: { resolve: async selected => {
    assert.equal(Object.isFrozen(selected), true)
    original.propertyId = 'sc-domain:attacker.test'
    original.organizationId = randomUUID()
    return { ...selected, actorId: ids.actorId, accessToken: 'discard-me' }
  } }, modify: (_source, _i, request) => {
    assert.equal(Object.isFrozen(request), true)
    assert.equal(Object.isFrozen(request.window), true)
    assert.equal(Object.isFrozen(request.dimensions), true)
  } })
  const result = await h.run(original)
  assert.equal(result.status, 'ready')
  assert.equal(result.selection.propertyId, selection.propertyId)
  assert.ok(!JSON.stringify(result).includes('discard-me'))
})
await test('repeat syncs use disjoint trusted IDs while preserving observed metrics', async () => {
  const h = harness(), a = await h.run(), b = await h.run()
  assert.notEqual(a.runId, b.runId)
  assert.notEqual(a.snapshots.current.aggregate.id, b.snapshots.current.aggregate.id)
  assert.deepEqual(copy(a.totals.current.metrics), copy(b.totals.current.metrics))
})
await test('existing GSC adapter composes without live tokens, default transport or storage', async () => {
  const calls = []
  const adapter = gsc.createGscAdapter({ resolve: async (actorId, organizationId, connectionId) => {
    assert.equal(actorId, ids.actorId)
    return { organizationId, connectionId, accessToken: 'mock-only' }
  } }, async (url, options) => {
    calls.push({ url, options })
    if (options.method === 'GET') return Response.json({ siteEntry: [{ siteUrl: selection.propertyId, permissionLevel: 'siteOwner' }] })
    const query = JSON.parse(options.body)
    return Response.json({ rows: fixture({ ...selection, window: { start: query.startDate, end: query.endDate }, dimensions: query.dimensions }).rows })
  })
  const result = await harness({ reader: adapter }).run()
  assert.equal(result.status, 'ready')
  assert.equal(calls.filter(call => call.options.method === 'POST').length, 6)
  assert.ok(!JSON.stringify(result).includes('mock-only'))
})
console.log(`${count} journey checks passed. All source reads mocked; no network, tokens, persistence or routes installed.`)

