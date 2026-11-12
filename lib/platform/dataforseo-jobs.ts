import 'server-only'
import type { DataForSeoJob, MentionEvidence } from './dataforseo-types'
export type JobInput = { domain: string; platform: 'google' | 'chat_gpt'; jobId: string }
export type JobLease = { lease: string; domain: string; platform: 'google' | 'chat_gpt'; rowLimit: number }
// Every store instance must bind the verified actor and workspace server-side.
export type DataForSeoJobStore = {
  enqueue(input: JobInput): Promise<DataForSeoJob>;
  start(jobId: string): Promise<JobLease | null>;
  complete(jobId: string, lease: string, evidence: MentionEvidence): Promise<void>;
  fail(jobId: string, lease: string, reason: 'unavailable'): Promise<void>;
  read(jobId: string): Promise<DataForSeoJob>;
}
export class DataForSeoJobUnavailable extends Error {
  constructor() { super('AI visibility job is unavailable. No automatic provider retry was attempted.') }
}
export async function enqueueDataForSeoJob(input: JobInput, store: DataForSeoJobStore) {
  // Enqueue never contacts the paid provider. The UI may safely recover via read.
  return store.enqueue(input)
}
export async function executeDataForSeoJob(jobId: string, deps: {
  store: DataForSeoJobStore;
  run(input: JobInput): Promise<MentionEvidence>;
}): Promise<DataForSeoJob> {
  const { store } = deps
  const lease = await store.start(jobId)
  if (!lease) return store.read(jobId)
  try {
    const evidence = await deps.run({jobId,domain:lease.domain,platform:lease.platform})
    // Never expose in-memory evidence. Durable completion and a fresh authorized
    // read are required, including when authorization changes during the request.
    await store.complete(jobId, lease.lease, evidence)
  } catch {
    // Completion may already have committed. Read first; never repeat a paid POST.
    try { const current = await store.read(jobId); if (current.state === 'completed') return current } catch { /* No fallback evidence. */ }
    try { await store.fail(jobId, lease.lease, 'unavailable') } catch { /* Durable running state still cannot be reclaimed. */ }
    throw new DataForSeoJobUnavailable()
  }
  return store.read(jobId)
}
