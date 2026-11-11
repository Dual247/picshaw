'use client'
import { useEffect, useState } from 'react'
type Status = { enabled: boolean; status?: string; connectionId?: string | null; selectedProperty?: string | null; revocationPending?: boolean }
type Property = { siteUrl: string; permissionLevel: string }
export function SearchConsoleConnect() {
  const [status, setStatus] = useState<Status>({ enabled: false }), [properties,setProperties] = useState<Property[]>([])
  const [message,setMessage] = useState('Checking connection configuration…'), [busy,setBusy] = useState(false), [consent,setConsent] = useState(false)
  async function request(action: string, body = {}) {
    const response = await fetch(`/api/platform/gsc/${action}`, { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body), cache:'no-store' })
    const value = await response.json()
    if (!response.ok) throw Error(value.error ?? 'Connection unavailable.')
    return value
  }
  async function refresh() { const value = await request('status'); setStatus(value); return value }
  useEffect(() => { let active = true; request('status').then(value => { if(active) {setStatus(value);setMessage('Connection status checked. Connecting does not import a report.')} }).catch(error => {if(active)setMessage(error.message)}); return () => {active=false} }, [])
  async function act(action: () => Promise<void>) { setBusy(true); try {await action()} catch(error) {setMessage(error instanceof Error ? error.message : 'Connection unavailable.')} finally {setBusy(false)} }
  return <section className="space-y-5 rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100">
    <h2 className="text-xl font-semibold">Google Search Console</h2>
    <p>Connect a Google account separately from portal sign-in. Picshaw requests read-only Search Console access and stores an encrypted refresh token for this workspace.</p>
    <p>This source measures ordinary final Google Web Search. It does not import Google’s separate Generative AI report or prove AI visibility, leads or revenue.</p>
    <p role="status" aria-live="polite">{message}</p>
    <p>Connection: <strong>{status.enabled ? (status.status ?? 'Unknown').replaceAll('_',' ') : 'Not configured'}</strong></p>
    {status.selectedProperty && <p>Selected property: {status.selectedProperty}</p>}
    {status.revocationPending && <p>Local access is disabled. Google revocation is still unconfirmed; retry disconnect or remove access in your Google account.</p>}
    {(!status.connectionId || status.status === 'disconnected' && !status.revocationPending) && <>
      <label className="flex gap-3"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)} disabled={!status.enabled || busy} /> I want to authorize read-only Search Console access for this workspace.</label>
      <button className="rounded-lg bg-cyan-300 px-4 py-2 text-slate-950 disabled:opacity-40" disabled={!status.enabled || !consent || busy} onClick={()=>act(async()=>{const value=await request('connect',{consent:true});const url=new URL(value.authorizationUrl);if(url.origin!=='https://accounts.google.com'||url.pathname!=='/o/oauth2/v2/auth')throw Error('Invalid authorization destination.');window.location.assign(url.toString())})}>Connect with Google</button>
    </>}
    {status.status === 'active' && status.connectionId && <div className="space-y-3">
      <button className="rounded-lg border px-4 py-2 disabled:opacity-40" disabled={busy} onClick={()=>act(async()=>{const value=await request('properties',{connectionId:status.connectionId});setProperties(value.properties);setMessage(value.properties.length?'Choose the exact property below.':'Google returned no readable properties. No sample data was substituted.')})}>Load accessible properties</button>
      {properties.map(property=><div key={property.siteUrl} className="flex flex-wrap items-center gap-3"><span>{property.siteUrl} ({property.permissionLevel})</span><button disabled={busy} className="rounded border px-3 py-1 disabled:opacity-40" onClick={()=>act(async()=>{await request('select',{connectionId:status.connectionId,propertyId:property.siteUrl});await refresh();setMessage('Property saved. Report import is not enabled yet.')})}>Select</button></div>)}
    </div>}
    {status.connectionId && (status.status !== 'disconnected' || status.revocationPending) && <div className="space-y-2"><p>Disconnect disables local access first and asks Google to revoke this app’s grant. This can affect other connections using the same Google app grant. Existing reports are retained.</p><button disabled={busy} className="rounded border border-red-300 px-4 py-2 disabled:opacity-40" onClick={()=>act(async()=>{await request('disconnect',{connectionId:status.connectionId});setProperties([]);await refresh();setMessage('Disconnect processed. Check revocation status above.')})}>Disconnect and revoke Google access</button></div>}
    <button disabled={busy} className="block underline disabled:opacity-40" onClick={()=>act(async()=>{await refresh();setMessage('Status refreshed.')})}>Refresh status</button>
  </section>
}
