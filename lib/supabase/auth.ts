import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export class AuthenticationRequiredError extends Error {
  readonly code = 'AUTHENTICATION_REQUIRED'
  constructor() {
    super('Sign in is required.')
    this.name = 'AuthenticationRequiredError'
  }
}

/** Identity only. Membership, roles, RLS and connection ownership are separate checks. */
export function verifiedActorFromResponse(result: Awaited<ReturnType<SupabaseClient['auth']['getUser']>>): { id: string } {
  const user = result?.data?.user
  if (result?.error || !user || user.is_anonymous !== false ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)) throw new AuthenticationRequiredError()
  return { id: user.id }
}

export async function requireVerifiedActor(client: Pick<SupabaseClient, 'auth'>): Promise<{ id: string }> {
  try {
    // getUser performs server verification; cookie session/user_metadata is not authority.
    return verifiedActorFromResponse(await client.auth.getUser())
  } catch {
    // Auth failures, network failures and malformed responses all deny access.
    throw new AuthenticationRequiredError()
  }
}
