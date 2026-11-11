'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(max-width: 767px)'

function subscribe(notify: () => void) {
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches
}

// Keep the server and initial hydration result aligned, then read the browser.
function getServerSnapshot() { return false }

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
