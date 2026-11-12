import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { NextRequest, NextResponse } from 'next/server.js'

function load(path, dependencies = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, module: { exports }, URL, Headers, TextDecoder, Uint8Array, AbortSignal,
    process: { env: {} }, fetch: () => { throw Error('Live network forbidden') },
    require: name => name === 'server-only' ? {} : name in dependencies ? dependencies[name] : (() => { throw Error(`Unexpected import ${name}`) })(),
  })
  return exports
}
const origin = 'https://app.picshaw.com', project = 'https://supabase.example.com'
const idA = '10000000-0000-4000-8000-000000000001', idB = '10000000-0000-4000-8000-000000000002'
const emails = ['hello+portal-test-a@picshaw.com', 'hello+portal-test-b@picshaw.com']
const env = { VERCEL_ENV: 'production', PIC_SHAW_AUTH_ORIGIN: origin, NEXT_PUBLIC_SUPABASE_URL: project,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture', PIC_SHAW_PORTAL_ACCESS_MODE: 'pilot',
  PIC_SHAW_PILOT_USER_A_ID: idA, PIC_SHAW_PILOT_USER_B_ID: idB,
  ...Object.fromEntries(['GOOGLE', 'APPLE', 'EMAIL', 'SESSION'].map(key => [`PIC_SHAW_AUTH_${key}_ENABLED`, 'true'])) }
const users = [idA, idB].map((id, index) => ({ id, email: emails[index], email_confirmed_at: '2026-01-01T00:00:00Z', is_anonymous: false }))
const auth = load('lib/supabase/auth.ts'), config = load('lib/supabase/config.ts')
let admitted = 0, created = 0, calls = [], currentUser = users[0], instantSignup = false, stores = 0
const admission = { authAdmissionConfigured: true, checkDeploymentAuthAdmission: async () => { admitted++; return { status: 'allow' } } }
const portal = load('lib/supabase/portal-config.ts', { './config': config, './auth': auth, './auth-admission': admission, '../portal-origin': { PORTAL_ORIGIN: origin } })
const cookie = (name, value) => ({ name, value, options: { secure: true, httpOnly: true, sameSite: 'lax', path: '/' } })
function createClient(adapter) {
  created++
  return { auth: Object.fromEntries(['getClaims', 'getUser', 'signInWithPassword', 'signUp', 'resetPasswordForEmail', 'exchangeCodeForSession', 'updateUser', 'signOut'].map(name => [name, async () => {
    calls.push(name)
    if (name === 'getClaims') return { data: { claims: { sub: currentUser.id, session_id: '20000000-0000-4000-8000-000000000001', exp: Math.floor(Date.now() / 1000) + 3600,
      role: 'authenticated', is_anonymous: false, iss: `${project}/auth/v1`, aud: 'authenticated' } }, error: null }
    if (name === 'getUser' || name === 'updateUser') return { data: { user: currentUser }, error: null }
    if (name === 'signOut') return { error: null }
    if (name === 'resetPasswordForEmail') return { data: {}, error: null }
    if (name === 'signUp' && !instantSignup) return { data: { session: null }, error: null }
    adapter.setAll([cookie('__Host-picshaw-auth.0', 'untrusted-fresh-cookie'), cookie('__Host-picshaw-auth.1', 'untrusted-fresh-chunk')], {})
    return { data: { session: { user: users[0] } }, error: null }
  }])) }
}
const server = { AUTH_RESPONSE_HEADERS: { 'Cache-Control': 'private, no-store' }, createRequestSupabaseClient: createClient }
const handlers = load('lib/supabase/portal-handlers.ts', { './server': server, './portal-config': portal, './auth': auth, './auth-admission': admission, 'next/server': { NextRequest, NextResponse } })
const request = (body = {}, extra = {}) => new NextRequest(`${origin}/api/platform/auth/session`, { method: 'POST',
  headers: { host: 'app.picshaw.com', origin, 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', cookie: '__Host-picshaw-auth.8=old; other=retained', ...extra }, body: JSON.stringify(body) })
const post = (action, body = {}, settings = env) => handlers.handleAuthPost(request(body), action, { env: settings })
const credentials = email => ({ email, password: 'synthetic-test-passphrase' })
let tests = 0
async function test(name, run) { admitted = 0; created = 0; calls = []; currentUser = users[0]; instantSignup = false; stores = 0; await run(); tests++; console.log(`PASS ${name}`) }

await test('missing, unknown and closed mode reject all initiation despite provider flags', async () => {
  for (const mode of [undefined, '', 'true', 'PILOT', 'closed']) {
    const settings = { ...env, PIC_SHAW_PORTAL_ACCESS_MODE: mode }
    for (const action of ['sign-in', 'sign-up', 'recover', 'google', 'apple']) assert.equal((await post(action, credentials(emails[0]), settings)).status, 503)
    assert.equal(portal.publicPortalReady(settings), false)
  }
  assert.equal(created, 0); assert.equal(admitted, 0)
})
await test('pilot exact email precheck blocks every other address before admission or SDK', async () => {
  for (const email of ['hello@picshaw.com', 'hello+portal-test-c@picshaw.com', 'hello+portal-test-a@picshaw.com.evil.test', 'hello+portal-test-a+alias@picshaw.com', 'HELLO+PORTAL-TEST-A@picshaw.com']) {
    for (const action of ['sign-in', 'sign-up', 'recover']) assert.equal((await post(action, credentials(email))).status, 403)
  }
  assert.equal(created, 0); assert.equal(admitted, 0)
})
await test('both exact addresses can request confirmation/recovery but no automatic ID enrollment', async () => {
  for (const email of emails) {
    const signup = await post('sign-up', credentials(email), { ...env, PIC_SHAW_PILOT_USER_A_ID: undefined, PIC_SHAW_PILOT_USER_B_ID: undefined })
    assert.equal(signup.status, 200); assert.equal((await signup.json()).state, undefined)
    assert.equal((await post('recover', { email })).status, 200)
  }
  assert.equal(calls.includes('getUser'), false)
})
await test('pilot ignores enabled social flags and never advertises public readiness', async () => {
  for (const action of ['google', 'apple']) assert.equal((await post(action)).status, 503)
  assert.equal(portal.authAvailability(env).email, true); assert.equal(portal.authAvailability(env).pilot, true)
  assert.equal(portal.authAvailability(env).google, false); assert.equal(portal.publicPortalReady(env), false)
  assert.equal(portal.publicPortalReady({ ...env, PIC_SHAW_PORTAL_ACCESS_MODE: 'public' }), true)
  assert.equal(created, 0)
})
await test('fresh server-confirmed email AND matching pinned ID admit both pilot users', async () => {
  for (let index = 0; index < users.length; index++) {
    currentUser = users[index]
    const signedIn = await post('sign-in', credentials(emails[index]))
    assert.equal(signedIn.status, 200); assert.equal((await signedIn.json()).state, 'signed-in')
    assert.equal((await post('session')).status, 200)
  }
  assert.equal(calls.filter(name => name === 'getUser').length, 4)
})
await test('wrong identity, unconfirmed email or mutable metadata cannot enter; new and old auth cookies cleared', async () => {
  for (const user of [{ ...users[0], id: idB }, { ...users[0], email: 'customer@example.com', user_metadata: { email: emails[0], pilot: true } },
    { ...users[0], email_confirmed_at: null }, { ...users[0], is_anonymous: true }]) {
    currentUser = user
    const response = await post('sign-in', credentials(emails[0]))
    assert.equal(response.status, 403)
    for (const name of ['__Host-picshaw-auth.0', '__Host-picshaw-auth.1', '__Host-picshaw-auth.8']) {
      assert.equal(response.cookies.get(name).maxAge, 0); assert.equal(response.cookies.get(name).httpOnly, true)
    }
    assert.equal(response.cookies.get('other'), undefined)
    assert.doesNotMatch(await response.text(), /untrusted-fresh|customer@example|10000000/)
    assert.equal((await post('session', { PIC_SHAW_PORTAL_ACCESS_MODE: 'public' })).status, 401)
    assert.equal((await post('reset-password', { password: 'synthetic-new-passphrase' })).status, 401)
  }
  assert.equal(calls.includes('updateUser'), false); assert.equal(calls.includes('signOut'), false)
})
await test('incomplete, duplicate or malformed ID pins deny authenticated pilot access', async () => {
  for (const patch of [{ PIC_SHAW_PILOT_USER_A_ID: undefined }, { PIC_SHAW_PILOT_USER_B_ID: undefined },
    { PIC_SHAW_PILOT_USER_B_ID: idA }, { PIC_SHAW_PILOT_USER_A_ID: 'not-a-uuid' }]) {
    assert.equal((await post('session', {}, { ...env, ...patch })).status, 401)
  }
  assert.equal(auth.readPortalAccess({ ...env, PIC_SHAW_PILOT_USER_A_ID: 'aaaaaaaa-0000-4000-8000-000000000001', PIC_SHAW_PILOT_USER_B_ID: 'AAAAAAAA-0000-4000-8000-000000000001' }).ids, null)
})
await test('auto-confirmed signup also requires the fresh pinned actor, not the signup response', async () => {
  instantSignup = true
  currentUser = { ...users[0], id: idB }
  const denied = await post('sign-up', credentials(emails[0]))
  assert.equal(denied.status, 403); assert.equal(denied.cookies.get('__Host-picshaw-auth.0').maxAge, 0)
  currentUser = users[0]
  const accepted = await post('sign-up', credentials(emails[0]))
  assert.equal(accepted.status, 200); assert.equal((await accepted.json()).state, 'signed-in')
  assert.deepEqual(calls, ['signUp', 'getUser', 'signUp', 'getUser'])
})
await test('callback re-verifies identity and denies exchanged nonpilot session before redirect', async () => {
  currentUser = { ...users[0], email: 'customer@example.com' }
  const response = await handlers.handleAuthCallback(new NextRequest(`${origin}/platform/auth/callback?code=synthetic&next=https://evil.example.com`, { headers: { host: 'app.picshaw.com' } }), { env })
  assert.equal(response.headers.get('location'), `${origin}/platform/sign-in?error=callback`)
  assert.equal(response.cookies.get('__Host-picshaw-auth.0').maxAge, 0)
  assert.deepEqual(calls, ['exchangeCodeForSession', 'getUser'])
})
await test('logout remains possible when closed and does not grant customer access', async () => {
  currentUser = { ...users[0], email: 'customer@example.com' }
  const closed = { ...env, PIC_SHAW_PORTAL_ACCESS_MODE: 'closed' }
  assert.equal((await post('sign-out', {}, closed)).status, 200)
  assert.equal((await post('sign-out-all', {}, closed)).status, 200)
  assert.equal((await post('session', {}, closed)).status, 401)
})
await test('pilot cannot bypass production host, origin, deployment or distributed admission', async () => {
  for (const headers of [{ host: 'preview.vercel.app' }, { origin: 'https://evil.example.com' }, { 'sec-fetch-site': 'cross-site' }]) {
    assert.equal((await handlers.handleAuthPost(request(credentials(emails[0]), headers), 'sign-in', { env })).status, 403)
  }
  assert.equal((await post('sign-in', credentials(emails[0]), { ...env, VERCEL_ENV: 'preview' })).status, 503)
  assert.equal((await handlers.handleAuthPost(request(credentials(emails[0])), 'sign-in', { env, admit: async () => ({ status: 'unavailable' }) })).status, 503)
  assert.equal(created, 0)
})

const input = load('lib/supabase/workspace-input.ts')
const runtime = load('lib/supabase/workspace-runtime.ts', { './database-tls': {}, './auth': auth, './workspace-input': input, postgres: { default: () => { throw Error('Real DB forbidden') } } })
const workspace = async () => { stores++; return { id: '30000000-0000-4000-8000-000000000001', name: 'Synthetic', site: 'example.com' } }
const workspaceHandlers = load('lib/supabase/workspace-handlers.ts', { './server': server, './portal-config': portal, './auth-admission': admission,
  './workspace-runtime': runtime, './workspace-input': input, 'next/server': { NextRequest, NextResponse } })
const common = { '../supabase/server': server, '../supabase/portal-config': portal, '../supabase/auth-admission': admission,
  '../supabase/workspace-runtime': runtime, 'next/server': { NextRequest, NextResponse } }
const gscHandlers = load('lib/platform/gsc-handlers.ts', { ...common, './gsc-runtime': { deploymentGsc: () => null } })
const reportHandlers = load('lib/platform/report-handlers.ts', { ...common, './report-runtime': { deploymentReports: () => null } })
await test('workspace, GSC and report handlers share the real pilot identity gate before any store', async () => {
  const operations = [
    (settings = env) => workspaceHandlers.handleWorkspacePost(request(), false, { env: settings, store: workspace }),
    (settings = env) => gscHandlers.handleGsc(request(), 'status', { env: settings, workspace, lifecycle: { status: async () => ({ status: 'not_connected' }) } }),
    (settings = env) => reportHandlers.handleReports(request(), 'read', { env: settings, workspace, reports: { read: async () => null } }),
  ]
  for (const operation of operations) {
    currentUser = { ...users[0], email: 'customer@example.com', user_metadata: { email: emails[0], id: idA } }
    const before = stores
    assert.equal((await operation()).status, 401); assert.equal(stores, before)
    currentUser = users[0]
    for (const patch of [{ PIC_SHAW_PORTAL_ACCESS_MODE: undefined }, { PIC_SHAW_PORTAL_ACCESS_MODE: 'closed' }, { PIC_SHAW_PILOT_USER_A_ID: undefined }]) {
      assert.equal((await operation({ ...env, ...patch })).status, 401); assert.equal(stores, before)
    }
    assert.equal((await operation()).status, 200); assert.equal(stores, before + 1)
  }
})
console.log(`${tests} restricted pilot checks passed. Synthetic SDK/accounts only; upstream Auth signup and Data API policies require independent hosted verification.`)
