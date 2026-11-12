import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createPilotApiLab } from './portal-pilot-api-lab.mjs'

const project = 'https://abcdefghijklmnopqrst.supabase.co', portal = 'https://app.picshaw.com'
const key = 'sb_publishable_SYNTHETIC_ONLY_not_a_real_key'
const pins = { A: '10000000-0000-4000-8000-000000000001', B: '10000000-0000-4000-8000-000000000002' }
const orgs = { A: '20000000-0000-4000-8000-000000000001', B: '20000000-0000-4000-8000-000000000002' }
const emails = { A: 'hello+portal-test-a@picshaw.com', B: 'hello+portal-test-b@picshaw.com' }
const cookieName = '__Host-picshaw-auth'
const oldFetch = globalThis.fetch
globalThis.fetch = () => { throw Error('NETWORK FORBIDDEN') }
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'synthetic-only', alg: 'RS256', use: 'sig' }
function signed(claims) {
  const input = [JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: jwk.kid }), JSON.stringify(claims)].map(value => Buffer.from(value).toString('base64url')).join('.')
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`
}
function world() {
  const passwords = new Map(), sessions = new Map(), workspaces = new Map(), revokedMembership = new Set(), events = [], requests = []
  let sessionSequence = 0
  const user = label => ({ id: pins[label], email: emails[label], is_anonymous: false, email_confirmed_at: '2026-01-01T00:00:00Z', role: 'authenticated', aud: 'authenticated', app_metadata: {}, user_metadata: {} })
  function session(label) {
    const exp = Math.floor(Date.now() / 1000) + 3600
    const value = { access_token: signed({ sub: pins[label], iss: `${project}/auth/v1`, aud: 'authenticated', role: 'authenticated', is_anonymous: false, session_id: `30000000-0000-4000-8000-${String(++sessionSequence).padStart(12, '0')}`, exp }),
      refresh_token: `synthetic-secret-refresh-${sessionSequence}`, token_type: 'bearer', expires_in: 3600, expires_at: exp, user: user(label) }
    sessions.set(value.access_token, { value, label, revoked: false }); return value
  }
  const cookie = value => `${cookieName}=base64-${Buffer.from(JSON.stringify(value)).toString('base64url')}; Secure; HttpOnly; SameSite=Lax; Path=/`
  const emptyCookie = `${cookieName}=; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
  const tokenInCookie = headers => {
    const value = (headers.get('cookie') ?? '').split('; ').find(pair => pair.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1)
    try { return JSON.parse(Buffer.from(value.slice(7), 'base64url').toString()).access_token } catch { return null }
  }
  const response = (data, status = 200, cookies = []) => {
    const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' })
    cookies.forEach(value => headers.append('Set-Cookie', value))
    return new Response(JSON.stringify(data), { status, headers })
  }
  async function transport(input, init) {
    const url = new URL(input), headers = new Headers(init.headers), method = init.method ?? 'GET'
    assert.equal(init.redirect, 'manual'); assert.equal(init.cache, 'no-store')
    requests.push({ origin: url.origin, path: url.pathname, method }) // Never capture values.
    if (url.origin === project) {
      if (url.pathname === '/auth/v1/.well-known/jwks.json') return response({ keys: [jwk] })
      if (url.pathname === '/auth/v1/user') {
        const state = sessions.get(headers.get('authorization')?.replace('Bearer ', ''))
        return state ? response(user(state.label)) : response({ message: 'invalid', code: 'bad_jwt' }, 401)
      }
      if (url.pathname === '/auth/v1/token') {
        const refresh = JSON.parse(init.body).refresh_token, state = [...sessions.values()].find(item => item.value.refresh_token === refresh)
        if (!state || state.revoked) return response({ message: 'synthetic revoked refresh', code: 'refresh_token_not_found' }, 400)
        return response(session(state.label))
      }
      if (url.pathname === '/auth/v1/verify') {
        const label = url.searchParams.get('token').includes('-A-') ? 'A' : 'B'
        return new Response(null, { status: 302, headers: { Location: `${portal}/platform/auth/callback?code=synthetic-${label}` } })
      }
      const table = url.pathname.slice('/rest/v1/'.length), state = sessions.get(headers.get('authorization')?.replace('Bearer ', ''))
      if (!state) return response({ code: '42501', message: 'not allowed' }, 401)
      if (method !== 'GET') return response({ code: '42501', message: 'not allowed' }, 403)
      const label = state.label, ownId = orgs[label]
      if (revokedMembership.has(label) || !workspaces.has(label)) return response([])
      const row = table === 'organizations' ? { id: ownId } : table === 'organization_memberships' ? { organization_id: ownId, user_id: pins[label] } : null
      const filter = url.searchParams.get(table === 'organizations' ? 'id' : 'organization_id')
      return response(row && (!filter || filter === `eq.${ownId}`) ? [row] : [])
    }
    assert.equal(url.origin, portal)
    if (url.pathname === '/platform/auth/callback') {
      const label = url.searchParams.get('code').endsWith('A') ? 'A' : 'B'
      assert.ok(headers.get('cookie').includes(`verifier-${label}`))
      const callbackHeaders = new Headers({ Location: `${portal}/platform` })
      callbackHeaders.append('Set-Cookie', cookie(session(label)))
      callbackHeaders.append('Set-Cookie', `${cookieName}-code-verifier=; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`)
      return new Response(null, { status: 303, headers: callbackHeaders })
    }
    if (headers.get('origin') !== portal) return response({ error: 'origin' }, 403)
    const body = JSON.parse(init.body)
    if (url.pathname.endsWith('/sign-up')) {
      const label = Object.keys(emails).find(label => emails[label] === body.email)
      assert.ok(label); assert.equal(body.password.length, 48); passwords.set(label, body.password)
      return response({ message: 'neutral confirmation' }, 200, [`${cookieName}-code-verifier=verifier-${label}; Secure; HttpOnly; SameSite=Lax; Path=/`])
    }
    if (url.pathname.endsWith('/sign-in')) {
      const label = Object.keys(emails).find(label => emails[label] === body.email)
      assert.ok(label); assert.equal(body.password, passwords.get(label))
      return response({ state: 'signed-in' }, 200, [cookie(session(label))])
    }
    const state = sessions.get(tokenInCookie(headers))
    if (url.pathname.endsWith('/sign-out') || url.pathname.endsWith('/sign-out-all')) {
      assert.ok(state)
      for (const item of sessions.values()) if (item === state || (url.pathname.endsWith('/sign-out-all') && item.label === state.label)) item.revoked = true
      return response({ message: 'signed out' }, 200, [emptyCookie])
    }
    if (url.pathname.endsWith('/current') && Object.keys(body).length) return response({ error: 'body' }, 400)
    if (!state) return response({ error: 'sign in' }, 401)
    if (state.revoked || revokedMembership.has(state.label)) return response({ error: 'denied' }, 503)
    if (url.pathname.endsWith('/bootstrap')) workspaces.set(state.label, { ...body, id: orgs[state.label] })
    return response({ workspace: workspaces.get(state.label) })
  }
  return { transport, events, requests, passwords, revokedMembership,
    lab: createPilotApiLab({ projectOrigin: project, publishableKey: key, transport, observe: event => events.push(event) }) }
}
const confirmation = label => `${project}/auth/v1/verify?token=synthetic-${label}-verification-token-not-real&type=signup&redirect_to=${encodeURIComponent(`${portal}/platform/auth/callback`)}`
let count = 0
const test = async (name, run) => { await run(); count++; console.log(`PASS ${name}`) }
try {
  await test('default import and configuration cannot contact network or accept a secret/admin key', async () => {
    for (const options of [{}, { projectOrigin: 'https://evil.example', publishableKey: key }, { projectOrigin: project, publishableKey: 'sb_secret_DO_NOT_USE' }, { projectOrigin: project, publishableKey: key }]) {
      assert.throws(() => createPilotApiLab(options))
    }
  })
  await test('verified confirmation target is exact and failure cannot retry a mutation', async () => {
    for (const url of [confirmation('A').replace(project, 'https://evil.example'), confirmation('A').replace('type=signup', 'type=recovery'), confirmation('A') + '&token=duplicate', confirmation('A').replace(encodeURIComponent(`${portal}/platform/auth/callback`), encodeURIComponent('https://evil.example'))]) {
      const w = world(); await w.lab.run({ action: 'signup', account: 'A' }); await w.lab.run({ action: 'pins', ...pins })
      const before = w.requests.length
      await assert.rejects(w.lab.run({ action: 'confirm', account: 'A', url }), /verification-link-mismatch/)
      assert.equal(w.requests.length, before)
      await assert.rejects(w.lab.run({ action: 'signup', account: 'B' }), /lab-stopped/)
      await w.lab.run({ action: 'close' })
    }
  })
  await test('unapproved labels and prototype keys fail before any signup request', async () => {
    for (const account of ['C', 'constructor', '__proto__', ['A'], 'hello@picshaw.com']) {
      const w = world()
      await assert.rejects(w.lab.run({ action: 'signup', account }), /signup-already-attempted-or-invalid-account/)
      assert.equal(w.requests.length, 0)
    }
  })
  await test('network errors sanitize values and duplicate signup never blindly retries', async () => {
    const lab = createPilotApiLab({ projectOrigin: project, publishableKey: key, transport: () => { throw Error('DO_NOT_PRINT_PASSWORD_OR_LINK') } })
    await assert.rejects(lab.run({ action: 'signup', account: 'A' }), error => error.message === 'transport-outcome-uncertain' && !error.stack.includes('DO_NOT_PRINT'))
    await assert.rejects(lab.run({ action: 'signup', account: 'A' }), /lab-stopped/)
    await lab.run({ action: 'close' })
  })
  await test('real SDK validates synthetic issued JWTs; full API sequence isolates tenants and sessions', async () => {
    const w = world()
    await w.lab.run({ action: 'signup', account: 'A' }); await w.lab.run({ action: 'signup', account: 'B' })
    await w.lab.run({ action: 'pins', ...pins })
    await w.lab.run({ action: 'confirm', account: 'A', url: confirmation('A') })
    await w.lab.run({ action: 'confirm', account: 'B', url: confirmation('B') })
    for (const action of ['sessions', 'workspaces', 'read-isolation', 'request-boundaries']) await w.lab.run({ action })
    await w.lab.run({ action: 'negative-writes', exactFixtureMutationApproval: true })
    await w.lab.run({ action: 'local-logout' }); await w.lab.run({ action: 'global-logout' })
    await w.lab.run({ action: 'membership-baseline' }); w.revokedMembership.add('A')
    await w.lab.run({ action: 'membership-revoked' }); await w.lab.run({ action: 'expiry-status' })
    await w.lab.run({ action: 'cleanup-sessions' }); await w.lab.run({ action: 'close' })
    const safe = JSON.stringify(w.events)
    for (const secret of [...w.passwords.values(), ...Object.values(pins), ...Object.values(orgs), key, 'synthetic-secret-refresh-', 'access_token', 'verifier-A', 'hello+', 'supabase.co']) assert.equal(safe.includes(secret), false)
    assert.ok(w.events.some(event => event.case === 'two-independent-A-sessions'))
    assert.ok(w.events.some(event => event.case === 'global-revocation-other-A-session-denied-B-preserved'))
    assert.ok(w.events.some(event => event.case === 'retained-report-snapshot-connection-fixtures-not-tested' && event.status === 'blocked'))
    assert.ok(w.events.some(event => event.case === 'delete-attempt-not-authorized-or-run' && event.status === 'blocked'))
    assert.ok(w.requests.every(request => [portal, project].includes(request.origin)))
    assert.ok(w.requests.length < 120)
  })
  await test('private stdin driver never echoes commands, malformed input or raw exception values', async () => {
    const result = spawnSync(process.execPath, ['scripts/run-portal-pilot-api-lab.mjs'], {
      encoding: 'utf8', input: [JSON.stringify({ action: 'canary', value: 'DO_NOT_ECHO_SECRET' }), JSON.stringify({ action: 'init', reviewedLiveScope: true, projectOrigin: project, publishableKey: key }), JSON.stringify({ action: 'close', ignored: 'DO_NOT_ECHO_SECRET' })].join('\n') + '\n', timeout: 10000,
    })
    assert.equal(result.status, 0); assert.equal(result.stderr, '')
    assert.doesNotMatch(result.stdout, /DO_NOT_ECHO|sb_publishable|supabase\.co/)
    assert.equal(result.stdout.match(/memory-released-cleanup-not-implied/g).length, 1)
    const invalid = spawnSync(process.execPath, ['scripts/run-portal-pilot-api-lab.mjs'], { encoding: 'utf8', input: 'INVALID_SECRET_INPUT\n', timeout: 10000 })
    assert.doesNotMatch(invalid.stdout + invalid.stderr, /INVALID_SECRET_INPUT/)
    assert.match(invalid.stdout, /command-error-sanitized/)
  })
  console.log(`${count} private-stdin API lab safety checks passed. All requests synthetic; no account, email, credential, browser or hosted change.`)
} finally { globalThis.fetch = oldFetch }
