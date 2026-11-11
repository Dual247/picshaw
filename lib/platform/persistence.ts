import 'server-only'
import { randomUUID } from 'node:crypto'
import { PlatformError } from './core'
import { GSC_SCOPE } from './gsc'
import { createSearchJourney, type JourneyDependencies, type JourneyFailure, type JourneySelection, type ReviewedSnapshotBundle } from './journey'

export interface TransactionSql {
  query(sql: string, parameters?: readonly unknown[]): Promise<{ rows: Record<string, unknown>[] }>
}
export interface PinnedSqlSession extends TransactionSql {
  // Return a dedicated session to its pool. true MUST discard a failed/uncertain
  // connection rather than letting another request inherit its transaction.
  release(discard: boolean): void | Promise<void>
}
export interface JourneyDatabase { acquire(): Promise<PinnedSqlSession> }
export type VerifiedSession = Readonly<{ actorId: string; sessionId: string; expiresAt: number }>
export interface SessionAuthority {
  // Fresh server-verified identity, session ID and expiry. May use Auth/network.
  // Never accept browser user/session IDs or unverified JWT claims as authority.
  verify(): Promise<VerifiedSession>
  // REQUIRED database-only check on this transaction. Verify the exact session's
  // current existence, actor, expiry and revocation, holding a conflicting lock
  // against session revocation until COMMIT. No network, writes or transaction
  // control here. There is intentionally no permissive/default implementation.
  lockCurrent(transaction: TransactionSql, identity: VerifiedSession): Promise<VerifiedSession>
}
export type PersistenceDependencies = {
  journey: JourneyDependencies
  database: JourneyDatabase
  authority: SessionAuthority
  now?: () => number
}
export type CommitReceipt = Readonly<{
  status: 'committed' | 'already_committed'
  organizationId: string; runId: string; reportId: string
}>
export type PreparedJourney = Readonly<{
  status: 'prepared'
  review: ReviewedSnapshotBundle
  // A server-local capability, not a serialized browser payload or public action.
  // Reuse this exact handle after failure/uncertainty. Never create a new run as
  // an automatic retry. Each attempt reauthenticates and reauthorizes.
  commit(): Promise<CommitReceipt>
}>
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const unauthorized = () => new PlatformError('UNAUTHORIZED', 'Current workspace and session authority is required.')
async function verify(authority: SessionAuthority, now: () => number): Promise<VerifiedSession> {
  try {
    const identity = await authority.verify()
    if (!identity || typeof identity.actorId !== 'string' || typeof identity.sessionId !== 'string' || !uuid.test(identity.actorId) || !uuid.test(identity.sessionId) || !Number.isSafeInteger(identity.expiresAt) || identity.expiresAt <= now()) throw unauthorized()
    return Object.freeze({ actorId: identity.actorId, sessionId: identity.sessionId, expiresAt: identity.expiresAt })
  } catch { throw unauthorized() }
}
type Artifact = { table: 'source_runs' | 'source_snapshots' | 'recommended_actions' | 'reports'; columns: string[]; rows: Record<string, unknown>[] }
function artifacts(review: ReviewedSnapshotBundle, actorId: string, reportId: string): Artifact[] {
  const { organizationId, connectionId, propertyId } = review.selection
  const common = { organization_id: organizationId, run_id: review.runId, property_id: propertyId }
  const snapshots = (['current', 'prior'] as const).flatMap(period => (['aggregate', 'daily', 'page'] as const).map(grain => {
    const snapshot = review.snapshots[period][grain]
    return {
      ...common, id: snapshot.id, source: snapshot.source, retrieved_at: snapshot.retrievedAt,
      timezone: snapshot.timezone, window_start: snapshot.window.start, window_end: snapshot.window.end,
      search_type: snapshot.searchType, filters: snapshot.filters, dimensions: snapshot.dimensions,
      data_state: snapshot.dataState, coverage: snapshot.coverage, warnings: snapshot.warnings, rows: snapshot.rows,
    }
  }))
  const actions = review.actions.map(action => ({
    ...common, id: action.id, snapshot_id: action.snapshotId, prior_snapshot_id: action.priorSnapshotId,
    rule: action.rule, rule_version: action.ruleVersion, title: action.title, reason: action.reason,
    page: action.page, current_row: action.current, prior_row: action.prior,
  }))
  return [
    { table: 'source_runs', columns: ['organization_id', 'id', 'connection_id', 'property_id', 'current_start', 'current_end', 'prior_start', 'prior_end', 'created_by'], rows: [{
      organization_id: organizationId, id: review.runId, connection_id: connectionId, property_id: propertyId,
      current_start: review.windows.current.start, current_end: review.windows.current.end,
      prior_start: review.windows.prior.start, prior_end: review.windows.prior.end, created_by: actorId,
    }] },
    { table: 'source_snapshots', columns: ['organization_id', 'run_id', 'property_id', 'id', 'source', 'retrieved_at', 'timezone', 'window_start', 'window_end', 'search_type', 'filters', 'dimensions', 'data_state', 'coverage', 'warnings', 'rows'], rows: snapshots },
    { table: 'recommended_actions', columns: ['organization_id', 'run_id', 'property_id', 'id', 'snapshot_id', 'prior_snapshot_id', 'rule', 'rule_version', 'title', 'reason', 'page', 'current_row', 'prior_row'], rows: actions },
    { table: 'reports', columns: ['organization_id', 'run_id', 'property_id', 'id', 'snapshot_id', 'prior_snapshot_id', 'version', 'created_by'], rows: [{
      ...common, id: reportId, snapshot_id: review.snapshots.current.page.id,
      prior_snapshot_id: review.snapshots.prior.page.id, version: review.version, created_by: actorId,
    }] },
  ]
}
// Identifiers are fixed internal allowlists. Only JSON values use parameters.
async function insertArtifact(transaction: TransactionSql, artifact: Artifact) {
  if (!artifact.rows.length) return
  const columns = artifact.columns.map(column => `"${column}"`).join(', ')
  await transaction.query(`insert into public.${artifact.table} (${columns})
    select ${columns} from jsonb_populate_recordset(null::public.${artifact.table}, $1::jsonb)`, [JSON.stringify(artifact.rows)])
}
async function exactReplay(transaction: TransactionSql, expected: Artifact[], organizationId: string, runId: string) {
  for (const artifact of expected) {
    // Typed JSON conversion normalizes PG dates/timestamps/numbers on both sides.
    // created_at is database-assigned; every supplied field and record must match.
    const runColumn = artifact.table === 'source_runs' ? 'id' : 'run_id'
    const result = await transaction.query(`select
      (select coalesce(jsonb_agg(to_jsonb(actual) - 'created_at' order by actual.id), '[]'::jsonb)
       from public.${artifact.table} actual where organization_id = $1::uuid and ${runColumn} = $2::uuid)
      = (select coalesce(jsonb_agg(to_jsonb(wanted) - 'created_at' order by wanted.id), '[]'::jsonb)
         from jsonb_populate_recordset(null::public.${artifact.table}, $3::jsonb) wanted) as matches`,
    [organizationId, runId, JSON.stringify(artifact.rows)])
    if (result.rows.length !== 1 || result.rows[0].matches !== true) throw new PlatformError('IDEMPOTENCY_CONFLICT', 'The retained run does not exactly match this prepared journey.')
  }
}
async function lockAuthority(transaction: TransactionSql, selection: JourneySelection, identity: VerifiedSession, authority: SessionAuthority) {
  // READ COMMITTED row locks see current committed state. Membership revocation,
  // role downgrade, disconnect and connection deletion conflict with these locks.
  const membership = await transaction.query(`select role from public.organization_memberships
    where organization_id = $1::uuid and user_id = $2::uuid and revoked_at is null for share`, [selection.organizationId, identity.actorId])
  if (membership.rows.length !== 1 || (membership.rows[0].role !== 'owner' && membership.rows[0].role !== 'admin')) throw unauthorized()
  // Serializes same-connection commits/replays without granting UPDATE on artifacts.
  const connection = await transaction.query(`select status, provider, scopes from public.google_connections
    where organization_id = $1::uuid and id = $2::uuid for update`, [selection.organizationId, selection.connectionId])
  const row = connection.rows[0]
  if (connection.rows.length !== 1 || row.status !== 'active' || row.provider !== 'google' || !Array.isArray(row.scopes) || row.scopes.length !== 1 || row.scopes[0] !== GSC_SCOPE) throw unauthorized()
  try {
    const locked = await authority.lockCurrent(transaction, identity)
    if (!locked || locked.actorId !== identity.actorId || locked.sessionId !== identity.sessionId || !Number.isSafeInteger(locked.expiresAt)) throw unauthorized()
    return Math.min(identity.expiresAt, locked.expiresAt)
  } catch { throw unauthorized() }
}
const exposedErrors = new Set(['UNAUTHORIZED', 'IDEMPOTENCY_CONFLICT'])
async function commitPrepared(review: ReviewedSnapshotBundle, preparedIdentity: VerifiedSession, reportId: string, dependencies: PersistenceDependencies): Promise<CommitReceipt> {
  const { database, authority, now = Date.now } = dependencies
  // All network authentication happens BEFORE acquiring a session or row locks.
  const identity = await verify(authority, now)
  if (identity.actorId !== preparedIdentity.actorId || identity.sessionId !== preparedIdentity.sessionId) throw unauthorized()
  const expected = artifacts(review, identity.actorId, reportId)
  let session: PinnedSqlSession
  try { session = await database.acquire() } catch { throw new PlatformError('PERSISTENCE_UNAVAILABLE', 'A database transaction could not be started.') }
  let begun = false, commitStarted = false, committed = false, discard = false
  try {
    await session.query('begin isolation level read committed')
    begun = true
    await session.query("set local lock_timeout = '5s'")
    await session.query("set local statement_timeout = '15s'")
    await session.query("set local idle_in_transaction_session_timeout = '15s'")
    const expiresAt = await lockAuthority(session, review.selection, identity, authority)
    if (expiresAt <= now()) throw unauthorized()
    const found = await session.query('select id from public.source_runs where organization_id = $1::uuid and id = $2::uuid', [review.selection.organizationId, review.runId])
    if (found.rows.length) await exactReplay(session, expected, review.selection.organizationId, review.runId)
    else {
      for (const artifact of expected) await insertArtifact(session, artifact)
      // Includes the empty action set; unexpected extras are never silently accepted.
      await exactReplay(session, expected, review.selection.organizationId, review.runId)
    }
    if (expiresAt <= now()) throw unauthorized()
    // Membership/connection/session locks are still held at this point. A revocation
    // that acquired its conflicting lock first wins; a later one waits for commit.
    commitStarted = true
    await session.query('commit')
    committed = true
    return Object.freeze({ status: found.rows.length ? 'already_committed' : 'committed', organizationId: review.selection.organizationId, runId: review.runId, reportId })
  } catch (error) {
    discard = true
    if (commitStarted) throw new PlatformError('COMMIT_OUTCOME_UNKNOWN', 'Commit confirmation was lost. Reconcile this exact prepared journey before starting another run.')
    if (begun) {
      try { await session.query('rollback') } catch { throw new PlatformError('ROLLBACK_UNCONFIRMED', 'Rollback could not be confirmed. Reconcile this exact prepared journey before starting another run.') }
    }
    if (error instanceof PlatformError && exposedErrors.has(error.code)) throw new PlatformError(error.code, error.message)
    throw new PlatformError('PERSISTENCE_FAILED', 'The journey was not committed. No partial report was returned.')
  } finally {
    // Pool cleanup must never turn a confirmed COMMIT into an apparent failure.
    try { await session.release(discard || !committed) } catch { /* Driver must evict a failed connection; no provider/database detail escapes. */ }
  }
}

/** Actual parameterized transaction orchestration; no default driver, credentials,
 * route, session-authority implementation or remote write is installed. */
export function createPersistentSearchJourney(dependencies: PersistenceDependencies) {
  const configuration = { ...dependencies, journey: { ...dependencies.journey } }
  return {
    async prepare(selection: JourneySelection): Promise<PreparedJourney | JourneyFailure> {
      const identity = await verify(configuration.authority, configuration.now ?? Date.now)
      const sourceResolver = configuration.journey.resolver
      const review = await createSearchJourney({ ...configuration.journey, resolver: { resolve: async selected => {
        const context = await sourceResolver.resolve(selected)
        if (!context || context.actorId !== identity.actorId) throw unauthorized()
        return context
      } } }).run(selection)
      if (review.status === 'unavailable') return review
      const reportId = randomUUID()
      // No public persist(bundle) or client-supplied IDs/data. This closure retains
      // the original validated, frozen six-snapshot result and verified identity.
      return Object.freeze({ status: 'prepared', review, commit: () => commitPrepared(review, identity, reportId, configuration) })
    },
  }
}


