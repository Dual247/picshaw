import { randomBytes } from 'node:crypto'
import { createServerClient } from '@supabase/ssr'

// Inert on import. No default transport, environment secrets, filesystem, browser
// automation, administrative key, SQL connection or automatic account creation.
const portal = 'https://app.picshaw.com'
const callback = `${portal}/platform/auth/callback`
const cookieName = '__Host-picshaw-auth'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const labels = { A: 'hello+portal-test-a@picshaw.com', B: 'hello+portal-test-b@picshaw.com' }
const allowedLabel = label => label === 'A' || label === 'B'
const slots = { A1: 'A', A2: 'A', B1: 'B' }
const tables = ['organizations', 'organization_memberships', 'google_connections', 'source_runs', 'source_snapshots', 'recommended_actions', 'work_events', 'reports']
const cookiePart = name => name === cookieName || name.startsWith(`${cookieName}.`) || name.startsWith(`${cookieName}-`)
const check = (condition, code = 'assertion-failed') => { if (!condition) throw new PilotLabError(code) }
export class PilotLabError extends Error {
  constructor(code) { super(code); this.name = 'PilotLabError'; this.code = code }
}

export function createPilotApiLab({ projectOrigin, publishableKey, transport, observe = () => {} }) {
  check(typeof projectOrigin === 'string' && /^https:\/\/[a-z]{20}\.supabase\.co$/.test(projectOrigin), 'invalid-project')
  check(typeof publishableKey === 'string' && /^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(publishableKey), 'publishable-key-required')
  check(typeof transport === 'function', 'explicit-transport-required')
  let budget = 120, pins = null, halted = false, closed = false
  const accounts = new Map(), jars = new Map(), identities = new Map(), workspaces = new Map()
  const record = (name, status = 'passed', extra = {}) => observe({ case: name, status, ...extra })
  const jar = name => { if (!jars.has(name)) jars.set(name, new Map()); return jars.get(name) }
  const fixture = label => ({ name: `Picshaw pilot ${label}`, site: 'example.com' })

  // No redirect following: credentials/cookies never follow an HTTP redirect.
  async function send(url, init = {}) {
    const target = new URL(url), method = init.method ?? 'GET'
    const appPath = /^\/api\/platform\/(auth\/(sign-up|sign-in|session|sign-out|sign-out-all)|workspaces\/(bootstrap|current))$/.test(target.pathname)
    const app = target.origin === portal && ((appPath && method === 'POST' && !target.search) || (target.pathname === '/platform/auth/callback' && method === 'GET'))
    const auth = target.origin === projectOrigin && ((method === 'GET' && ['/auth/v1/user', '/auth/v1/.well-known/jwks.json', '/auth/v1/verify'].includes(target.pathname)) ||
      (method === 'POST' && target.pathname === '/auth/v1/token' && target.search === '?grant_type=refresh_token'))
    const rest = target.origin === projectOrigin && tables.some(table => target.pathname === `/rest/v1/${table}`) && ['GET', 'POST', 'PATCH'].includes(method)
    check((app || auth || rest) && !target.username && !target.password && !target.hash, 'outbound-target-denied')
    check(budget-- > 0, 'request-budget-exhausted')
    try { return await transport(target.href, { ...init, redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(15000) }) }
    catch { throw new PilotLabError('transport-outcome-uncertain') }
  }
  async function json(response) {
    try {
      const body = await response.text()
      check(Buffer.byteLength(body) <= 65536, 'response-too-large')
      return JSON.parse(body)
    } catch (error) { throw error instanceof PilotLabError ? error : new PilotLabError('invalid-response') }
  }
  function applyCookies(target, response) {
    check(typeof response.headers.getSetCookie === 'function', 'set-cookie-inspection-required')
    for (const line of response.headers.getSetCookie()) {
      const [pair, ...attributes] = line.split(';'), equals = pair.indexOf('=')
      check(equals > 0, 'invalid-cookie')
      const name = pair.slice(0, equals).trim(), value = pair.slice(equals + 1)
      if (!cookiePart(name)) continue
      const flags = attributes.map(part => part.trim().toLowerCase())
      check(flags.includes('secure') && flags.includes('httponly') && flags.includes('samesite=lax') && flags.includes('path=/') && !flags.some(flag => flag.startsWith('domain=')), 'unsafe-cookie-attributes')
      if (!value || flags.includes('max-age=0')) target.delete(name)
      else target.set(name, value)
    }
  }
  async function post(target, path, body = {}, origin = portal) {
    const headers = new Headers({ 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' })
    if (origin !== null) headers.set('Origin', origin)
    if (target.size) headers.set('Cookie', [...target].map(([name, value]) => `${name}=${value}`).join('; '))
    const response = await send(`${portal}/api/platform/${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
    check(/(?:^|[, ])no-store(?:$|[, ])/.test(response.headers.get('cache-control') ?? '') && response.headers.get('referrer-policy') === 'no-referrer', 'private-response-headers')
    applyCookies(target, response)
    const data = await json(response)
    check(response.status !== 429, 'admission-limited-stop-and-wait')
    return { response, data }
  }
  function sdk(target) {
    return createServerClient(projectOrigin, publishableKey, {
      cookieOptions: { name: cookieName, secure: true, httpOnly: true, sameSite: 'lax', path: '/' },
      auth: { debug: false },
      global: { fetch: async (input, init) => send(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, init) },
      cookies: {
        getAll: () => [...target].map(([name, value]) => ({ name, value })),
        setAll: values => { for (const item of values) { if (!item.value || item.options.maxAge === 0) target.delete(item.name); else target.set(item.name, item.value) } },
      },
    })
  }
  async function issuedIdentity(slot) {
    check(pins && slots[slot], 'verified-pins-required')
    const client = sdk(jar(slot)), cached = await client.auth.getSession()
    const session = cached.data?.session
    check(!cached.error && session?.access_token && session?.refresh_token, 'issued-session-required')
    // getSession only extracts an issued credential for the test transport. It is
    // never authority: getUser and getClaims verify that same token independently.
    const [userResult, claimResult] = await Promise.all([client.auth.getUser(session.access_token), client.auth.getClaims(session.access_token)])
    const user = userResult.data?.user, claims = claimResult.data?.claims, label = slots[slot]
    check(!userResult.error && !claimResult.error && user?.id === pins[label] && user.email === labels[label] && user.email_confirmed_at && user.is_anonymous === false &&
      claims?.sub === user.id && uuid.test(claims.session_id ?? '') && claims.iss === `${projectOrigin}/auth/v1` && claims.role === 'authenticated' &&
      claims.is_anonymous === false && (claims.aud === 'authenticated' || (Array.isArray(claims.aud) && claims.aud.includes('authenticated'))) && claims.exp > Date.now() / 1000, 'issued-identity-mismatch')
    const identity = { token: session.access_token, refresh: session.refresh_token, expires: claims.exp, sessionId: claims.session_id, userId: user.id }
    identities.set(slot, identity)
    return identity
  }
  async function signIn(slot) {
    const label = slots[slot]
    check(label && accounts.get(label)?.password, 'account-memory-required')
    jars.set(slot, new Map())
    const { response, data } = await post(jar(slot), 'auth/sign-in', { email: labels[label], password: accounts.get(label).password })
    check(response.status === 200 && data.state === 'signed-in', 'sign-in-not-confirmed')
    await issuedIdentity(slot)
  }
  async function current(target, expected, denied = false) {
    const { response, data } = await post(target, 'workspaces/current')
    if (denied) check([401, 503].includes(response.status) && !data.workspace, 'revoked-workspace-was-not-denied')
    else check(response.status === 200 && data.workspace?.id === expected, 'workspace-not-confirmed')
  }
  async function rest(slot, table, { filter = '', method = 'GET', body } = {}) {
    check(tables.includes(table), 'table-denied')
    const headers = { apikey: publishableKey, 'Content-Type': 'application/json', Prefer: 'return=representation' }
    if (slot) { check(identities.has(slot), 'issued-session-required'); headers.Authorization = `Bearer ${identities.get(slot).token}` }
    const columns = table === 'organization_memberships' ? 'organization_id,user_id' : table === 'organizations' ? 'id' : 'organization_id'
    const response = await send(`${projectOrigin}/rest/v1/${table}?select=${columns}&limit=20${filter ? `&${filter}` : ''}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) })
    return { response, data: await json(response) }
  }
  async function refreshDenied(target) {
    const result = await sdk(target).auth.refreshSession()
    check(result.error && !result.data?.session, 'revoked-refresh-was-not-denied')
  }
  function clear() {
    for (const account of accounts.values()) account.password = null
    for (const cookies of jars.values()) cookies.clear()
    accounts.clear(); identities.clear(); jars.clear(); workspaces.clear(); pins = null; closed = true
    // JS strings cannot be guaranteed zeroized. Terminate this process after use.
  }

  return { async run(command) {
    check(command && typeof command === 'object' && !Array.isArray(command), 'invalid-command')
    const action = command.action
    if (action === 'close') { clear(); record('memory-released-cleanup-not-implied'); return }
    check(!closed && !halted, 'lab-stopped')
    try {
      if (action === 'pins') {
        check(!pins && typeof command.A === 'string' && typeof command.B === 'string' && uuid.test(command.A) && uuid.test(command.B) && command.A.toLowerCase() !== command.B.toLowerCase(), 'invalid-pins')
        pins = { A: command.A.toLowerCase(), B: command.B.toLowerCase() }
        record('operator-pins-loaded-not-deployment-proof'); return
      }
      if (action === 'signup') {
        const label = command.account
        check(allowedLabel(label) && !accounts.has(label), 'signup-already-attempted-or-invalid-account')
        accounts.set(label, { password: randomBytes(36).toString('base64url') })
        const { response, data } = await post(jar(`confirmation-${label}`), 'auth/sign-up', { email: labels[label], password: accounts.get(label).password })
        check(response.status === 200 && !data.state, 'confirmation-required-signup-result')
        record(`signup-${label}-request-only-email-unverified`); return
      }
      if (action === 'confirm') {
        const label = command.account
        check(allowedLabel(label) && accounts.has(label) && !accounts.get(label).confirmed && pins, 'pending-signup-and-pins-required')
        const link = new URL(command.url)
        const keys = [...link.searchParams.keys()]
        check(link.origin === projectOrigin && link.pathname === '/auth/v1/verify' && !link.username && !link.password && !link.hash &&
          new Set(keys).size === keys.length && keys.every(key => ['token', 'token_hash', 'type', 'redirect_to'].includes(key)) &&
          link.searchParams.get('type') === 'signup' && link.searchParams.get('redirect_to') === callback &&
          ['token', 'token_hash'].filter(key => link.searchParams.has(key)).length === 1 &&
          /^[A-Za-z0-9_-]{20,512}$/.test(link.searchParams.get('token') ?? link.searchParams.get('token_hash') ?? ''), 'verification-link-mismatch')
        const verification = await send(link.href)
        check([302, 303].includes(verification.status), 'verification-not-redirected')
        const destination = new URL(verification.headers.get('location'))
        check(destination.origin + destination.pathname === callback && !destination.hash && destination.searchParams.getAll('code').length === 1 &&
          destination.searchParams.get('code') && [...destination.searchParams.keys()].every(key => ['code', 'sb_flow_id'].includes(key)), 'verification-callback-mismatch')
        const target = jar(`confirmation-${label}`)
        const result = await send(destination.href, { headers: { Cookie: [...target].map(([name, value]) => `${name}=${value}`).join('; ') } })
        applyCookies(target, result)
        check(result.status === 303 && result.headers.get('location') === `${portal}/platform`, 'portal-callback-not-confirmed')
        accounts.get(label).confirmed = true
        record(`confirmation-${label}-api-flow-only`); return
      }
      if (action === 'sessions') {
        check(identities.size === 0 && accounts.get('A')?.confirmed && accounts.get('B')?.confirmed, 'confirmation-phase-required')
        for (const [slot, label] of [['A1', 'A'], ['B1', 'B']]) {
          jars.set(slot, new Map(jar(`confirmation-${label}`))); jars.delete(`confirmation-${label}`)
          await issuedIdentity(slot); record(`issued-session-${slot}`)
        }
        await signIn('A2'); record('issued-session-A2')
        check(identities.get('A1').sessionId !== identities.get('A2').sessionId, 'independent-sessions-required')
        record('two-independent-A-sessions'); return
      }
      if (action === 'workspaces') {
        check(identities.size === 3 && workspaces.size === 0, 'workspace-phase-order')
        const results = await Promise.all(['A1', 'A2'].map(slot => post(jar(slot), 'workspaces/bootstrap', fixture('A'))))
        const b = await post(jar('B1'), 'workspaces/bootstrap', fixture('B'))
        for (const [index, result] of [...results, b].entries()) {
          const label = index === 2 ? 'B' : 'A', value = result.data.workspace
          check(result.response.status === 200 && uuid.test(value?.id ?? '') && value.name === fixture(label).name && value.site === 'example.com', 'bootstrap-not-confirmed')
          if (workspaces.has(label)) check(workspaces.get(label) === value.id, 'duplicate-workspace-created')
          workspaces.set(label, value.id)
        }
        check(workspaces.get('A') !== workspaces.get('B'), 'distinct-tenants-required')
        record('two-real-workspaces-and-concurrent-idempotency'); return
      }
      check(workspaces.size === 2, 'workspaces-required')
      if (action === 'read-isolation') {
        for (const [slot, label, other] of [['A1', 'A', 'B'], ['B1', 'B', 'A']]) {
          for (const table of ['organizations', 'organization_memberships']) {
            const own = await rest(slot, table), column = table === 'organizations' ? 'id' : 'organization_id'
            check(own.response.status === 200 && Array.isArray(own.data) && own.data.length === 1 && own.data[0][column] === workspaces.get(label), 'own-tenant-read-failed')
            const cross = await rest(slot, table, { filter: `${column}=eq.${workspaces.get(other)}` })
            check(cross.response.status === 200 && Array.isArray(cross.data) && cross.data.length === 0, 'cross-tenant-read-not-denied')
          }
          record(`issued-token-${label}-own-rows-and-cross-tenant-zero`)
        }
        const anonymous = await rest(null, 'organizations')
        check([401, 403].includes(anonymous.response.status) && !Array.isArray(anonymous.data), 'anonymous-data-not-denied')
        const anonymousPortal = await post(new Map(), 'workspaces/current')
        check(anonymousPortal.response.status === 401 && !anonymousPortal.data.workspace, 'anonymous-portal-not-denied')
        record('anonymous-api-and-portal-denied')
        record('retained-report-snapshot-connection-fixtures-not-tested', 'blocked'); return
      }
      if (action === 'negative-writes') {
        // Explicit coordinator gate, not a substitute for owner authorization.
        check(command.exactFixtureMutationApproval === true, 'specific-negative-mutation-approval-required')
        for (const operation of [
          ['organization_memberships', { method: 'POST', body: { organization_id: workspaces.get('B'), user_id: pins.A, role: 'viewer' } }],
          ['organizations', { method: 'PATCH', filter: `id=eq.${workspaces.get('B')}`, body: { name: 'Denied synthetic change' } }],
        ]) {
          const result = await rest('A1', ...operation)
          check(result.response.status === 403 && result.data?.code === '42501', 'expected-denial-did-not-occur-stop')
        }
        record('cross-tenant-membership-insert-and-update-denied')
        record('delete-attempt-not-authorized-or-run', 'blocked'); return
      }
      if (action === 'request-boundaries') {
        for (const origin of [null, 'https://www.picshaw.com']) {
          check((await post(jar('A1'), 'workspaces/current', {}, origin)).response.status === 403, 'csrf-not-denied')
        }
        check((await post(jar('A1'), 'workspaces/current', { organizationId: workspaces.get('B') })).response.status === 400, 'tenant-selector-not-denied')
        record('origin-and-browser-tenant-selector-denied'); return
      }
      if (action === 'local-logout') {
        check(identities.get('A1')?.expires > Date.now() / 1000 + 60, 'unexpired-revocation-token-required')
        await current(jar('A1'), workspaces.get('A'))
        const stale = new Map(jar('A1')), forRefresh = new Map(stale)
        const result = await post(jar('A1'), 'auth/sign-out')
        check(result.response.status === 200 && jar('A1').size === 0, 'local-logout-not-confirmed')
        await current(stale, null, true); await refreshDenied(forRefresh)
        await current(jar('A2'), workspaces.get('A')); await current(jar('B1'), workspaces.get('B'))
        record('local-revocation-old-session-denied-A2-and-B-preserved'); return
      }
      if (action === 'global-logout') {
        check(identities.get('A2')?.expires > Date.now() / 1000 + 60, 'unexpired-revocation-token-required')
        await current(jar('A2'), workspaces.get('A'))
        await signIn('A1')
        const stale = new Map(jar('A2')), forRefresh = new Map(stale)
        const result = await post(jar('A1'), 'auth/sign-out-all')
        check(result.response.status === 200, 'global-logout-not-confirmed')
        await current(stale, null, true); await refreshDenied(forRefresh)
        await current(jar('B1'), workspaces.get('B'))
        record('global-revocation-other-A-session-denied-B-preserved'); return
      }
      if (action === 'membership-baseline') {
        await signIn('A1'); await current(jar('A1'), workspaces.get('A'))
        record('membership-baseline-ready-for-separate-approved-revocation'); return
      }
      if (action === 'membership-revoked') {
        await current(jar('A1'), null, true)
        for (const table of tables) {
          const result = await rest('A1', table)
          check(result.response.status === 200 && Array.isArray(result.data) && result.data.length === 0, 'revoked-membership-data-not-denied')
        }
        await current(jar('B1'), workspaces.get('B'))
        record('revoked-membership-eight-tables-empty-B-preserved'); return
      }
      if (action === 'expiry-status') {
        check(identities.has('B1'), 'issued-session-required')
        record('natural-expiry-wait', 'pending', { remainingSeconds: Math.max(0, Math.ceil(identities.get('B1').expires - Date.now() / 1000)) }); return
      }
      if (action === 'expired-refresh') {
        check(identities.get('B1')?.expires + 2 < Date.now() / 1000, 'natural-expiry-not-reached')
        const before = JSON.stringify([...jar('B1')])
        await current(jar('B1'), workspaces.get('B'))
        check(before !== JSON.stringify([...jar('B1')]), 'response-did-not-rotate-cookies')
        await current(jar('B1'), workspaces.get('B')); await issuedIdentity('B1')
        record('expired-token-real-portal-cookie-refresh-and-next-request'); return
      }
      if (action === 'cleanup-sessions') {
        for (const slot of ['A1', 'B1']) {
          await signIn(slot)
          const stale = new Map(jar(slot))
          check((await post(jar(slot), 'auth/sign-out-all')).response.status === 200, 'cleanup-revocation-unconfirmed')
          await refreshDenied(stale)
        }
        record('fixture-session-revocation-confirmed-no-records-deleted'); return
      }
      throw new PilotLabError('unknown-command')
    } catch (error) {
      halted = true
      // Never retain an exception, provider response, URL or secret in evidence.
      throw new PilotLabError(error instanceof PilotLabError ? error.code : 'operation-failed-sanitized')
    }
  } }
}
