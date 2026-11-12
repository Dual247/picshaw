'use client'
import { useEffect, useRef, useState } from 'react'
import type { WebsiteAnalysis } from '@/lib/platform/website-analysis'

export function WebsiteAnalysisPanel() {
  const [url, setUrl] = useState(''), [consent, setConsent] = useState(false)
  const [result, setResult] = useState<WebsiteAnalysis | null>(null), [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Enter one public HTTPS page to review its HTML evidence.')
  const generation = useRef(0), controller = useRef<AbortController | null>(null), locked = useRef(false)
  useEffect(() => {
    const clear = () => { generation.current++; controller.current?.abort(); locked.current = false; setBusy(false); setResult(null); setMessage('Results cleared. Submit the page again to check current access.') }
    const show = (event: PageTransitionEvent) => { if (event.persisted) clear() }
    let channel: BroadcastChannel | null = null
    try { channel = new BroadcastChannel('picshaw-portal-auth'); channel.onmessage = event => { if (event.data === 'signed-out') clear() } } catch { /* Server authorization still applies. */ }
    document.addEventListener('visibilitychange', clear); window.addEventListener('pagehide', clear); window.addEventListener('pageshow', show)
    return () => {
      // Invalidate the request counter, not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++; controller.current?.abort(); channel?.close(); document.removeEventListener('visibilitychange', clear); window.removeEventListener('pagehide', clear); window.removeEventListener('pageshow', show) }
  }, [])
  async function analyze() {
    if (locked.current || !consent) return
    locked.current = true; const ticket = ++generation.current
    controller.current = new AbortController(); setBusy(true); setResult(null); setMessage('Reviewing this page. No other pages are crawled.')
    try {
      const response = await fetch('/api/platform/analysis', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, consent: true }), signal: controller.current.signal })
      const value = await response.json()
      if (ticket !== generation.current) return
      if (!response.ok) { setMessage(value.error || 'Analysis is unavailable.'); return }
      setResult(value.analysis); setMessage('HTML review complete. This is a point-in-time page check, not a search-performance report.')
    } catch { if (ticket === generation.current) setMessage('Analysis could not be completed. No result was saved. You can retry explicitly.') }
    finally { if (ticket === generation.current) { locked.current = false; setBusy(false) } }
  }
  return <section className="portal-card p-6 space-y-5">
    <p>Review one public page for its title, description, headings and basic HTML signals. This does not measure rankings, traffic, AI visibility, JavaScript-rendered content or the rest of the website. Results are not saved.</p>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); void analyze() }}>
      <label className="block">Public page URL<input className="block w-full rounded border p-3 bg-transparent" type="url" required maxLength={2048} placeholder="https://example.com/" value={url} disabled={busy} onChange={event => { setUrl(event.target.value); setConsent(false); setResult(null) }} /></label>
      <p className="text-sm">Use an HTTPS URL without login details, query parameters or fragments. Do not enter private links or personal information. Requests may follow redirects to other public HTTPS pages.</p>
      <label className="flex gap-3"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} />I authorize Picshaw to request this public URL and its redirects from the destination websites to analyze the page.</label>
      <button className="portal-button disabled:opacity-40" type="submit" disabled={busy || !consent || !url}>Analyze page</button>
      {busy && <button type="button" className="portal-button secondary" onClick={() => { generation.current++; controller.current?.abort(); locked.current = false; setBusy(false); setMessage('Canceled locally. A server request may finish, but no result will be shown or saved.') }}>Cancel</button>}
    </form>
    <p role="status" aria-live="polite">{message}</p>
    {result && <article className="space-y-4" aria-label="Page analysis results">
      <h2 className="text-2xl font-semibold">Observed page evidence</h2>
      <p className="break-all">Requested: {result.url}</p><p className="break-all">Retrieved: {result.finalUrl}</p><p>Checked: {result.retrievedAt}</p>
      <dl><dt>Title</dt><dd>{result.title || 'No title found in the received HTML.'}</dd><dt>Description</dt><dd>{result.description || 'No meta description found in the received HTML.'}</dd></dl>
      <h3 className="text-xl">H1 headings observed</h3>{result.headings.length ? <ul>{result.headings.map((heading, index) => <li key={index}>{heading}</li>)}</ul> : <p>No H1 headings found in the received HTML.</p>}
      <p>Canonical: {result.canonical || 'Not observed'}</p><p>Robots directives: {result.robots.join('; ') || 'Not observed'}</p><p>Images: {result.images}; missing alt attributes: {result.imagesWithoutAlt}. Structured data blocks: {result.structuredDataBlocks} (not validated).</p><h3 className="text-xl">Items to review</h3>{!result.findings.length && <p>No issues were identified by these limited markup checks. This is not a clean bill of health for the website.</p>}<ul className="space-y-3">{result.findings.map((finding, index) => <li key={index}><strong>{finding.title}</strong><p>{finding.detail}</p></li>)}</ul>
    </article>}
  </section>
}
