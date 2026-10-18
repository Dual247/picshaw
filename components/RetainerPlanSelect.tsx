'use client'
import { useEffect } from 'react'
import { RETAINER_SELECTION_EVENT } from '@/lib/retainer'
export function RetainerPlanSelect({ service, children, className }: { service: string; children: React.ReactNode; className?: string }) {
  useEffect(() => { /* Kept as an explicit client component for same-page selection. */ }, [])
  return <button type="button" className={className} onClick={() => {
    window.dispatchEvent(new CustomEvent(RETAINER_SELECTION_EVENT, { detail: service }))
    document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }}>{children}</button>
}
