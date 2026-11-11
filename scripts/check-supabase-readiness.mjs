import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const projectOrigin = 'https://emlrtdffbfhainvvlvnl.supabase.co'
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

export function localReadiness(env) {
  return {
    dedicatedProjectMatches: env.NEXT_PUBLIC_SUPABASE_URL === projectOrigin,
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

/** Only the public settings GET; fixed project origin, no redirect, no account calls. */
export async function inspectPublicReadiness(env, fetcher = fetch) {
  const local = localReadiness(env)
  if (!local.dedicatedProjectMatches || !local.modernPublishableKeyPresent) throw Error('Expected dedicated project URL and modern publishable key are required.')
  const response = await fetcher(`${projectOrigin}/auth/v1/settings`, {
    method: 'GET', headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
    redirect: 'error', cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw Error('Public auth settings could not be read.')
  // Only selected booleans leave this function, never raw settings or keys.
  return summarizePublicSettings(await response.json())
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const env = readPublicEnvironment(readFileSync('.env.local', 'utf8'))
    const result = { local: localReadiness(env) }
    // No network by default. This explicit option is read-only and sends only the
    // existing publishable project key to its own fixed project's settings endpoint.
    if (process.argv.includes('--read-public-settings')) result.publicSettings = await inspectPublicReadiness(env)
    console.log(JSON.stringify(result, null, 2))
  } catch { console.error('Readiness check unavailable. Verify local public configuration and network access; no authentication was attempted.'); process.exitCode = 1 }
}
