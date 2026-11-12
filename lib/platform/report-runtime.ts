import 'server-only'
import postgres from 'postgres'
import { createReportService, type ReportStore } from './report-service'
import { deploymentGsc } from './gsc-runtime'

export function readReportConfig(env: Record<string, string | undefined> = process.env) {
  if (env.VERCEL !== '1' || env.VERCEL_ENV !== 'production' || env.PIC_SHAW_AUTH_ORIGIN !== 'https://app.picshaw.com' || env.PIC_SHAW_REPORTS_ENABLED !== 'true' || env.PIC_SHAW_AUTH_SESSION_ENABLED !== 'true' || env.PIC_SHAW_WORKSPACE_ENABLED !== 'true' || env.PIC_SHAW_GSC_ENABLED !== 'true') return null
  const ref = /^https:\/\/([a-z]{20})\.supabase\.co\/?$/.exec(env.NEXT_PUBLIC_SUPABASE_URL ?? '')?.[1]
  const host = env.PIC_SHAW_REPORTS_DB_HOST ?? '', password = env.PIC_SHAW_REPORTS_DB_PASSWORD ?? ''
  if (!ref || !/^[a-z0-9]+(?:-[a-z0-9]+)*\.pooler\.supabase\.com$/.test(host) || password.length < 32 || password.length > 256) return null
  return { host, password, user: `picshaw_reports.${ref}` }
}
export function createDeploymentReports(env: Record<string, string | undefined> = process.env) {
  const config = readReportConfig(env), lifecycle = config ? deploymentGsc() : null
  if (!config || !lifecycle) return null
  const sql = postgres({ host: config.host, port: 6543, database: 'postgres', username: config.user, password: config.password,
    ssl: { rejectUnauthorized: true }, prepare: false, max: 2, max_pipeline: 1, connect_timeout: 2, queue_timeout: 2,
    query_timeout: 5, cancel_timeout: 1, idle_timeout: 10, max_lifetime: 60, fetch_types: false, onnotice: () => {}, debug: false })
  const store: ReportStore = async ({ actor, organizationId }, operation, payload) => {
    const rows = await sql`select picshaw_reports_private.operation(${actor.id}::uuid,${actor.sessionId}::uuid,${actor.expiresAt}::bigint,
      ${organizationId}::uuid,${operation}::text,${JSON.stringify(payload)}::jsonb) as result`.signal(AbortSignal.timeout(6000))
    if (rows.length !== 1) throw Error('Report unavailable')
    return rows[0].result
  }
  return createReportService({ store, lifecycle })
}
let reports: ReturnType<typeof createDeploymentReports> | undefined
export function deploymentReports() { reports ??= createDeploymentReports(); return reports }
