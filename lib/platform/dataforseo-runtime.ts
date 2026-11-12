import 'server-only'
import postgres from 'postgres'
import { createSupabasePoolerTls } from '../supabase/database-tls'
import type { WorkspaceActor } from '../supabase/workspace-runtime'
import { fetchMentions, planMentions, type MentionEvidence, type SpendLedger } from './dataforseo-provider'

type Environment = Record<string, string | undefined>
export type DataForSeoRun = (input: { actor: WorkspaceActor; workspaceId: string; domain: string; platform: 'google' | 'chat_gpt'; jobId: string }) => Promise<MentionEvidence>
// Convert the JSON decimal representation, not its binary float product. SQL
// validates the same JSON numeric value; both round upward to a microdollar.
export function dataForSeoMicros(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000) throw Error('Invalid cost')
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(String(value))
  if (!match) throw Error('Invalid cost')
  const digits = (match[1] + (match[2] ?? '')).replace(/^0+/, '') || '0'
  const shift = 6 + Number(match[3] ?? 0) - (match[2]?.length ?? 0)
  if (shift >= 0) return Number(digits + '0'.repeat(shift))
  const cut = digits.length + shift
  if (cut <= 0) return digits === '0' ? 0 : 1
  return Number(digits.slice(0,cut)) + (/[1-9]/.test(digits.slice(cut)) ? 1 : 0)
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// No credentials are loaded unless all deployment gates are explicitly configured.
// This module has no route consumer; provisioning and publication require separate approval.
export function createDataForSeoRun(env: Environment = process.env): DataForSeoRun | null {
  if (env.VERCEL !== '1' || env.VERCEL_ENV !== 'production' || env.PIC_SHAW_AUTH_ORIGIN !== 'https://app.picshaw.com' || env.PIC_SHAW_PORTAL_ACCESS_MODE !== 'pilot' || env.PIC_SHAW_DATAFORSEO_ENABLED !== 'true') return null
  const ref = /^https:\/\/([a-z]{20})\.supabase\.co\/?$/.exec(env.NEXT_PUBLIC_SUPABASE_URL ?? '')?.[1]
  const host = env.PIC_SHAW_DATAFORSEO_DB_HOST ?? ''
  const dbPassword = env.PIC_SHAW_DATAFORSEO_DB_PASSWORD ?? ''
  const login = env.DATAFORSEO_LOGIN, password = env.DATAFORSEO_PASSWORD
  if (!ref || !/^[a-z0-9]+(?:-[a-z0-9]+)*\.pooler\.supabase\.com$/.test(host) || dbPassword.length < 32 || dbPassword.length > 256 || !login || !password) return null
  const domains = (env.PIC_SHAW_DATAFORSEO_APPROVED_DOMAINS ?? '').split(',')
  try { if (!domains.length || domains.length > 20 || domains.some(domain => planMentions({domain,platform:'google'}).domain !== domain)) return null } catch { return null }
  const sql = postgres({ host, port: 6543, database: 'postgres', username: `picshaw_dataforseo.${ref}`, password: dbPassword,
    ssl: createSupabasePoolerTls(host), prepare: false, max: 2, max_pipeline: 1, connect_timeout: 2, queue_timeout: 2,
    query_timeout: 3, cancel_timeout: 1, idle_timeout: 10, max_lifetime: 60, fetch_types: false, onnotice: () => {}, debug: false })
  return async ({actor,workspaceId,domain,platform,jobId}) => {
    if (![actor.id,actor.sessionId,workspaceId,jobId].every(id => uuid.test(id)) || !Number.isSafeInteger(actor.expiresAt) || actor.expiresAt <= Date.now()/1000) throw Error('Data unavailable')
    const plan = planMentions({domain,platform,limit:20})
    if (!domains.includes(plan.domain)) throw Error('Data unavailable')
    const ledger: SpendLedger = {
      reserve: async input => {
        if (input.workspaceId !== workspaceId || input.jobId !== jobId) throw Error('Data unavailable')
        const rows = await sql`select picshaw_dataforseo_private.reserve(${actor.id}::uuid, ${actor.sessionId}::uuid, ${actor.expiresAt}::bigint,
          ${workspaceId}::uuid, ${jobId}::text, ${dataForSeoMicros(input.estimatedMaxUsd)}::bigint, ${input.fingerprint}::text) as allowed`.signal(AbortSignal.timeout(4000))
        return rows.length === 1 && rows[0].allowed === true
      },
      settle: async input => {
        if (input.workspaceId !== workspaceId || input.jobId !== jobId || !Number.isFinite(input.chargedUsd) || input.chargedUsd < 0) throw Error('Data unavailable')
        await sql`select picshaw_dataforseo_private.settle(${actor.id}::uuid, ${actor.sessionId}::uuid, ${actor.expiresAt}::bigint,
          ${workspaceId}::uuid, ${jobId}::text, ${dataForSeoMicros(input.chargedUsd)}::bigint, ${input.outcome}::text)`.signal(AbortSignal.timeout(4000))
      },
    }
    return fetchMentions({domain:plan.domain,platform,limit:20}, {enabled:true,consentToDataForSeo:true,login,password,workspaceId,jobId,ledger})
  }
}
