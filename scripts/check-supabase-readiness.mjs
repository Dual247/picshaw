import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// The operator supplies this independently of the inspected configuration.
// Restrict to canonical hosted Supabase project origins, not arbitrary URLs.
export function isProjectOrigin(value) {
  return typeof value === 'string' && /^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(value)
}
const flagNames = ['GOOGLE', 'APPLE', 'EMAIL', 'SESSION'].map(name => `PIC_SHAW_AUTH_${name}_ENABLED`)
const allowedKeys = new Set(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'PIC_SHAW_AUTH_ORIGIN', ...flagNames])

export function readPublicEnvironment(text) {
  const values = {}
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(.*)$/)
    if (match && allowedKeys.has(match[1])) values[match[1]] = match[2].trim()
  }
  return values
}

export function localReadiness(env, expectedOrigin) {
  return {
    dedicatedProjectMatches: isProjectOrigin(expectedOrigin) && env.NEXT_PUBLIC_SUPABASE_URL === expectedOrigin,
    modernPublishableKeyPresent: /^sb_publishable_[A-Za-z0-9_-]+$/.test(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''),
    appOriginConfigured: Boolean(env.PIC_SHAW_AUTH_ORIGIN),
    allAuthFlagsExplicitlyDisabled: flagNames.every(name => env[name] === 'false'),
  }
}

export function summarizePublicSettings(settings) {
  const boolean = value => typeof value === 'boolean' ? value : null
  return {
    googleEnabled: boolean(settings?.external?.google),
    appleEnabled: boolean(settings?.external?.apple),
    emailEnabled: boolean(settings?.external?.email),
    signupsDisabled: boolean(settings?.disable_signup),
    emailAutoConfirm: boolean(settings?.mailer_autoconfirm),
    // Null means not verified, never "configured" or "not configured".
    smtpConfigured: null, appRedirectsConfigured: null, securePasswordChangeConfigured: null,
  }
}

/** Only the public settings GET; operator-pinned project origin, no redirect, no account calls. */
export async function inspectPublicReadiness(env, expectedOrigin, fetcher = fetch) {
  const local = localReadiness(env, expectedOrigin)
  if (!local.dedicatedProjectMatches || !local.modernPublishableKeyPresent) throw Error('Expected dedicated project URL and modern publishable key are required.')
  const response = await fetcher(`${expectedOrigin}/auth/v1/settings`, {
    method: 'GET', headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
    redirect: 'error', cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw Error('Public auth settings could not be read.')
  // Only selected booleans leave this function, never raw settings or keys.
  return summarizePublicSettings(await response.json())
}

export async function runReadiness(env, { expectedOrigin, live = false } = {}, fetcher = fetch) {
  const result = { local: localReadiness(env, expectedOrigin) }
  if (live === true) result.publicSettings = await inspectPublicReadiness(env, expectedOrigin, fetcher)
  return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2)
    if (args.some(arg => arg !== '--live' && !arg.startsWith('--expected-origin=')) ||
        args.filter(arg => arg.startsWith('--expected-origin=')).length > 1 ||
        args.filter(arg => arg === '--live').length > 1) throw Error('Invalid options.')
    const expectedOrigin = args.find(arg => arg.startsWith('--expected-origin='))?.slice('--expected-origin='.length)
    if (expectedOrigin !== undefined && !isProjectOrigin(expectedOrigin)) throw Error('Invalid expected origin.')
    const env = readPublicEnvironment(readFileSync('.env.local', 'utf8'))
    // Offline by default. Live inspection requires independent expected-origin
    // confirmation and an exact match with the configured public project URL.
    const result = await runReadiness(env, { expectedOrigin, live: args.includes('--live') })
    console.log(JSON.stringify(result, null, 2))
  } catch { console.error('Readiness check unavailable. Verify options, public configuration and network access; no authentication was attempted.'); process.exitCode = 1 }
}