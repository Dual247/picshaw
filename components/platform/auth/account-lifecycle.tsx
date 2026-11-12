'use client'

import Link from 'next/link'
import { useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, Eye, EyeOff, KeyRound, LogOut, RefreshCw } from 'lucide-react'
import { ThemeToggle } from '@/components/platform/theme-toggle'

type Mode = 'recover' | 'reset-password' | 'account'
export function AccountLifecycle({ mode, available }: { mode: Mode; available: boolean }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [confirmAll, setConfirmAll] = useState(false)
  const [completed, setCompleted] = useState(false)
  const inFlight = useRef(false)
  const title = mode === 'recover' ? 'Forgot your password?' : mode === 'reset-password' ? 'Set a new password' : 'Your account session'

  async function submit(action: string, body: Record<string, string> = {}) {
    if (!available || inFlight.current) return
    const clearPrivateViews = () => {
      if (action !== 'sign-out' && action !== 'sign-out-all') return
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel('picshaw-portal-auth')
          channel.postMessage('signed-out'); channel.close()
        }
      } catch { /* Best-effort local view clearing must not block sign-out. */ }
    }
    clearPrivateViews()
    inFlight.current = true; setBusy(true); setError(false); setMessage('')
    try {
      const response = await fetch(`/api/platform/auth/${action}`, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const result = await response.json()
      if (response.ok) clearPrivateViews()
      setError(!response.ok)
      setMessage(result.error || result.message || 'The request could not be completed. Please retry.')
      if (response.ok && action === 'reset-password') setCompleted(true)
      if (response.ok && action === 'sign-out-all') setConfirmAll(false)
    } catch { setError(true); setMessage('We could not confirm the result. Check your connection and retry. Your session status has not been assumed to change.') }
    finally { inFlight.current = false; setBusy(false) }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (mode === 'recover') { void submit('recover', { email: String(form.get('email') || '').trim() }); return }
    const password = String(form.get('password') || '')
    if (password !== form.get('confirm-password')) { setError(true); setMessage('Your passwords do not match. Please try again.'); return }
    void submit('reset-password', { password })
  }

  return <main id="main-content" className="mx-auto w-full max-w-xl px-6 py-8 sm:py-14">
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3"><Link href="/platform/sign-in" className="portal-muted inline-flex items-center gap-2 text-sm"><ArrowLeft size={16} /> Back to sign in</Link><ThemeToggle /></div>
    <section className="portal-card p-6 sm:p-9" aria-labelledby="lifecycle-title">
      <p className="portal-eyebrow mb-3">PICSHAW ACCOUNT</p>
      <h1 id="lifecycle-title" className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="portal-muted mt-3 text-sm leading-relaxed">{mode === 'recover'
        ? 'Enter your email to request a recovery link. Open it in this same browser to continue.'
        : mode === 'reset-password' ? 'Use the recovery link in this browser, or a verified signed-in session. Choose a unique password you do not use elsewhere.'
        : 'Check your session or sign out. These controls never grant access to a client workspace.'}</p>
      {!available && <div className="mt-5 rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm"><strong className="block font-medium">Secure setup pending</strong><p className="portal-muted mt-1">These controls are not active. No recovery email, password change or session request will be sent.</p></div>}
      {mode !== 'account' ? <form onSubmit={onSubmit} className="mt-6 space-y-4" aria-busy={busy}>
        <fieldset disabled={!available || busy || completed} className="space-y-4 disabled:opacity-60">
          {mode === 'recover' ? <div><label htmlFor="recovery-email" className="mb-2 block text-sm font-medium">Email address</label><input id="recovery-email" name="email" type="email" autoComplete="email" maxLength={254} required placeholder="you@company.com" className="portal-input w-full" /></div> : <>
            <div><label htmlFor="new-password" className="mb-2 block text-sm font-medium">New password</label><div className="relative"><input id="new-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={12} maxLength={128} required aria-describedby="new-password-help" className="portal-input w-full pr-12" /><button type="button" aria-label={showPassword ? 'Hide passwords' : 'Show passwords'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-0 px-3">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><p id="new-password-help" className="portal-muted mt-2 text-xs">Use 12-128 characters. Your password is never saved in this browser by Picshaw.</p></div>
            <div><label htmlFor="confirm-new-password" className="mb-2 block text-sm font-medium">Confirm new password</label><input id="confirm-new-password" name="confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={12} maxLength={128} required className="portal-input w-full" /></div>
            <p className="portal-muted text-xs leading-relaxed">After the password changes, Picshaw will request sign-out on all devices. Existing access tokens may remain valid until expiry.</p>
          </>}
          <button type="submit" className="portal-button flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed"><KeyRound size={17} />{busy ? 'Please wait...' : mode === 'recover' ? 'Request recovery link' : 'Update password and sign out'}</button>
        </fieldset>
      </form> : <div className="mt-6 space-y-3" aria-busy={busy}>
        <button type="button" disabled={!available || busy} onClick={() => void submit('session')} className="portal-button secondary flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"><RefreshCw size={17} />{busy ? 'Please wait...' : 'Check session'}</button>
        <button type="button" disabled={!available || busy} onClick={() => void submit('sign-out')} className="portal-button secondary flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"><LogOut size={17} />Sign out of this browser</button>
        {!confirmAll ? <button type="button" disabled={!available || busy} onClick={() => setConfirmAll(true)} className="portal-button flex w-full items-center justify-center disabled:cursor-not-allowed disabled:opacity-60">Sign out on all devices</button> : <div role="group" aria-label="Confirm sign-out on all devices" className="rounded-xl border border-border p-4">
          <p className="text-sm font-medium">Sign out on all devices?</p><p className="portal-muted mt-2 text-sm">This requests revocation of your refresh sessions, including this browser. Existing access tokens can remain valid until expiry.</p>
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void submit('sign-out-all')} className="portal-button">Confirm sign-out</button><button type="button" disabled={busy} onClick={() => setConfirmAll(false)} className="portal-button secondary">Cancel</button></div>
        </div>}
      </div>}
      <p role={error ? 'alert' : 'status'} aria-live="polite" className={`mt-5 text-sm leading-relaxed ${error ? 'text-destructive' : 'portal-muted'}`}>{message}</p>
      <div className="portal-muted mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm"><Link href="/platform/sign-in" className="text-primary hover:underline">Sign in</Link>{mode !== 'recover' && <Link href="/platform/forgot-password" className="text-primary hover:underline">Request a new recovery link</Link>}{mode !== 'account' && <Link href="/platform/account" className="text-primary hover:underline">Session controls</Link>}<Link href="/platform" className="hover:underline">Back to workspace</Link></div>
    </section>
  </main>
}
