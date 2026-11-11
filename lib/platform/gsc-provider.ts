import 'server-only'
import { GSC_SCOPE } from './gsc'
import { PlatformError } from './core'
export const GSC_CALLBACK = 'https://app.picshaw.com/api/platform/gsc/callback'
export type GoogleCredentials = { clientId: string; clientSecret: string }
export function googleProvider(config: GoogleCredentials, transport: typeof fetch = fetch) {
  async function tokens(parameters: Record<string, string>, requireRefresh: boolean) {
    let response: Response
    try {
      response = await transport('https://oauth2.googleapis.com/token', { method: 'POST',
        body: new URLSearchParams({ ...parameters, client_id: config.clientId, client_secret: config.clientSecret }),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000) })
    } catch { throw new PlatformError('PROVIDER_UNAVAILABLE', 'Google token exchange could not be confirmed.') }
    if (!response.ok) throw new PlatformError(response.status === 400 || response.status === 401 ? 'RECONNECT_REQUIRED' : 'PROVIDER_UNAVAILABLE', 'Google connection needs attention.')
    let data
    try { data = await response.json() } catch { throw new PlatformError('INVALID_RESPONSE', 'Google returned an invalid response.') }
    if (!data || typeof data.access_token !== 'string' || !data.access_token || data.access_token.length > 16000 ||
        data.token_type?.toLowerCase() !== 'bearer' || !Number.isInteger(data.expires_in) || data.expires_in < 30 || data.expires_in > 86400 ||
        (requireRefresh && (typeof data.refresh_token !== 'string' || !data.refresh_token)) ||
        (data.refresh_token !== undefined && (typeof data.refresh_token !== 'string' || data.refresh_token.length > 16000)) ||
        (requireRefresh ? data.scope !== GSC_SCOPE : data.scope !== undefined && data.scope !== GSC_SCOPE)) {
      throw new PlatformError('RECONNECT_REQUIRED', 'Google did not grant the exact read-only connection requested.')
    }
    return { accessToken: data.access_token as string, refreshToken: data.refresh_token as string | undefined }
  }
  return {
    authorization(state: string, pkceChallenge: string) {
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: GSC_CALLBACK, response_type: 'code',
        scope: GSC_SCOPE, access_type: 'offline', prompt: 'consent select_account', include_granted_scopes: 'false',
        state, code_challenge: pkceChallenge, code_challenge_method: 'S256' }).toString()
      return url.toString()
    },
    exchange: (code: string, verifier: string) => tokens({ code, code_verifier: verifier, redirect_uri: GSC_CALLBACK, grant_type: 'authorization_code' }, true),
    refresh: (token: string) => tokens({ refresh_token: token, grant_type: 'refresh_token' }, false),
    async revoke(token: string) {
      try {
        const result = await transport('https://oauth2.googleapis.com/revoke', { method: 'POST',
          body: new URLSearchParams({ token }), headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000) })
        // Do not call arbitrary 400 responses a confirmed revocation.
        return result.ok
      } catch { return false }
    },
  }
}
