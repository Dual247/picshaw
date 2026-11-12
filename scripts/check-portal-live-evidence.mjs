import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// Evidence-only harness: intentionally no network transport, credential input,
// account provisioning, email sending, flag activation or cleanup commands.
// A report is NOT owner approval and cannot authorize a live operation.
export const approvalGates = [
  'target-and-deployment', 'test-accounts-and-recipients', 'fixture-writes-and-revocations', 'cleanup-and-retention',
]
export const configurationGates = [
  'exact-site-url-and-callback', 'smtp-and-confirmation', 'password-protections', 'jwt-and-session-policy',
  'restricted-runtime-roles', 'distributed-admission-and-ingress', 'no-store-and-log-redaction',
]
export const liveCases = [
  'email-signup-confirmation', 'email-login-and-navigation', 'invalid-and-duplicate-login',
  'pkce-cancel-expire-replay-and-wrong-browser', 'recovery-and-password-change',
  'reauthentication-required', 'expired-session-refresh', 'local-and-global-revocation',
  'csrf-and-alias-denial', 'two-tenant-read-write-denial', 'membership-revocation',
  'revoked-session-workspace-denial', 'concurrent-bootstrap-and-retry',
  'admission-limit-and-outage', 'response-cache-isolation', 'fixture-cleanup',
]
const passed = (record, now, earliest) => record?.status === 'passed' &&
  typeof record.evidence === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._/-]{2,159}$/.test(record.evidence) &&
  typeof record.observedAt === 'string' && Number.isFinite(Date.parse(record.observedAt)) &&
  Date.parse(record.observedAt) >= earliest && Date.parse(record.observedAt) <= now

export function assessLiveEvidence(report, { expectedCommit, expectedProject, now = Date.now() } = {}) {
  const blockers = []
  const validCommit = /^[a-f0-9]{40}$/.test(expectedCommit ?? '')
  const validProject = /^https:\/\/[a-z]{20}\.supabase\.co$/.test(expectedProject ?? '')
  if (!validCommit || report?.commit !== expectedCommit) blockers.push('pinned-commit')
  if (!validProject || report?.projectOrigin !== expectedProject) blockers.push('pinned-project')
  if (report?.portalOrigin !== 'https://app.picshaw.com') blockers.push('canonical-portal')
  if (report?.execution !== 'live') blockers.push('live-execution-not-established')
  const start = Date.parse(report?.startedAt)
  if (!Number.isFinite(start) || start > now || start < now - 24 * 60 * 60 * 1000) blockers.push('fresh-run-window')
  // Prerequisites must have been reviewed before this exact run. Old reports are
  // not carried forward as current configuration/authorization automatically.
  for (const id of approvalGates) if (!passed(report?.approvals?.[id], start, start - 24 * 60 * 60 * 1000)) blockers.push(`approval:${id}`)
  for (const id of configurationGates) if (!passed(report?.configuration?.[id], start, start - 24 * 60 * 60 * 1000)) blockers.push(`configuration:${id}`)
  for (const id of liveCases) if (!passed(report?.checks?.[id], now, start)) blockers.push(`case:${id}`)
  // Optional providers stay disabled unless included in the individually approved
  // scope and verified through the real browser/provider flow.
  const providers = report?.providers
  if (!Array.isArray(providers) || providers.length === 0 || new Set(providers).size !== providers.length ||
      providers.some(value => !['email', 'google', 'apple'].includes(value)) || !providers.includes('email')) blockers.push('provider-scope')
  for (const provider of ['google', 'apple']) {
    if (Array.isArray(providers) && providers.includes(provider) &&
        !passed(report?.checks?.[`${provider}-oauth`], now, start)) blockers.push(`case:${provider}-oauth`)
  }
  return { evidenceComplete: blockers.length === 0, activationAuthorized: false, blockers,
    limitation: 'Checks evidence completeness only. Verify original reports and current owner approval before live work or activation.' }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2)
    const prefixes = ['--report=', '--expected-commit=', '--expected-project=']
    if (args.some(arg => !prefixes.some(prefix => arg.startsWith(prefix))) ||
        prefixes.some(prefix => args.filter(arg => arg.startsWith(prefix)).length > 1)) throw Error()
    const value = prefix => args.find(arg => arg.startsWith(prefix))?.slice(prefix.length)
    const path = value('--report=')
    const report = path ? JSON.parse(readFileSync(path, 'utf8')) : null
    const result = assessLiveEvidence(report, { expectedCommit: value('--expected-commit='), expectedProject: value('--expected-project=') })
    console.log(JSON.stringify(result, null, 2))
    if (!result.evidenceComplete) process.exitCode = 2
  } catch {
    console.error('Evidence review unavailable. Supply a redacted local report and independently verified targets. No network or account operation was attempted.')
    process.exitCode = 1
  }
}
