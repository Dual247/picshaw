import assert from 'node:assert/strict'
import { assessLiveEvidence, approvalGates, configurationGates, liveCases } from './check-portal-live-evidence.mjs'
const now = Date.parse('2026-11-12T00:00:00Z')
const options = { now, expectedCommit: 'a'.repeat(40), expectedProject: 'https://abcdefghijklmnopqrst.supabase.co' }
const before = { status: 'passed', evidence: 'fixture/operator-review', observedAt: '2026-11-11T23:00:00Z' }
const after = { status: 'passed', evidence: 'fixture/redacted-results', observedAt: '2026-11-11T23:45:00Z' }
const report = { commit: options.expectedCommit, projectOrigin: options.expectedProject, portalOrigin: 'https://app.picshaw.com',
  execution: 'live', startedAt: '2026-11-11T23:30:00Z', providers: ['email'],
  approvals: Object.fromEntries(approvalGates.map(id => [id, { ...before }])),
  configuration: Object.fromEntries(configurationGates.map(id => [id, { ...before }])),
  checks: Object.fromEntries(liveCases.map(id => [id, { ...after }])) }
const originalFetch = globalThis.fetch
globalThis.fetch = () => { throw Error('Network forbidden') }
try {
  assert.equal(assessLiveEvidence(null).evidenceComplete, false)
  assert.equal(assessLiveEvidence(report, options).evidenceComplete, true)
  assert.equal(assessLiveEvidence(report, options).activationAuthorized, false)
  for (const [section, ids] of [['approvals', approvalGates], ['configuration', configurationGates], ['checks', liveCases]]) {
    for (const id of ids) {
      for (const value of [undefined, { status: 'passed' }, { ...after, evidence: '' }, { ...after, status: 'pending' }, { ...after, observedAt: '2027-01-01T00:00:00Z' }]) {
        const changed = structuredClone(report); changed[section][id] = value
        assert.equal(assessLiveEvidence(changed, options).evidenceComplete, false)
      }
    }
  }
  for (const change of [{ execution: 'mocked' }, { commit: 'b'.repeat(40) }, { projectOrigin: 'https://evil.example.com' },
    { portalOrigin: 'https://preview.vercel.app' }, { startedAt: '2026-11-01T00:00:00Z' }, { providers: ['google'] },
    { providers: ['email', 'apple'] }, { providers: ['email', 'email'] }]) {
    assert.equal(assessLiveEvidence({ ...report, ...change }, options).evidenceComplete, false)
  }
  const provider = structuredClone(report); provider.providers.push('google'); provider.checks['google-oauth'] = { ...after }
  assert.equal(assessLiveEvidence(provider, options).evidenceComplete, true)
  // A complete synthetic report is only a test of this evaluator, never live proof.
  console.log('PASS live evidence gate rejects absent/stale/mocked/mismatched/incomplete evidence; no network, provisioning or activation capability')
} finally { globalThis.fetch = originalFetch }
