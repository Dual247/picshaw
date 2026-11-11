'use client'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { portalNavigationOrigin } from '@/lib/portal-origin'
const previewNavigation = process.env.NEXT_PUBLIC_PICSHAW_PREVIEW_NAVIGATION === 'true'
/** Server-declared previews stay usable before DNS. Production stays canonical. */
export function usePortalOrigin() {
  return useSyncExternalStore(subscribeOrigin, readOrigin, readServerOrigin)
}
const subscribeOrigin = () => () => {}
const readOrigin = () => portalNavigationOrigin(window.location.hostname, previewNavigation)
const readServerOrigin = () => portalNavigationOrigin('', previewNavigation)
/** Default closed, including a failed/invalid response. No user data is sent. */
export function usePortalAccess() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/portal-access', { cache: 'no-store', credentials: 'omit', signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(value => setReady(value?.ready === true))
      .catch(() => setReady(false))
    return () => controller.abort()
  }, [])
  return ready
}
