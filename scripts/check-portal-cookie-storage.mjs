import assert from 'node:assert/strict'
import { createStorageFromOptions, applyServerStorage } from '@supabase/ssr/dist/main/cookies.js'
import { createServerClient } from '@supabase/ssr'
const key = '__Host-picshaw-auth'
const cookieOptions = { name: key, secure: true, httpOnly: true, sameSite: 'lax', path: '/' }
const jar = new Map(), writes = []
const cookies = {
  getAll: () => [...jar].map(([name, value]) => ({ name, value })),
  setAll: values => {
    for (const cookie of values) {
      assert.ok(cookie.name.startsWith('__Host-'))
      assert.equal(cookie.options.domain, undefined)
      assert.equal(cookie.options.path, '/')
      assert.equal(cookie.options.secure, true)
      assert.equal(cookie.options.httpOnly, true)
      writes.push(cookie)
      if (cookie.options.maxAge === 0) jar.delete(cookie.name)
      else jar.set(cookie.name, cookie.value)
    }
  },
}
const options = { cookieOptions, cookieEncoding: 'base64url', cookies }
let adapter = createStorageFromOptions(options, true)
const session = JSON.stringify({ fixture: 'x'.repeat(10000) })
await adapter.storage.setItem(key, session)
await applyServerStorage(adapter, options)
assert.ok(jar.has(`${key}.0`) && jar.has(`${key}.1`))
adapter = createStorageFromOptions(options, true)
assert.equal(await adapter.storage.getItem(key), session)
await adapter.storage.setItem(key, 'rotated-small-fixture')
await applyServerStorage(adapter, options)
assert.ok(!jar.has(`${key}.0`) && jar.has(key))
adapter = createStorageFromOptions(options, true)
for (const suffix of ['-code-verifier', '-flow-abcdefgh1234-code-verifier', '-flows-code-verifier']) {
  await adapter.storage.setItem(`${key}${suffix}`, suffix.includes('-flows-') ? '["abcdefgh1234"]' : 'fixture-verifier')
  assert.ok(jar.has(`${key}${suffix}`))
}
adapter = createStorageFromOptions(options, true)
for (const name of [...jar.keys()]) await adapter.storage.removeItem(name)
await applyServerStorage(adapter, options)
assert.equal(jar.size, 0)
console.log(`PASS real SDK chunk roundtrip, rotation, PKCE and deletion (${writes.length} host-only secure cookie writes; no network)`)

// Exercise actual auth-js getUser -> refresh -> signOut, not manual removal.
// The transport has no network fallback and accepts only these mock endpoints.
const uid = '00000000-0000-4000-8000-000000000001'
const now = Math.floor(Date.now() / 1000)
const jwt = exp => [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),
  Buffer.from(JSON.stringify({ sub: uid, exp, role: 'authenticated' })).toString('base64url'), 'mock-signature'].join('.')
const user = { id: uid, aud: 'authenticated', role: 'authenticated', user_metadata: { fixture: 'x'.repeat(10000) } }
adapter = createStorageFromOptions(options, true)
await adapter.storage.setItem(key, JSON.stringify({ access_token: jwt(now - 600), refresh_token: 'fixture-old-refresh',
  token_type: 'bearer', expires_in: 3600, expires_at: now - 600, user }))
await applyServerStorage(adapter, options)
assert.ok(jar.has(`${key}.1`))
const transportCalls = []
const client = createServerClient('https://fixture.example.invalid', 'sb_publishable_fixture', {
  cookieOptions, cookies,
  global: { fetch: async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url)
    assert.equal(url.origin, 'https://fixture.example.invalid')
    transportCalls.push(`${init.method} ${url.pathname}${url.search}`)
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
      assert.equal(JSON.parse(init.body).refresh_token, 'fixture-old-refresh')
      return Response.json({ access_token: jwt(now + 3600), refresh_token: 'fixture-rotated-refresh',
        token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user })
    }
    if (url.pathname === '/auth/v1/user') return Response.json(user)
    if (url.pathname === '/auth/v1/logout' && url.searchParams.get('scope') === 'local') return new Response(null, { status: 204 })
    throw Error('Unexpected SDK transport operation; no live network is allowed')
  } },
})
const verified = await client.auth.getUser()
assert.equal(verified.error, null); assert.equal(verified.data.user.id, uid)
assert.ok(transportCalls.some(call => call.includes('/token?grant_type=refresh_token')))
const rotated = createStorageFromOptions(options, true)
assert.equal(JSON.parse(await rotated.storage.getItem(key)).refresh_token, 'fixture-rotated-refresh')
assert.ok(jar.has(`${key}.1`), 'refreshed session remains chunked')
const logout = await client.auth.signOut({ scope: 'local' })
assert.equal(logout.error, null)
assert.ok(transportCalls.includes('POST /auth/v1/logout?scope=local'))
assert.equal(jar.size, 0, 'SDK signOut must delete every chunk without manual deletion')
console.log('PASS actual SDK expired-session refresh and local logout clear chunked session; transport fully mocked')
