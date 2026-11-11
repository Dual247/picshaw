'use client'
import Link from 'next/link'
import { ArrowUpRight, Search, ClipboardList } from 'lucide-react'
import { usePortalAccess, usePortalOrigin } from '@/hooks/use-portal-access'
import styles from './PortalShowcase.module.css'

export function PortalShowcase() {
  const ready = usePortalAccess()
  const portalOrigin = usePortalOrigin()
  return <section id="portal" className={styles.section} aria-labelledby="portal-heading">
    <div className={styles.layout}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>The Picshaw portal / Take a look inside</p>
        <h2 id="portal-heading">The evidence.<br /><em>The next step.</em></h2>
        <p>Explore a sample workspace: search visibility, the detail behind the numbers, and a focused list of priorities.</p>
        <div className={styles.actions}>
          <Link href={`${portalOrigin}${ready ? '/platform/sign-up' : '/platform/preview'}`} prefetch={false} className={styles.button}>{ready ? 'Create your account' : 'Explore the sample portal'}<ArrowUpRight size={17} aria-hidden="true" /></Link>
          <Link href={`${portalOrigin}/platform/sign-in`} prefetch={false} className={styles.link}>{ready ? 'Log in' : 'Portal login & access'}<ArrowUpRight size={15} aria-hidden="true" /></Link>
        </div>
        <p className={styles.readiness}>{ready ? 'The sample is fictional and separate from your account.' : 'Preview available. Account creation and login are not enabled yet.'}</p>
      </div>
      <figure className={styles.figure}>
        <div className={styles.workspace}>
          <div className={styles.masthead}><span>picshaw<span className={styles.brandDot}>.</span> <small>PORTAL</small></span><span className={styles.sample}>Fictional sample</span></div>
          <div className={styles.workspaceBody}>
            <p className={styles.business}>Willow Dental Studio <span>/ Fictional business</span></p>
            <h3>Your search, at a glance.</h3>
            <p className={styles.period}>1–28 Oct 2026 · Fixed sample, not live data</p>
            <div className={styles.metrics}>
              <div><span className={styles.label}><Search size={14} aria-hidden="true" />Google Search clicks</span><strong>1,248</strong><p>Fictional aggregate</p><div className={styles.comparison}><span>Prior</span><i /><span>1,114</span><span>Current</span><i /><span>1,248</span></div></div>
              <div><span className={styles.label}>Sampled AI discovery</span><strong>18 <small>of 60</small></strong><p>Valid sample answers mentioning the business</p><div className={styles.distribution} aria-hidden="true" /><p>42 not mentioned · 4 failures excluded</p></div>
            </div>
            <div className={styles.priority}><ClipboardList size={20} aria-hidden="true" /><div><span className={styles.label}>A sample next step</span><p>Review emergency-service information</p></div><span className={styles.proposed}>Proposed</span></div>
            <p className={styles.note}>No accounts connected. No real customer results.</p>
          </div>
        </div>
        <figcaption>A condensed view of the fictional portal preview, rendered as text, not a screenshot. <Link href={`${portalOrigin}/platform/preview`} prefetch={false}>Open the full sample <ArrowUpRight size={12} aria-hidden="true" /></Link></figcaption>
      </figure>
    </div>
  </section>
}
