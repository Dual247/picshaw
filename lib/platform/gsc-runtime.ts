import 'server-only'
import postgres from 'postgres'
import { createSupabasePoolerTls } from '../supabase/database-tls'
import { createGscLifecycle, type GscStore } from './gsc-lifecycle'
import { tokenCipher } from './gsc-crypto'
import { googleProvider } from './gsc-provider'

export function readGscConfig(env: Record<string, string | undefined> = process.env) {
  if (env.VERCEL !== '1' || env.VERCEL_ENV !== 'production' || env.PIC_SHAW_AUTH_ORIGIN !== 'https://app.picshaw.com' ||
      env.PIC_SHAW_GSC_ENABLED !== 'true' || env.PIC_SHAW_AUTH_SESSION_ENABLED !== 'true' || env.PIC_SHAW_WORKSPACE_ENABLED !== 'true') return null
  const ref = /^https:\/\/([a-z]{20})\.supabase\.co\/?$/.exec(env.NEXT_PUBLIC_SUPABASE_URL ?? '')?.[1]
  const host = env.PIC_SHAW_GSC_DB_HOST ?? '', password = env.PIC_SHAW_GSC_DB_PASSWORD ?? ''
  const clientId = env.PIC_SHAW_GSC_CLIENT_ID ?? '', clientSecret = env.PIC_SHAW_GSC_CLIENT_SECRET ?? '', key = env.PIC_SHAW_GSC_TOKEN_KEY_V1 ?? ''
  if (!ref || !/^[a-z0-9]+(?:-[a-z0-9]+)*\.pooler\.supabase\.com$/.test(host) || password.length < 32 || password.length > 256 ||
      !/^[A-Za-z0-9-]+\.apps\.googleusercontent\.com$/.test(clientId) || clientSecret.length < 20 || clientSecret.length > 256 ||
      !/^[A-Za-z0-9+/]{43}=$/.test(key)) return null
  return { host, password, user: `picshaw_gsc.${ref}`, clientId, clientSecret, key }
}
export function createDeploymentGsc(env: Record<string, string | undefined> = process.env) {
  const config = readGscConfig(env)
  if (!config) return null
  const sql = postgres({ host: config.host, port: 6543, database: 'postgres', username: config.user, password: config.password,
    ssl: createSupabasePoolerTls(config.host), prepare: false, max: 2, max_pipeline: 1, connect_timeout: 2, queue_timeout: 2,
    query_timeout: 5, cancel_timeout: 1, idle_timeout: 10, max_lifetime: 60, fetch_types: false, onnotice: () => {}, debug: false })
  const store: GscStore = async (actor, organizationId, operation, payload) => {
    const rows = await sql`select picshaw_gsc_private.operation(${actor.id}::uuid,${actor.sessionId}::uuid,${actor.expiresAt}::bigint,
      ${organizationId}::uuid,${operation}::text,${JSON.stringify(payload)}::text::jsonb) as result`.signal(AbortSignal.timeout(6000))
    if (rows.length !== 1 || !rows[0].result || typeof rows[0].result !== 'object') throw Error('Connection unavailable')
    return rows[0].result
  }
  return createGscLifecycle({ store, cipher: tokenCipher(config.key), provider: googleProvider(config) })
}
let lifecycle: ReturnType<typeof createDeploymentGsc> | undefined
export function deploymentGsc() { lifecycle ??= createDeploymentGsc(); return lifecycle }
