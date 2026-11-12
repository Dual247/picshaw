import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export type PortalAccessEnvironment = {
  PIC_SHAW_PORTAL_ACCESS_MODE?: string
  PIC_SHAW_PILOT_USER_A_ID?: string
  PIC_SHAW_PILOT_USER_B_ID?: string
  PIC_SHAW_PILOT_OWNER_EMAIL?: string
  PIC_SHAW_PILOT_OWNER_ID?: string
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
  return { mode, ids: pinned ? ids : null, owner } as const
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

/** Portal admission is additional to identity; logout retains identity-only checks. */
export function verifiedPortalActorFromResponse(
  result: Awaited<ReturnType<SupabaseClient['auth']['getUser']>>, env?: PortalAccessEnvironment,
): { id: string } {
  const actor = verifiedActorFromResponse(result)
  const { mode, ids, owner } = readPortalAccess(env)
  if (mode === 'public') return actor
  const user = result.data.user!
  const index = pilotEmails.findIndex(email => email === user.email)
  const pinnedIdentity = index >= 0 ? ids?.[index] === actor.id.toLowerCase() :
    owner !== null && owner.email === user.email && owner.id !== null && owner.id === actor.id.toLowerCase()
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
    const { mode, ids, owner } = readPortalAccess(env), user = result.data.user!
    return mode === 'pilot' && ids !== null && owner !== null && owner.id === null && owner.email === user.email &&
      typeof user.email_confirmed_at === 'string' && Number.isFinite(Date.parse(user.email_confirmed_at))
  } catch { return false }
}
