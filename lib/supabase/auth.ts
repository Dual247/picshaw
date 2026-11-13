import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export type PortalAccessEnvironment = {
  PIC_SHAW_PORTAL_ACCESS_MODE?: string
  PIC_SHAW_PILOT_USER_A_ID?: string
  PIC_SHAW_PILOT_USER_B_ID?: string
  PIC_SHAW_PILOT_OWNER_EMAIL?: string
  PIC_SHAW_PILOT_OWNER_ID?: string
  PIC_SHAW_PILOT_GOOGLE_EMAIL?: string
  PIC_SHAW_PILOT_GOOGLE_ID?: string
}
const pilotEmails = ['hello+portal-test-a@picshaw.com', 'hello+portal-test-b@picshaw.com'] as const
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Server-only deployment boundary. Unknown/missing mode is closed, never public. */
export function readPortalAccess(env: PortalAccessEnvironment = {
  PIC_SHAW_PORTAL_ACCESS_MODE: process.env.PIC_SHAW_PORTAL_ACCESS_MODE,
  PIC_SHAW_PILOT_USER_A_ID: process.env.PIC_SHAW_PILOT_USER_A_ID,
  PIC_SHAW_PILOT_USER_B_ID: process.env.PIC_SHAW_PILOT_USER_B_ID,
  PIC_SHAW_PILOT_OWNER_EMAIL: process.env.PIC_SHAW_PILOT_OWNER_EMAIL,
  PIC_SHAW_PILOT_OWNER_ID: process.env.PIC_SHAW_PILOT_OWNER_ID,
  PIC_SHAW_PILOT_GOOGLE_EMAIL: process.env.PIC_SHAW_PILOT_GOOGLE_EMAIL,
  PIC_SHAW_PILOT_GOOGLE_ID: process.env.PIC_SHAW_PILOT_GOOGLE_ID,
}) {
  const mode = env.PIC_SHAW_PORTAL_ACCESS_MODE === 'pilot' ? 'pilot' :
    env.PIC_SHAW_PORTAL_ACCESS_MODE === 'public' ? 'public' : 'closed'
  const ids = [env.PIC_SHAW_PILOT_USER_A_ID, env.PIC_SHAW_PILOT_USER_B_ID].map(id => id?.toLowerCase())
  const pinned = ids.every(id => typeof id === 'string' && uuid.test(id)) && ids[0] !== ids[1]
  const email = env.PIC_SHAW_PILOT_OWNER_EMAIL
  const ownerId = env.PIC_SHAW_PILOT_OWNER_ID?.toLowerCase()
  // Optional exact address may register before its independently verified UUID
  // is pinned. Neither registration nor email confirmation grants portal access.
  const ownerEmail = typeof email === 'string' && email.length <= 254 &&
    /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(email) &&
    !pilotEmails.some(value => value === email) ? email : null
  const owner = ownerEmail ? { email: ownerEmail, id: pinned && typeof ownerId === 'string' && uuid.test(ownerId) && !ids.includes(ownerId) ? ownerId : null } : null
  // A separate exact Google identity preserves the existing owner and test pins.
  // Registration may finish before an independent operator pins the Auth UUID.
  const googleEmail = env.PIC_SHAW_PILOT_GOOGLE_EMAIL
  const googleId = env.PIC_SHAW_PILOT_GOOGLE_ID?.toLowerCase()
  const validGoogleEmail = typeof googleEmail === 'string' && googleEmail.length <= 254 &&
    /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(googleEmail) &&
    !pilotEmails.some(value => value === googleEmail) && googleEmail !== ownerEmail
  const google = validGoogleEmail ? { email: googleEmail, id: pinned && typeof googleId === 'string' &&
    uuid.test(googleId) && !ids.includes(googleId) && googleId !== ownerId ? googleId : null } : null
  return { mode, ids: pinned ? ids : null, owner, google } as const
}

/** Exact addresses only. No domains, aliases, suffix matching or mutable metadata. */
export function portalEmailAllowed(email: unknown, env?: PortalAccessEnvironment) {
  const { mode, owner } = readPortalAccess(env)
  return mode === 'public' || (mode === 'pilot' && typeof email === 'string' && (pilotEmails.some(value => value === email) || owner?.email === email))
}

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

/** getUser returns server-verified identities; client metadata is never authority. */
function hasVerifiedGoogleIdentity(user: NonNullable<Awaited<ReturnType<SupabaseClient['auth']['getUser']>>['data']['user']>, email: string) {
  return Array.isArray(user.identities) && user.identities.some(identity =>
    identity.provider === 'google' && identity.user_id === user.id &&
    identity.identity_data?.email === email && identity.identity_data?.email_verified === true)
}

/** Portal admission is additional to identity; logout retains identity-only checks. */
export function verifiedPortalActorFromResponse(
  result: Awaited<ReturnType<SupabaseClient['auth']['getUser']>>, env?: PortalAccessEnvironment,
): { id: string } {
  const actor = verifiedActorFromResponse(result)
  const { mode, ids, owner, google } = readPortalAccess(env)
  if (mode === 'public') return actor
  const user = result.data.user!
  const index = pilotEmails.findIndex(email => email === user.email)
  const pinnedIdentity = index >= 0 ? ids?.[index] === actor.id.toLowerCase() :
    (owner !== null && owner.email === user.email && owner.id !== null && owner.id === actor.id.toLowerCase()) ||
    (google !== null && google.email === user.email && google.id !== null && google.id === actor.id.toLowerCase() &&
      hasVerifiedGoogleIdentity(user, google.email))
  if (mode !== 'pilot' || !ids || !pinnedIdentity ||
      typeof user.email_confirmed_at !== 'string' || !Number.isFinite(Date.parse(user.email_confirmed_at))) {
    throw new AuthenticationRequiredError()
  }
  return actor
}

export async function requirePortalActor(client: Pick<SupabaseClient, 'auth'>, env?: PortalAccessEnvironment) {
  try { return verifiedPortalActorFromResponse(await client.auth.getUser(), env) }
  catch { throw new AuthenticationRequiredError() }
}

/** Confirmation can finish while owner admission still awaits an explicit pin. */
export function pendingOwnerFromResponse(result: Awaited<ReturnType<SupabaseClient['auth']['getUser']>>, env?: PortalAccessEnvironment): boolean {
  try {
    verifiedActorFromResponse(result)
    const { mode, ids, owner, google } = readPortalAccess(env), user = result.data.user!
    const pending = (owner !== null && owner.id === null && owner.email === user.email) ||
      (google !== null && google.id === null && google.email === user.email && hasVerifiedGoogleIdentity(user, google.email))
    return mode === 'pilot' && ids !== null && pending &&
      typeof user.email_confirmed_at === 'string' && Number.isFinite(Date.parse(user.email_confirmed_at))
  } catch { return false }
}
