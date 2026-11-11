import 'server-only'
import { randomUUID } from 'node:crypto'
import {
  GSC_TIMEZONE, PlatformError, aggregate, buildActions, completedWindows, validateWindow,
  type Action, type Metrics, type Observation, type Snapshot, type Window,
} from './core'
import type { createGscAdapter } from './gsc'

type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T
type Period = 'current' | 'prior'
type Grain = 'aggregate' | 'daily' | 'page'
type SnapshotSet = Record<Grain, Snapshot>
type SnapshotRequest = Parameters<ReturnType<typeof createGscAdapter>['readSnapshot']>[0]
export type JourneySelection = { organizationId: string; connectionId: string; propertyId: string }
export type JourneyContext = JourneySelection & { actorId: string }
export interface JourneyResolver {
  // Authenticate from the server session, then check membership, connection ownership and
  // selected property. Never derive actorId from the browser or return a token here.
  resolve(selection: Readonly<JourneySelection>): Promise<JourneyContext | null>
}
export type JourneyDependencies = {
  resolver: JourneyResolver
  reader: Pick<ReturnType<typeof createGscAdapter>, 'readSnapshot'>
  // Server-owned dependencies only, never request parameters. Defaults mint UUIDs and
  // request 28 Pacific-calendar days with a conservative three-day lag.
  newId?: () => string
  now?: () => Date
  days?: number
  lagDays?: number
  maxPages?: number
}
export type CoverageReview = {
  status: 'complete' | 'unknown' | 'bounded' | 'inconsistent'
  missingDates: string[]
  reasons: ('MISSING_DATES' | 'MISSING_TOTALS' | 'BOUNDED_SOURCE' | 'TOTALS_MISMATCH' | 'CONFLICTING_ACTIVITY')[]
}
type PropertyTotal = { snapshotId: string; status: 'available' | 'missing' | 'bounded'; metrics: Metrics | null }
type Change = { absolute: number; relative: number | null }
export type PropertyComparison = {
  clicks: Change; impressions: Change; ctrPercentagePoints: number; positionChange: number | null
}
export type ReviewedSnapshotBundle = DeepReadonly<{
  version: 1
  selection: JourneySelection
  runId: string
  windows: Record<Period, Window>
  snapshots: Record<Period, SnapshotSet>
  totals: Record<Period, PropertyTotal>
  coverage: Record<Period, CoverageReview>
  status: 'ready' | 'empty' | 'incomplete' | 'inconsistent'
  comparison: PropertyComparison | null
  actions: Action[]
  disclaimer: string
}>
export type JourneyFailure = DeepReadonly<{
  status: 'unavailable'; code: string; message: string; comparison: null; actions: []
}>
export type JourneyResult = ReviewedSnapshotBundle | JourneyFailure

const periods: Period[] = ['current', 'prior']
const grains: Grain[] = ['aggregate', 'daily', 'page']
const dimensions: Record<Grain, Snapshot['dimensions']> = { aggregate: [], daily: ['date'], page: ['page'] }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const day = 86_400_000
const disclaimer = 'Final Google Web Search observations only. Daily coverage is checked against separately fetched property totals; available page rows are not exhaustive. Missing dates are unknown, not zero. Review actions do not establish cause, leads, revenue or AI visibility.'
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function fail(code = 'INVALID_SNAPSHOT'): never {
  throw new PlatformError(code, 'Search Console snapshot validation failed.')
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}
function validId(value: unknown): value is string { return typeof value === 'string' && uuid.test(value) }
function validProperty(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 2048 || /[\u0000-\u0020]/.test(value)) return false
  try {
    const domain = value.startsWith('sc-domain:')
    const url = new URL(domain ? `https://${value.slice(10)}` : value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash && (!domain || (!url.port && url.pathname === '/' && value.slice(10) === url.hostname))
  } catch { return false }
}
function sameWindow(a: Window, b: Window) { return a.start === b.start && a.end === b.end }
function dates(window: Window): string[] {
  const result: string[] = []
  for (let t = Date.parse(window.start); t <= Date.parse(window.end); t += day) result.push(new Date(t).toISOString().slice(0, 10))
  return result
}
function close(a: number, b: number, tolerance = 1e-9) { return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b)) }
function metrics(value: unknown): Metrics {
  if (!record(value)) fail()
  const { clicks, impressions, ctr, position } = value
  if (typeof clicks !== 'number' || typeof impressions !== 'number' || !Number.isSafeInteger(clicks) || !Number.isSafeInteger(impressions) || clicks < 0 || impressions < clicks || typeof ctr !== 'number' || !Number.isFinite(ctr) || ctr < 0 || ctr > 1 || !close(ctr, impressions ? clicks / impressions : 0)) fail()
  if (impressions === 0 ? position !== null : typeof position !== 'number' || !Number.isFinite(position) || position < 1) fail()
  return { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position: position as number | null }
}
// A strict allowlist creates detached copies and strips any unexpected credential fields.
// TypeScript types alone cannot validate persisted/provider/runtime values.
function copySnapshot(value: unknown, expected: SnapshotRequest): Snapshot {
  if (!record(value)) fail()
  for (const [key, wanted] of Object.entries({ id: expected.snapshotId, organizationId: expected.organizationId, propertyId: expected.propertyId, runId: expected.runId, source: 'google-search-console', timezone: GSC_TIMEZONE, searchType: 'web', dataState: 'final' })) {
    if (value[key] !== wanted) fail('SNAPSHOT_MISMATCH')
  }
  if (!record(value.window) || value.window.start !== expected.window.start || value.window.end !== expected.window.end || !Array.isArray(value.dimensions) || JSON.stringify(value.dimensions) !== JSON.stringify(expected.dimensions) || !Array.isArray(value.filters) || value.filters.length !== 0) fail('SNAPSHOT_MISMATCH')
  if (typeof value.retrievedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.retrievedAt) || !Number.isFinite(Date.parse(value.retrievedAt)) || new Date(value.retrievedAt).toISOString() !== value.retrievedAt || (value.coverage !== 'available-rows' && value.coverage !== 'bounded') || !Array.isArray(value.warnings) || value.warnings.some(warning => typeof warning !== 'string') || !Array.isArray(value.rows) || value.rows.length > (expected.maxPages ?? 4) * 1000) fail()
  if (completedWindows(new Date(value.retrievedAt), 1, 1).current.end < expected.window.end) fail()
  if (expected.dimensions.length === 0 && value.rows.length > 1) fail()
  const seen = new Set<string>()
  const rows = value.rows.map((raw): Observation => {
    if (!record(raw) || !Array.isArray(raw.keys) || raw.keys.length !== expected.dimensions.length || raw.keys.some(key => typeof key !== 'string' || !key)) fail()
    const keys = raw.keys as string[]
    const key = JSON.stringify(keys)
    if (seen.has(key)) fail()
    seen.add(key)
    if (expected.dimensions[0] === 'date' && !dates(expected.window).includes(keys[0])) fail()
    if (expected.dimensions[0] === 'page') {
      try {
        const url = new URL(keys[0])
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || /[\u0000-\u0020]/.test(keys[0])) fail()
        if (expected.propertyId.startsWith('sc-domain:')) {
          const domain = expected.propertyId.slice(10)
          if (url.hostname !== domain && !url.hostname.endsWith(`.${domain}`)) fail('SNAPSHOT_MISMATCH')
        } else if (!url.href.startsWith(new URL(expected.propertyId).href)) fail('SNAPSHOT_MISMATCH')
      } catch { fail() }
    }
    return { keys: [...keys], ...metrics(raw) }
  })
  return deepFreeze({
    id: expected.snapshotId, organizationId: expected.organizationId, propertyId: expected.propertyId,
    runId: expected.runId, source: 'google-search-console', retrievedAt: value.retrievedAt,
    timezone: GSC_TIMEZONE, window: { ...expected.window }, searchType: 'web', filters: [],
    dimensions: [...expected.dimensions], dataState: 'final', coverage: value.coverage as Snapshot['coverage'],
    warnings: [...value.warnings] as string[], rows,
  })
}
function propertyTotal(snapshot: Snapshot): PropertyTotal {
  return {
    snapshotId: snapshot.id,
    status: snapshot.coverage === 'bounded' ? 'bounded' : snapshot.rows.length ? 'available' : 'missing',
    metrics: snapshot.rows.length ? metrics(snapshot.rows[0]) : null,
  }
}
function reviewCoverage(set: SnapshotSet): CoverageReview {
  const present = new Set(set.daily.rows.map(row => row.keys[0]))
  const missingDates = dates(set.daily.window).filter(date => !present.has(date))
  const reasons: CoverageReview['reasons'] = []
  const total = propertyTotal(set.aggregate).metrics
  if (missingDates.length) reasons.push('MISSING_DATES')
  if (!total) reasons.push('MISSING_TOTALS')
  if (grains.some(grain => set[grain].coverage === 'bounded')) reasons.push('BOUNDED_SOURCE')
  // Daily/property aggregation is comparable; page sums intentionally never participate.
  // Without every date, equal totals alone cannot establish completeness.
  if (total && !missingDates.length) {
    const daily = aggregate(set.daily.rows)
    if (daily.clicks !== total.clicks || daily.impressions !== total.impressions || (daily.position === null || total.position === null ? daily.position !== total.position : !close(daily.position, total.position, 1e-6))) reasons.push('TOTALS_MISMATCH')
    // A literal zero cannot coexist with observed activity at any grain. This does
    // not require page sums (or positive page totals) to equal property totals.
    if (set.page.rows.some(row => (total.impressions === 0 && row.impressions > 0) || (total.clicks === 0 && row.clicks > 0))) reasons.push('CONFLICTING_ACTIVITY')
  }
  const status = reasons.includes('TOTALS_MISMATCH') || reasons.includes('CONFLICTING_ACTIVITY') ? 'inconsistent' : reasons.includes('BOUNDED_SOURCE') ? 'bounded' : reasons.length ? 'unknown' : 'complete'
  return { status, missingDates, reasons }
}
function difference(current: number, prior: number): Change { return { absolute: current - prior, relative: prior > 0 ? (current - prior) / prior : null } }
function reviewBundle(selection: JourneySelection, runId: string, windows: Record<Period, Window>, snapshots: Record<Period, SnapshotSet>): ReviewedSnapshotBundle {
  // Defense in depth for the run manifest, independent of the request planner.
  for (const period of periods) validateWindow(windows[period])
  if (Date.parse(windows.current.start) - Date.parse(windows.prior.end) !== day || dates(windows.current).length !== dates(windows.prior).length || periods.some(period => grains.some(grain => !sameWindow(snapshots[period][grain].window, windows[period])))) fail('SNAPSHOT_MISMATCH')
  const coverage = { current: reviewCoverage(snapshots.current), prior: reviewCoverage(snapshots.prior) }
  const totals = { current: propertyTotal(snapshots.current.aggregate), prior: propertyTotal(snapshots.prior.aggregate) }
  const complete = periods.every(period => coverage[period].status === 'complete')
  const inconsistent = periods.some(period => coverage[period].status === 'inconsistent')
  const current = totals.current.metrics, prior = totals.prior.metrics
  const comparison = complete && current && prior ? {
    clicks: difference(current.clicks, prior.clicks), impressions: difference(current.impressions, prior.impressions),
    ctrPercentagePoints: (current.ctr - prior.ctr) * 100,
    positionChange: current.position !== null && prior.position !== null ? current.position - prior.position : null,
  } : null
  const empty = complete && current?.impressions === 0 && prior?.impressions === 0 && periods.every(period => snapshots[period].page.rows.length === 0)
  // The core action rules are only reached after this stronger source/coverage review.
  const actions = complete && !empty ? buildActions(snapshots.current.page, snapshots.prior.page) : []
  return deepFreeze({ version: 1, selection: { ...selection }, runId, windows, snapshots, totals, coverage,
    status: inconsistent ? 'inconsistent' : !complete ? 'incomplete' : empty ? 'empty' : 'ready',
    comparison, actions, disclaimer })
}
const failureCodes = new Set(['RECONNECT_REQUIRED', 'PROPERTY_ACCESS_DENIED', 'RATE_LIMITED', 'PROVIDER_UNAVAILABLE', 'INVALID_RESPONSE', 'INVALID_SNAPSHOT', 'SNAPSHOT_MISMATCH'])

/** No route, storage, token handling or default provider transport is installed here. */
export function createSearchJourney(dependencies: JourneyDependencies) {
  const { resolver, reader, newId = randomUUID, now = () => new Date(), days = 28, lagDays = 3, maxPages = 4 } = dependencies
  return {
    async run(input: JourneySelection): Promise<JourneyResult> {
      if (!record(input) || !validId(input.organizationId) || !validId(input.connectionId) || !validProperty(input.propertyId)) throw new PlatformError('INVALID_REQUEST', 'A valid workspace, connection and property selection is required.')
      const selection = deepFreeze({ organizationId: input.organizationId, connectionId: input.connectionId, propertyId: input.propertyId })
      let context: JourneyContext | null
      try { context = await resolver.resolve(selection) } catch { throw new PlatformError('UNAUTHORIZED', 'Workspace authorization could not be established.') }
      if (!context || !validId(context.actorId) || context.organizationId !== selection.organizationId || context.connectionId !== selection.connectionId || context.propertyId !== selection.propertyId) throw new PlatformError('UNAUTHORIZED', 'Workspace authorization could not be established.')
      // Only the authenticated actor primitive crosses the resolver boundary. No tokens,
      // mutable resolver object, or caller-supplied run/snapshot IDs are retained.
      const actorId = context.actorId
      const windows = deepFreeze(completedWindows(now(), days, lagDays))
      if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 10) throw new PlatformError('INVALID_REQUEST', 'Pagination limit must be 1-10.')
      const issued = new Set<string>()
      const mint = () => { const id = newId(); if (!validId(id) || issued.has(id)) throw new PlatformError('INVALID_ID', 'The server ID factory must issue unique UUIDs.'); issued.add(id); return id }
      const runId = mint()
      // Mint every ID before reading so an invalid factory cannot partially execute a run.
      const plan = periods.flatMap(period => grains.map(grain => ({ period, grain, request: deepFreeze({
        actorId, ...selection, runId, snapshotId: mint(), window: { ...windows[period] }, dimensions: [...dimensions[grain]], maxPages,
      }) })))
      const snapshots = { current: {}, prior: {} } as Record<Period, SnapshotSet>
      try {
        for (const { period, grain, request } of plan) {
          // Sequential, bounded reads stop at the first failure. No partial result or demo
          // substitute is returned. Copy immediately before any later asynchronous read.
          snapshots[period][grain] = copySnapshot(await reader.readSnapshot(request), request)
        }
        return reviewBundle(selection, runId, windows, snapshots)
      } catch (error) {
        if (error instanceof PlatformError && error.code === 'UNAUTHORIZED') throw new PlatformError('UNAUTHORIZED', 'Workspace authorization could not be established.')
        const code = error instanceof PlatformError && failureCodes.has(error.code) ? error.code : 'PROVIDER_UNAVAILABLE'
        return deepFreeze({ status: 'unavailable', code, message: 'Search Console data could not be reviewed. No partial report or substitute data was returned.', comparison: null, actions: [] })
      }
    },
  }
}


