'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { ReviewedSnapshotBundle } from '@/lib/platform/journey'
import { SearchReportView } from './search-report-view'

type Report = { reportId: string; runId: string; review: ReviewedSnapshotBundle }
type Operation = { state: 'running' | 'failed' | 'completed'; reportId: string; startedAt: string; leaseUntil: string | null }
type Reply = { enabled?: boolean; report?: Report | null; operation?: Operation | null; state?: string; error?: string }
type Access = 'checking' | 'enabled' | 'disabled' | 'signed-out' | 'unavailable'

export function SearchReportDashboard() {
  const [report, setReport] = useState<Report | null>(null)
  const [access, setAccess] = useState<Access>('checking')
  const [busy, setBusy] = useState(false)
  const [needsCheck, setNeedsCheck] = useState(false)
  const [message, setMessage] = useState('Checking private report access.')
  const generation = useRef(0), inFlight = useRef(false), mounted = useRef(false), controller = useRef<AbortController | null>(null)

  // Every read reauthorizes on the server. No identity, session token or report is
  // persisted in browser storage, props, URLs or a client-side data cache.
  async function run(action: 'read' | 'status' | 'sync') {
    if (inFlight.current || !mounted.current) return
    inFlight.current = true
    const ticket = ++generation.current
    controller.current = new AbortController()
    const active = () => mounted.current && ticket === generation.current
    setBusy(true); setReport(null)
    setMessage(action === 'sync' ? 'Importing final Google Web Search observations. Keep this page open, or check status when you return.' : 'Checking authorized report access.')
    try {
      const response = await fetch(`/api/platform/reports/${action}`, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: controller.current.signal })
      const value: Reply = await response.json()
      if (!active()) return
      if (!response.ok || value.enabled === false) {
        setAccess(response.status === 401 ? 'signed-out' : value.enabled === false ? 'disabled' : 'unavailable')
        if (action === 'sync') setNeedsCheck(true)
        setMessage(response.status === 401 ? 'Sign in again to view private reports.' : value.error || 'Reports are unavailable. Check workspace setup and try reading again.')
        return
      }
      setAccess('enabled')
      const leaseExpired = value.operation?.state === 'running' && typeof value.operation.leaseUntil === 'string' && Number.isFinite(Date.parse(value.operation.leaseUntil)) && Date.parse(value.operation.leaseUntil) <= Date.now()
      if (value.state === 'busy' || (value.operation?.state === 'running' && !leaseExpired)) {
        setNeedsCheck(true); setMessage('An import is still running or awaiting recovery. Check status before retrying. No second import has been started.'); return
      }
      if (action === 'status') {
        setNeedsCheck(false)
        setMessage(leaseExpired ? 'The previous import lease expired. You can explicitly retry the same daily operation; the server will decide whether recovery is available.' : value.operation?.state === 'completed' ? 'Import completed. Open the latest report below.' : value.operation?.state === 'failed' ? 'The last import failed. You can explicitly retry the same daily operation.' : 'No running import was found. You can load a saved report or request an import.')
      } else {
        if (action === 'sync') setNeedsCheck(false)
        setReport(value.report ?? null)
        setMessage(value.report ? 'Private report loaded. Review its dates and source completeness below.' : 'No saved report is available. Connect Google Search Console, choose a property, then request your first import.')
      }
    } catch {
      if (!active()) return
      setAccess('unavailable'); if (action === 'sync') setNeedsCheck(true)
      setMessage(action === 'sync' ? 'The import outcome is unknown. It may still complete. Check status before explicitly retrying the same daily operation.' : 'Private access could not be confirmed. No previous report remains visible. Try checking again.')
    } finally {
      if (active()) { inFlight.current = false; setBusy(false) }
    }
  }

  useEffect(() => {
    mounted.current = true
    let effectActive = true
    const clear = () => { generation.current++; controller.current?.abort(); inFlight.current = false; setBusy(false); setReport(null); setAccess('checking'); setMessage('Private data cleared. Check access to load the latest report.'); setNeedsCheck(true) }
    const visibility = () => { clear(); if (document.visibilityState === 'visible') void run('read') }
    const pageshow = (event: PageTransitionEvent) => { if (event.persisted) { clear(); void run('read') } }
    let channel: BroadcastChannel | null = null
    try { if (typeof BroadcastChannel !== 'undefined') channel = new BroadcastChannel('picshaw-portal-auth') } catch { /* Visibility and server checks still protect access when browser messaging is unavailable. */ }
    if (channel) channel.onmessage = event => { if (event.data === 'signed-out') { clear(); setAccess('signed-out'); setMessage('Private data cleared after a sign-out request. Check access again or sign in to view reports.') } }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', clear)
    window.addEventListener('pageshow', pageshow)
    // Defer the initial read; Strict Mode cleanup can cancel it before dispatch.
    void Promise.resolve().then(() => { if (effectActive) void run('read') })
    return () => {
      effectActive = false; mounted.current = false
      // This is a request counter, not a DOM ref: invalidate the latest request.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++
      controller.current?.abort(); inFlight.current = false; channel?.close()
      document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', clear); window.removeEventListener('pageshow', pageshow)
    }
  }, [])

  return <div className="space-y-8">
    <section className="portal-card p-6 space-y-4" aria-labelledby="report-controls">
      <h1 id="report-controls" className="text-3xl font-semibold">Your Google Search report</h1>
      <p className="portal-muted">A private view of saved evidence. Opening this page does not contact Google or start an import. Imports run only when you request them, using the same server-controlled daily operation on retry.</p>
      <p role="status" aria-live="polite">{message}</p>
      {access === 'disabled' && <p>Report imports are not enabled for this deployment. Setup may still be required.</p>}
      <div className="flex flex-wrap gap-3">
        <button className="portal-button secondary disabled:opacity-40" disabled={busy} onClick={() => void run('read')}>Load latest report</button>
        <button className="portal-button secondary disabled:opacity-40" disabled={busy} onClick={() => void run('status')}>Check import status</button>
        <button className="portal-button disabled:opacity-40" disabled={busy || access !== 'enabled' || needsCheck} onClick={() => void run('sync')}>Import / retry Google Search</button>
      </div>
      {needsCheck && <p className="text-sm portal-muted">Check import status before retrying. If a lease is still running, wait and check again. There are no automatic retries.</p>}
      <nav aria-label="Report setup" className="flex flex-wrap gap-5 text-sm"><Link className="portal-text-link" href="/platform/connect">Connect Google Search Console</Link><Link className="portal-text-link" href="/platform/analyze">Analyze a website page</Link><Link href="/platform/ai-visibility" prefetch={false} className="portal-text-link" title="Check availability; AI lookups require separate consent">AI visibility evidence</Link><Link className="portal-text-link" href="/platform/onboarding">Workspace and Google setup</Link>{access === 'signed-out' && <Link className="portal-text-link" href="/platform/sign-in">Sign in</Link>}<Link className="portal-text-link" href="/platform/account">Session and sign-out controls</Link><Link className="portal-text-link" href="/platform/preview">Separate fictional sample</Link></nav>
    </section>
    {report && access === 'enabled' && <SearchReportView review={report.review} />}
  </div>
}
