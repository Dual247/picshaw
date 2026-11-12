import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import type { CookieOptions } from '@supabase/ssr'
import { createRequestSupabaseClient, AUTH_RESPONSE_HEADERS } from './server'
import { readPortalConfig, validEmailCredentials, validEmail, validNewPassword, type PortalEnvironment } from './portal-config'
import { requireVerifiedActor, requirePortalActor, verifiedPortalActorFromResponse, portalEmailAllowed } from './auth'
import { checkDeploymentAuthAdmission, type AuthAdmission, type AuthAdmissionAction } from './auth-admission'

type Dependencies = { env?: PortalEnvironment; createClient?: typeof createRequestSupabaseClient; admit?: AuthAdmission }
type CookieWrite = { name: string; value: string; options: CookieOptions }
const unavailable = 'This sign-in option is awaiting secure setup. No account request was sent.'
const failed = 'We could not complete sign-in. Check your details or start again.'

function responseContext(request: NextRequest, dependencies: Dependencies) {
  const cookies = new Map<string, CookieWrite>()
  const currentCookies = new Map(request.cookies.getAll().map(({ name, value }) => [name, value]))
  const headers = new Headers({ ...AUTH_RESPONSE_HEADERS, 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' })
  return {
    discardAuth: () => {
      // Reject an ineligible portal session without revoking an unrelated account
      // upstream. Also replace any freshly written chunks before this response.
      for (const name of currentCookies.keys()) {
        if (name === '__Host-picshaw-auth' || name.startsWith('__Host-picshaw-auth.') || name.startsWith('__Host-picshaw-auth-')) {
          cookies.set(name, { name, value: '', options: { secure: true, httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 } })
          currentCookies.delete(name)
        }
      }
    },
    client: () => (dependencies.createClient ?? createRequestSupabaseClient)({
      getAll: () => Array.from(currentCookies, ([name, value]) => ({ name, value })),
      setAll: (values, extraHeaders) => {
        values.forEach(cookie => {
          cookies.set(cookie.name, cookie)
          // Later SDK operations in the same request must see rotated/new chunks,
          // so a subsequent logout can delete them too, not only incoming chunks.
          if (cookie.options.maxAge === 0 || cookie.value === '') currentCookies.delete(cookie.name)
          else currentCookies.set(cookie.name, cookie.value)
        })
        Object.entries(extraHeaders).forEach(([key, value]) => headers.set(key, value))
      },
    }, dependencies.env),
    finish: (body: Record<string, string>, status = 200, location?: string) => {
      const response = location
        ? new NextResponse(null, { status: 303, headers })
        : NextResponse.json(body, { status, headers })
      if (location) response.headers.set('Location', location)
      for (const { name, value, options } of cookies.values()) response.cookies.set(name, value, options)
      return response
    },
  }
}

// Bound streamed bodies too, not just Content-Length. Never log credentials/body.
async function readBody(request: NextRequest): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw Error('Invalid body')
  const reader = request.body?.getReader()
  if (!reader) throw Error('Missing body')
  let length = 0
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > 4096) { await reader.cancel(); throw Error('Body too large') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const body = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length }
  return JSON.parse(new TextDecoder().decode(body))
}

export async function handleAuthPost(request: NextRequest, action: string, dependencies: Dependencies = {}) {
  const context = responseContext(request, dependencies)
  let config: ReturnType<typeof readPortalConfig>
  try { config = readPortalConfig(dependencies.env) } catch { return context.finish({ error: unavailable }, 503) }
  // Do not trust Host/X-Forwarded-Host to choose redirects or accept cross-origin login POSTs.
  if (request.method !== 'POST' || request.headers.get('host') !== new URL(config.origin).host || new URL(request.url).origin !== config.origin ||
      request.headers.get('origin') !== config.origin ||
      (request.headers.has('sec-fetch-site') && request.headers.get('sec-fetch-site') !== 'same-origin')) {
    return context.finish({ error: 'Please start sign-in from this website.' }, 403)
  }
  const provider = action === 'google' || action === 'apple' ? action : null
  const emailAction = action === 'sign-in' || action === 'sign-up'
  const recoveryAction = action === 'recover' || action === 'reset-password'
  const sessionAction = action === 'session' || action === 'sign-out' || action === 'sign-out-all'
  if (!provider && !emailAction && !recoveryAction && !sessionAction) return context.finish({ error: 'Unknown sign-in option.' }, 404)
  if (!(sessionAction ? config.sessionEnabled : provider ? config.enabled[provider] : config.enabled.email) ||
      (action === 'reset-password' && !config.sessionEnabled)) return context.finish({ error: unavailable }, 503)
  let body: unknown
  try { body = await readBody(request) } catch { return context.finish({ error: 'Please check the form and try again.' }, 400) }
  if (emailAction && !validEmailCredentials(body, action === 'sign-up')) {
    return context.finish({ error: action === 'sign-up' ? 'Enter a valid email and a password of 12–128 characters.' : 'Enter a valid email and password.' }, 400)
  }
  const fields = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null
  if (!fields || (action === 'recover' && !validEmail(fields.email)) ||
      (action === 'reset-password' && !validNewPassword(fields.password))) return context.finish({ error: 'Please check the form and try again.' }, 400)
  // Before admission/SDK/email calls. This is an exact server-side pilot list,
  // never a client flag, domain match, user metadata or tenant selector.
  if ((emailAction || action === 'recover') && !portalEmailAllowed(fields.email, dependencies.env)) {
    return context.finish({ error: 'Customer sign-in is not open yet. This pilot is limited to approved test accounts.' }, 403)
  }
  if (!sessionAction) {
    try {
      const admission = await (dependencies.admit ?? checkDeploymentAuthAdmission)({ action: action as AuthAdmissionAction, request })
      if (admission.status === 'limited') return context.finish({ error: 'Too many attempts. Please wait and try again.' }, 429)
      if (admission.status !== 'allow') return context.finish({ error: 'Account requests are temporarily unavailable. Please try again later.' }, 503)
    } catch { return context.finish({ error: 'Account requests are temporarily unavailable. Please try again later.' }, 503) }
  }
  try {
    const client = context.client()
    if (action === 'session') {
      try {
        // getUser may refresh via the SDK. All resulting cookie writes are sent
        // on THIS response, without a shared client, proxy or authenticated page.
        const result = await client.auth.getUser()
        if (result.error && ![400, 401, 403].includes(result.error.status ?? 0) && result.error.name !== 'AuthSessionMissingError') {
          return context.finish({ state: 'unknown', error: 'We could not verify your session right now. Please retry; this does not mean you have been signed out.' }, 503)
        }
        try { verifiedPortalActorFromResponse(result, dependencies.env) } catch {
          context.discardAuth()
          return context.finish({ state: 'signed-out', message: 'Your session is unavailable for this portal. Please sign in with an approved account.' }, 401)
        }
        return context.finish({ state: 'signed-in', message: 'Your account session is active. Workspace access is separate.' })
      } catch { return context.finish({ state: 'unknown', error: 'We could not verify your session right now. Please retry; this does not mean you have been signed out.' }, 503) }
    }
    if (action === 'sign-out' || action === 'sign-out-all') {
      // SDK may clear local cookies before upstream revocation completes. Preserve
      // every write, but never claim clearing/revocation after an uncertain error.
      // Global logout needs a verified account so an absent local session cannot
      // be misreported as successful revocation on every other device.
      if (action === 'sign-out-all') {
        try { await requireVerifiedActor(client) } catch { return context.finish({ error: 'Sign in again before requesting sign-out on all devices.' }, 401) }
      }
      const { error } = await client.auth.signOut({ scope: action === 'sign-out-all' ? 'global' : 'local' })
      if (error) return context.finish({ error: 'We could not confirm server-side sign-out. This browser may already be signed out. Please retry; other sessions may remain active.' }, 503)
      return context.finish({ state: 'signed-out', message: action === 'sign-out-all'
        ? 'Sign-out was requested for all devices. Existing access tokens can remain valid until they expire.'
        : 'You are signed out of this browser. Existing access tokens can remain valid until they expire.' })
    }
    if (action === 'recover') {
      // Use the same neutral message for existing/unknown addresses and provider
      // account-specific errors. It is never a claim that a message was sent.
      await client.auth.resetPasswordForEmail(fields.email as string, { redirectTo: config.callback })
      return context.finish({ message: 'If this address is eligible, a recovery email will arrive. Open the link in this same browser. Check spam or try again later if needed.' })
    }
    if (action === 'reset-password') {
      try { await requirePortalActor(client, dependencies.env) } catch {
        context.discardAuth()
        return context.finish({ error: 'Open a new recovery link in this browser or sign in with an approved account before changing your password.' }, 401)
      }
      // Auth server enforces secure password change/reauthentication settings.
      // Never infer recovery permission from a query string or an unsigned cookie.
      const { data, error } = await client.auth.updateUser({ password: fields.password as string })
      if (error || !data.user) return context.finish({ error: 'The password could not be updated. Use a new recovery link and a different strong password, then try again.' }, 400)
      try {
        const { error: signOutError } = await client.auth.signOut({ scope: 'global' })
        if (!signOutError) return context.finish({ state: 'password-updated', message: 'Password updated. Sign-out was requested for all devices; existing access tokens can remain valid until expiry. Sign in with your new password.' })
      } catch { /* Password changed, but revocation is not confirmed. Do not hide this partial result. */ }
      return context.finish({ state: 'password-updated-signout-pending', message: 'Password updated, but sign-out on all devices could not be confirmed. Use session controls to retry sign-out.' })
    }
    if (provider) {
      const { data, error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo: config.callback, skipBrowserRedirect: true } })
      if (error || !data.url) return context.finish({ error: failed }, 400)
      const destination = new URL(data.url)
      // SDK returns the project's authorize endpoint, never a user-supplied next URL.
      if (destination.origin !== config.url || destination.pathname !== '/auth/v1/authorize' ||
          destination.username || destination.password || destination.hash ||
          destination.searchParams.get('provider') !== provider) return context.finish({ error: failed }, 400)
      return context.finish({ url: destination.href })
    }
    const { email, password } = body as { email: string; password: string }
    if (action === 'sign-up') {
      const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: config.callback } })
      if (error) return context.finish({ error: 'We could not process that request. Try again later, or sign in if you already have an account.' }, 400)
      // Never claim a new account exists: Supabase can obscure duplicate signups.
      if (data.session) {
        try { await requirePortalActor(client, dependencies.env) } catch {
          context.discardAuth(); return context.finish({ error: failed }, 403)
        }
        return context.finish({ state: 'signed-in', message: 'Signed in. Workspace access still requires an approved membership.' })
      }
      return context.finish({ message: 'If this address is eligible, a confirmation email will arrive. Open it in this browser to finish. You can also sign in if you already have an account.' })
    }
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error || !data.session) return context.finish({ error: failed }, 400)
    try { await requirePortalActor(client, dependencies.env) } catch {
      context.discardAuth(); return context.finish({ error: failed }, 403)
    }
    return context.finish({ state: 'signed-in', message: 'Signed in. Workspace access still requires an approved membership.' })
  } catch { return context.finish({ error: failed }, 400) }
}

export async function handleAuthCallback(request: NextRequest, dependencies: Dependencies = {}) {
  const context = responseContext(request, dependencies)
  let config: ReturnType<typeof readPortalConfig>
  try { config = readPortalConfig(dependencies.env) } catch { return context.finish({ error: unavailable }, 503) }
  if (request.headers.get('host') !== new URL(config.origin).host || new URL(request.url).origin !== config.origin || !Object.values(config.enabled).some(Boolean)) return context.finish({ error: unavailable }, 403)
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const flowId = url.searchParams.get('sb_flow_id')
  const failure = () => context.finish({}, 303, `${config.origin}/platform/sign-in?error=callback`)
  if (url.searchParams.has('error') || url.searchParams.getAll('code').length !== 1 ||
      !code || code.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(code) ||
      (flowId !== null && (!/^[A-Za-z0-9_-]{8,64}$/.test(flowId) || url.searchParams.getAll('sb_flow_id').length !== 1))) return failure()
  // OAuth navigations need no Origin header. The same canonical ingress guard
  // still admits every exchange before SDK creation, including during outages.
  try {
    const admission = await (dependencies.admit ?? checkDeploymentAuthAdmission)({ action: 'callback', request })
    if (admission.status === 'limited') return context.finish({ error: 'Too many attempts. Please wait and try again.' }, 429)
    if (admission.status !== 'allow') return context.finish({ error: 'Account requests are temporarily unavailable. Please try again later.' }, 503)
  } catch { return context.finish({ error: 'Account requests are temporarily unavailable. Please try again later.' }, 503) }
  try {
    const client = context.client()
    // SDK owns PKCE verifier creation/storage and one-time exchange; Supabase owns
    // provider OAuth state validation. A code without its browser verifier fails.
    const { data, error } = await client.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined)
    if (error || !data.session) return failure()
    try { await requirePortalActor(client, dependencies.env) } catch {
      context.discardAuth(); return failure()
    }
    // Recovery type comes from the SDK's verifier, never an incoming type/next.
    // Identity never unlocks data. Both redirect destinations are fixed.
    // Installed SDK returns redirectType at runtime, though public AuthTokenResponse
    // omits it. Narrow the actual returned property rather than assuming its type.
    const destination = 'redirectType' in data && data.redirectType === 'recovery' && config.enabled.email && config.sessionEnabled
      ? '/platform/reset-password' : '/platform'
    return context.finish({}, 303, `${config.origin}${destination}`)
  } catch { return failure() }
}
