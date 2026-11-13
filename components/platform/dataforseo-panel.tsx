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

  return <section className="portal-card portal-ai-panel space-y-5" aria-label="AI visibility evidence">
    <h2 className="text-xl font-semibold">AI visibility evidence</h2>
    <p>AI citation research for <strong>{domain}</strong>. United States · English. This is a sample of source citations, not a visibility score or a live test of every answer.</p>
    <label className="block space-y-2"><span>AI platform</span><select className="portal-input portal-ai-select" value={platform} disabled={busy || !!job || revoked} onChange={event => { setPlatform(event.target.value as 'google' | 'chat_gpt'); setConsent(false); setEvidence(null) }}><option value="google">Google AI Overview</option><option value="chat_gpt">ChatGPT</option></select></label>
    <p>Up to 20 records per job. A provider request may incur a charge. An unknown outcome must not be retried.</p>
    <label className="flex items-start gap-3"><input className="mt-1" type="checkbox" checked={consent} disabled={busy || !!job || revoked} onChange={event => setConsent(event.target.checked)} /><span>I authorize sending the public domain <strong>{domain}</strong> to <strong>DataForSEO</strong> for this {platform === 'google' ? 'Google AI Overview' : 'ChatGPT'} US-English lookup.</span></label>
    <div className="flex flex-wrap gap-3">
      <button type="button" className="portal-button disabled:opacity-40" disabled={!consent || busy || !!job || revoked} onClick={() => request('submit')}>Request AI evidence</button>
      <button type="button" className="portal-button secondary disabled:opacity-40" disabled={!job || busy || revoked} onClick={() => request('read')}>Refresh status</button>
      {transport.latest && <button type="button" className="portal-button secondary disabled:opacity-40" disabled={!!job || busy || revoked} onClick={() => request('latest')}>Load saved result</button>}
      <button type="button" className="portal-button secondary disabled:opacity-40" disabled={(!job && !busy) || revoked} onClick={() => { clearWaiting(); setMessage('Local waiting stopped and evidence cleared. This does not cancel provider work or any charge. Refresh status reads the same job; it does not submit another.') }}>Stop waiting locally</button>
    </div>
    {job && (job.state === 'completed' || job.state === 'failed') && <button type="button" className="portal-button secondary disabled:opacity-40" disabled={busy || revoked} onClick={() => {
      if (guard.current.busy || guard.current.revoked || !guard.current.alive || !job || !['completed', 'failed'].includes(job.state)) return
      clearWaiting(); guard.current.jobId = null; setJob(null); setConsent(false)
      setMessage('Choose a platform and provide fresh consent before requesting a new lookup. Nothing has been submitted.')
    }}>New lookup</button>}
    <p role="status" aria-live="polite">{message}</p>
    {job && <p>Job status: <strong>{labels[job.state]}</strong></p>}
    {evidence && <DataForSeoEvidence evidence={evidence} />}
  </section>
}

type EvidenceRow = MentionEvidence['items'][number]
export function citationHost(value: string): string | null {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.hostname.toLowerCase().replace(/^www\./, '') : null } catch { return null }
}
export function summarizeEvidence(evidence: MentionEvidence) {
  const sources = new Map<string, { domain: string; observations: number; citations: number; owned: boolean }>()
  const models = new Set<string>()
  let citationCount = 0, datedRows = 0
  for (const row of evidence.items) {
    if (row.model) models.add(row.model)
    if (row.observedAt && Number.isFinite(Date.parse(row.observedAt))) datedRows++
    const seen = new Set<string>()
    for (const citation of row.citations) {
      citationCount++
      const host = citationHost(citation.url)
      if (!host) continue
      const entry = sources.get(host) ?? { domain: host, observations: 0, citations: 0, owned: host === evidence.domain || host.endsWith(`.${evidence.domain}`) }
      entry.citations++; if (!seen.has(host)) entry.observations++
      seen.add(host); sources.set(host, entry)
    }
  }
  return { sources: [...sources.values()].sort((a,b) => b.observations-a.observations || a.domain.localeCompare(b.domain)), models: [...models].sort(), citationCount, datedRows }
}
export function filterEvidenceRows(rows: EvidenceRow[], query: string, model: string, source: string) {
  const term = query.trim().toLowerCase()
  return rows.filter(row => (model === 'all' || (row.model ?? 'Not reported') === model) &&
    (source === 'all' || row.citations.some(citation => citationHost(citation.url) === source)) &&
    (!term || [row.question, row.model ?? '', ...row.citations.flatMap(citation => [citation.title ?? '', citation.url])].some(value => value.toLowerCase().includes(term))))
}
export function evidenceCsv(evidence: MentionEvidence, rows: EvidenceRow[]) {
  const cell = (value: string) => `"${(/^[\s]*[=+@-]/.test(value) ? `'${value}` : value).replace(/"/g, '""')}"`
  const records = [['Domain','Platform','Question','Model','Observed at','Retrieved at','Citation title','Citation URL','Scope']]
  for (const row of rows) for (const citation of row.citations.length ? row.citations : [{title:null,url:''}]) records.push([evidence.domain,evidence.platform,row.question,row.model ?? 'Not reported',row.observedAt ?? 'Not reported',evidence.retrievedAt,citation.title ?? '',citation.url,'Database observation sample; not a live prompt test or visibility score'])
  return records.map(row => row.map(cell).join(',')).join('\r\n')
}
export function DataForSeoEvidence({ evidence, sample = false }: { evidence: MentionEvidence; sample?: boolean }) {
  const [query,setQuery] = useState('')
  const [model,setModel] = useState('all')
  const [source,setSource] = useState('all')
  const [view,setView] = useState<'observations'|'sources'>('observations')
  const [exportMessage,setExportMessage] = useState('')
  const summary = summarizeEvidence(evidence)
  const rows = filterEvidenceRows(evidence.items,query,model,source)
  const filteredSummary = summarizeEvidence({...evidence,items:rows})
  const platform = evidence.platform === 'google' ? 'Google AI Overview' : 'ChatGPT'
  function resetFilters() { setQuery('');setModel('all');setSource('all');setExportMessage('') }
  function download() {
    if (!rows.length) return
    try {
      const url = URL.createObjectURL(new Blob(['\uFEFF'+evidenceCsv(evidence,rows)],{type:'text/csv;charset=utf-8;'}))
      const link = document.createElement('a');link.href=url;link.download='picshaw-citation-observations.csv';link.click()
      setTimeout(()=>URL.revokeObjectURL(url),1000)
      setExportMessage(`CSV prepared with ${rows.length} filtered observations. It contains source URLs, not a visibility score.`)
    } catch { setExportMessage('The CSV could not be prepared. Please try again in this browser.') }
  }
  return <div className="visibility-workspace">
    <header className="visibility-heading"><div><p className="portal-eyebrow">PICSHAW INTELLIGENCE</p><h2>Inside your AI citations</h2><p>{evidence.domain} <span aria-hidden="true">/</span> {platform} <span aria-hidden="true">/</span> United States · English</p></div><span className="portal-badge green">{sample ? 'Fictional sample' : 'Saved evidence'}</span></header>
    <div className="visibility-snapshot"><span>Retrieved at: <time>{evidence.retrievedAt}</time></span><span>Collection time, not answer time</span></div>
    <section className="visibility-kpis" aria-label="Saved snapshot summary">{[
      ['Observations in snapshot',String(evidence.items.length),'Returned records, not tracked prompts'],
      ['Matching records',String(evidence.totalMatches),'Reported database matches, not total answers'],
      ['Source domains',String(summary.sources.length),'Distinct valid domains in returned citations'],
      ['Citations in snapshot',String(summary.citationCount),'Includes repeat citations across records'],
    ].map(([label,value,note])=><article className="portal-card visibility-kpi" key={label}><h3>{label}</h3><strong>{value}</strong><p>{note}</p></article>)}</section>
    <div className="visibility-analysis-grid">
      <section className="portal-card visibility-source-chart" aria-labelledby="citation-domains-heading"><div className="portal-section-heading"><h3 id="citation-domains-heading">Most cited domains in this snapshot</h3><span>Up to 6 domains</span></div><p>Number of returned observations citing each domain. One observation can cite several domains.</p>{summary.sources.length ? <ol>{summary.sources.slice(0,6).map(item=><li key={item.domain}><div><button type="button" onClick={()=>{setSource(item.domain);setView('observations')}} title={`Filter observations citing ${item.domain}`}>{item.domain}</button><span>{item.owned ? 'Your domain' : 'Other source'}</span><strong>{item.observations}</strong></div><div className="visibility-bar-track"><span style={{width:`${evidence.items.length ? item.observations/evidence.items.length*100 : 0}%`}} /></div></li>)}</ol> : <div className="visibility-empty">No valid citation domains in this snapshot.</div>}</section>
      <aside className="portal-card visibility-coverage"><p className="portal-eyebrow">READ THIS SNAPSHOT CORRECTLY</p><h3>A source sample.<br/>Not a market score.</h3><dl><div><dt>Returned records</dt><dd>{evidence.sampledRows}</dd></div><div><dt>Records with an answer date</dt><dd>{summary.datedRows} / {evidence.items.length}</dd></div><div><dt>Reported model names</dt><dd>{summary.models.length}</dd></div></dl><p>No visibility score, ranking, lead estimate or traffic forecast has been inferred.</p><details><summary>Methodology and coverage</summary><p>Database matches are not a controlled set of live buyer-question tests. Counts describe this saved sample only. No comparable historical series is available here.</p><ul>{evidence.limitations.map((limitation,index)=><li key={index}>{limitation}</li>)}</ul></details></aside>
    </div>
    <section className="portal-card visibility-explorer" aria-labelledby="evidence-explorer-heading"><div className="visibility-explorer-title"><div><h3 id="evidence-explorer-heading">Explore the evidence</h3><p>Search questions, models and citation URLs. Filters apply only to this saved snapshot.</p></div><button type="button" className="portal-button secondary small" onClick={download} disabled={!rows.length}>Export filtered CSV</button></div>
      <div className="visibility-filters"><label><span>Search evidence</span><input className="portal-input" type="search" value={query} maxLength={200} placeholder="Question, source or keyword" onChange={event=>{setQuery(event.target.value);setExportMessage('')}}/></label><label><span>Model</span><select className="portal-input" value={model} onChange={event=>{setModel(event.target.value);setExportMessage('')}}><option value="all">All models</option>{[...summary.models,...(evidence.items.some(row=>!row.model)?['Not reported']:[])].map(value=><option key={value} value={value}>{value}</option>)}</select></label><label><span>Source domain</span><select className="portal-input" value={source} onChange={event=>{setSource(event.target.value);setExportMessage('')}}><option value="all">All sources</option>{summary.sources.map(item=><option key={item.domain} value={item.domain}>{item.domain}</option>)}</select></label><button type="button" className="portal-text-link" onClick={resetFilters} disabled={!query&&model==='all'&&source==='all'}>Reset filters</button></div>
      <div className="visibility-tabs"><div role="group" aria-label="Evidence view"><button type="button" aria-pressed={view==='observations'} onClick={()=>setView('observations')}>Observations</button><button type="button" aria-pressed={view==='sources'} onClick={()=>setView('sources')}>Sources</button></div><p role="status">Showing {rows.length} of {evidence.items.length} observations</p></div>
      {exportMessage && <p className="portal-fine" role="status">{exportMessage}</p>}
      {!evidence.items.length ? <div className="visibility-empty"><h4>No matching records returned</h4><p>No matching records were returned. This does not establish zero AI visibility. Try another platform or revisit when a new snapshot is available.</p></div> : !rows.length ? <div className="visibility-empty"><h4>No observations match these filters</h4><p>Your saved snapshot still contains {evidence.items.length} observations.</p><button type="button" className="portal-button secondary" onClick={resetFilters}>Clear filters</button></div> : view === 'observations' ? <ol className="visibility-observations">{rows.map((row,index)=><li key={index}><details><summary><span className="visibility-row-index">{String(index+1).padStart(2,'0')}</span><span className="visibility-question">{row.question}<small>{row.model ?? 'Model not reported'} · {row.observedAt ?? 'Answer date not reported'}</small></span><span className="portal-badge">{row.citations.length} citations</span><span className="visibility-expand" aria-hidden="true">+</span></summary><div className="visibility-observation-detail"><dl><div><dt>Model</dt><dd>{row.model ?? 'Not reported'}</dd></div><div><dt>Observed at (provider answer time)</dt><dd>{row.observedAt ?? 'Not reported'}</dd></div></dl><h4>Source citations</h4><p>Source URLs are shown as evidence, not verified recommendations.</p>{row.citations.length ? <ul>{row.citations.map((citation,citationIndex)=><li key={citationIndex}><span>{citation.title ?? 'Untitled source'}</span><code>{citation.url}</code></li>)}</ul> : <p>No source citations were returned for this observation.</p>}</div></details></li>)}</ol> : <div className="visibility-table-scroll"><table className="visibility-source-table"><caption>Source domains within the filtered observations. Counts can overlap.</caption><thead><tr><th scope="col">Source domain</th><th scope="col">Relationship</th><th scope="col">Observations</th><th scope="col">Citations</th></tr></thead><tbody>{filteredSummary.sources.map(item=><tr key={item.domain}><th scope="row"><button type="button" className="portal-text-link" onClick={()=>{setSource(item.domain);setView('observations')}}>{item.domain}</button></th><td>{item.owned?'Your domain':'Other source'}</td><td>{item.observations}</td><td>{item.citations}</td></tr>)}</tbody></table>{!filteredSummary.sources.length&&<p className="visibility-empty">These observations contain no valid source domains.</p>}</div>}
    </section>
  </div>
}
