'use client'

import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import type { AuthAvailability } from '@/lib/supabase/portal-config'
import { ProviderIcon } from './provider-icon'
import { ThemeToggle } from '@/components/platform/theme-toggle'

export function AuthForm({ mode, available, callbackError = false }: {
  mode: 'sign-in' | 'sign-up'; available: AuthAvailability; callbackError?: boolean
}) {
  const signup = mode === 'sign-up'
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState(callbackError ? 'That sign-in link could not be verified. Start again in the same browser.' : '')
  const [error, setError] = useState(callbackError)
  const anyAvailable = available.email || available.google || available.apple

  async function submit(action: string, credentials: Record<string, string> = {}) {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true); setMessage(''); setError(false)
    try {
      const response = await fetch(`/api/platform/auth/${action}`, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials),
      })
      const result = await response.json()
      if (!response.ok) { setError(true); setMessage(result.error || 'Sign-in could not be completed. Please try again.'); return }
      if (result.url) { window.location.assign(result.url); return }
      setMessage(result.message || 'Request completed.')
    } catch { setError(true); setMessage('We could not connect. Please try again when your connection is ready.') }
    finally { inFlight.current = false; setBusy(false) }
  }
  function emailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!available.email || busy) return
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') || '')
    if (signup && password !== form.get('confirm-password')) {
      setError(true); setMessage('Your passwords do not match. Please try again.'); return
    }
    void submit(mode, { email: String(form.get('email') || '').trim(), password })
  }

  return <main id="main-content" className="mx-auto grid min-h-[85vh] w-full max-w-5xl items-center gap-6 px-6 py-6 lg:grid-cols-[1fr_1.1fr] lg:gap-12 lg:py-12">
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 lg:mb-10"><Link href="/platform" className="portal-muted inline-flex items-center gap-2 text-sm"><ArrowLeft size={16} /> Back to workspace</Link><ThemeToggle /></div>
      <div className="hidden max-w-md lg:block">
      <p className="portal-eyebrow mb-4">YOUR PICSHAW WORKSPACE</p>
      <h2 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">A clearer view.<br /><span className="text-primary">A stronger business.</span></h2>
      <p className="portal-muted mt-5 text-base leading-relaxed">Your visibility, reputation and next best move. Together in one focused workspace.</p>
      <div className="portal-card mt-8 flex gap-3 p-5"><ShieldCheck className="mt-0.5 shrink-0 text-primary" size={21} /><p className="portal-muted text-sm leading-relaxed">Your account identifies you. Access to your business workspace is granted separately, keeping each client&apos;s data private.</p></div>
      </div>
    </section>
    <section className="portal-card w-full p-6 sm:p-9" aria-labelledby="auth-title">
      <p className="portal-eyebrow mb-2">CLIENT PORTAL</p>
      <h1 id="auth-title" className="text-2xl font-semibold tracking-tight">{signup ? 'Create your account' : 'Welcome back'}</h1>
      <p className="portal-muted mt-2 text-sm">{signup ? 'Choose how you’d like to get started.' : 'Choose how you’d like to sign in.'}</p>
      {!anyAvailable && <div id="setup-notice" className="mt-5 rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm leading-relaxed"><strong className="block font-medium">Sign-in is being prepared</strong><span className="portal-muted">Google, Apple and email are shown for preview. Secure provider setup is pending, so no accounts or emails can be created here yet.</span></div>}
      <div className="mt-6 grid gap-3" aria-describedby={!anyAvailable ? 'setup-notice' : undefined}>
        {(['google', 'apple'] as const).map(provider => <button key={provider} type="button" disabled={!available[provider] || busy} onClick={() => void submit(provider)} className="portal-button secondary flex w-full items-center justify-center gap-3 disabled:cursor-not-allowed disabled:opacity-60">
          <ProviderIcon provider={provider} /><span>Continue with {provider === 'google' ? 'Google' : 'Apple'}</span>{!available[provider] && <span className="ml-auto text-xs font-normal">Not active</span>}
        </button>)}
      </div>
      <div className="portal-muted my-6 flex items-center gap-3 text-xs"><span className="h-px flex-1 bg-border" />or use your email<span className="h-px flex-1 bg-border" /></div>
      <form onSubmit={emailSubmit} className="space-y-4" aria-busy={busy}>
        <fieldset disabled={!available.email || busy} className="space-y-4 disabled:opacity-60">
          <div><label htmlFor="email" className="mb-2 flex items-center gap-2 text-sm font-medium"><Mail size={15} /> Email address</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@company.com" className="portal-input w-full" /></div>
          <div><label htmlFor="password" className="mb-2 flex items-center gap-2 text-sm font-medium"><LockKeyhole size={15} /> Password</label><div className="relative"><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 12 : 1} maxLength={128} aria-describedby={signup ? 'password-help' : undefined} className="portal-input w-full pr-12" /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="absolute inset-y-0 right-0 px-3">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{signup && <p id="password-help" className="portal-muted mt-2 text-xs">Use 12–128 characters. A long, unique passphrase works well.</p>}</div>
          {signup && <div><label htmlFor="confirm-password" className="mb-2 block text-sm font-medium">Confirm password</label><input id="confirm-password" name="confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={12} maxLength={128} className="portal-input w-full" /></div>}
          <button type="submit" className="portal-button flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed">{busy ? 'Please wait…' : signup ? 'Create account with email' : 'Sign in with email'}<ArrowRight size={17} /></button>
        </fieldset>
        {!available.email && <p className="portal-muted text-center text-xs">Email sign-in and signup are not active yet.</p>}
        <p role={error ? 'alert' : 'status'} aria-live="polite" className={`text-sm leading-relaxed ${error ? 'text-destructive' : 'portal-muted'}`}>{message}</p>
      </form>
      {!signup && <p className="mt-3 text-center text-sm"><Link className="text-primary hover:underline" href="/platform/forgot-password">Forgot your password?</Link></p>}
      <p className="portal-muted mt-5 text-center text-sm">{signup ? 'Already have an account?' : 'New to Picshaw?'} <Link className="font-medium text-primary underline-offset-4 hover:underline" href={signup ? '/platform/sign-in' : '/platform/sign-up'}>{signup ? 'Sign in' : 'Create an account'}</Link></p>
      <p className="mt-3 text-center text-sm"><Link className="portal-muted hover:underline" href="/platform/account">Session and sign-out controls</Link></p>
      <p className="portal-muted mt-6 text-center text-xs leading-relaxed">No workspace is connected in this preview.<br />Signing in will not automatically grant access to client data.</p>
    </section>
  </main>
}
