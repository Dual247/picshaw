import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import ts from 'typescript'
import { createServerClient } from '@supabase/ssr'
import { createChunks } from '@supabase/ssr/dist/main/utils/chunker.js'
import { NextRequest, NextResponse } from 'next/server.js'

// Actual pinned SDK + actual route handlers. Only HTTP transport is synthetic.
// No real project, credentials, account, email, external fetch or browser involved.
const origin = 'https://app.picshaw.com'
const project = 'https://supabase.example.com'
const key = '__Host-picshaw-auth'
const env = { VERCEL_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: project,
  PIC_SHAW_PORTAL_ACCESS_MODE: 'public',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture', PIC_SHAW_AUTH_ORIGIN: origin,
  ...Object.fromEntries(['GOOGLE', 'APPLE', 'EMAIL', 'SESSION'].map(name => [`PIC_SHAW_AUTH_${name}_ENABLED`, 'true'])) }
const user = number => ({ id: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
  aud: 'authenticated', role: 'authenticated', is_anonymous: false, email: `fixture-${number}@example.com`, user_metadata: {} })
const now = () => Math.floor(Date.now() / 1000)
function session(number, expires = now() + 3600, large = false) {
  const record = user(number)
  if (large) record.user_metadata.fixture = 'x'.repeat(12000)
  const token = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),
    Buffer.from(JSON.stringify({ sub: record.id, exp: expires, role: 'authenticated', fixture: number })).toString('base64url'), 'fixture-signature'].join('.')
  return { access_token: token, refresh_token: `fixture-refresh-${number}`, token_type: 'bearer', expires_in: 3600, expires_at: expires, user: record }
}
function cookieJar(value) {
  return new Map(value ? createChunks(key, `base64-${Buffer.from(JSON.stringify(value)).toString('base64url')}`).map(({ name, value }) => [name, value]) : [])
}
function applyResponse(jar, response) {
  for (const cookie of response.cookies.getAll()) {
    assert.ok(cookie.name.startsWith('__Host-'))
    assert.equal(cookie.secure, true); assert.equal(cookie.httpOnly, true)
    assert.equal(cookie.sameSite, 'lax'); assert.equal(cookie.path, '/'); assert.equal(cookie.domain, undefined)
    if (cookie.maxAge === 0 || cookie.value === '') jar.delete(cookie.name)
    else jar.set(cookie.name, cookie.value)
  }
}
const cookieHeader = jar => [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
const admissions = { authAdmissionConfigured: true, checkDeploymentAuthAdmission: async () => ({ status: 'allow' }) }
let transport, calls = [], tests = 0
const originalFetch = globalThis.fetch
globalThis.fetch = () => { throw Error('External network is forbidden in this test.') }
function load(name, dependencies = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(`lib/supabase/${name}.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, module: { exports }, URL, Headers, Response, TextDecoder, Uint8Array, process: { env: {} },
    fetch: async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input.url)
      assert.equal(url.origin, project); assert.equal(init.cache, 'no-store'); assert.equal(init.redirect, 'error')
      assert.equal(init.headers.apikey, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
      calls.push({ path: url.pathname, query: url.searchParams, method: init.method })
      return transport(url, init)
    },
    require: name => name === 'server-only' ? {} : name in dependencies ? dependencies[name] : (() => { throw Error(`Unexpected dependency ${name}`) })(),
  })
  return exports
}
const config = load('config'), auth = load('auth')
const server = load('server', { './config': config, '@supabase/ssr': { createServerClient } })
const portal = load('portal-config', { './config': config, './auth': auth, './auth-admission': admissions, '../portal-origin': { PORTAL_ORIGIN: origin } })
const handlers = load('portal-handlers', { './server': server, './auth': auth, './portal-config': portal,
  './auth-admission': admissions, 'next/server': { NextRequest, NextResponse } })
async function post(action, jar = new Map(), body = {}, headers = {}) {
  const response = await handlers.handleAuthPost(new NextRequest(`${origin}/api/platform/auth/${action}`, {
    method: 'POST', headers: { host: 'app.picshaw.com', origin, 'content-type': 'application/json',
      'sec-fetch-site': 'same-origin', cookie: cookieHeader(jar), ...headers }, body: JSON.stringify(body),
  }), action, { env })
  assert.match(response.headers.get('cache-control'), /private.*no-store/)
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
  assert.doesNotMatch(await response.clone().text(), /fixture-refresh|fixture-signature|fixture-[12]@|access_token|code_verifier/)
  applyResponse(jar, response)
  return response
}
async function callback(query, jar) {
  const response = await handlers.handleAuthCallback(new NextRequest(`${origin}/platform/auth/callback${query}`, {
    headers: { host: 'app.picshaw.com', cookie: cookieHeader(jar) },
  }), { env })
  assert.match(response.headers.get('cache-control'), /private.*no-store/)
  applyResponse(jar, response)
  return response
}
async function test(name, run) {
  calls = []; transport = () => { throw Error('Unexpected transport request') }
  await run(); tests++; console.log(`PASS ${name}`)
}
try {
  await test('real SDK refresh reaches final response, deletes stale chunks and survives next request', async () => {
    const expired = session(1, now() - 600, true), fresh = session(1)
    const jar = cookieJar(expired)
    assert.ok(jar.size > 2)
    transport = (url, init) => {
      if (url.pathname === '/auth/v1/token') {
        assert.equal(url.searchParams.get('grant_type'), 'refresh_token')
        assert.equal(JSON.parse(init.body).refresh_token, expired.refresh_token)
        return Response.json(fresh)
      }
      assert.equal(url.pathname, '/auth/v1/user')
      assert.equal(init.headers.Authorization, `Bearer ${fresh.access_token}`)
      return Response.json(fresh.user)
    }
    const first = await post('session', jar)
    assert.equal(first.status, 200); assert.equal((await first.json()).state, 'signed-in')
    assert.equal(jar.size, 1); assert.ok(jar.has(key))
    assert.equal((await post('session', jar)).status, 200)
    assert.equal(calls.filter(call => call.path === '/auth/v1/token').length, 1)
  })
  await test('two concurrent request clients never share cookie or user state', async () => {
    const one = session(1), two = session(2), first = cookieJar(one), second = cookieJar(two)
    transport = async (url, init) => {
      assert.equal(url.pathname, '/auth/v1/user')
      await new Promise(resolve => setTimeout(resolve, 1))
      return Response.json(init.headers.Authorization === `Bearer ${one.access_token}` ? one.user : two.user)
    }
    const result = await Promise.all([post('session', first), post('session', second)])
    assert.ok(result.every(response => response.status === 200))
    assert.notEqual(first.get(key), second.get(key)); assert.equal(calls.length, 2)
    assert.equal((await post('session')).status, 401); assert.equal(calls.length, 2)
  })
  await test('a revoked session clears SDK cookie chunks and denies the next request without network', async () => {
    const jar = cookieJar(session(1, now() + 3600, true))
    transport = url => {
      assert.equal(url.pathname, '/auth/v1/user')
      return Response.json({ error_code: 'session_not_found', message: 'fixture' }, { status: 403 })
    }
    const response = await post('session', jar)
    assert.equal(response.status, 401); assert.equal((await response.json()).state, 'signed-out')
    assert.equal(jar.size, 0)
    assert.equal((await post('session', jar)).status, 401); assert.equal(calls.length, 1)
  })
  await test('real logout gateway errors cannot become false global or local success', async () => {
    for (const action of ['sign-out', 'sign-out-all']) {
      for (const status of [400, 401, 403, 404, 429, 503]) {
        const jar = cookieJar(session(1))
        transport = url => url.pathname === '/auth/v1/user' ? Response.json(user(1)) :
          Response.json({ message: 'fixture rejected request', ...(status === 400 ? { error_code: 'session_not_found' } : {}) }, { status })
        const response = await post(action, jar)
        assert.equal(response.status, 503)
        assert.match((await response.json()).error, /could not confirm/)
        if (action === 'sign-out') assert.equal(jar.size, 0, 'local cleanup remains available even on upstream errors')
      }
    }
  })
  await test('confirmed global logout keeps explicit scope and removes every session chunk', async () => {
    const jar = cookieJar(session(1, now() + 3600, true))
    transport = url => {
      if (url.pathname === '/auth/v1/user') return Response.json(user(1))
      assert.equal(url.pathname, '/auth/v1/logout'); assert.equal(url.searchParams.get('scope'), 'global')
      return new Response(null, { status: 204 })
    }
    const response = await post('sign-out-all', jar)
    assert.equal(response.status, 200); assert.equal((await response.json()).state, 'signed-out')
    assert.equal(jar.size, 0)
  })
  await test('password update truthfully reports partial success when logout returns masked status', async () => {
    const jar = cookieJar(session(1))
    transport = (url, init) => {
      if (url.pathname === '/auth/v1/logout') return Response.json({ message: 'fixture rejected request' }, { status: 403 })
      assert.equal(url.pathname, '/auth/v1/user')
      if (init.method === 'PUT') assert.equal(JSON.parse(init.body).password, 'new-fixture-password')
      return Response.json(user(1))
    }
    const response = await post('reset-password', jar, { password: 'new-fixture-password' })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).state, 'password-updated-signout-pending')
  })
  await test('real SDK recovery PKCE flow binds verifier to callback and consumes it once', async () => {
    const jar = new Map(); let redirect, challenge
    transport = (url, init) => {
      if (url.pathname === '/auth/v1/user') return Response.json(user(1))
      if (url.pathname === '/auth/v1/recover') {
        redirect = new URL(url.searchParams.get('redirect_to'))
        const payload = JSON.parse(init.body); challenge = payload.code_challenge
        assert.equal(payload.code_challenge_method, 's256')
        return Response.json({})
      }
      assert.equal(url.pathname, '/auth/v1/token'); assert.equal(url.searchParams.get('grant_type'), 'pkce')
      assert.equal(JSON.parse(init.body).auth_code, 'fixture-code')
      assert.equal(createHash('sha256').update(JSON.parse(init.body).code_verifier).digest('base64url'), challenge)
      return Response.json(session(1))
    }
    assert.equal((await post('recover', jar, { email: 'fixture-1@example.com' })).status, 200)
    assert.ok([...jar.keys()].some(name => name.includes('code-verifier')))
    assert.equal(redirect.origin, origin); assert.equal(redirect.pathname, '/platform/auth/callback')
    // Pinned SDK keeps appending flow IDs experimental and OFF by default to
    // preserve exact redirect allowlists. Exercise the actual default, not a mock.
    assert.equal(redirect.searchParams.has('sb_flow_id'), false)
    const beforeWrongFlow = calls.length
    assert.equal((await callback('?code=fixture-code&sb_flow_id=unknown123', jar)).headers.get('location'), `${origin}/platform/sign-in?error=callback`)
    assert.equal(calls.length, beforeWrongFlow, 'unknown explicit flow must not borrow the legacy verifier')
    const query = '?code=fixture-code&next=https://evil.example.com'
    const completed = await callback(query, jar)
    assert.equal(completed.headers.get('location'), `${origin}/platform/reset-password`)
    assert.ok(jar.has(key))
    const beforeReplay = calls.length
    const replay = await callback(query, jar)
    assert.equal(replay.headers.get('location'), `${origin}/platform/sign-in?error=callback`)
    assert.equal(calls.length, beforeReplay, 'missing consumed verifier must not contact Auth')
    assert.equal((await callback(query, new Map())).headers.get('location'), `${origin}/platform/sign-in?error=callback`)
    assert.equal(calls.length, beforeReplay, 'another browser cannot borrow the verifier')
  })
  await test('real SDK sign-in returns safe navigation state but confirmation signup does not', async () => {
    transport = url => Response.json(url.pathname === '/auth/v1/signup' ? user(1) : session(1))
    const signedIn = await post('sign-in', new Map(), { email: 'fixture-1@example.com', password: 'fixture-password' })
    assert.equal((await signedIn.json()).state, 'signed-in')
    const pending = await post('sign-up', new Map(), { email: 'fixture-1@example.com', password: 'fixture-password' })
    assert.equal((await pending.json()).state, undefined)
  })
  await test('cross-origin requests fail before the real SDK touches transport', async () => {
    assert.equal((await post('reset-password', cookieJar(session(1)), { password: 'fixture-password' }, { origin: 'https://evil.example.com' })).status, 403)
    assert.equal(calls.length, 0)
  })
  console.log(`${tests} actual-SDK route integration checks passed with synthetic transport. No live Auth, browser, JWT signature or tenant-RLS verification.`)
} finally { globalThis.fetch = originalFetch }
