'use client'

import { useEffect, useRef, useState } from 'react'
import type { DataForSeoJob, MentionEvidence } from '../../lib/platform/dataforseo-types'

export type DataForSeoTransport = {
  // Adapter must enforce authenticated workspace access and no-store responses.
  // read must only read persisted status; it must never dispatch provider work.
  submit(input: { platform: 'google' | 'chat_gpt'; jobId: string; consent: 'dataforseo-domain-v1' }): Promise<DataForSeoJob>
  read(jobId: string): Promise<DataForSeoJob>
  // Read persisted results only; never dispatch provider work.
  latest?(platform: 'google' | 'chat_gpt'): Promise<DataForSeoJob | null>
}
export type DataForSeoPanelProps = {
  // Parent should pass the canonical public domain (lowercase, no www prefix).
  domain: string
  // Change on session/workspace changes; null on logout. Never pass a credential.
  sessionScope: string | null
  transport: DataForSeoTransport
}

export function DataForSeoPanel(props: DataForSeoPanelProps) {
  if (!props.sessionScope) return <p role="status">Sign in to view private AI visibility evidence.</p>
  // Scope changes discard all consent, job IDs and evidence before rendering.
  const domain = props.domain.toLowerCase().replace(/^www\./, '')
  return <DataForSeoPanelSession key={JSON.stringify([props.sessionScope, domain])} {...props} domain={domain} />
}

const labels = { queued: 'Queued', running: 'Running', completed: 'Completed', failed: 'Failed', uncertain: 'Uncertain' }

export function DataForSeoPanelSession({ domain, transport }: DataForSeoPanelProps) {
  const [platform, setPlatform] = useState<'google' | 'chat_gpt'>('google')
  const [consent, setConsent] = useState(false)
  const [job, setJob] = useState<DataForSeoJob | null>(null)
  const [evidence, setEvidence] = useState<MentionEvidence | null>(null)
  const [busy, setBusy] = useState(false)
  const [revoked, setRevoked] = useState(false)
  const [message, setMessage] = useState('Nothing has been requested. This panel does not load automatically.')
  const guard = useRef({ alive: true, epoch: 0, busy: false, jobId: null as string | null, revoked: false })

  function clearWaiting() {
    guard.current.epoch++; guard.current.busy = false
    setBusy(false); setEvidence(null)
  }
  useEffect(() => {
    const lifecycle = guard.current
    lifecycle.alive = true
    const clear = () => { clearWaiting(); setMessage('Local waiting stopped. Provider work and any charge are not cancelled. Refresh status to read the saved job.') }
    const revoke = () => { clear(); guard.current.revoked = true; setRevoked(true); setConsent(false); setJob(null); guard.current.jobId = null; setMessage('Private evidence cleared after sign-out. Sign in again to continue.') }
    const visibility = () => { if (document.visibilityState === 'hidden') clear() }
    let channel: BroadcastChannel | null = null
    try { if (typeof BroadcastChannel !== 'undefined') channel = new BroadcastChannel('picshaw-portal-auth') } catch { /* Parent session scope and server checks remain mandatory. */ }
    if (channel) channel.onmessage = event => { if (event.data === 'signed-out') revoke() }
    window.addEventListener('pagehide', clear)
    window.addEventListener('picshaw:session-cleared', revoke)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      lifecycle.alive = false; lifecycle.epoch++; lifecycle.busy = false
      channel?.close(); window.removeEventListener('pagehide', clear)
      window.removeEventListener('picshaw:session-cleared', revoke)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])

  async function request(mode: 'submit' | 'read' | 'latest') {
    const create = mode === 'submit', latest = mode === 'latest'
    const state = guard.current
    if (!state.alive || state.busy || state.revoked || (create && (!consent || state.jobId)) || (mode === 'read' && !state.jobId) || (latest && (!transport.latest || state.jobId))) return
    if (create) state.jobId = crypto.randomUUID()
    const jobId = state.jobId!
    const epoch = ++state.epoch
    state.busy = true; setBusy(true); setEvidence(null)
    if (create) setJob({ jobId, domain, platform, rowLimit: 20, state: 'queued', createdAt: new Date().toISOString() })
    setMessage(create ? 'Submitting one job. Repeated clicks will not submit another.' : 'Reading saved job status. This does not start a provider request.')
    try {
      const value = await (latest ? transport.latest!(platform) : create ? transport.submit({ platform, jobId, consent: 'dataforseo-domain-v1' }) : transport.read(jobId))
      if (!state.alive || state.epoch !== epoch || state.revoked) return
      if (latest && value === null) { setJob(null); setMessage('No saved result was found for this platform. This does not establish zero AI visibility. No provider request was made.'); return }
      if (!value) throw Error('Missing job')
      const validJobId = typeof value.jobId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.jobId)
      if (!validJobId || (mode === 'read' && value.jobId !== jobId) || value.domain !== domain || value.platform !== platform || !Object.hasOwn(labels, value.state)) throw Error('Mismatched job')
      if (value.result && (value.result.domain !== domain || value.result.platform !== platform || value.result.locationCode !== 2840 || value.result.languageCode !== 'en')) throw Error('Mismatched evidence')
      // Enqueue can deduplicate to an existing canonical job. Reads cannot switch IDs.
      state.jobId = value.jobId
      setJob(value); setEvidence(value.state === 'completed' ? value.result ?? null : null)
      setMessage(value.state === 'uncertain' ? 'Outcome or charge is unknown. Do not resubmit. Refresh only reads saved status.' : value.state === 'failed' ? 'The job failed. No visibility conclusion is available.' : value.state === 'completed' ? (value.result ? 'Saved evidence is available below.' : 'Job completed, but evidence is unavailable. No visibility conclusion is available.') : 'Job saved. Use Refresh status to check progress; there is no automatic polling.')
    } catch (error) {
      if (!state.alive || state.epoch !== epoch || state.revoked) return
      setEvidence(null)
      const status = error && typeof error === 'object' && 'status' in error ? error.status : null
      if (status === 401 || status === 403) {
        state.revoked = true; state.jobId = null; setRevoked(true); setConsent(false); setJob(null)
        setMessage('Access unavailable. Private evidence has been cleared. Sign in again to continue.')
      } else {
        setJob(previous => previous ? { ...previous, state: 'uncertain', result: undefined } : null)
        setMessage(latest ? 'Saved result could not be loaded. No provider request was made. You can try Load saved result again.' : 'Outcome or charge is unknown. No retry was sent. Refresh status only reads the same saved job.')
      }
    } finally {
      if (state.alive && state.epoch === epoch) { state.busy = false; setBusy(false) }
    }
  }

  return <section className="space-y-5 rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100" aria-label="AI visibility evidence">
    <h2 className="text-xl font-semibold">AI visibility evidence</h2>
    <p>DataForSEO database observations for <strong>{domain}</strong>. United States · English. This is a sample of source citations, not a visibility score or a live test of every answer.</p>
    <label className="block space-y-2"><span>AI platform</span><select className="block rounded-lg border border-slate-600 bg-slate-950 p-2" value={platform} disabled={busy || !!job || revoked} onChange={event => { setPlatform(event.target.value as 'google' | 'chat_gpt'); setConsent(false); setEvidence(null) }}><option value="google">Google AI Overview</option><option value="chat_gpt">ChatGPT</option></select></label>
    <p>Up to 20 records per job. A provider request may incur a charge. An unknown outcome must not be retried.</p>
    <label className="flex items-start gap-3"><input className="mt-1" type="checkbox" checked={consent} disabled={busy || !!job || revoked} onChange={event => setConsent(event.target.checked)} /><span>I authorize sending the public domain <strong>{domain}</strong> to <strong>DataForSEO</strong> for this {platform === 'google' ? 'Google AI Overview' : 'ChatGPT'} US-English lookup.</span></label>
    <div className="flex flex-wrap gap-3">
      <button type="button" className="rounded-lg bg-cyan-300 px-4 py-2 text-slate-950 disabled:opacity-40" disabled={!consent || busy || !!job || revoked} onClick={() => request('submit')}>Request AI evidence</button>
      <button type="button" className="rounded-lg border px-4 py-2 disabled:opacity-40" disabled={!job || busy || revoked} onClick={() => request('read')}>Refresh status</button>
      {transport.latest && <button type="button" className="rounded-lg border px-4 py-2 disabled:opacity-40" disabled={!!job || busy || revoked} onClick={() => request('latest')}>Load saved result</button>}
      <button type="button" className="rounded-lg border px-4 py-2 disabled:opacity-40" disabled={(!job && !busy) || revoked} onClick={() => { clearWaiting(); setMessage('Local waiting stopped and evidence cleared. This does not cancel provider work or any charge. Refresh status reads the same job; it does not submit another.') }}>Stop waiting locally</button>
    </div>
    {job && (job.state === 'completed' || job.state === 'failed') && <button type="button" className="rounded-lg border px-4 py-2 disabled:opacity-40" disabled={busy || revoked} onClick={() => {
      if (guard.current.busy || guard.current.revoked || !guard.current.alive || !job || !['completed', 'failed'].includes(job.state)) return
      clearWaiting(); guard.current.jobId = null; setJob(null); setConsent(false)
      setMessage('Choose a platform and provide fresh consent before requesting a new lookup. Nothing has been submitted.')
    }}>New lookup</button>}
    <p role="status" aria-live="polite">{message}</p>
    {job && <p>Job status: <strong>{labels[job.state]}</strong></p>}
    {evidence && <DataForSeoEvidence evidence={evidence} />}
  </section>
}

export function DataForSeoEvidence({ evidence }: { evidence: MentionEvidence }) {
  return <div className="space-y-4">
    <p>Retrieved at: <time>{evidence.retrievedAt}</time> (collection time, not answer time).</p>
    <p>Records returned: {evidence.sampledRows}. Matching records reported by provider: {evidence.totalMatches}.</p>
    {!evidence.items.length && <p>No matching records were returned. This does not establish zero AI visibility.</p>}
    <ol className="space-y-4">{evidence.items.map((item, index) => <li key={index} className="space-y-2 rounded-lg border border-slate-700 p-4">
      <p className="font-semibold">{item.question}</p><p>Model: {item.model ?? 'Not reported'}</p>
      <p>Observed at (provider answer time): {item.observedAt ?? 'Not reported'}</p>
      <p>Source citations (plain text, not verified recommendations):</p>
      <ul className="space-y-1 break-words">{item.citations.map((citation, citationIndex) => <li key={citationIndex}>{citation.title ? `${citation.title}: ` : ''}{citation.url}</li>)}</ul>
    </li>)}</ol>
    <ul className="list-disc space-y-2 pl-5">{evidence.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul>
    <p>No visibility score, ranking, lead estimate or traffic forecast has been inferred.</p>
  </div>
}
