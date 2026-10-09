'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Analytics } from '@vercel/analytics/next'
import { track } from '@vercel/analytics'
import { pageCategory } from '@/lib/analytics'

// Enable only after the owner confirms a plan supporting Vercel custom events.
const customEventsEnabled = process.env.NEXT_PUBLIC_ANALYTICS_EVENTS === 'true'
const enabled = process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_VERCEL_ENV !== 'preview'

export function SiteAnalytics() {
  const pathname = usePathname()
  useEffect(() => {
    if (!enabled || !customEventsEnabled) return
    let started = false
    const send = (event: string) => {
      try { track(event, { page_type: pageCategory(pathname) }) } catch { /* Analytics must not affect the enquiry flow. */ }
    }
    const onFocus = (event: FocusEvent) => {
      if (!started && event.target instanceof HTMLElement && event.target.closest('#contact form')) {
        started = true
        send('review_request_started')
      }
    }
    const onClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('a[href^="tel:"]')) send('phone_click')
    }
    document.addEventListener('focusin', onFocus)
    document.addEventListener('click', onClick)
    return () => { document.removeEventListener('focusin', onFocus); document.removeEventListener('click', onClick) }
  }, [pathname])
  if (!enabled) return null
  return <Analytics beforeSend={event => {
    // Retain no query string or fragment in pageview/event URLs.
    try { const url = new URL(event.url); url.search = ''; url.hash = ''; return { ...event, url: url.toString() } } catch { return null }
  }} />
}
