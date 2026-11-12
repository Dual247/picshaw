import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function load(name, dependencies = {}, overrides = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(`lib/supabase/${name}.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, module: { exports }, URL, Response, process: { env: {} },
    fetch: () => { throw Error('REAL NETWORK FORBIDDEN') },
    require: name => {
      if (name === 'server-only') return {}
      if (name in dependencies) return dependencies[name]
      throw Error(`Unexpected dependency: ${name}`)
    }, ...overrides,
  })
  return exports
}
const config = load('config')
const auth = load('auth')
const valid = { NEXT_PUBLIC_SUPABASE_URL: 'https://picshaw-test.invalid', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_mock_only' }
// Reserved domain for tests, never a real project. Config allows custom HTTPS origins.
valid.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.example.com'
const invalidConfig = error => error.code === 'SUPABASE_NOT_CONFIGURED' && !error.message.includes('secret')
const denied = error => error.code === 'AUTHENTICATION_REQUIRED' && !error.message.includes('secret')
let passed = 0
async function test(name, fn) { await fn(); passed++; console.log(`PASS ${name}`) }

await test('missing and partial configuration fail closed', () => {
  for (const env of [{}, { NEXT_PUBLIC_SUPABASE_URL: valid.NEXT_PUBLIC_SUPABASE_URL }, { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: valid.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }]) {
    assert.throws(() => config.readSupabaseConfig(env), invalidConfig)
  }
  assert.throws(() => config.readSupabaseConfig(), invalidConfig)
})
await test('secret, legacy and placeholder keys are rejected', () => {
  for (const key of ['', ' ', 'sb_secret_secret', 'eyJ.mock.service_role', 'your-key', 'sb_publishable_']) {
    assert.throws(() => config.readSupabaseConfig({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }), invalidConfig)
  }
})
await test('non-HTTPS and non-origin configuration is rejected', () => {
  for (const url of ['invalid', 'http://example.com', 'https://secret@example.com', 'https://example.com/path', 'https://example.com?secret', 'https://example.com#secret', 'https://example.com:1234', 'https://localhost', 'https://project.invalid']) {
    assert.throws(() => config.readSupabaseConfig({ ...valid, NEXT_PUBLIC_SUPABASE_URL: url }), invalidConfig)
  }
})
await test('valid config is normalized, not treated as proof of a project', () => {
  assert.equal(config.readSupabaseConfig({ ...valid, NEXT_PUBLIC_SUPABASE_URL: ' https://supabase.example.com/ ' }).url, valid.NEXT_PUBLIC_SUPABASE_URL)
})
const calls = [], fetches = []
const server = load('server', {
  './config': config,
  '@supabase/ssr': { createServerClient: (...args) => { calls.push(args); return { mockedClientNumber: calls.length } } },
}, { fetch: async (...args) => { fetches.push(args); return { mockedResponse: true } } })
const writes = []
const cookies = { getAll: () => [{ name: 'test', value: 'mock-only' }], setAll: (...args) => { writes.push(args) } }
await test('invalid config prevents SDK creation', () => {
  assert.throws(() => server.createRequestSupabaseClient(cookies, {}), invalidConfig)
  assert.equal(calls.length, 0)
})
await test('read-only or missing cookie adapters are rejected', () => {
  for (const adapter of [null, {}, { getAll: () => [] }]) assert.throws(() => server.createRequestSupabaseClient(adapter, valid))
  assert.equal(calls.length, 0)
})
await test('client factory is request scoped with secure cookie options', () => {
  assert.notEqual(server.createRequestSupabaseClient(cookies, valid), server.createRequestSupabaseClient(cookies, valid))
  assert.equal(calls.length, 2)
  assert.equal(calls[0][0], valid.NEXT_PUBLIC_SUPABASE_URL)
  assert.equal(calls[0][1], valid.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  assert.equal(calls[0][2].cookieOptions.secure, true)
  assert.equal(calls[0][2].cookieOptions.httpOnly, true)
  assert.equal(calls[0][2].cookieOptions.sameSite, 'lax')
  assert.equal(calls[0][2].cookieOptions.name, '__Host-picshaw-auth')
  assert.equal(calls[0][2].cookieOptions.path, '/')
  assert.equal(calls[0][2].cookieOptions.domain, undefined)
  assert.equal(calls[0][2].cookies.getAll()[0].value, 'mock-only')
})
await test('all cookie options and cache headers forwarded on every write', async () => {
  const batch = [{ name: 'test', value: 'mock-only', options: { maxAge: 0, path: '/' } }]
  for (const headers of [{ 'Cache-Control': 'public', 'X-Test': 'retained' }, {}]) await calls[0][2].cookies.setAll(batch, headers)
  for (const [values, headers] of writes) {
    assert.equal(values, batch)
    assert.match(headers['Cache-Control'], /private.*no-store/)
    assert.equal(headers.Expires, '0'); assert.equal(headers.Pragma, 'no-cache')
  }
  assert.equal(writes[0][1]['X-Test'], 'retained')
})
await test('cookie write failures are not silently swallowed', async () => {
  server.createRequestSupabaseClient({ ...cookies, setAll: async () => { throw Error('write failed') } }, valid)
  await assert.rejects(calls.at(-1)[2].cookies.setAll([], {}), /write failed/)
})
await test('upstream auth fetch cannot opt into caching or redirects', async () => {
  await calls[0][2].global.fetch('https://supabase.example.com/auth/v1/token', { method: 'POST', cache: 'force-cache', redirect: 'follow', body: 'mock-only' })
  assert.equal(fetches[0][1].cache, 'no-store'); assert.equal(fetches[0][1].redirect, 'error')
  assert.equal(fetches[0][1].method, 'POST'); assert.equal(fetches[0][1].body, 'mock-only')
})
const id = '00000000-0000-4000-8000-000000000001'
const user = { id, is_anonymous: false, user_metadata: { organizationId: 'attacker', role: 'admin' } }
function client(result) { return { auth: { getUser: async () => result, getSession: () => { throw Error('Unverified session must not be used') } } } }
await test('only server-verified actor ID is returned, never metadata or tokens', async () => {
  const actor = await auth.requireVerifiedActor(client({ data: { user }, error: null }))
  assert.equal(JSON.stringify(actor), JSON.stringify({ id }))
})
await test('missing, anonymous, malformed or errored users deny access', async () => {
  for (const result of [null, {}, { data: { user: null }, error: null }, { data: { user }, error: { message: 'secret' } },
    ...[ { ...user, id: '' }, { ...user, id: 'forged' }, { ...user, is_anonymous: true }, { id } ].map(user => ({ data: { user }, error: null }))]) {
    await assert.rejects(auth.requireVerifiedActor(client(result)), denied)
  }
})
await test('network/SDK exceptions deny access with sanitized error', async () => {
  await assert.rejects(auth.requireVerifiedActor({ auth: { getUser: async () => { throw Error('secret token') } } }), denied)
})
await test('blank env template and synchronized exact direct dependency pins', () => {
  const template = readFileSync('.env.example', 'utf8')
  for (const key of Object.keys(valid)) assert.match(template, new RegExp(`^${key}=$`, 'm'))
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'))
  const pnpm = readFileSync('pnpm-lock.yaml', 'utf8')
  for (const name of ['@supabase/ssr', '@supabase/supabase-js']) {
    const version = pkg.dependencies[name]
    assert.match(version, /^\d+\.\d+\.\d+$/)
    assert.equal(lock.packages[''].dependencies[name], version)
    assert.equal(lock.packages[`node_modules/${name}`].version, version)
    assert.ok(pnpm.includes(`specifier: ${version}`))
  }
})
console.log(`${passed} Supabase foundation checks passed. SDK/user responses mocked; no live auth, cookies, RLS, or network verification.`)
