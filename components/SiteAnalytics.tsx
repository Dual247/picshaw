'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import { track } from '@vercel/analytics'
import { pageCategory } from '@/lib/analytics'

const googleAnalyticsId = 'G-LFJFHY63RR'
const customEventsEnabled = process.env.NEXT_PUBLIC_ANALYTICS_EVENTS === 'true'
export function SiteAnalytics({ production }: { production: boolean }) {
  const pathname = usePathname()
  const enabled = production && process.env.NODE_ENV === 'production'
  useEffect(() => {
    if (!enabled || !customEventsEnabled) return
    const started = new Set<string>()
    const send = (event: string) => { try { track(event, { page_type: pathname === '/ai-visibility-audit' ? 'audit' : pathname === '/methodology' ? 'methodology' : pageCategory(pathname) }) } catch { /* Tracking must not interrupt an enquiry. */ } }
    const onFocus = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement)) return
      const form = event.target.closest<HTMLFormElement>('#contact form')
      if (!form) return
      const kind = form.dataset.enquiryType === 'aeo' ? 'aeo' : 'website'
      if (!started.has(kind)) { started.add(kind); send(kind === 'aeo' ? 'aeo_enquiry_started' : 'review_request_started') }
    }
    const onClick = (event: MouseEvent) => { if (event.target instanceof Element && event.target.closest('a[href^="tel:"]')) send('phone_click') }
    document.addEventListener('focusin', onFocus)
    document.addEventListener('click', onClick)
    return () => { document.removeEventListener('focusin', onFocus); document.removeEventListener('click', onClick) }
  }, [pathname, enabled])
  if (!enabled) return null
  return <>
    <Script id="google-analytics-init" strategy="afterInteractive">{`
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${googleAnalyticsId}');
    `}</Script>
    <Script id="google-analytics" src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`} strategy="afterInteractive" />
    <Analytics beforeSend={event => { try { const url = new URL(event.url); url.search = ''; url.hash = ''; return { ...event, url: url.toString() } } catch { return null } }} />
  </>
}
