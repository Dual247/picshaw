import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const source = readFileSync('components/platform/dataforseo-panel.tsx', 'utf8')
function load(react, jsx, globals = {}) {
  const exports = {}
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(code, { exports, URL, ...globals, require(name) { if (name === 'react') return react; if (name === 'react/jsx-runtime') return jsx; throw Error(`Unexpected dependency ${name}`) } })
  return exports
}
const element = (type, props, key) => ({ type, props, key })
const flatten = node => Array.isArray(node) ? node.flatMap(flatten) : node && typeof node === 'object' ? [node, ...flatten(node.props?.children)] : []
const flush = () => new Promise(resolve => setImmediate(resolve))
function harness(domain = 'example.com') {
  const values = [], refs = [], calls = [], listeners = new Map(), channels = []
  let index = 0, refIndex = 0, effect, cleanup
  const react = {
    useState(initial) { const i = index++; if (!(i in values)) values[i] = initial; return [values[i], value => { values[i] = typeof value === 'function' ? value(values[i]) : value }] },
    useRef(initial) { return refs[refIndex++] ??= { current: initial } }, useEffect(fn) { effect = fn },
  }
  const events = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) }
  const document = { ...events, visibilityState: 'visible' }
  class BroadcastChannel { constructor() { channels.push(this) } close() { this.closed = true } }
  const components = load(react, { jsx: element, jsxs: element }, { window: events, document, BroadcastChannel, crypto: { randomUUID: () => '11111111-1111-4111-8111-111111111111' } })
  const props = { domain, sessionScope: 'workspace-session-1', transport: Object.fromEntries(['submit', 'read', 'latest'].map(method => [method, input => new Promise((resolve, reject) => calls.push({ method, input, resolve, reject }))])) }
  const render = () => { index = 0; refIndex = 0; return components.DataForSeoPanelSession(props) }
  const button = label => flatten(render()).find(node => node.type === 'button' && node.props.children === label)
  const consent = () => flatten(render()).find(node => node.type === 'input').props.onChange({ target: { checked: true } })
  render(); cleanup = effect()
  return { render, button, consent, calls, values, listeners, channels, document, props, components, unmount: cleanup }
}
const job = (state, overrides = {}) => ({ jobId: '11111111-1111-4111-8111-111111111111', domain: 'example.com', platform: 'google', rowLimit: 20, state, createdAt: '2026-11-12T12:00:00Z', ...overrides })
const evidence = { source: 'dataforseo-llm-mentions', domain: 'example.com', platform: 'google', locationCode: 2840, languageCode: 'en', retrievedAt: '2026-11-12T12:05:00Z', providerTaskId: 'provider-id', actualCostUsd: .12, totalMatches: 0, sampledRows: 0, items: [], limitations: ['Database sample only.'] }
const h = harness()
assert.equal(h.calls.length, 0, 'Mount must not fetch')
assert.equal(h.button('Request AI evidence').props.disabled, true)
h.button('Request AI evidence').props.onClick(); assert.equal(h.calls.length, 0)
h.consent(); const start = h.button('Request AI evidence'); start.props.onClick(); start.props.onClick()
assert.equal(h.calls.length, 1, 'Repeated clicks create one job')
assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0].input)), { platform: 'google', jobId: '11111111-1111-4111-8111-111111111111', consent: 'dataforseo-domain-v1' })
h.calls[0].resolve(job('queued')); await flush()
assert.equal(h.values[2].state, 'queued')
assert.equal(h.button('Request AI evidence').props.disabled, true)
h.button('Refresh status').props.onClick(); h.calls[1].resolve(job('running')); await flush()
assert.equal(h.calls[1].method, 'read'); assert.equal(h.values[2].state, 'running')
h.button('Refresh status').props.onClick(); h.calls[2].resolve(job('completed', { result: evidence })); await flush()
assert.equal(h.values[3], evidence)
h.button('Refresh status').props.onClick(); assert.equal(h.values[3], null)
h.button('Stop waiting locally').props.onClick()
h.calls[3].resolve(job('completed', { result: evidence })); await flush()
assert.equal(h.values[3], null, 'Stopped wait cannot repopulate evidence')
assert.match(h.values[6], /does not cancel provider work or any charge/)
h.button('Refresh status').props.onClick(); h.calls[4].resolve(job('failed')); await flush()
assert.equal(h.values[2].state, 'failed'); assert.equal(h.button('Request AI evidence').props.disabled, true)
h.button('Refresh status').props.onClick(); h.calls[5].resolve(job('uncertain')); await flush()
assert.equal(h.values[2].state, 'uncertain'); assert.match(h.values[6], /Do not resubmit/)
assert.equal(h.calls.filter(c => c.method === 'submit').length, 1)
h.button('Refresh status').props.onClick(); h.calls[6].reject(Error('raw secret error')); await flush()
assert.equal(h.values[2].state, 'uncertain'); assert.ok(!h.values[6].includes('secret'))
h.button('Refresh status').props.onClick(); h.channels[0].onmessage({ data: 'signed-out' })
h.calls[7].resolve(job('completed', { result: evidence })); await flush()
assert.equal(h.values[3], null); assert.equal(h.values[2], null); assert.equal(h.button('Request AI evidence').props.disabled, true)
h.unmount(); assert.equal(h.channels[0].closed, true); assert.equal(h.listeners.size, 0)
for (const kind of ['unmount', 'hidden', 'pagehide', 'logout', 'denied', 'mismatch', 'network']) {
  const t = harness(); t.consent(); t.button('Request AI evidence').props.onClick()
  if (kind === 'unmount') t.unmount()
  if (kind === 'hidden') { t.document.visibilityState = 'hidden'; t.listeners.get('visibilitychange')() }
  if (kind === 'pagehide') t.listeners.get('pagehide')()
  if (kind === 'logout') t.listeners.get('picshaw:session-cleared')()
  if (kind === 'denied') t.calls[0].reject({ status: 401 })
  else if (kind === 'network') t.calls[0].reject(Error('lost response'))
  else t.calls[0].resolve(job('completed', { result: kind === 'mismatch' ? { ...evidence, domain: 'other.com' } : evidence }))
  await flush(); assert.equal(t.values[3], null, kind)
  if (kind === 'network' || kind === 'mismatch') { assert.equal(t.values[2].state, 'uncertain'); assert.equal(t.calls.length, 1) }
  if (kind !== 'unmount') t.unmount()
}
// React's keyed wrapper discards all state synchronously on domain/session change.
const scope = harness()
const original = scope.components.DataForSeoPanel(scope.props)
assert.notEqual(original.key, scope.components.DataForSeoPanel({ ...scope.props, domain: 'other.com' }).key)
assert.notEqual(original.key, scope.components.DataForSeoPanel({ ...scope.props, sessionScope: 'other-session' }).key)
assert.equal(scope.components.DataForSeoPanel({ ...scope.props, sessionScope: null }).type, 'p')
const select = flatten(scope.render()).find(node => node.type === 'select')
scope.consent(); select.props.onChange({ target: { value: 'chat_gpt' } }); assert.equal(scope.values[1], false)
scope.consent(); scope.button('Request AI evidence').props.onClick(); assert.equal(scope.calls[0].input.platform, 'chat_gpt'); scope.unmount()
const dedup = harness()
dedup.consent(); dedup.button('Request AI evidence').props.onClick()
const canonical = '22222222-2222-4222-8222-222222222222'
dedup.calls[0].resolve(job('queued', { jobId: canonical })); await flush()
assert.equal(dedup.values[2].jobId, canonical)
dedup.button('Refresh status').props.onClick(); assert.equal(dedup.calls[1].input, canonical)
dedup.calls[1].resolve(job('completed', { jobId: canonical, result: evidence })); await flush()
assert.equal(dedup.values[3], evidence)
dedup.button('New lookup').props.onClick()
assert.equal(dedup.values[2], null); assert.equal(dedup.values[3], null); assert.equal(dedup.values[1], false)
assert.equal(dedup.button('Request AI evidence').props.disabled, true); assert.equal(dedup.calls.length, 2)
flatten(dedup.render()).find(node => node.type === 'select').props.onChange({ target: { value: 'chat_gpt' } })
dedup.consent(); dedup.button('Request AI evidence').props.onClick()
assert.equal(dedup.calls[2].input.platform, 'chat_gpt')
dedup.calls[2].resolve(job('running', { platform: 'chat_gpt' })); await flush()
assert.equal(dedup.button('New lookup'), undefined)
dedup.button('Refresh status').props.onClick()
dedup.calls[3].resolve(job('completed', { jobId: canonical, platform: 'chat_gpt' })); await flush()
assert.equal(dedup.values[2].state, 'uncertain', 'Read cannot switch to another job')
assert.equal(dedup.button('New lookup'), undefined)
dedup.unmount()
const normalized = scope.components.DataForSeoPanel({ ...scope.props, domain: 'WWW.Example.COM' })
assert.equal(normalized.props.domain, 'example.com'); assert.equal(normalized.key, original.key)
const saved = harness()
assert.equal(saved.calls.length, 0)
assert.equal(saved.button('Load saved result').props.disabled, false)
saved.button('Load saved result').props.onClick(); saved.button('Load saved result').props.onClick()
assert.equal(saved.calls.length, 1); assert.equal(saved.calls[0].method, 'latest'); assert.equal(saved.calls[0].input, 'google')
saved.calls[0].resolve(null); await flush()
assert.match(saved.values[6], /No saved result/); assert.match(saved.values[6], /does not establish zero/)
saved.button('Load saved result').props.onClick()
saved.calls[1].resolve(job('completed', { jobId: canonical, result: evidence })); await flush()
assert.equal(saved.values[3], evidence); assert.equal(saved.values[1], false)
saved.button('Refresh status').props.onClick(); assert.equal(saved.calls[2].input, canonical)
saved.calls[2].resolve(job('completed', { jobId: canonical, result: evidence })); await flush()
saved.unmount()
for (const action of ['stop', 'logout', 'unmount', 'mismatch', 'denied', 'error']) {
  const t = harness(); t.button('Load saved result').props.onClick()
  if (action === 'stop') t.button('Stop waiting locally').props.onClick()
  if (action === 'logout') t.listeners.get('picshaw:session-cleared')()
  if (action === 'unmount') t.unmount()
  if (action === 'denied') t.calls[0].reject({ status: 403 })
  else if (action === 'error') t.calls[0].reject(Error('do not display raw error'))
  else t.calls[0].resolve(job('completed', { jobId: canonical, domain: action === 'mismatch' ? 'other.com' : 'example.com', result: evidence }))
  await flush(); assert.equal(t.values[3], null, `saved ${action}`)
  assert.equal(t.calls.filter(call => call.method === 'submit').length, 0)
  if (action !== 'unmount') t.unmount()
}
const real = load(React, await import('react/jsx-runtime'))
const render = result => renderToStaticMarkup(React.createElement(real.DataForSeoEvidence, { evidence: result }))
const zero = render(evidence)
assert.match(zero, /No matching records/); assert.match(zero, /does not establish zero AI visibility/)
assert.match(zero, /Retrieved at/); assert.match(zero, /No visibility score/)
const malicious = render({ ...evidence, totalMatches: 1, sampledRows: 1, items: [{ question: '<script>bad()</script>', model: 'model', observedAt: '2026-11-01', citations: [{ title: '<img src=x onerror=bad()>', url: 'javascript:bad()' }] }] })
assert.match(malicious, /Observed at \(provider answer time\)/)
assert.ok(!malicious.includes('<script>')); assert.ok(!malicious.includes('<img')); assert.ok(!malicious.includes('href='))
assert.ok(!source.includes('fetch(')); assert.ok(!source.includes('localStorage')); assert.ok(!source.includes('sessionStorage')); assert.ok(!source.includes('dataforseo-provider'))
console.log('PASS offline mocked UI: consent, no autofetch, duplicate clicks, all five job states, read-only refresh, unknown outcomes, cancellation, stale replies, unmount, logout, hidden page, domain/session keys, escaping and zero-record semantics.')
console.log('PASS real React static evidence rendering. Not browser, production or live-provider verification.')

// Derived analytics describe returned evidence only, with no market-score inference.
const sample = {...evidence,totalMatches:30,sampledRows:3,items:[
 {question:'Family care',model:'M1',observedAt:'2026-11-01',citations:[{title:'Care',url:'https://example.com/care'},{title:'Same domain repeated',url:'https://www.example.com/info'},{title:'Other',url:'https://other.example/a'}]},
 {question:'Emergency',model:'M2',observedAt:null,citations:[{title:'Subdomain',url:'https://care.example.com/a'},{title:'Not owned',url:'https://notexample.com/a'}]},
 {question:'=unsafe formula',model:null,observedAt:'invalid-date',citations:[{title:'Unsafe scheme',url:'javascript:alert(1)'},{title:'Credentials',url:'https://secret:pass@example.com/'}]},
]}
const stats=real.summarizeEvidence(sample)
assert.equal(stats.sources.length,4)
assert.equal(stats.citationCount,7)
assert.equal(stats.datedRows,1)
assert.equal(stats.sources.find(row=>row.domain==='example.com').observations,1,'Duplicate domain citation counted once per observation')
assert.equal(stats.sources.find(row=>row.domain==='example.com').citations,2)
assert.equal(stats.sources.find(row=>row.domain==='care.example.com').owned,true)
assert.equal(stats.sources.find(row=>row.domain==='notexample.com').owned,false)
assert.equal(real.filterEvidenceRows(sample.items,'family','all','all').length,1)
assert.equal(real.filterEvidenceRows(sample.items,'','M2','care.example.com').length,1)
assert.equal(real.filterEvidenceRows(sample.items,'','M1','care.example.com').length,0)
assert.equal(real.filterEvidenceRows(sample.items,'','Not reported','all').length,1)
const csv=real.evidenceCsv(sample,sample.items)
assert.ok(csv.includes("'=unsafe formula"),'Spreadsheet formula starts are neutralized')
assert.ok(!csv.includes('provider-id'))
assert.ok(!csv.includes('actualCostUsd'))
assert.ok(csv.includes('not a live prompt test or visibility score'))
assert.ok(render(sample).includes('Explore the evidence'))
console.log('PASS sample-only counts, source deduplication, ownership boundary, filters, safe CSV and no secret metadata export.')
