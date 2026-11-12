import 'server-only'
import { createServerClient, type CookieMethodsServer } from '@supabase/ssr'
import { readSupabaseConfig, type SupabaseEnvironment } from './config'

/** Adapter must write ALL cookies and headers to the same outgoing response. */
export type SupabaseResponseCookies = Required<Pick<CookieMethodsServer, 'getAll' | 'setAll'>>

export const AUTH_RESPONSE_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
} as const

/** Request scoped. Route handlers own response writes; never use as a singleton. */
export function createRequestSupabaseClient(
  cookies: SupabaseResponseCookies,
  env?: SupabaseEnvironment,
) {
  const { url, publishableKey } = readSupabaseConfig(env)
  if (!cookies || typeof cookies.getAll !== 'function' || typeof cookies.setAll !== 'function') {
    throw new Error('A response-capable Supabase cookie adapter is required.')
  }
  return createServerClient(url, publishableKey, {
    // No browser Supabase client: session and verifier cookies stay HttpOnly.
    // Supabase appends chunk indexes and -code-verifier to this storage key;
    // every resulting name retains __Host- and the required host-only options.
    cookieOptions: { name: '__Host-picshaw-auth', secure: true, httpOnly: true, sameSite: 'lax', path: '/' },
    global: {
      // Do not cache upstream token or user responses in Next's data cache.
      fetch: async (input, init) => {
        const response = await fetch(input, { ...init, cache: 'no-store', redirect: 'error' })
        const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
        // auth-js 2.x deliberately suppresses ANY logout 401/403/404, including
        // gateway errors and bad JWTs. None proves that global revocation worked.
        // Treat every failed logout as unconfirmed. Keep local SDK cleanup, but
        // surface an uncertainty result instead of
        // allowing the SDK to turn these failed upstream requests into success.
        if (target.origin === url && target.pathname === '/auth/v1/logout' &&
            !response.ok) {
          await response.body?.cancel()
          return Response.json({ message: 'Server-side sign-out could not be confirmed.' }, { status: 503 })
        }
        return response
      },
    },
    cookies: {
      getAll: () => cookies.getAll(),
      setAll: (values, headers) => cookies.setAll(values, { ...headers, ...AUTH_RESPONSE_HEADERS }),
    },
  })
}

