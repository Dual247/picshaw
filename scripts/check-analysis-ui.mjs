import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

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
  const { WebsiteAnalysisPanel } = load('components/platform/website-analysis-panel.tsx', { react, 'react/jsx-runtime': { jsx: element, jsxs: element }, 'next/link': 'a', './search-report-view': { SearchReportView: 'report' } }, {
    document, window, BroadcastChannel, AbortController, Date,
    fetch(url, options) { return new Promise((resolve, reject) => calls.push({ url, options, resolve, reject })) },
  })
  const render = () => { stateIndex = 0; refIndex = 0; return WebsiteAnalysisPanel() }
  function flatten(node) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(flatten); return [node, ...flatten(node.props?.children)] }
  const button = text => flatten(render()).find(node => node.type === 'button' && node.props.children === text)
  const respond = async (index, body, status = 200) => { calls[index].resolve({ ok: status >= 200 && status < 300, status, json: async () => body }); await new Promise(resolve => setImmediate(resolve)) }
  render(); cleanup = effect()
  await Promise.resolve()
  return { calls, values, render, button, respond, document, listeners, channels, flatten, unmount: () => cleanup() }
}
const h = await harness()
assert.equal(h.calls.length, 0, 'Opening page must not fetch a site')
let nodes=h.flatten(h.render())
nodes.find(n=>n.type==='input'&&n.props.type==='url').props.onChange({target:{value:'https://example.com/'}})
nodes=h.flatten(h.render())
nodes.find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}})
let form=h.flatten(h.render()).find(n=>n.type==='form')
form.props.onSubmit({preventDefault(){}});form.props.onSubmit({preventDefault(){}})
assert.equal(h.calls.length,1,'Repeated submit starts one request')
assert.equal(h.calls[0].options.cache,'no-store')
assert.deepEqual(JSON.parse(h.calls[0].options.body),{url:'https://example.com/',consent:true})
h.button('Cancel').props.onClick()
await h.respond(0,{analysis:{url:'private-result'}})
assert.equal(h.values[2],null,'Late response after cancel must not reappear')
form=h.flatten(h.render()).find(n=>n.type==='form');form.props.onSubmit({preventDefault(){}})
await h.respond(1,{analysis:{url:'https://example.com/',finalUrl:'https://example.com/',headings:[],findings:[],robots:[]}})
assert.ok(h.values[2])
h.channels[0].onmessage({data:'signed-out'})
assert.equal(h.values[2],null,'Logout clears evidence')
form=h.flatten(h.render()).find(n=>n.type==='form');form.props.onSubmit({preventDefault(){}})
h.listeners.get('pagehide')()
await h.respond(2,{analysis:{url:'stale'}})
assert.equal(h.values[2],null,'Page navigation invalidates response')
h.unmount()
const home=readFileSync('app/(workspace)/platform/page.tsx','utf8'),reports=readFileSync('components/platform/search-report-dashboard.tsx','utf8')
for(const source of [home,reports])for(const path of ['/platform/connect','/platform/analyze'])assert.ok(source.includes(path))
console.log('Analysis UI checks passed: no automatic fetch, consent, repeated clicks, cancel, late replies, logout, navigation and workspace links.')