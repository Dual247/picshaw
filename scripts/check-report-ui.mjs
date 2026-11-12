import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

function load(file, dependencies, globals = {}) {
  const exports = {}
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  vm.runInNewContext(code, { exports, module: { exports }, ...globals, require(name) {
    if (Object.hasOwn(dependencies, name)) return dependencies[name]
    throw Error(`Unexpected dependency: ${name}`)
  } })
  return exports
}
const element = (type, props) => ({ type, props })
async function harness() {
  const values = [], refs = [], calls = [], listeners = new Map(), channels = []
  let stateIndex = 0, refIndex = 0, effect, cleanup
  const react = {
    useState(initial) { const index = stateIndex++; if (!(index in values)) values[index] = initial; return [values[index], value => { values[index] = typeof value === 'function' ? value(values[index]) : value }] },
    useRef(initial) { const index = refIndex++; return refs[index] ??= { current: initial } },
    useEffect(fn) { effect = fn },
  }
  const document = { visibilityState: 'visible', addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) }
  const window = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) }
  class BroadcastChannel { constructor() { channels.push(this) } close() { this.closed = true } }
  const { SearchReportDashboard } = load('components/platform/search-report-dashboard.tsx', { react, 'react/jsx-runtime': { jsx: element, jsxs: element }, 'next/link': 'a', './search-report-view': { SearchReportView: 'report' } }, {
    document, window, BroadcastChannel, AbortController, Date,
    fetch(url, options) { return new Promise((resolve, reject) => calls.push({ url, options, resolve, reject })) },
  })
  const render = () => { stateIndex = 0; refIndex = 0; return SearchReportDashboard() }
  function flatten(node) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(flatten); return [node, ...flatten(node.props?.children)] }
  const button = text => flatten(render()).find(node => node.type === 'button' && node.props.children === text)
  const respond = async (index, body, status = 200) => { calls[index].resolve({ ok: status >= 200 && status < 300, status, json: async () => body }); await new Promise(resolve => setImmediate(resolve)) }
  render(); cleanup = effect()
  await Promise.resolve()
  return { calls, values, render, button, respond, document, listeners, channels, unmount: () => cleanup() }
}
const retained = { reportId: 'report-private', runId: 'run-private', review: {} }
const h = await harness()
assert.equal(h.calls.length, 1)
assert.equal(h.calls[0].url, '/api/platform/reports/read')
assert.equal(h.calls[0].options.method, 'POST')
assert.equal(h.calls[0].options.credentials, 'same-origin')
assert.equal(h.calls[0].options.cache, 'no-store')
assert.equal(h.calls[0].options.body, '{}')
await h.respond(0, { enabled: true, report: retained })
assert.equal(h.values[0], retained)
const sync = h.button('Import / retry Google Search')
assert.equal(sync.props.disabled, false)
sync.props.onClick(); sync.props.onClick()
assert.equal(h.calls.length, 2, 'Rapid repeated clicks issue one sync')
assert.equal(h.values[0], null)
h.calls[1].reject(Error('network lost'))
await new Promise(resolve => setImmediate(resolve))
assert.equal(h.values[3], true)
assert.match(h.values[4], /outcome is unknown/)
h.button('Load latest report').props.onClick()
await h.respond(2, { enabled: true, report: retained })
assert.equal(h.button('Import / retry Google Search').props.disabled, true, 'Read does not bypass explicit status recovery')
h.button('Check import status').props.onClick()
await h.respond(3, { enabled: true, operation: { state: 'running', leaseUntil: '2999-01-01T00:00:00Z' } })
assert.equal(h.button('Import / retry Google Search').props.disabled, true)
h.button('Check import status').props.onClick()
await h.respond(4, { enabled: true, operation: { state: 'running', leaseUntil: '2000-01-01T00:00:00Z' } })
assert.equal(h.button('Import / retry Google Search').props.disabled, false)
assert.match(h.values[4], /lease expired/)
h.button('Load latest report').props.onClick()
await h.respond(5, { error: 'Access denied' }, 401)
assert.equal(h.values[0], null); assert.equal(h.values[1], 'signed-out')
h.button('Load latest report').props.onClick()
await h.respond(6, { enabled: true, report: retained })
h.channels[0].onmessage({ data: 'signed-out' })
assert.equal(h.values[0], null); assert.equal(h.values[1], 'signed-out')
h.button('Load latest report').props.onClick()
h.document.visibilityState = 'hidden'; h.listeners.get('visibilitychange')()
await h.respond(7, { enabled: true, report: retained })
assert.equal(h.values[0], null, 'Hidden-page stale response cannot restore private data')
h.document.visibilityState = 'visible'; h.listeners.get('visibilitychange')()
assert.equal(h.calls[8].url, '/api/platform/reports/read')
h.unmount(); await h.respond(8, { enabled: true, report: retained })
assert.equal(h.values[0], null, 'Unmounted response is ignored')
assert.equal(h.channels[0].closed, true)
assert.equal(h.listeners.size, 0)
const denied = await harness()
await denied.respond(0, { enabled: true, report: retained })
denied.button('Load latest report').props.onClick()
await denied.respond(1, { error: 'Access unavailable' }, 503)
assert.equal(denied.values[0], null)
assert.equal(denied.button('Import / retry Google Search').props.disabled, true)
denied.button('Load latest report').props.onClick()
await denied.respond(2, { enabled: false })
assert.equal(denied.values[1], 'disabled')
denied.unmount()
const restored = await harness()
await restored.respond(0, { enabled: true, report: retained })
restored.listeners.get('pagehide')()
assert.equal(restored.values[0], null)
restored.listeners.get('pageshow')({ persisted: true })
assert.equal(restored.calls.length, 2)
await restored.respond(1, { error: 'Sign in' }, 401)
assert.equal(restored.values[0], null)
restored.unmount()
console.log('PASS report request boundaries, repeated clicks, ambiguous recovery, leases, 401/access clear, cross-tab sign-out, visibility, stale responses and unmount')

const { SearchReportView } = load('components/platform/search-report-view.tsx', { 'react/jsx-runtime': await import('react/jsx-runtime') })
const metrics = { clicks: 5, impressions: 100, ctr: .05, position: 4 }
const snapshot = { rows: [], coverage: 'available-rows', warnings: ['Available rows are not exhaustive.'], retrievedAt: '2026-11-01T12:00:00.000Z' }
const period = { aggregate: { ...snapshot, rows: [metrics] }, daily: snapshot, page: { ...snapshot, rows: Array.from({ length: 12 }, (_, i) => ({ ...metrics, keys: [`https://example.com/page-${i}`] })) } }
const review = { selection: { propertyId: 'sc-domain:example.com' }, windows: { current: { start: '2026-10-01', end: '2026-10-28' }, prior: { start: '2026-09-03', end: '2026-09-30' } }, snapshots: { current: period, prior: period }, totals: { current: { status: 'available', metrics }, prior: { status: 'available', metrics } }, coverage: { current: { status: 'complete', missingDates: [], reasons: [] }, prior: { status: 'complete', missingDates: [], reasons: [] } }, status: 'ready', comparison: { clicks: { absolute: 0, relative: 0 }, impressions: { absolute: 0, relative: 0 }, ctrPercentagePoints: 0, positionChange: 0 }, actions: [], disclaimer: 'Final Google Web Search observations only.' }
const render = value => renderToStaticMarkup(React.createElement(SearchReportView, { review: value }))
const html = render(review)
assert.match(html, /Property totals/); assert.match(html, /Current versus prior/)
assert.match(html, /Pacific/); assert.match(html, /5.00%/)
assert.equal((html.match(/scope="row"/g) ?? []).length, 10)
const withActions = render({ ...review, actions: Array.from({ length: 4 }, (_, i) => ({ id: String(i), title: `REVIEW_ACTION_${i}`, page: 'https://example.com/', reason: 'Review evidence, not a diagnosis.', ruleVersion: '1' })) })
assert.ok(withActions.includes('REVIEW_ACTION_2') && !withActions.includes('REVIEW_ACTION_3'))
for (const status of ['unknown', 'bounded', 'inconsistent']) {
  const incomplete = { ...review, status: status === 'inconsistent' ? status : 'incomplete', coverage: { ...review.coverage, current: { status, missingDates: ['2026-10-01'], reasons: ['MISSING_DATES'] } }, actions: [{ id: 'bad', title: 'MUST NOT SHOW' }] }
  const result = render(incomplete)
  assert.match(result, /Comparison withheld/); assert.match(result, /Actions withheld/)
  assert.match(result, /unknown, not zero/); assert.ok(!result.includes('MUST NOT SHOW'))
}
const missing = render({ ...review, totals: { ...review.totals, current: { status: 'missing', metrics: null } }, comparison: null })
assert.match(missing, /Unknown/)
const source = readFileSync('components/platform/search-report-dashboard.tsx', 'utf8')
assert.ok(!source.includes('localStorage') && !source.includes('sessionStorage'))
assert.match(source, /import type \{ ReviewedSnapshotBundle \}/)
const route = readFileSync('app/(workspace)/platform/reports/page.tsx', 'utf8')
assert.match(route, /force-dynamic/); assert.match(route, /index: false/)
console.log('PASS real React report rendering, top-ten cap, missing metrics, comparison/action suppression and static private route contract')
console.log('These are local mocked interaction and render tests, not browser or live Google integration tests.')

// AI evidence navigation remains discoverable without claiming the provider is enabled.
for (const file of ['app/(workspace)/platform/page.tsx', 'components/platform/search-report-dashboard.tsx']) {
  const navigation = readFileSync(file, 'utf8')
  assert.match(navigation, /href="\/platform\/ai-visibility" prefetch=\{false\}/)
  assert.match(navigation, /Check availability; AI lookups require separate consent/)
}
const icons = await import('lucide-react')
const { default: WorkspaceHome } = load('app/(workspace)/platform/page.tsx', {
  'react/jsx-runtime': await import('react/jsx-runtime'),
  'next/link': ({ prefetch, ...props }) => React.createElement('a', props),
  'lucide-react': icons,
  '@/components/platform/portal-header': { PortalHeader: () => null },
})
assert.match(renderToStaticMarkup(React.createElement(WorkspaceHome)), /href="\/platform\/ai-visibility"[^>]*>AI visibility evidence<\/a>/)
for (const enabled of [false, true]) {
  const { default: AiVisibilityPage } = load('app/(workspace)/platform/ai-visibility/page.tsx', {
    'react/jsx-runtime': await import('react/jsx-runtime'),
    '@/components/platform/portal-header': { PortalHeader: () => null },
    '@/components/platform/dataforseo-dashboard': { DataForSeoDashboard: () => React.createElement('p', null, 'DASHBOARD_ENABLED') },
  }, { process: { env: { PIC_SHAW_DATAFORSEO_ENABLED: enabled ? 'true' : 'false' } } })
  const page = renderToStaticMarkup(React.createElement(AiVisibilityPage))
  assert.equal(page.includes('DASHBOARD_ENABLED'), enabled)
  if (!enabled) assert.match(page, /not connected for this deployment yet. No provider request has been made/)
}
console.log('PASS workspace/report AI evidence links, disabled prefetch, separate-consent labeling and disabled/enabled destination rendering')
