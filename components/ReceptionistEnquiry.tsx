'use client'

import { useRef, useState, type FormEvent } from 'react'
import { ArrowUpRight, Check } from 'lucide-react'
import { sendLeadConversion } from '@/lib/google-conversions'

const inputClass = 'w-full rounded-lg border border-border bg-background px-4 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20'

export function ReceptionistEnquiry() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const submitting = useRef(false)
  const statusHeading = useRef<HTMLHeadingElement>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    const form = event.currentTarget
    const data = new FormData(form)
    const text = (key: string) => String(data.get(key) || '').trim()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    submitting.current = true
    setStatus('submitting')
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          name: text('name'), email: text('email'), business: text('business'), website: text('website'),
          service_interest: 'receptionist',
          message: `AI receptionist demo / founding-pilot enquiry\nPhone (optional): ${text('phone') || 'Not provided'}\nCall coverage: ${text('coverage')}\n\n${text('message')}`,
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || result?.success !== true) throw new Error('Enquiry was not accepted.')
      sendLeadConversion()
      form.reset()
      setStatus('success')
      requestAnimationFrame(() => statusHeading.current?.focus())
    } catch {
      setStatus('error')
    } finally {
      clearTimeout(timer)
      submitting.current = false
    }
  }

  return <div className="min-w-0 rounded-2xl border border-border bg-card p-6 sm:p-8">
    {status === 'success' ? <div role="status" className="py-10 text-center"><Check size={32} className="mx-auto text-primary" aria-hidden="true" /><h3 ref={statusHeading} tabIndex={-1} className="mt-5 text-2xl font-semibold outline-none">Demo enquiry sent.</h3><p className="mt-4 text-sm leading-7 text-muted-foreground">Thanks for getting in touch. We’ll reply to discuss fit and demo availability. No appointment, subscription or live phone service has been activated.</p><button type="button" onClick={() => setStatus('idle')} className="mt-7 min-h-11 text-sm text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">Send another enquiry</button></div> : <form method="post" action="/api/contact" onSubmit={submit} aria-busy={status === 'submitting'} data-enquiry-type="receptionist">
      <h3 className="text-xl font-semibold">Request a demo</h3><p className="mb-6 mt-3 text-sm leading-6 text-muted-foreground">Required fields are marked *. A website is optional.</p>
      <fieldset id="receptionist-fields" disabled={status === 'submitting'} className="space-y-5 disabled:opacity-70"><legend className="sr-only">Your AI receptionist enquiry</legend>
        <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="receptionist-name" className="mb-2 block text-sm font-medium">Your name *</label><input id="receptionist-name" name="name" required maxLength={150} autoComplete="name" className={inputClass} /></div><div><label htmlFor="receptionist-business" className="mb-2 block text-sm font-medium">Business name *</label><input id="receptionist-business" name="business" required maxLength={200} autoComplete="organization" className={inputClass} /></div></div>
        <div><label htmlFor="receptionist-email" className="mb-2 block text-sm font-medium">Email *</label><input id="receptionist-email" name="email" type="email" required maxLength={254} autoComplete="email" className={inputClass} placeholder="you@business.com" /></div>
        <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="receptionist-phone" className="mb-2 block text-sm font-medium">Phone <span className="font-normal text-muted-foreground">(optional)</span></label><input id="receptionist-phone" name="phone" type="tel" maxLength={60} autoComplete="tel" className={inputClass} /></div><div><label htmlFor="receptionist-website" className="mb-2 block text-sm font-medium">Website <span className="font-normal text-muted-foreground">(optional)</span></label><input id="receptionist-website" name="website" type="text" maxLength={2048} autoComplete="url" className={inputClass} placeholder="yourbusiness.com" /></div></div>
        <div><label htmlFor="receptionist-coverage" className="mb-2 block text-sm font-medium">When do you need help with calls?</label><select id="receptionist-coverage" name="coverage" defaultValue="After hours" className={inputClass}><option>After hours</option><option>When the team cannot answer</option><option>Both</option><option>Help me decide</option></select></div>
        <div><label htmlFor="receptionist-message" className="mb-2 block text-sm font-medium">Tell us about your calls <span className="font-normal text-muted-foreground">(optional)</span></label><textarea id="receptionist-message" name="message" rows={4} maxLength={4000} className={inputClass} placeholder="Your services and area, typical enquiries, and what happens when a call goes unanswered." /></div>
        <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-lg bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:cursor-wait">{status === 'submitting' ? 'Sending…' : 'Request a demo'}<ArrowUpRight size={17} aria-hidden="true" /></button>
      </fieldset>
      {status === 'error' && <p role="alert" className="mt-4 text-sm leading-7 text-primary">We could not confirm your enquiry was sent. Please try again or email <a href="mailto:hello@picshaw.com?subject=AI%20receptionist%20pilot%20enquiry" className="underline underline-offset-4">hello@picshaw.com</a>. Your details have been kept in this form.</p>}
      <p className="mt-5 text-xs leading-6 text-muted-foreground">We use these details to respond to your enquiry. This does not subscribe you to marketing or authorise payment. Please do not include confidential customer information.</p>
      <noscript><style>{'#receptionist-fields { display: none; }'}</style><p className="mt-4 text-sm leading-7">This form needs JavaScript to send. Please email <a href="mailto:hello@picshaw.com?subject=AI%20receptionist%20pilot%20enquiry" className="text-primary underline">hello@picshaw.com</a> instead.</p></noscript>
    </form>}
  </div>
}
