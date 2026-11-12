import 'server-only'
import { completedWindows, PlatformError } from './core'
import { createSearchJourney, restoreReviewedBundle, type ReviewedSnapshotBundle } from './journey'
import type { GscIdentity, createGscLifecycle } from './gsc-lifecycle'

export type ReportStore = (identity: GscIdentity, operation: 'claim' | 'complete' | 'fail' | 'read' | 'status', payload: Record<string, unknown>) => Promise<unknown>
export type PrivateReport = { reportId: string; runId: string; review: ReviewedSnapshotBundle }
export type ReportStatus = { state: 'running' | 'failed' | 'completed'; reportId: string; startedAt: string; leaseUntil: string | null } | null
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const unavailable = () => new PlatformError('REPORT_UNAVAILABLE', 'Your report is unavailable. Check status before retrying.')
function safeReport(value: unknown, identity: GscIdentity): PrivateReport | null {
  if (value === null) return null
  if (!record(value) || typeof value.reportId !== 'string' || !uuid.test(value.reportId) || typeof value.runId !== 'string' || !uuid.test(value.runId)) throw unavailable()
  const review = restoreReviewedBundle(value.review)
  if (review.selection.organizationId !== identity.organizationId || review.runId !== value.runId) throw unavailable()
  return { reportId: value.reportId, runId: value.runId, review }
}
export function createReportService(deps: { store: ReportStore; lifecycle: ReturnType<typeof createGscLifecycle>; now?: () => Date }) {
  const { store, lifecycle, now = () => new Date() } = deps
  return {
    async read(identity: GscIdentity, reportId?: string) {
      if (reportId !== undefined && !uuid.test(reportId)) throw unavailable()
      return safeReport(await store(identity, 'read', reportId ? { report: reportId } : {}), identity)
    },
    async status(identity: GscIdentity): Promise<ReportStatus> {
      const value = await store(identity, 'status', {})
      if (value === null) return null
      if (!record(value) || !['running','failed','completed'].includes(String(value.state)) || typeof value.reportId !== 'string' || !uuid.test(value.reportId) || typeof value.startedAt !== 'string' || !Number.isFinite(Date.parse(value.startedAt)) || (value.leaseUntil !== null && (typeof value.leaseUntil !== 'string' || !Number.isFinite(Date.parse(value.leaseUntil))))) throw unavailable()
      return { state: value.state as NonNullable<ReportStatus>['state'], reportId: value.reportId, startedAt: value.startedAt, leaseUntil: value.leaseUntil as string | null }
    },
    async sync(identity: GscIdentity): Promise<{ state: 'completed'; report: PrivateReport } | { state: 'busy' } | { state: 'unavailable' }> {
      const selected = await lifecycle.status(identity)
      if (selected.status !== 'active' || !selected.connectionId || !selected.selectedProperty) throw new PlatformError('CONNECTION_REQUIRED', 'Connect Search Console and select a property first.')
      const windowEnd = completedWindows(now(), 28, 3).current.end
      // Browser supplies no tenant, plan, operation, lease, timestamp or artifact IDs.
      const claim = await store(identity, 'claim', { connection: selected.connectionId, property: selected.selectedProperty, windowEnd })
      if (!record(claim) || typeof claim.reportId !== 'string' || !uuid.test(claim.reportId)) throw unavailable()
      if (claim.state === 'busy') return { state: 'busy' }
      if (claim.state === 'completed') {
        const report = safeReport(await store(identity, 'read', { report: claim.reportId }), identity)
        if (!report) throw unavailable()
        return { state: 'completed', report }
      }
      if (claim.state !== 'running' || typeof claim.operationId !== 'string' || !uuid.test(claim.operationId) || typeof claim.lease !== 'string' || !uuid.test(claim.lease) || typeof claim.runId !== 'string' || !uuid.test(claim.runId) || !Array.isArray(claim.snapshotIds) || claim.snapshotIds.length !== 6 || claim.snapshotIds.some(id => typeof id !== 'string' || !uuid.test(id)) || typeof claim.startedAt !== 'string' || !Number.isFinite(Date.parse(claim.startedAt)) || !record(claim.selection) || claim.selection.organizationId !== identity.organizationId || claim.selection.connectionId !== selected.connectionId || claim.selection.propertyId !== selected.selectedProperty) throw unavailable()
      const binding = { operation: claim.operationId, lease: claim.lease }
      let completing = false
      try {
        const reader = await lifecycle.snapshotReader(identity, selected.connectionId)
        const ids = [claim.runId, ...claim.snapshotIds] as string[]
        let index = 0
        const review = await createSearchJourney({ reader, resolver: lifecycle.journeyResolver(identity),
          now: () => new Date(claim.startedAt as string), newId: () => ids[index++], days: 28, lagDays: 3, maxPages: 1,
        }).run({ organizationId: identity.organizationId, connectionId: selected.connectionId, propertyId: selected.selectedProperty })
        if (review.status === 'unavailable') {
          await store(identity, 'fail', binding)
          return { state: 'unavailable' }
        }
        const safe = restoreReviewedBundle(review)
        if (safe.windows.current.end !== claim.windowEnd) throw unavailable()
        completing = true
        await store(identity, 'complete', { ...binding, review: safe })
        // Recheck current authority after completion; never leak a revoked result.
        const report = safeReport(await store(identity, 'read', { report: claim.reportId }), identity)
        if (!report) throw unavailable()
        return { state: 'completed', report }
      } catch {
        // A lost COMMIT reply is uncertain. Do not mark failed or mint a new run.
        // Next sync asks the durable claim first and returns its existing report.
        if (!completing) { try { await store(identity, 'fail', binding) } catch {} }
        throw unavailable()
      }
    },
  }
}
