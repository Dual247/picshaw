import 'server-only'

// Deliberately not imported by a route. See docs/dataforseo-integration.md before activation.
const ENDPOINT = 'https://api.dataforseo.com/v3/ai_optimization/llm_mentions/search_mentions/live'
const MAX_BYTES = 2 * 1024 * 1024
export class DataForSeoError extends Error {
  constructor(public readonly code: 'DISABLED' | 'INVALID_INPUT' | 'NOT_CONFIGURED' | 'BUDGET_OR_DUPLICATE' | 'UNAVAILABLE' | 'INVALID_RESPONSE') {
    super('AI visibility data is unavailable. No visibility score has been inferred.')
  }
}
export type MentionInput = { domain: string; platform: 'google' | 'chat_gpt'; limit?: number }
export type MentionPlan = { domain: string; platform: 'google' | 'chat_gpt'; limit: number; estimatedMaxUsd: number }
export type { Citation, MentionEvidence } from './dataforseo-types'
import type { Citation, MentionEvidence } from './dataforseo-types'
// Must be durable and atomic across instances. A claim is permanent even on timeout:
// retrying an uncertain POST can incur a second charge. Never implement with an in-memory Map.
export type SpendLedger = {
  reserve(input: { workspaceId: string; jobId: string; estimatedMaxUsd: number; fingerprint: string }): Promise<boolean>;
  settle(input: { workspaceId: string; jobId: string; chargedUsd: number; outcome: 'confirmed' | 'uncertain' }): Promise<void>;
}
function fail(code: ConstructorParameters<typeof DataForSeoError>[0]): never { throw new DataForSeoError(code) }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_RESPONSE')
  return value as Record<string, unknown>
}
function nonnegative(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) fail('INVALID_RESPONSE')
  return value
}
function integer(value: unknown): number { const n = nonnegative(value); if (!Number.isSafeInteger(n)) fail('INVALID_RESPONSE'); return n }
function short(value: unknown, max: number): string | null { return typeof value === 'string' ? value.slice(0, max) : null }
function publicDomain(value: string): boolean {
  return value.length <= 63 && value.includes('.') && /^[a-z0-9.-]+$/.test(value) &&
    !/^[\d.]+$/.test(value) && !/(^|\.)(localhost|local|internal|test|invalid|onion|home|lan)$/.test(value) &&
    value.split('.').every(label => !!label && !label.startsWith('-') && !label.endsWith('-'))
}
export function planMentions(input: MentionInput): MentionPlan {
  if (!input || typeof input.domain !== 'string' || !['google', 'chat_gpt'].includes(input.platform)) fail('INVALID_INPUT')
  const domain = input.domain.toLowerCase().replace(/^www\./, '')
  const limit = input.limit ?? 20
  if (!publicDomain(domain) || !Number.isInteger(limit) || limit < 1 || limit > 100) fail('INVALID_INPUT')
  // Published rate verified 2026-11-12. Estimate, not a provider billing cap.
  return { domain, platform: input.platform, limit, estimatedMaxUsd: (100 + limit) / 1000 }
}
function citation(value: unknown): Citation | null {
  const row = record(value)
  if (typeof row.url !== 'string' || row.url.length > 2048) return null
  try {
    const url = new URL(row.url)
    if (url.protocol !== 'https:' || url.username || url.password || !publicDomain(url.hostname)) return null
    return { url: url.href, title: short(row.title, 300) }
  } catch { return null }
}
export function normalizeMentions(value: unknown, plan: MentionPlan): MentionEvidence {
  const envelope = record(value)
  if (envelope.status_code !== 20000 || envelope.tasks_error !== 0 || envelope.tasks_count !== 1 || !Array.isArray(envelope.tasks) || envelope.tasks.length !== 1) fail('INVALID_RESPONSE')
  const task = record(envelope.tasks[0])
  if (task.status_code !== 20000 || typeof task.id !== 'string' || !task.id || task.id.length > 100 || !Array.isArray(task.result) || task.result.length !== 1) fail('INVALID_RESPONSE')
  const data = record(task.data)
  if (data.platform !== plan.platform || data.location_code !== 2840 || data.language_code !== 'en' || data.limit !== plan.limit || !Array.isArray(data.target) || data.target.length !== 1) fail('INVALID_RESPONSE')
  const target = record(data.target[0])
  if (target.domain !== plan.domain || target.search_filter !== 'include' || target.include_subdomains !== true || !Array.isArray(target.search_scope) || target.search_scope.length !== 1 || target.search_scope[0] !== 'sources') fail('INVALID_RESPONSE')
  const cost = nonnegative(envelope.cost)
  if (nonnegative(task.cost) !== cost) fail('INVALID_RESPONSE')
  const result = record(task.result[0])
  const count = integer(result.items_count), total = integer(result.total_count)
  const rows = result.items === null && count === 0 ? [] : result.items
  if (!Array.isArray(rows) || rows.length !== count || count > plan.limit || total < count) fail('INVALID_RESPONSE')
  const items = rows.map(value => {
    const row = record(value)
    if (row.platform !== plan.platform || row.location_code !== 2840 || row.language_code !== 'en' || typeof row.question !== 'string') fail('INVALID_RESPONSE')
    if (row.sources !== null && !Array.isArray(row.sources)) fail('INVALID_RESPONSE')
    return { question: row.question.slice(0, 1000), model: short(row.model_name, 100), observedAt: short(row.last_response_at, 100),
      citations: Array.isArray(row.sources) ? row.sources.slice(0, 100).map(citation).filter((item): item is Citation => item !== null) : [] }
  })
  return { source: 'dataforseo-llm-mentions', domain: plan.domain, platform: plan.platform, locationCode: 2840, languageCode: 'en', retrievedAt: new Date().toISOString(), providerTaskId: task.id,
    actualCostUsd: cost, totalMatches: total, sampledRows: items.length, items,
    limitations: ['Database sample for United States / English; not a live test of every answer or every customer location.', 'No matching records does not establish zero AI visibility. Retrieved time is not the time the model produced its answer.', 'Source citations are evidence, not a ranking or guaranteed recommendation. No score or traffic forecast has been inferred.'] }
}
async function boundedJson(response: Response): Promise<unknown> {
  if (!response.ok || !response.body || !/^application\/json\b/i.test(response.headers.get('content-type') ?? '')) fail('UNAVAILABLE')
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break
      bytes += part.value.byteLength
      if (bytes > MAX_BYTES) { void reader.cancel().catch(() => {}); fail('INVALID_RESPONSE') }
      chunks.push(part.value)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } finally { reader.releaseLock() }
}
export async function fetchMentions(input: MentionInput, options: {
  enabled: boolean; consentToDataForSeo: boolean; login?: string; password?: string;
  workspaceId: string; jobId: string; ledger: SpendLedger; transport?: typeof fetch;
}): Promise<MentionEvidence> {
  if (options.enabled !== true) fail('DISABLED')
  if (options.consentToDataForSeo !== true || !/^[a-zA-Z0-9_-]{1,100}$/.test(options.workspaceId) || !/^[a-zA-Z0-9_-]{1,100}$/.test(options.jobId)) fail('INVALID_INPUT')
  const plan = planMentions(input)
  if (!options.login || !options.password || /[:\r\n]/.test(options.login) || /[\r\n]/.test(options.password)) fail('NOT_CONFIGURED')
  const task = { target: [{ domain: plan.domain, search_filter: 'include', search_scope: ['sources'], include_subdomains: true }], platform: plan.platform, location_code: 2840, language_code: 'en', limit: plan.limit }
  if (!await options.ledger.reserve({ workspaceId: options.workspaceId, jobId: options.jobId, estimatedMaxUsd: plan.estimatedMaxUsd, fingerprint: JSON.stringify(task) })) fail('BUDGET_OR_DUPLICATE')
  let evidence: MentionEvidence | undefined
  try {
    const response = await (options.transport ?? fetch)(ENDPOINT, { method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(125_000),
      headers: { Authorization: `Basic ${Buffer.from(`${options.login}:${options.password}`).toString('base64')}`, 'Content-Type': 'application/json' }, body: JSON.stringify([task]) })
    evidence = normalizeMentions(await boundedJson(response), plan)
  } catch {
    // Reserve remains consumed if settlement itself fails. No retry or raw error disclosure.
    try { await options.ledger.settle({ workspaceId: options.workspaceId, jobId: options.jobId, chargedUsd: plan.estimatedMaxUsd, outcome: 'uncertain' }) } catch { /* Keep durable reservation. */ }
    fail('UNAVAILABLE')
  }
  try { await options.ledger.settle({ workspaceId: options.workspaceId, jobId: options.jobId, chargedUsd: evidence.actualCostUsd, outcome: 'confirmed' }) } catch { fail('UNAVAILABLE') }
  return evidence
}
