import type { CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUpRight, Calculator, Check, HardHat, HeartPulse, MessageSquare, Scale, Search, Sparkles } from 'lucide-react'
import type { Industry } from '@/lib/industries'
import styles from './IndustrySpotlight.module.css'

const identities = {
  'med-spas': { icon: Sparkles, accent: '#e5acbc' },
  dentists: { icon: HeartPulse, accent: '#94d5c9' },
  'law-firms': { icon: Scale, accent: '#d1c197' },
  'accounting-firms': { icon: Calculator, accent: '#b0baff' },
  'construction-companies': { icon: HardHat, accent: '#edbb80' },
}

export function IndustrySpotlight({ industry }: { industry: Industry }) {
  const spotlight = industry.spotlight
  if (!spotlight) return null
  const identity = identities[industry.slug as keyof typeof identities] ?? identities['construction-companies']
  const Icon = identity.icon
  return (
    <section
      className={styles.spotlight}
      style={{ '--industry-accent': identity.accent } as CSSProperties}
      aria-labelledby="industry-outcome"
    >
      <div className={styles.promise}>
        <span className={styles.icon}><Icon size={28} aria-hidden="true" /></span>
        <p className={styles.eyebrow}>Built around your next enquiry</p>
        <h2 id="industry-outcome">{spotlight.headline}</h2>
        <ul className={styles.outcomes}>
          {spotlight.outcomes.map(outcome => <li key={outcome}><Check size={17} aria-hidden="true" /><span>{outcome}</span></li>)}
        </ul>
        <Link href="/#contact" className={styles.cta}>{spotlight.cta}<ArrowUpRight size={18} aria-hidden="true" /></Link>
        <Link href="#how-we-help" className={styles.secondary}>See how we can help<ArrowDown size={16} aria-hidden="true" /></Link>
      </div>
      <div className={styles.journey} aria-labelledby="example-journey-heading">
        <div className={styles.journeyHeading}>
          <h3 id="example-journey-heading">Example enquiry journey</h3>
          <span>Illustrative</span>
        </div>
        <ol className={styles.steps}>
          <li>
            <span className={styles.stepNumber} aria-hidden="true">01</span>
            <div className={styles.stepContent}>
              <p className={styles.stepLabel}>A relevant search</p>
              <div className={styles.search}><Search size={17} aria-hidden="true" /><span>{spotlight.journey.query}</span></div>
              <p className={styles.caption}>An example of the intent your pages can address.</p>
            </div>
          </li>
          <li>
            <span className={styles.stepNumber} aria-hidden="true">02</span>
            <div className={styles.stepContent}>
              <p className={styles.stepLabel}>A reason to choose you</p>
              <div className={styles.pagePreview}>
                <div className={styles.browserBar} aria-hidden="true"><i /><i /><i /><span>Your website</span></div>
                <div className={styles.previewContent}>
                  <p className={styles.previewTitle}>{spotlight.journey.page}</p>
                  <ul className={styles.pageDetails}>{spotlight.journey.details.map(detail => <li key={detail}><Check size={13} aria-hidden="true" />{detail}</li>)}</ul>
                  <p className={styles.exampleAction}>{spotlight.journey.action}<ArrowUpRight size={15} aria-hidden="true" /></p>
                </div>
              </div>
            </div>
          </li>
          <li>
            <span className={styles.stepNumber} aria-hidden="true">03</span>
            <div className={styles.stepContent}>
              <p className={styles.stepLabel}>An enquiry your team can act on</p>
              <div className={styles.handoff}><MessageSquare size={19} aria-hidden="true" /><p>{spotlight.journey.handoff}</p></div>
            </div>
          </li>
        </ol>
        <p className={styles.exampleNote}>Example workflow, not a client case study or a guaranteed result.</p>
      </div>
    </section>
  )
}
