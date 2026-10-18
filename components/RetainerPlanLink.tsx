'use client'

import type { ReactNode } from 'react'
import { RETAINER_SELECTION_EVENT, type RetainerService } from '@/lib/retainer'

/** A native anchor remains usable without JavaScript; enhancement preselects the plan. */
export function RetainerPlanLink({ service, children, className = '' }: { service: RetainerService; children: ReactNode; className?: string }) {
  return <a href="#contact" className={className} onClick={() => {
    window.dispatchEvent(new CustomEvent(RETAINER_SELECTION_EVENT, { detail: service }))
  }}>{children}</a>
}
