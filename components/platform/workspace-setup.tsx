'use client'
import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { parseWorkspaceInput } from '@/lib/supabase/workspace-input'

type Workspace = { id: string; name: string; site: string }
export function WorkspaceSetup({ available }: { available: boolean }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const inFlight = useRef(false)
  async function request(create: boolean, input: object = {}) {
    if (!available || inFlight.current) return
    inFlight.current = true; setBusy(true); setMessage('')
    try {
      const response = await fetch(`/api/platform/workspaces/${create ? 'bootstrap' : 'current'}`, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      })
      const result = await response.json()
      if (!response.ok) { setWorkspace(null); setChecked(false); setMessage(result.error || 'Workspace access could not be confirmed.'); return }
      setWorkspace(result.workspace); setChecked(true)
      if (!result.workspace) setMessage('No workspace has been created for this account. Create your own below.')
    } catch { setWorkspace(null); setChecked(false); setMessage('We could not confirm the result. Retry with the same details to safely recover your workspace.') }
    finally { inFlight.current = false; setBusy(false) }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const input = parseWorkspaceInput({ name: String(form.get('name') || '').trim(), site: String(form.get('site') || '').trim().toLowerCase() })
    if (!input) { setMessage('Enter a name and a website hostname, such as example.com. Do not include https:// or a path.'); return }
    void request(true, input)
  }
  return <section className="portal-card p-6 sm:p-9" aria-busy={busy}>
    {!available && <p className="portal-note">Workspace creation is awaiting secure setup. These fields are disabled and no business details are collected.</p>}
    {workspace ? <>
      <p className="portal-eyebrow">YOUR PRIVATE WORKSPACE</p><h2>{workspace.name}</h2>
      <p className="portal-muted">{workspace.site} · Website not verified</p>
      <div className="portal-note"><p>Your workspace is empty. No search property is connected, no data has been imported, and no recommendations or reports have been created.</p></div>
      <h3 className="mt-6 font-semibold">Next: connect your evidence</h3>
      <p className="portal-muted mt-2">Google Search Console connections are not available yet. A Google sign-in only identifies your account. It does not authorize access to search data.</p>
      <button className="portal-button secondary mt-5" disabled={busy} onClick={() => void request(false)}>Refresh workspace access</button>
    </> : <>
      <h2>Create your own workspace</h2><p className="portal-muted mt-2">One new private workspace per account. A website address does not grant access to another business or verify ownership.</p>
      <div className="portal-actions"><Link href="/platform/sign-in" className="portal-button secondary">Sign in first</Link><button type="button" className="portal-button secondary" disabled={!available || busy} onClick={() => void request(false)}>{busy ? 'Checking…' : 'Open my workspace'}</button></div>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <fieldset disabled={!available || busy || !checked} className="space-y-4 disabled:opacity-60">
          <div><label htmlFor="workspace-name" className="mb-2 block text-sm font-medium">Workspace name</label><input className="portal-input w-full" id="workspace-name" name="name" required maxLength={160} autoComplete="organization" /></div>
          <div><label htmlFor="workspace-site" className="mb-2 block text-sm font-medium">Website hostname</label><input className="portal-input w-full" id="workspace-site" name="site" required maxLength={253} placeholder="example.com" autoCapitalize="none" spellCheck={false} aria-describedby="site-help"/><p id="site-help" className="portal-muted mt-2 text-sm">Only the hostname. We will not visit it or connect any data.</p></div>
          <button className="portal-button" type="submit">{busy ? 'Creating…' : 'Create private workspace'}</button>
        </fieldset>
        {available && !checked && <p className="portal-muted text-sm">Use “Open my workspace” after signing in to check your account before creating a workspace.</p>}
      </form>
    </>}
    <p role="status" aria-live="polite" className="portal-muted mt-4">{message}</p>
    <p className="mt-5 text-sm"><Link href="/platform/account" className="portal-text-link">Session and sign-out controls</Link></p>
  </section>
}
