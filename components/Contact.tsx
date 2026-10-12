'use client'

import { useRef, useState, type FormEvent } from 'react'
import { ArrowUpRight, Check, ArrowLeft } from 'lucide-react'

const options = [
  { value: 'audit', label: 'AI Visibility Audit' },
  { value: 'aeo', label: 'AEO implementation or ongoing support' },
  { value: '1k', label: '$1,000 Website Refresh' },
  { value: '2.5k', label: '$2,500+ Growth Site' },
  { value: 'monthly', label: 'Website partnership' },
  { value: 'unsure', label: 'Help me decide' },
]
const emptyForm = { name: '', email: '', business: '', website: '', message: '' }
const inputClass = 'w-full rounded-lg border border-border bg-background px-4 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20'

export function Contact({ compact = false }: { compact?: boolean }) {
  const [step, setStep] = useState(1)
  const [selectedService, setSelectedService] = useState('audit')
  const [data, setData] = useState(emptyForm)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const submitting = useRef(false)
  const isWebsite = ['1k', '2.5k', 'monthly'].includes(selectedService)
  const change = (key: keyof typeof emptyForm, value: string) => setData(previous => ({ ...previous, [key]: value }))
  const next = (event: FormEvent) => { event.preventDefault(); setStep(2); requestAnimationFrame(() => document.getElementById('contact-name')?.focus()) }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setStatus('submitting')
    setErrorMessage('')
    try {
      const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, service_interest: selectedService }) })
      const result = await response.json().catch(() => null)
      if (!response.ok || result?.success !== true) throw new Error('Please try again or email hello@picshaw.com directly.')
      setStatus('success')
      setData(emptyForm)
    } catch {
      setStatus('error')
      setErrorMessage('Your message could not be sent. Please try again or email hello@picshaw.com directly.')
    } finally { submitting.current = false }
  }
  return <section id="contact" className={`scroll-mt-28 ${compact ? 'mt-16 border-t border-border pt-14' : 'border-t border-border py-20 md:py-28'}`} aria-labelledby="contact-heading">
    <div className={compact ? '' : 'mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20'}><div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
      <div><p className="mb-5 text-xs font-medium uppercase tracking-[0.2em] text-primary">Start a conversation</p><h2 id="contact-heading" className="text-3xl font-semibold leading-tight tracking-tight md:text-5xl">Find your next<br />search opportunity.</h2><p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">Tell us about your business and website. We will recommend the right starting point and confirm the scope, fee and delivery date before any paid work begins.</p><p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground">The enquiry is free. A full audit is a separately quoted service—not an instant automated score or a free ongoing programme.</p>
        <div className="mt-8 space-y-4 text-sm"><a href="mailto:hello@picshaw.com" className="flex items-center gap-2 text-primary">hello@picshaw.com<ArrowUpRight size={15} aria-hidden="true" /></a><a href="tel:+17379009237" className="block text-muted-foreground">(737) 900-9237</a><p className="text-muted-foreground">Los Angeles, California</p></div>
      </div>
      <div className="min-w-0 rounded-2xl border border-border bg-card p-6 sm:p-8">
        {status === 'success' ? <div role="status" className="py-10 text-center"><Check size={32} className="mx-auto text-primary" aria-hidden="true" /><h3 className="mt-5 text-2xl font-semibold">Message sent!</h3><p className="mt-4 text-sm leading-7 text-muted-foreground">Thanks for getting in touch. We will review your request and reply about the next step. No paid work has started.</p><button type="button" onClick={() => { setStatus('idle'); setStep(1); setSelectedService('audit') }} className="mt-7 text-sm text-primary underline underline-offset-4">Send another message</button></div> : <>
          <div className="mb-7 flex items-center justify-between"><p className="text-sm text-muted-foreground">Step {step} of 2</p><p className="text-xs text-muted-foreground">No payment required to enquire</p></div>
          {step === 1 ? <form onSubmit={next} className="space-y-6" data-enquiry-type={isWebsite ? 'website' : 'aeo'}>
            <div><label htmlFor="contact-website" className="mb-2 block text-sm font-medium">Your website <span className="text-primary">*</span></label><input id="contact-website" name="website" type="text" required maxLength={2048} autoComplete="url" value={data.website} onChange={event => change('website', event.target.value)} className={inputClass} placeholder="yourbusiness.com" /></div>
            <div><label htmlFor="contact-email" className="mb-2 block text-sm font-medium">Email <span className="text-primary">*</span></label><input id="contact-email" name="email" type="email" required maxLength={254} autoComplete="email" value={data.email} onChange={event => change('email', event.target.value)} className={inputClass} placeholder="you@business.com" /></div>
            <fieldset><legend className="mb-3 text-sm font-medium">What would you like to explore?</legend><div className="grid gap-3 sm:grid-cols-2">{options.map(option => <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm leading-6 ${selectedService === option.value ? 'border-primary bg-primary/5' : 'border-border'}`}><input type="radio" name="service_interest" value={option.value} checked={selectedService === option.value} onChange={() => setSelectedService(option.value)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]" /><span>{option.label}</span></label>)}</div></fieldset>
            <button type="submit" className="w-full rounded-lg bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Continue</button>
          </form> : <form onSubmit={submit} className="space-y-5" data-enquiry-type={isWebsite ? 'website' : 'aeo'} aria-busy={status === 'submitting'}>
            <button type="button" onClick={() => { setStep(1); setStatus('idle') }} disabled={status === 'submitting'} className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={14} aria-hidden="true" />Back</button>
            <p className="rounded-lg border border-border p-3 text-sm">Enquiring about: <strong>{options.find(option => option.value === selectedService)?.label}</strong></p>
            <div><label htmlFor="contact-name" className="mb-2 block text-sm font-medium">Your name</label><input id="contact-name" name="name" maxLength={150} autoComplete="name" value={data.name} onChange={event => change('name', event.target.value)} className={inputClass} /></div>
            <div><label htmlFor="contact-business" className="mb-2 block text-sm font-medium">Business name</label><input id="contact-business" name="business" maxLength={200} autoComplete="organization" value={data.business} onChange={event => change('business', event.target.value)} className={inputClass} /></div>
            <div><label htmlFor="contact-message" className="mb-2 block text-sm font-medium">What do you offer, where do you work, and what would you like to improve?</label><textarea id="contact-message" name="message" rows={4} maxLength={5000} value={data.message} onChange={event => change('message', event.target.value)} className={inputClass} placeholder="For example: home remodeling in Los Angeles. We want more relevant project enquiries." /></div>
            <button type="submit" disabled={status === 'submitting'} className="w-full rounded-lg bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60">{status === 'submitting' ? 'Sending…' : isWebsite ? 'Get My Free Website Review' : 'Request my audit scope'}</button>
            {status === 'error' && <p role="alert" className="text-sm leading-6 text-primary">{errorMessage}</p>}
            <p className="text-xs leading-6 text-muted-foreground">We use these details to respond to your enquiry. This form does not subscribe you to a newsletter or authorise a payment. Please do not include confidential customer information.</p>
          </form>}
        </>}
      </div>
    </div></div>
  </section>
}
