'use client'
import { useEffect, useState } from 'react'
/** Default closed, including a failed/invalid response. No user data is sent. */
export function usePortalAccess() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/platform/access', { cache: 'no-store', credentials: 'omit', signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(value => setReady(value?.ready === true))
      .catch(() => setReady(false))
    return () => controller.abort()
  }, [])
  return ready
}
