import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Component event tests, not a browser/hydration simulation. No DOM or network.
const source = ts.transpileModule(readFileSync('components/platform/auth/auth-form.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText
const settle = () => new Promise(resolve => setImmediate(resolve))
function fixture({ mode = 'sign-in', enabled = true, respond = async () => Response.json({ state: 'signed-in' }) } = {}) {
  const exports = {}, requests = [], destinations = [], states = []
  const element = (type, props) => ({ type, props })
  vm.runInNewContext(source, { exports, module: { exports },
    FormData: class { constructor(form) { this.fields = form.fields } get(key) { return this.fields[key] } },
    window: { location: { assign: path => destinations.push(path) } },
    fetch: async (...args) => { requests.push(args); return respond(...args) },
    require(name) {
      if (name === 'react') return { useRef: value => ({ current: value }), useState: value => [value, next => states.push(next)] }
      if (name === 'react/jsx-runtime') return { jsx: element, jsxs: element }
      if (name === 'next/link') return { default: 'link' }
      if (name === 'lucide-react') return {}
      if (name === './provider-icon') return { ProviderIcon: 'provider-icon' }
      if (name === '@/components/platform/theme-toggle') return { ThemeToggle: 'theme-toggle' }
      throw Error(`Unexpected import ${name}`)
    },
  })
  const tree = exports.AuthForm({ mode, available: { email: enabled, google: false, apple: false } })
  function find(node) {
    if (!node || typeof node !== 'object') return null
    if (node.type === 'form') return node
    for (const child of [node.props?.children].flat(Infinity)) { const found = find(child); if (found) return found }
    return null
  }
  const form = find(tree)
  return { requests, destinations, states, submit(fields = { email: 'fixture@example.com', password: 'fixture-password', 'confirm-password': 'fixture-password' }) {
    form.props.onSubmit({ preventDefault() {}, currentTarget: { fields } })
  } }
}
let test = fixture()
test.submit(); await settle()
assert.deepEqual(test.destinations, ['/platform'])
assert.equal(test.requests[0][1].credentials, 'same-origin')
assert.equal(test.requests[0][1].cache, 'no-store')
console.log('PASS email sign-in navigates to the fixed workspace after response completion')
for (const state of [{ message: 'Check your email' }, { error: 'Could not sign in' }]) {
  test = fixture({ mode: 'sign-up', respond: async () => Response.json(state, { status: state.error ? 400 : 200 }) })
  test.submit(); await settle(); assert.equal(test.destinations.length, 0)
}
test = fixture({ respond: async () => { throw Error('offline') } })
test.submit(); await settle(); assert.equal(test.destinations.length, 0)
assert.ok(test.states.some(value => typeof value === 'string' && value.includes('could not connect')))
console.log('PASS confirmation-only signup, errors and uncertain network outcomes do not navigate')
test = fixture({ enabled: false }); test.submit(); await settle(); assert.equal(test.requests.length, 0)
test = fixture({ mode: 'sign-up' }); test.submit({ email: 'fixture@example.com', password: 'fixture-password', 'confirm-password': 'different' })
await settle(); assert.equal(test.requests.length, 0)
let resolveRequest
test = fixture({ respond: () => new Promise(resolve => { resolveRequest = resolve }) })
test.submit(); test.submit(); assert.equal(test.requests.length, 1); assert.equal(test.destinations.length, 0)
resolveRequest(Response.json({ state: 'signed-in', next: 'https://evil.example.com' })); await settle()
assert.deepEqual(test.destinations, ['/platform'])
console.log('PASS unavailable/mismatched forms, duplicate pending submit and untrusted next destination')
