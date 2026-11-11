import assert from 'node:assert/strict'
import { readPublicEnvironment, localReadiness, summarizePublicSettings, inspectPublicReadiness } from './check-supabase-readiness.mjs'

const env = readPublicEnvironment('\uFEFFNEXT_PUBLIC_SUPABASE_URL=https://emlrtdffbfhainvvlvnl.supabase.co\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_only\nPIC_SHAW_AUTH_ORIGIN=\nPIC_SHAW_AUTH_GOOGLE_ENABLED=false\nPIC_SHAW_AUTH_APPLE_ENABLED=false\nPIC_SHAW_AUTH_EMAIL_ENABLED=false\nPIC_SHAW_AUTH_SESSION_ENABLED=false\nUNRELATED_SECRET=excluded')
assert.equal(env.UNRELATED_SECRET, undefined)
assert.deepEqual(localReadiness(env), { dedicatedProjectMatches: true, modernPublishableKeyPresent: true, appOriginConfigured: false, allAuthFlagsExplicitlyDisabled: true })
let calls = 0
const mockedFetch = async (url, options) => {
  calls++
  assert.equal(url, 'https://emlrtdffbfhainvvlvnl.supabase.co/auth/v1/settings')
  assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'omit'); assert.equal(options.cache, 'no-store')
  assert.equal(options.headers.apikey, 'sb_publishable_test_only')
  return { ok: true, json: async () => ({ external: { google: false, apple: false, email: true }, disable_signup: false, mailer_autoconfirm: false, unexpected_secret: 'never-output' }) }
}
const result = await inspectPublicReadiness(env, mockedFetch)
assert.equal(result.googleEnabled, false); assert.equal(result.emailEnabled, true); assert.equal(result.smtpConfigured, null)
assert.doesNotMatch(JSON.stringify(result), /never-output|publishable|unexpected_secret/)
assert.equal(summarizePublicSettings({ external: { google: 'true' } }).googleEnabled, null)
for (const changes of [{ NEXT_PUBLIC_SUPABASE_URL: 'https://evil.example.com' }, { NEXT_PUBLIC_SUPABASE_URL: 'http://emlrtdffbfhainvvlvnl.supabase.co' }, { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_forbidden' }]) await assert.rejects(inspectPublicReadiness({ ...env, ...changes }, mockedFetch))
assert.equal(calls, 1)
console.log('Public auth readiness checks passed; fixed destination, GET only, boolean-only results, no live network.')
