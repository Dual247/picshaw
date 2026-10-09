import assert from 'node:assert/strict'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const source = readFileSync('app/api/contact/route.ts', 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
function load(options = {}) {
  const messages = [], events = []
  const exports = {}
  const sandbox = { exports, module: { exports }, Response, Request, console: { error() {}, warn() {}, log() {} }, process: { env: { RESEND_API_KEY: options.missingKey ? '' : 're_local_mock_only', VERCEL_ENV: options.preview ? 'preview' : 'production', NEXT_PUBLIC_ANALYTICS_EVENTS: options.eventsOff ? 'false' : 'true' } }, require(name) {
    if (name === 'resend') return { Resend: class { emails = { send: async message => { messages.push(message); if (options.throwSend) throw new Error('mock provider failure'); return { error: options.providerError ? { message: 'mock rejection' } : null, data: { id: 'mock-only' } } } } }
    if (name === '@vercel/analytics/server') return { track: async (...args) => { events.push(args); if (options.throwTrack) throw new Error('mock analytics failure') } }
    if (name === 'zod') return require('zod')
    throw new Error(`Unexpected dependency: ${name}`)
  } }
  vm.runInNewContext(compiled, sandbox)
  return { post: exports.POST, messages, events }
}
const valid = { name: '<b>Test</b>', email: 'test@example.com', business: 'Test & Co', website: 'https://example.com', message: '<script>test</script>', service_interest: '1k' }
const request = body => new Request('https://www.picshaw.com/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) })
const results = []
for (const [name, body] of [['missing fields', {}], ['invalid email', { ...valid, email: 'not-an-email' }], ['unknown service', { ...valid, service_interest: 'unapproved' }], ['wrong type', { ...valid, name: 42 }], ['malformed JSON', '{bad']]) {
  const app = load(), response = await app.post(request(body))
  assert.equal(response.status, 400, name); assert.equal(app.messages.length, 0); assert.equal(app.events.length, 0); results.push({ test: name, passed: true })
}
for (const [name, options, status, events] of [['success', {}, 200, 1], ['provider rejection', { providerError: true }, 502, 0], ['provider throws', { throwSend: true }, 500, 0], ['analytics failure preserves success', { throwTrack: true }, 200, 1], ['missing configuration', { missingKey: true }, 503, 0], ['preview excludes analytics', { preview: true }, 200, 0], ['events disabled', { eventsOff: true }, 200, 0]]) {
  const app = load(options), response = await app.post(request(valid))
  assert.equal(response.status, status, name); assert.equal(app.events.length, events, name)
  if (app.messages.length) { assert.ok(app.messages[0].html.includes('&lt;script&gt;')); assert.ok(!app.messages[0].html.includes('<script>')) }
  if (events) { assert.equal(app.events[0][0], 'review_request_completed'); assert.equal(JSON.stringify(app.events[0][1]), JSON.stringify({ form: 'website_review' })); assert.ok(!JSON.stringify(app.events).includes(valid.email)) }
  results.push({ test: name, passed: true })
}
mkdirSync('validation', { recursive: true })
writeFileSync('validation/contact-tests.json', JSON.stringify(results, null, 2))
console.log(JSON.stringify(results, null, 2))
