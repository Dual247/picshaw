import 'server-only'
import postgres from 'postgres'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireVerifiedActor, AuthenticationRequiredError } from './auth'
import { parseWorkspaceInput, type WorkspaceInput } from './workspace-input'

export type Workspace = WorkspaceInput & { id: string }
export type WorkspaceActor = { id: string; sessionId: string; expiresAt: number }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function requireWorkspaceActor(client: Pick<SupabaseClient, 'auth'>, projectUrl: string): Promise<WorkspaceActor> {
  // getClaims verifies the SAME token's signature, expiry and subject. Never
  // decode a cookie JWT and pair its unverified session_id with getUser().
  const { data, error } = await client.auth.getClaims()
  const claims = data?.claims
  if (error || !claims || !uuid.test(claims.sub) || typeof claims.session_id !== 'string' ||
      !uuid.test(claims.session_id) || !Number.isSafeInteger(claims.exp) || claims.exp <= Date.now() / 1000 ||
      claims.role !== 'authenticated' || claims.is_anonymous !== false || claims.iss !== `${projectUrl}/auth/v1` ||
      !(claims.aud === 'authenticated' || (Array.isArray(claims.aud) && claims.aud.includes('authenticated')))) throw new AuthenticationRequiredError()
  const actor = await requireVerifiedActor(client)
  if (actor.id !== claims.sub) throw new AuthenticationRequiredError()
  return { id: actor.id, sessionId: claims.session_id, expiresAt: claims.exp }
}

type Environment = Record<string, string | undefined>
export function readWorkspaceConfig(env: Environment = process.env) {
  if (env.VERCEL !== '1' || env.VERCEL_ENV !== 'production' || env.PIC_SHAW_AUTH_ORIGIN !== 'https://app.picshaw.com' ||
      env.PIC_SHAW_WORKSPACE_ENABLED !== 'true' || env.PIC_SHAW_AUTH_SESSION_ENABLED !== 'true') return null
  const ref = /^https:\/\/([a-z]{20})\.supabase\.co\/?$/.exec(env.NEXT_PUBLIC_SUPABASE_URL ?? '')?.[1]
  const host = env.PIC_SHAW_WORKSPACE_DB_HOST ?? ''
  const password = env.PIC_SHAW_WORKSPACE_DB_PASSWORD ?? ''
  if (!ref || !/^[a-z0-9]+(?:-[a-z0-9]+)*\.pooler\.supabase\.com$/.test(host) ||
      password.length < 32 || password.length > 256) return null
  return { host, user: `picshaw_workspace.${ref}`, password }
}
export type WorkspaceStore = (actor: WorkspaceActor, input: WorkspaceInput | null) => Promise<Workspace | null>
export function createWorkspaceStore(env: Environment = process.env): WorkspaceStore | null {
  const config = readWorkspaceConfig(env)
  if (!config) return null
  const sql = postgres({ host: config.host, port: 6543, database: 'postgres', username: config.user,
    password: config.password, ssl: { rejectUnauthorized: true }, prepare: false, max: 2, max_pipeline: 1,
    connect_timeout: 2, queue_timeout: 2, query_timeout: 3, cancel_timeout: 1, idle_timeout: 10,
    max_lifetime: 60, fetch_types: false, onnotice: () => {}, debug: false })
  return async (actor, input) => {
    if (!uuid.test(actor.id) || !uuid.test(actor.sessionId) || !Number.isSafeInteger(actor.expiresAt) ||
        actor.expiresAt <= Date.now() / 1000 || (input !== null && !parseWorkspaceInput(input))) throw new AuthenticationRequiredError()
    const rows = await sql`select picshaw_workspace_private.workspace(${actor.id}::uuid, ${actor.sessionId}::uuid,
      ${actor.expiresAt}::bigint, ${input !== null}, ${input?.name ?? null}::text, ${input?.site ?? null}::text) as workspace`
      .signal(AbortSignal.timeout(4000))
    if (rows.length !== 1) throw Error('Workspace unavailable')
    const value = rows[0].workspace
    if (value === null && input === null) return null
    if (!value || !uuid.test(value.id) || !parseWorkspaceInput({ name: value.name, site: value.site })) throw Error('Workspace unavailable')
    return { id: value.id, name: value.name, site: value.site }
  }
}
let store: WorkspaceStore | null | undefined
export function deploymentWorkspaceStore() {
  store ??= createWorkspaceStore()
  return store
}
