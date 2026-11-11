'use client'
import Link from 'next/link'
import { ArrowUpRight, Search, ClipboardList } from 'lucide-react'
import styles from './PortalShowcase.module.css'

export function PortalShowcase() {
  return <section id="portal" className={styles.section} aria-labelledby="portal-heading">
    <div className={styles.layout}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>In development / Reporting preview</p>
        <h2 id="portal-heading">The evidence.<br /><em>The next step.</em></h2>
        <p>A look at the reporting experience we are building: search visibility, the evidence behind the numbers, and a focused list of priorities.</p>
        <div className={styles.actions}><Link href="/#contact" className={styles.button}>Discuss visibility reporting<ArrowUpRight size={17} aria-hidden="true" /></Link></div>
        <p className={styles.readiness}>Portal coming soon. Account creation and login are not enabled yet.</p>
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
        <figcaption>A condensed concept for the future portal, rendered as text, not a screenshot. Fictional data, not client results.</figcaption>
      </figure>
    </div>
  </section>
}
