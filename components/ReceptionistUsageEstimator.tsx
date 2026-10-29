'use client'

import { useState } from 'react'
import { receptionistOffer } from '@/lib/receptionist'
import { estimateReceptionistUsage, receptionistMoney as money } from '@/lib/receptionist-usage'

export function ReceptionistUsageEstimator() {
  const [minutes, setMinutes] = useState<number>(receptionistOffer.includedMinutes)
  const estimate = estimateReceptionistUsage(minutes)
  return <div className="min-w-0 rounded-2xl border border-border bg-card p-6 sm:p-8" data-receptionist-estimator>
    <p className="text-xs font-medium uppercase tracking-[0.15em] text-primary">Usage, without the guesswork</p>
    <h3 className="mt-3 text-2xl font-semibold tracking-tight">Estimate your monthly total.</h3>
    <p className="mt-3 text-sm leading-7 text-muted-foreground">Move the slider to see the base fee and additional minutes. Setup is shown separately.</p>
    <label htmlFor="receptionist-usage-minutes" className="mt-7 flex flex-wrap items-baseline justify-between gap-3 text-sm"><span>Estimated call minutes / month</span><strong data-usage-minutes className="text-xl font-semibold">{minutes.toLocaleString('en-US')}</strong></label>
    <input id="receptionist-usage-minutes" type="range" min={0} max={2000} step={50} value={minutes} onChange={event => setMinutes(Number(event.target.value))} aria-valuetext={`${minutes} call minutes per month`} className="mt-3 min-h-11 w-full cursor-pointer accent-[var(--primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" />
    <div aria-hidden="true" className="flex justify-between text-xs text-muted-foreground"><span>0 min</span><span>2,000 min</span></div>
    <dl className="mt-6 divide-y divide-border text-sm">
      <div className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-muted-foreground">Monthly base fee</dt><dd>{money(receptionistOffer.monthly)}</dd></div>
      <div className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-muted-foreground">Additional usage ({estimate.additionalMinutes} min)</dt><dd data-usage-extra>{money(estimate.usageCharge)}</dd></div>
    </dl>
    <div className="rounded-xl bg-[#eeece5] p-5 text-[#191b18]" aria-live="polite" aria-atomic="true">
      <p className="text-sm">Estimated monthly total</p><p className="mt-2 text-4xl font-semibold tracking-tight" data-usage-total>{money(estimate.monthlyTotal)}<span className="ml-2 text-sm font-normal">USD</span></p>
      <p className="mt-3 border-t border-[#bdc1b5] pt-3 text-sm leading-6">Including one-time setup: <strong data-usage-with-setup>{money(estimate.withSetup)}</strong></p>
    </div>
    <p className="mt-5 text-xs leading-6 text-muted-foreground">Illustrative estimate, not a checkout or fixed quote. Excludes applicable taxes and separately quoted integrations. Actual usage measurement, billing and service terms are confirmed before activation. The monthly base fee still applies below {receptionistOffer.includedMinutes} minutes.</p>
    <noscript><p className="mt-3 text-sm leading-6">The slider needs JavaScript. Up to 500 minutes: $399/month; 750 minutes: $524/month; 1,000 minutes: $649/month. Add $500 for one-time setup.</p></noscript>
  </div>
}
