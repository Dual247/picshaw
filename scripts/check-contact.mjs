import assert from 'node:assert/strict'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const source = readFileSync('app/api/contact/route.ts', 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
function load(options = {}) {
  const messages = [], events = [], exports = {}
  class MockResend {
    constructor() {
      this.emails = {
        send: async message => {
          messages.push(message)
          if (options.throwSend) throw new Error('mock provider failure')
          return { error: options.providerError ? { message: 'mock rejection' } : null, data: { id: 'mock-only' } }
        },
      }
    }
  }
  const sandbox = {
    exports, module: { exports }, Response, Request, console: { error() {}, warn() {}, log() {} },
    process: { env: { RESEND_API_KEY: options.missingKey ? '' : 're_local_mock_only', VERCEL_ENV: options.preview ? 'preview' : 'production', NEXT_PUBLIC_ANALYTICS_EVENTS: options.eventsOff ? 'false' : 'true' } },
    require(name) {
      if (name === 'resend') return { Resend: MockResend }
      if (name === '@vercel/analytics/server') return { track: async (...args) => { events.push(args); if (options.throwTrack) throw new Error('mock analytics failure') } }
      if (name === 'zod') return require('zod')
      throw new Error(`Unexpected dependency: ${name}`)
    },
  }
  vm.runInNewContext(compiled, sandbox)
  return { post: exports.POST, messages, events }
}
const valid = { name: '<b>Test</b>', email: 'test@example.com', business: 'Test & Co', website: 'https://example.com', message: '<script>test</script>', service_interest: '1k' }
const request = body => new Request('https://www.picshaw.com/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) })
const results = []
for (const [name, body] of [['missing fields', {}], ['invalid email', { ...valid, email: 'not-an-email' }], ['unknown service', { ...valid, service_interest: 'unapproved' }], ['wrong type', { ...valid, name: 42 }], ['malformed JSON', '{bad']]) {
  const app = load(); const response = await app.post(request(body))
  assert.equal(response.status, 400, name); assert.equal(app.messages.length, 0); assert.equal(app.events.length, 0)
  results.push({ test: name, passed: true })
}
for (const [name, options, status, events] of [['success', {}, 200, 1], ['provider rejection', { providerError: true }, 502, 0], ['provider throws', { throwSend: true }, 500, 0], ['analytics failure preserves success', { throwTrack: true }, 200, 1], ['missing configuration', { missingKey: true }, 503, 0], ['preview excludes analytics', { preview: true }, 200, 0], ['events disabled', { eventsOff: true }, 200, 0]]) {
  const app = load(options); const response = await app.post(request(valid))
  assert.equal(response.status, status, name); assert.equal(app.events.length, events, name)
  if (app.messages.length) { assert.ok(app.messages[0].html.includes('&lt;script&gt;')); assert.ok(!app.messages[0].html.includes('<script>')) }
  if (events) { assert.equal(app.events[0][0], 'review_request_completed'); assert.equal(JSON.stringify(app.events[0][1]), JSON.stringify({ form: 'website_review' })); assert.ok(!JSON.stringify(app.events).includes(valid.email)) }
  results.push({ test: name, passed: true })
}
for (const service of ['audit', 'aeo']) {
  for (const fails of [false, true]) {
    const app = load({ providerError: fails }); const response = await app.post(request({ ...valid, service_interest: service }))
    assert.equal(response.status, fails ? 502 : 200)
    assert.equal(app.events.length, fails ? 0 : 1)
    assert.ok(app.messages[0].subject.startsWith('New AI visibility enquiry'))
    assert.ok(app.messages[0].html.includes('No payment'))
    if (!fails) { assert.equal(app.events[0][0], 'aeo_enquiry_completed'); assert.equal(JSON.stringify(app.events[0][1]), JSON.stringify({ form: 'aeo_enquiry' })); assert.ok(!JSON.stringify(app.events).includes(valid.website)) }
    results.push({ test: `${service}: ${fails ? 'provider rejection' : 'accepted enquiry'}`, passed: true })
  }
}
// The receptionist can be requested without a website. All sends remain mocked.
const receptionist = { ...valid, name: 'Test\r\nOwner', website: '', service_interest: 'receptionist' }
for (const [name, options, status, eventCount] of [['accepted', {}, 200, 1], ['provider rejection', { providerError: true }, 502, 0], ['provider exception', { throwSend: true }, 500, 0], ['analytics failure', { throwTrack: true }, 200, 1], ['missing key', { missingKey: true }, 503, 0], ['preview', { preview: true }, 200, 0], ['events off', { eventsOff: true }, 200, 0]]) {
  const app = load(options); const response = await app.post(request(receptionist))
  assert.equal(response.status, status, name); assert.equal(app.events.length, eventCount, name)
  if (status === 200) assert.equal((await response.json()).success, true)
  if (app.messages.length) {
    const email = app.messages[0]
    assert.ok(email.subject.startsWith('New AI receptionist enquiry'))
    assert.ok(!/[\r\n]/.test(email.subject))
    assert.equal(email.replyTo, valid.email)
    assert.equal(JSON.stringify(email.to), JSON.stringify(['hello@picshaw.com']))
    assert.ok(email.html.includes('AI receptionist demo / founding pilot'))
    assert.ok(email.html.includes('Not provided'))
    assert.ok(email.html.includes('&lt;script&gt;'))
    assert.ok(!email.html.includes('<script>'))
    assert.ok(email.html.includes('No payment'))
  }
  if (eventCount) {
    assert.equal(app.events[0][0], 'receptionist_enquiry_completed')
    assert.equal(JSON.stringify(app.events[0][1]), JSON.stringify({ form: 'receptionist_enquiry' }))
    for (const personal of [valid.email, valid.business, valid.message, receptionist.name]) assert.ok(!JSON.stringify(app.events).includes(personal))
  }
  results.push({ test: `receptionist: ${name}`, passed: true })
}
for (const [name, patch] of [['missing name', { name: '' }], ['missing business', { business: '' }], ['whitespace name', { name: '  ' }], ['invalid email', { email: 'not-email' }], ['oversized message', { message: 'x'.repeat(5001) }], ['oversized website', { website: 'x'.repeat(2049) }]]) {
  const app = load(); const response = await app.post(request({ ...receptionist, ...patch }))
  assert.equal(response.status, 400); assert.equal(app.messages.length, 0); assert.equal(app.events.length, 0)
  results.push({ test: `receptionist: ${name} rejected`, passed: true })
}
const noWebsite = load()
assert.equal((await noWebsite.post(request({ ...receptionist, website: undefined }))).status, 200)
results.push({ test: 'receptionist: omitted website accepted', passed: true })
for (const service of ['audit', 'aeo', '1k', '2.5k', 'monthly', 'unsure']) {
  const app = load(); assert.equal((await app.post(request({ ...valid, website: '', service_interest: service }))).status, 400)
  assert.equal(app.messages.length, 0)
  results.push({ test: `${service}: website still required`, passed: true })
}
mkdirSync('validation', { recursive: true })
writeFileSync('validation/contact-tests.json', JSON.stringify(results, null, 2))
console.log(JSON.stringify(results, null, 2))
