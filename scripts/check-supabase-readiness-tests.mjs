import assert from 'node:assert/strict'
import { readPublicEnvironment, localReadiness, summarizePublicSettings, inspectPublicReadiness, runReadiness, isProjectOrigin } from './check-supabase-readiness.mjs'

const expectedOrigin = 'https://abcdefghijklmnopqrst.supabase.co'
const env = readPublicEnvironment('\uFEFFNEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_only\nPIC_SHAW_AUTH_ORIGIN=\nPIC_SHAW_AUTH_GOOGLE_ENABLED=false\nPIC_SHAW_AUTH_APPLE_ENABLED=false\nPIC_SHAW_AUTH_EMAIL_ENABLED=false\nPIC_SHAW_AUTH_SESSION_ENABLED=false\nUNRELATED_SECRET=excluded')
assert.equal(env.UNRELATED_SECRET, undefined)
assert.deepEqual(localReadiness(env, expectedOrigin), { dedicatedProjectMatches: true, modernPublishableKeyPresent: true, appOriginConfigured: false, allAuthFlagsExplicitlyDisabled: true })
let calls = 0
const mockedFetch = async (url, options) => {
  calls++
  assert.equal(url, 'https://abcdefghijklmnopqrst.supabase.co/auth/v1/settings')
  assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'omit'); assert.equal(options.cache, 'no-store')
  assert.equal(options.headers.apikey, 'sb_publishable_test_only')
  return { ok: true, json: async () => ({ external: { google: false, apple: false, email: true }, disable_signup: false, mailer_autoconfirm: false, unexpected_secret: 'never-output' }) }
}
const result = await inspectPublicReadiness(env, expectedOrigin, mockedFetch)
assert.equal(result.googleEnabled, false); assert.equal(result.emailEnabled, true); assert.equal(result.smtpConfigured, null)
assert.doesNotMatch(JSON.stringify(result), /never-output|publishable|unexpected_secret/)
assert.equal(summarizePublicSettings({ external: { google: 'true' } }).googleEnabled, null)
for (const changes of [{ NEXT_PUBLIC_SUPABASE_URL: 'https://evil.example.com' }, { NEXT_PUBLIC_SUPABASE_URL: 'http://abcdefghijklmnopqrst.supabase.co' }, { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_forbidden' }]) await assert.rejects(inspectPublicReadiness({ ...env, ...changes }, expectedOrigin, mockedFetch))
assert.equal(localReadiness(env).dedicatedProjectMatches, false)
await runReadiness(env, {}, mockedFetch)
await runReadiness(env, { expectedOrigin }, mockedFetch)
await assert.rejects(runReadiness(env, { live: true }, mockedFetch))
for (const invalid of [undefined, '', 'https://127.0.0.1', 'https://localhost', 'https://abcdefghijklmnopqrst.supabase.co.evil.test', 'https://evil.test@abcdefghijklmnopqrst.supabase.co', 'https://abcdefghijklmnopqrst.supabase.co:443', 'https://abcdefghijklmnopqrst.supabase.co/', 'https://abcdefghijklmnopqrst.supabase.co?x=1', 'https://abcdefghijklmnopqrst.supabase.co#x', 'https://abcdefghijklmnopqrst.supabase.co\\evil', 'https://ABCDEFGHIJKLMNOPQRST.supabase.co', 'http://abcdefghijklmnopqrst.supabase.co', 'https://anotherprojectorigin.supabase.co']) {
  assert.equal(localReadiness(env, invalid).dedicatedProjectMatches, false)
  await assert.rejects(inspectPublicReadiness(env, invalid, mockedFetch))
}
assert.equal(isProjectOrigin(expectedOrigin), true)
assert.equal(calls, 1)
await runReadiness(env, { expectedOrigin, live: true }, mockedFetch)
assert.equal(calls, 2)
await assert.rejects(inspectPublicReadiness(env, expectedOrigin, async () => ({ ok: false })))
console.log('Public auth readiness checks passed; independently pinned destination, offline default, GET only, boolean-only results, no live network.')
