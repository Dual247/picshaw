'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import { track } from '@vercel/analytics'
import { pageCategory } from '@/lib/analytics'
import { googleLeadConversionScript } from '@/lib/google-conversions'

const googleAnalyticsId = 'G-LFJFHY63RR'
const preferenceKey = 'picshaw-analytics-consent-v1'
const preferenceLifetimeMs = 180 * 24 * 60 * 60 * 1000
const settingsEvent = 'picshaw:privacy-settings'
const customEventsEnabled = process.env.NEXT_PUBLIC_ANALYTICS_EVENTS === 'true'
type Preference = 'loading' | 'unset' | 'granted' | 'denied'
type GoogleWindow = Window & { 'ga-disable-G-LFJFHY63RR'?: boolean }

const initScript = [
  'window.dataLayer = window.dataLayer || [];',
  'function gtag(){dataLayer.push(arguments);}',
  "gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});",
  "gtag('consent','update',{analytics_storage:'granted'});",
  "gtag('js', new Date());",
  "gtag('config','G-LFJFHY63RR',{allow_google_signals:false,allow_ad_personalization_signals:false});",
  googleLeadConversionScript,
].join('\n')

export function PrivacySettingsButton({ className = '' }: { className?: string }) {
  return <button
    type="button"
    className={className}
    onClick={() => window.dispatchEvent(new Event(settingsEvent))}
  >Privacy settings</button>
}

// Remove accessible first-party GA cookies when consent is withdrawn.
// The browser and each vendor control any cookies outside this domain.
function clearAnalyticsCookies() {
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim()
    if (!name || !(/^_ga($|_)/.test(name) || name === '_gid' || name === '_gat')) continue
    for (const domain of ['', ';domain=' + window.location.hostname, ';domain=.picshaw.com']) {
      document.cookie = name + '=;Max-Age=0;Path=/' + domain + ';SameSite=Lax'
    }
  }
}
function browserSendsGpc() {
  return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
}

export function SiteAnalytics({ production }: { production: boolean }) {
  const pathname = usePathname()
  const enabled = production && process.env.NODE_ENV === 'production'
  const [choice, setChoice] = useState<Preference>('loading')
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [gpc, setGpc] = useState(false)
  const granted = choice === 'granted' && !gpc

  useEffect(() => {
    const browserGpc = browserSendsGpc()
    setGpc(browserGpc)
    if (browserGpc) {
      (window as GoogleWindow)['ga-disable-G-LFJFHY63RR'] = true
      setChoice('denied')
      return
    }
    try {
      const saved = JSON.parse(window.localStorage.getItem(preferenceKey) || 'null') as { value?: string; at?: number } | null
      if (saved && (saved.value === 'granted' || saved.value === 'denied') &&
        typeof saved.at === 'number' && saved.at <= Date.now() &&
        Date.now() - saved.at < preferenceLifetimeMs) {
        setChoice(saved.value)
        ;(window as GoogleWindow)['ga-disable-G-LFJFHY63RR'] = saved.value !== 'granted'
        return
      }
    } catch { /* Unavailable browser storage: leave optional trackers off. */ }
    ;(window as GoogleWindow)['ga-disable-G-LFJFHY63RR'] = true
    setChoice('unset')
  }, [])

  useEffect(() => {
    const show = () => setPreferencesOpen(true)
    window.addEventListener(settingsEvent, show)
    return () => window.removeEventListener(settingsEvent, show)
  }, [])

  function choose(next: 'granted' | 'denied') {
    if (gpc && next === 'granted') return
    const revoking = granted && next === 'denied'
    try {
      window.localStorage.setItem(preferenceKey, JSON.stringify({ value: next, at: Date.now() }))
    } catch { /* Choice takes effect now even if preference storage is blocked. */ }
    ;(window as GoogleWindow)['ga-disable-G-LFJFHY63RR'] = next !== 'granted'
    setChoice(next)
    setPreferencesOpen(false)
    if (revoking) {
      clearAnalyticsCookies()
      window.location.reload() // Remove previously inserted third-party scripts and listeners.
    }
  }

  useEffect(() => {
    if (!enabled || !customEventsEnabled || !granted) return
    const started = new Set<string>()
    const send = (event: string) => {
      try {
        track(event, { page_type: pathname === '/ai-visibility-audit' ? 'audit' : pathname === '/methodology' ? 'methodology' : pageCategory(pathname) })
      } catch { /* Tracking must not interrupt an enquiry. */ }
    }
    const onFocus = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement)) return
      const form = event.target.closest<HTMLFormElement>('#contact form')
      if (!form) return
      const kind = form.dataset.enquiryType === 'aeo' ? 'aeo' : 'website'
      if (!started.has(kind)) {
        started.add(kind)
        send(kind === 'aeo' ? 'aeo_enquiry_started' : 'review_request_started')
      }
    }
    const onClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('a[href^="tel:"]')) send('phone_click')
    }
    document.addEventListener('focusin', onFocus)
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('click', onClick)
    }
  }, [pathname, enabled, granted])

  return <>
    {enabled && granted && <>
      <Script id="google-analytics-init" strategy="afterInteractive">{initScript}</Script>
      <Script id="google-analytics" src={'https://www.googletagmanager.com/gtag/js?id=' + googleAnalyticsId} strategy="afterInteractive" />
      <Analytics beforeSend={event => {
        try {
          const url = new URL(event.url)
          url.search = ''
          url.hash = ''
          return { ...event, url: url.toString() }
        } catch { return null }
      }} />
    </>}
    {choice !== 'loading' && (choice === 'unset' || preferencesOpen) && <aside
      id="privacy-preferences-panel"
      role="region"
      aria-labelledby="privacy-preferences-title"
      className="fixed bottom-4 left-4 right-4 z-[80] mx-auto max-w-2xl rounded-xl border border-white/20 bg-[#171a17] p-5 text-[#f9f8f3] shadow-2xl shadow-black/50 sm:bottom-6 sm:p-7"
    >
      <div className="flex items-start justify-between gap-5">
        <div>
          <h2 id="privacy-preferences-title" className="text-lg font-semibold tracking-tight">Your privacy matters.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#d2d5ca]">Essential technology runs Picshaw. We use Google Analytics and Vercel Web Analytics only if you allow optional analytics. Your choice does not affect our enquiry forms.</p>
          {gpc && <p className="mt-3 text-xs font-medium text-[#f0c0b4]">Global Privacy Control is enabled in your browser. Optional analytics remains off.</p>}
          {!gpc && choice !== 'unset' && <p className="mt-3 text-xs text-[#d2d5ca]">Current preference: {granted ? 'Analytics allowed' : 'Optional analytics rejected'}.</p>}
        </div>
        {choice !== 'unset' && <button type="button" onClick={() => setPreferencesOpen(false)} aria-label="Close privacy settings" className="shrink-0 rounded border border-white/20 px-3 py-1 text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">×</button>}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => choose('denied')} className="min-h-11 rounded border border-[#aeb6a8] px-5 py-2 text-sm font-semibold hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Reject optional</button>
        <button type="button" onClick={() => choose('granted')} disabled={gpc} className="min-h-11 rounded bg-[#ff6b4e] px-5 py-2 text-sm font-semibold text-[#10120f] hover:bg-[#ff8a72] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50">Allow analytics</button>
        <Link href="/privacy-policy" onClick={() => setPreferencesOpen(false)} className="px-1 py-2 text-sm text-[#e1e6da] underline underline-offset-4 hover:text-white">Privacy Policy</Link>
      </div>
    </aside>}
  </>
}
