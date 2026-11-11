import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { NextRequest, NextResponse } from 'next/server.js'

function load(name, dependencies = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(`lib/supabase/${name}.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, module: { exports }, URL, Headers, TextDecoder, Uint8Array, process: { env: {} },
    fetch: () => { throw Error('LIVE NETWORK FORBIDDEN') },
    require: name => { if (name === 'server-only') return {}; if (name in dependencies) return dependencies[name]; throw Error(`Unexpected import ${name}`) },
  })
  return exports
}
const config = load('config')
const auth = load('auth')
const admission = load('auth-admission')
const portal = load('portal-config', { './config': config, './auth-admission': admission })
const server = load('server', { './config': config, '@supabase/ssr': { createServerClient: () => { throw Error('REAL SDK FORBIDDEN') } } })
const handlers = load('portal-handlers', { './server': server, './portal-config': portal, './auth': auth, './auth-admission': admission, 'next/server': { NextRequest, NextResponse } })
const env = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://auth.example.com', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_mock',
  PIC_SHAW_AUTH_ORIGIN: 'https://portal.example.com', PIC_SHAW_AUTH_GOOGLE_ENABLED: 'true',
  PIC_SHAW_AUTH_APPLE_ENABLED: 'true', PIC_SHAW_AUTH_EMAIL_ENABLED: 'true',
  PIC_SHAW_AUTH_SESSION_ENABLED: 'true',
}
let calls = [], created = 0, result, throws = false, cookieBatches = [], methodResults = {}, methodCookies = {}, throwMethods = [], cookieReads = []
const methods = ['signInWithOAuth', 'signInWithPassword', 'signUp', 'exchangeCodeForSession', 'getUser', 'signOut', 'resetPasswordForEmail', 'updateUser']
const verifiedUser = { id: '00000000-0000-4000-8000-000000000001', is_anonymous: false, user_metadata: { role: 'admin' }, email: 'private@example.com' }
const allow = async () => ({ status: 'allow' })
function createClient(adapter) {
  created++
  return { auth: Object.fromEntries(methods.map(method => [method, async (...args) => {
    cookieReads.push([method, adapter.getAll()])
    calls.push([method, ...args]); for (const batch of methodCookies[method] ?? cookieBatches) await adapter.setAll(batch, server.AUTH_RESPONSE_HEADERS)
    if (throws || throwMethods.includes(method)) throw Error('SECRET_TOKEN_MUST_NOT_LEAK')
    return methodResults[method] ?? result
  }])) }
}
function request(body = {}, overrides = {}) {
  return new NextRequest(overrides.url || `${env.PIC_SHAW_AUTH_ORIGIN}/api/platform/auth/sign-in`, {
    method: 'POST', headers: { origin: env.PIC_SHAW_AUTH_ORIGIN, 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', ...overrides.headers },
    body: overrides.raw ?? JSON.stringify(body),
  })
}
const post = (action, body, overrides, environment = env) => handlers.handleAuthPost(request(body, overrides), action, { env: environment, createClient, admit: allow })
const callback = (query, environment = env, origin = env.PIC_SHAW_AUTH_ORIGIN) => handlers.handleAuthCallback(new NextRequest(`${origin}/platform/auth/callback${query}`), { env: environment, createClient })
function privateResponse(response) {
  assert.match(response.headers.get('cache-control'), /private.*no-store/)
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
  assert.match(response.headers.get('x-robots-tag'), /noindex/)
}
let passed = 0
async function test(name, fn) { calls = []; created = 0; result = { data: {}, error: null }; throws = false; cookieBatches = []; methodResults = {}; methodCookies = {}; throwMethods = []; cookieReads = []; await fn(); passed++; console.log(`PASS ${name}`) }
const credentials = { email: 'person@example.com', password: 'a-long-mock-passphrase' }

await test('missing project, origin or provider flags deny before SDK creation', async () => {
  for (const setup of [{}, { ...env, PIC_SHAW_AUTH_ORIGIN: '' }, { ...env, PIC_SHAW_AUTH_GOOGLE_ENABLED: 'false' }]) {
    const r = await post('google', {}, {}, setup); assert.equal(r.status, 503); privateResponse(r)
  }
  const r = await callback('?code=mock', {}); assert.equal(r.status, 503); privateResponse(r); assert.equal(created, 0)
})
await test('origin config rejects HTTP, credentials, paths, wildcard and query forms', () => {
  for (const value of ['http://portal.example.com', 'https://*.example.com', 'https://user:secret@portal.example.com', 'https://portal.example.com/path', 'https://portal.example.com?x=1', 'https://portal.example.com:8443']) {
    assert.throws(() => portal.readPortalConfig({ ...env, PIC_SHAW_AUTH_ORIGIN: value }))
  }
  assert.equal(portal.authAvailability({ ...env, PIC_SHAW_AUTH_EMAIL_ENABLED: 'TRUE' }).email, false)
  assert.equal(portal.authAvailability({}).google, false)
})
await test('cross-site, missing-origin and forwarded-host tricks cannot initiate sign-in', async () => {
  for (const headers of [{ origin: 'https://evil.example.com' }, { origin: '' }, { 'sec-fetch-site': 'cross-site' }]) assert.equal((await post('google', {}, { headers })).status, 403)
  assert.equal((await post('google', {}, { url: 'https://evil.example.com/api/platform/auth/google', headers: { 'x-forwarded-host': 'portal.example.com' } })).status, 403)
  assert.equal(created, 0)
})
await test('unsupported actions and malformed, oversized or non-JSON bodies do not create clients', async () => {
  assert.equal((await post('arbitrary-provider')).status, 404)
  for (const overrides of [{ raw: '{' }, { raw: 'x'.repeat(4097) }, { headers: { 'content-type': 'text/plain' } }]) assert.equal((await post('google', {}, overrides)).status, 400)
  assert.equal(created, 0)
})
await test('email credentials enforce size and signup policy without trimming passwords', async () => {
  for (const body of [null, {}, { ...credentials, email: 'invalid' }, { ...credentials, password: '' }, { ...credentials, password: 'x'.repeat(129) }]) assert.equal((await post('sign-in', body)).status, 400)
  assert.equal((await post('sign-up', { ...credentials, password: 'short' })).status, 400)
  assert.equal(created, 0)
  result = { data: { session: {} }, error: null }
  await post('sign-in', { ...credentials, password: ' keep spaces ' })
  assert.equal(calls[0][1].password, ' keep spaces ')
})
await test('Google and Apple use exact callback and only trusted authorize URLs', async () => {
  for (const provider of ['google', 'apple']) {
    const url = `https://auth.example.com/auth/v1/authorize?provider=${provider}`
    result = { data: { url }, error: null }
    const r = await post(provider); assert.equal(r.status, 200); privateResponse(r)
    assert.equal((await r.json()).url, url)
    const args = calls.at(-1)[1]; assert.equal(args.provider, provider); assert.equal(args.options.redirectTo, 'https://portal.example.com/platform/auth/callback'); assert.equal(args.options.skipBrowserRedirect, true)
  }
  for (const url of ['https://evil.example.com/auth/v1/authorize?provider=google', 'https://auth.example.com/other?provider=google', 'https://auth.example.com/auth/v1/authorize?provider=apple', 'https://secret@auth.example.com/auth/v1/authorize?provider=google']) {
    result = { data: { url }, error: null }; assert.equal((await post('google')).status, 400)
  }
})
await test('password login and signup return no sessions/tokens or account-existence claim', async () => {
  result = { data: { session: { access_token: 'SECRET_TOKEN_MUST_NOT_LEAK' } }, error: null }
  const r = await post('sign-in', credentials); assert.equal(r.status, 200); privateResponse(r)
  assert.doesNotMatch(await r.text(), /SECRET_TOKEN|access_token/)
  result = { data: { session: null, user: { id: 'obscured' } }, error: null }
  const signup = await post('sign-up', credentials); assert.match((await signup.json()).message, /If this address is eligible/)
  assert.equal(calls.at(-1)[1].options.emailRedirectTo, 'https://portal.example.com/platform/auth/callback')
})
await test('SDK errors and thrown exceptions are generic and private', async () => {
  result = { data: {}, error: { message: 'SECRET_TOKEN_MUST_NOT_LEAK' } }
  for (const action of ['google', 'sign-in', 'sign-up']) { const r = await post(action, credentials); assert.equal(r.status, 400); privateResponse(r); assert.doesNotMatch(await r.text(), /SECRET_TOKEN/) }
  throws = true; const r = await post('apple'); assert.equal(r.status, 400); assert.doesNotMatch(await r.text(), /SECRET_TOKEN/)
})
await test('callback rejects missing, repeated, errored and malformed codes before exchange', async () => {
  for (const query of ['', '?error=secret&code=mock', '?code=one&code=two', '?code=%0d%0a', '?code=ok&sb_flow_id=bad', '?code=ok&sb_flow_id=abcdefgh&sb_flow_id=ijklmnop']) {
    const r = await callback(query); assert.equal(r.status, 303); privateResponse(r); assert.equal(r.headers.get('location'), 'https://portal.example.com/platform/sign-in?error=callback')
  }
  assert.equal(created, 0)
})
await test('callback honors PKCE flow ID, ignores next/forwarded destinations and preserves cookies', async () => {
  result = { data: { session: { access_token: 'SECRET_TOKEN_MUST_NOT_LEAK' } }, error: null }
  cookieBatches = [[{ name: 'verifier', value: '', options: { maxAge: 0, path: '/', secure: true, httpOnly: true, sameSite: 'lax' } }], [{ name: 'session', value: 'mock-cookie', options: { path: '/', secure: true, httpOnly: true, sameSite: 'lax' } }]]
  const r = await callback('?code=mock-code&sb_flow_id=abcdefgh&next=https://evil.example.com')
  assert.equal(r.status, 303); privateResponse(r); assert.equal(r.headers.get('location'), 'https://portal.example.com/platform')
  assert.equal(calls[0][1], 'mock-code'); assert.equal(calls[0][2].flowId, 'abcdefgh')
  assert.equal(r.cookies.get('session').value, 'mock-cookie'); assert.equal(r.cookies.get('verifier').value, '')
  assert.match(r.headers.get('set-cookie'), /HttpOnly/); assert.match(r.headers.get('set-cookie'), /Secure/)
})
await test('failed verifier exchange never redirects to workspace and keeps cookie deletions', async () => {
  result = { data: { session: null }, error: { message: 'secret' } }
  cookieBatches = [[{ name: 'verifier', value: '', options: { maxAge: 0, path: '/' } }]]
  const r = await callback('?code=stale'); assert.match(r.headers.get('location'), /sign-in\?error=callback$/); assert.equal(r.cookies.get('verifier').value, '')
  assert.equal((await callback('?code=mock', env, 'https://evil.example.com')).status, 403)
})
await test('response cookie jars and clients are isolated across requests', async () => {
  result = { data: { session: {} }, error: null }
  cookieBatches = [[{ name: 'session', value: 'first-user', options: { path: '/' } }]]
  const first = await post('sign-in', credentials)
  cookieBatches = []
  const second = await post('sign-in', credentials)
  assert.equal(created, 2); assert.equal(first.cookies.get('session').value, 'first-user'); assert.equal(second.cookies.get('session'), undefined)
})
await test('each provider can be disabled independently including both email operations', async () => {
  for (const [flag, actions] of [['GOOGLE', ['google']], ['APPLE', ['apple']], ['EMAIL', ['sign-in', 'sign-up']]]) {
    for (const action of actions) {
      const r = await post(action, credentials, {}, { ...env, [`PIC_SHAW_AUTH_${flag}_ENABLED`]: 'false' })
      assert.equal(r.status, 503); privateResponse(r)
    }
  }
  assert.equal(created, 0)
})
await test('OAuth initiation carries the verifier cookie on its response and signup carries its own', async () => {
  cookieBatches = [[{ name: 'pkce-verifier', value: 'mock-verifier', options: { path: '/', secure: true, httpOnly: true, sameSite: 'lax' } }]]
  result = { data: { url: 'https://auth.example.com/auth/v1/authorize?provider=google' }, error: null }
  const oauth = await post('google'); assert.equal(oauth.cookies.get('pkce-verifier').value, 'mock-verifier')
  assert.doesNotMatch(await oauth.text(), /mock-verifier/)
  result = { data: { session: null }, error: null }
  const signup = await post('sign-up', credentials); assert.equal(signup.cookies.get('pkce-verifier').value, 'mock-verifier')
})
await test('missing session and thrown callback error never claim authentication', async () => {
  result = { data: { session: null }, error: null }
  assert.equal((await post('sign-in', credentials)).status, 400)
  assert.match((await callback('?code=mock')).headers.get('location'), /sign-in\?error=callback$/)
  throws = true
  const r = await callback('?code=mock'); assert.match(r.headers.get('location'), /sign-in\?error=callback$/); assert.doesNotMatch(await r.text(), /SECRET_TOKEN/)
})
await test('default abuse adapter fails closed even with configured provider flags', async () => {
  for (const action of ['google', 'apple', 'sign-in', 'sign-up', 'recover', 'reset-password']) {
    const r = await handlers.handleAuthPost(request(credentials), action, { env, createClient })
    assert.equal(r.status, 503); privateResponse(r)
  }
  assert.equal(created, 0)
})
await test('limited, unavailable and thrown abuse checks cannot create a client', async () => {
  for (const [admit, status] of [[async () => ({ status: 'limited' }), 429], [async () => ({ status: 'unavailable' }), 503], [async () => { throw Error('secret') }, 503]]) {
    const r = await handlers.handleAuthPost(request(credentials), 'sign-in', { env, createClient, admit })
    assert.equal(r.status, status); privateResponse(r); assert.doesNotMatch(await r.text(), /secret/)
  }
  assert.equal(created, 0)
})
await test('all lifecycle operations are separately gated and origin checked before SDK calls', async () => {
  for (const action of ['session', 'sign-out', 'sign-out-all', 'reset-password']) {
    assert.equal((await post(action, credentials, {}, { ...env, PIC_SHAW_AUTH_SESSION_ENABLED: 'false' })).status, 503)
    assert.equal((await post(action, credentials, { headers: { origin: 'https://evil.example.com' } })).status, 403)
  }
  for (const action of ['recover', 'reset-password']) assert.equal((await post(action, credentials, {}, { ...env, PIC_SHAW_AUTH_EMAIL_ENABLED: 'false' })).status, 503)
  assert.equal(created, 0)
})
await test('recovery validates email and preserves PKCE cookie with a neutral result', async () => {
  for (const body of [{}, { email: 'invalid' }, { email: 'a'.repeat(255) }, null]) assert.equal((await post('recover', body)).status, 400)
  assert.equal(created, 0)
  cookieBatches = [[{ name: 'recovery-verifier', value: 'mock-only', options: { httpOnly: true, secure: true, sameSite: 'lax', path: '/' } }]]
  result = { data: {}, error: null }
  const r = await post('recover', { email: credentials.email }); const first = await r.json()
  assert.equal(r.status, 200); privateResponse(r); assert.match(first.message, /If this address is eligible/)
  assert.equal(calls[0][1], credentials.email); assert.equal(calls[0][2].redirectTo, 'https://portal.example.com/platform/auth/callback')
  assert.equal(r.cookies.get('recovery-verifier').value, 'mock-only')
  result = { data: null, error: { code: 'account-specific-error', message: 'secret' } }
  const second = await post('recover', { email: credentials.email }); assert.deepEqual(await second.json(), first)
})
await test('only SDK recovery type selects fixed reset-password destination', async () => {
  result = { data: { session: {}, redirectType: null }, error: null }
  assert.equal((await callback('?code=mock&type=recovery&next=/platform/reset-password')).headers.get('location'), 'https://portal.example.com/platform')
  result = { data: { session: {}, redirectType: 'recovery' }, error: null }
  const r = await callback('?code=mock&next=https://evil.example.com'); assert.equal(r.headers.get('location'), 'https://portal.example.com/platform/reset-password'); privateResponse(r)
  assert.equal((await callback('?code=mock', { ...env, PIC_SHAW_AUTH_SESSION_ENABLED: 'false' })).headers.get('location'), 'https://portal.example.com/platform')
})
await test('session check refreshes via verified getUser and returns no identity or tokens', async () => {
  methodResults.getUser = { data: { user: verifiedUser }, error: null }
  methodCookies.getUser = [[{ name: 'session.0', value: 'rotated-mock', options: { path: '/', httpOnly: true, secure: true, sameSite: 'lax' } }]]
  const r = await post('session'); assert.equal(r.status, 200); privateResponse(r)
  const body = await r.text(); assert.match(body, /signed-in/); assert.doesNotMatch(body, /private@example|00000000|rotated-mock|admin|access_token/)
  assert.equal(r.cookies.get('session.0').value, 'rotated-mock'); assert.equal(calls[0][0], 'getUser'); assert.equal(calls.length, 1)
})
await test('missing or rejected sessions differ from temporary verification failures', async () => {
  for (const response of [{ data: { user: null }, error: null }, { data: { user: null }, error: { status: 401 } }, { data: { user: null }, error: { name: 'AuthSessionMissingError' } }]) {
    methodResults.getUser = response
    const r = await post('session'); assert.equal(r.status, 401); assert.equal((await r.json()).state, 'signed-out'); privateResponse(r)
  }
  for (const error of [{ status: 503, message: 'secret' }, { name: 'AuthRetryableFetchError', message: 'secret' }]) {
    methodResults.getUser = { data: { user: null }, error }; const r = await post('session'); assert.equal(r.status, 503); assert.equal((await r.json()).state, 'unknown')
  }
  throwMethods = ['getUser']; const r = await post('session'); assert.equal(r.status, 503); assert.equal((await r.json()).state, 'unknown')
})
await test('expired-session cookie deletion survives verification failure response', async () => {
  methodResults.getUser = { data: { user: null }, error: { status: 401, message: 'secret' } }
  methodCookies.getUser = [[{ name: 'session', value: '', options: { path: '/', maxAge: 0, secure: true, httpOnly: true } }]]
  const r = await post('session'); assert.equal(r.status, 401); privateResponse(r); assert.equal(r.cookies.get('session').value, '')
})
await test('logout scope is explicit and local cookie deletion survives upstream errors', async () => {
  methodResults.signOut = { error: null }
  methodCookies.signOut = [[{ name: 'session', value: '', options: { path: '/', maxAge: 0, secure: true, httpOnly: true } }]]
  const local = await post('sign-out'); assert.equal(local.status, 200); privateResponse(local); assert.equal(calls[0][1].scope, 'local'); assert.equal(local.cookies.get('session').value, '')
  methodResults.signOut = { error: { message: 'secret' } }
  const failed = await post('sign-out'); assert.equal(failed.status, 503); privateResponse(failed); assert.equal(failed.cookies.get('session').value, ''); assert.doesNotMatch(await failed.text(), /secret/)
  methodResults.getUser = { data: { user: verifiedUser }, error: null }; methodResults.signOut = { error: null }
  const global = await post('sign-out-all'); assert.equal(global.status, 200); assert.equal(calls.at(-1)[1].scope, 'global'); assert.match((await global.json()).message, /until they expire/)
})
await test('global logout cannot report remote revocation without a verified current account', async () => {
  methodResults.getUser = { data: { user: null }, error: null }
  const r = await post('sign-out-all'); assert.equal(r.status, 401); assert.equal(calls.some(([method]) => method === 'signOut'), false)
})
await test('logout remains available when initiation limiter is unavailable or providers paused', async () => {
  methodResults.signOut = { error: null }
  const paused = { ...env, PIC_SHAW_AUTH_GOOGLE_ENABLED: 'false', PIC_SHAW_AUTH_APPLE_ENABLED: 'false', PIC_SHAW_AUTH_EMAIL_ENABLED: 'false' }
  const r = await handlers.handleAuthPost(request(), 'sign-out', { env: paused, createClient })
  assert.equal(r.status, 200); assert.equal(calls[0][0], 'signOut')
})
await test('password update requires verified identity and validation, never mutable metadata', async () => {
  assert.equal((await post('reset-password', { password: 'short' })).status, 400); assert.equal(created, 0)
  for (const user of [null, { ...verifiedUser, is_anonymous: true }, { ...verifiedUser, id: 'forged' }]) {
    methodResults.getUser = { data: { user }, error: null }
    const r = await post('reset-password', credentials); assert.equal(r.status, 401)
  }
  assert.equal(calls.some(([method]) => method === 'updateUser'), false)
})
await test('password update is followed by explicit global sign-out with cookies retained', async () => {
  methodResults.getUser = { data: { user: verifiedUser }, error: null }
  methodResults.updateUser = { data: { user: verifiedUser }, error: null }
  methodResults.signOut = { error: null }
  methodCookies.getUser = [[{ name: 'session', value: 'rotated', options: { path: '/', secure: true, httpOnly: true } }]]
  methodCookies.signOut = [[{ name: 'session', value: '', options: { path: '/', maxAge: 0, secure: true, httpOnly: true } }]]
  const r = await post('reset-password', { password: ' keep this long password ' }); assert.equal(r.status, 200); privateResponse(r)
  assert.equal((await r.json()).state, 'password-updated'); assert.equal(calls[1][1].password, ' keep this long password '); assert.equal(calls[2][1].scope, 'global')
  assert.equal(r.cookies.get('session').value, '')
  assert.equal(cookieReads.find(([method]) => method === 'signOut')[1].find(cookie => cookie.name === 'session').value, 'rotated')
})
await test('failed password update does not sign out or claim success; partial revocation failure is explicit', async () => {
  methodResults.getUser = { data: { user: verifiedUser }, error: null }
  methodResults.updateUser = { data: { user: null }, error: { message: 'secret' } }
  const failed = await post('reset-password', credentials); assert.equal(failed.status, 400); assert.equal(calls.some(([method]) => method === 'signOut'), false)
  methodResults.updateUser = { data: { user: verifiedUser }, error: null }; methodResults.signOut = { error: { message: 'secret' } }
  const partial = await post('reset-password', credentials); assert.equal(partial.status, 200); assert.equal((await partial.json()).state, 'password-updated-signout-pending')
  throwMethods = ['signOut']; const thrown = await post('reset-password', credentials); assert.equal((await thrown.json()).state, 'password-updated-signout-pending')
})
await test('unwired abuse backend disables initiation UI but not independently configured session controls', () => {
  assert.equal(portal.authAvailability(env).google, false); assert.equal(portal.authAvailability(env).apple, false); assert.equal(portal.authAvailability(env).email, false)
  assert.equal(portal.lifecycleAvailability(env).email, false); assert.equal(portal.lifecycleAvailability(env).session, true)
  assert.equal(portal.lifecycleAvailability({}).session, false)
})
await test('transient logout without cookie writes does not claim cookies were cleared', async () => {
  methodResults.signOut = { error: { message: 'upstream private failure' } }
  const r = await post('sign-out'); assert.equal(r.status, 503); privateResponse(r)
  assert.equal(r.headers.get('set-cookie'), null); assert.match((await r.json()).error, /could not confirm/)
})
await test('recovery and verification upstream exceptions retain all cookie headers privately', async () => {
  const cookies = [[{ name: 'verifier', value: '', options: { path: '/', maxAge: 0, httpOnly: true, secure: true } }]]
  cookieBatches = cookies; throwMethods = ['resetPasswordForEmail', 'getUser']
  const recovery = await post('recover', { email: credentials.email }); assert.equal(recovery.status, 400); privateResponse(recovery); assert.equal(recovery.cookies.get('verifier').value, '')
  const session = await post('session'); assert.equal(session.status, 503); privateResponse(session); assert.equal(session.cookies.get('verifier').value, ''); assert.equal((await session.json()).state, 'unknown')
})
console.log(`${passed} mocked auth-flow checks passed. No live sign-in, signup, email, OAuth, database or network calls.`)
