'use client'

import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Plus, Search } from 'lucide-react'
import { PortalShowcase } from '@/components/PortalShowcase'
import { ProjectPreview } from '@/components/ProjectPreview'
import { projects } from '@/lib/work-showcase'
import { sendLeadConversion } from '@/lib/google-conversions'
import { retainerOptions, isRetainerService, RETAINER_PATH, corePrice, auditPrice, usd } from '@/lib/retainer'
import styles from './EditorialHome.module.css'

type Guide = { slug: string; title: string; category: string }
type IndustryLink = { slug: string; name: string }
const questions = [
  { question: 'What is AI-search visibility?', answer: 'It is how easily people can discover and understand your business through AI-powered search. Answer engine optimization (AEO) improves the technical foundations, service information and evidence that support that discovery.' },
  { question: 'Do I need a new website?', answer: 'Not necessarily. We start with what you have. A redesign is a separate scope, recommended only when the existing website or enquiry experience needs it.' },
  { question: 'Can you guarantee a ChatGPT recommendation?', answer: 'No. AI answers vary and placements are not ours to sell. We document the questions tested, changes made and evidence observed, alongside relevant visits and enquiries.' },
  { question: 'What does it cost to get started?', answer: 'An enquiry is free. A single-location AI Visibility Audit is $1,250. The Core AI Visibility Retainer is $1,500 per month with a three-month minimum, then month to month. Website builds and the AI receptionist pilot are separate.' },
]
const services = [
  { number: '01', title: 'AEO & AI visibility.', description: 'Answer engine optimization for clearer visibility in ChatGPT, Perplexity and Google AI search experiences.', href: '/ai-search-optimization', label: 'Explore AEO' },
  { number: '02', title: 'Website design.', description: 'Mobile-first websites and redesigns that make your services clear and guide visitors to an enquiry.', href: '/website-redesign', label: 'Explore website design' },
  { number: '03', title: 'AI phone answering.', description: 'Explore after-hours call capture, enquiry qualification and callbacks through our managed AI receptionist pilot.', href: '/ai-receptionist', label: 'Explore AI receptionist', tag: 'Founding pilot' },
]
const enquiryOptions = [
  { value: 'audit', label: 'AI Visibility Audit — $1,250' },
  ...retainerOptions,
  { value: 'aeo', label: 'Other AEO implementation (quoted)' },
  { value: '1k', label: 'Website Refresh — $1,000 scope' },
  { value: '2.5k', label: 'Growth Site — from $2,500' },
  { value: 'monthly', label: 'Website maintenance only (not the AEO retainer)' },
  { value: 'unsure', label: 'Help me decide' },
]

/** Retains the existing contact API and analytics classification. */
function HomeEnquiry() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [service, setService] = useState('unsure')
  const submitting = useRef(false)
  const statusRef = useRef<HTMLDivElement>(null)
  const isWebsite = ['1k', '2.5k', 'monthly'].includes(service)
  const isRetainer = isRetainerService(service)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    const form = event.currentTarget
    const fields = new FormData(form)
    setStatus('submitting')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    try {
      const response = await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({
          name: String(fields.get('name') || ''), email: String(fields.get('email') || ''),
          website: String(fields.get('website') || ''), message: String(fields.get('message') || ''),
          business: '', service_interest: service,
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || result?.success !== true) throw new Error('Enquiry not accepted')
      sendLeadConversion()
      setStatus('success')
      form.reset()
      requestAnimationFrame(() => statusRef.current?.focus())
    } catch { setStatus('error') }
    finally { clearTimeout(timeout); submitting.current = false }
  }

  return <section id="contact" className={styles.contact} aria-labelledby="home-contact-heading">
    <div className={`${styles.container} ${styles.contactGrid}`}>
      <div>
        <p className={styles.eyebrow}>Start with a conversation</p>
        <h2 id="home-contact-heading" className={styles.contactHeading}>What&apos;s holding<br />your website<br /><span>back?</span></h2>
        <p className={styles.contactIntro}>Tell us what you do and where you want to improve. We&apos;ll help you choose a sensible starting point, with scope and pricing agreed before paid work begins.</p>
        <a className={styles.emailLink} href="mailto:hello@picshaw.com">hello@picshaw.com <ArrowUpRight size={18} aria-hidden="true" /></a>
      </div>
      <div className={styles.enquiryPanel}>
        {status === 'success' ? <div ref={statusRef} tabIndex={-1} role="status" className={styles.success}>
          <Check size={32} aria-hidden="true" /><h3>You&apos;re on our radar.</h3>
          <p>Your enquiry has been accepted. We&apos;ll review it and reply about the next step. No paid work has started. Founding availability is confirmed in writing.</p>
          <button className={styles.textLink} type="button" onClick={() => { setStatus('idle'); setService('unsure') }}>Send another enquiry <ArrowRight size={16} aria-hidden="true" /></button>
        </div> : <form onSubmit={submit} className={styles.form} data-enquiry-type={isWebsite ? 'website' : 'aeo'} aria-busy={status === 'submitting'}>
          <h3>Let&apos;s find your next step.</h3>
          <p className={styles.formNote}>Free to enquire. No payment, account or commitment needed. Not sure which service fits? Choose Help me decide.</p>
          <div className={styles.fieldPair}>
            <label htmlFor="home-name">Your name <span>(optional)</span><input id="home-name" name="name" autoComplete="name" maxLength={150} /></label>
            <label htmlFor="home-email">Email <span>(required)</span><input id="home-email" name="email" type="email" autoComplete="email" maxLength={254} required /></label>
          </div>
          <label htmlFor="home-website">Website <span>(required)</span><input id="home-website" name="website" type="text" inputMode="url" autoComplete="url" maxLength={2048} required placeholder="yourbusiness.com" /></label>
          <label htmlFor="home-service">What are you exploring?<select id="home-service" name="service_interest" value={service} onChange={event => setService(event.target.value)}>{enquiryOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label htmlFor="home-message">What would you like to improve? <span>(optional)</span><textarea id="home-message" name="message" rows={3} maxLength={5000} placeholder="Your services, location and what you have in mind." /></label>
          {isRetainer && <p className={styles.formNote}>Three-month minimum, then month to month for standard Core. Founding and annual plans have separate terms. See <Link href={RETAINER_PATH} className="underline underline-offset-4">full monthly pricing</Link>.</p>}
          <button className={styles.primaryButton} type="submit" disabled={status === 'submitting'}>{status === 'submitting' ? 'Sending…' : 'Discuss my business'}<ArrowUpRight size={18} aria-hidden="true" /></button>
          {status === 'error' && <p className={styles.error} role="alert">Your message could not be sent. Please try again or email <a href="mailto:hello@picshaw.com">hello@picshaw.com</a>.</p>}
          <p className={styles.privacy}>Used only to respond to your enquiry. No newsletter signup or payment authorisation. Please leave out confidential customer information. <Link href="/privacy-policy" className="underline underline-offset-4">Privacy Policy</Link>.</p>
        </form>}
      </div>
    </div>
  </section>
}

export function EditorialHome({ guides, industryLinks }: { guides: Guide[]; industryLinks: IndustryLink[] }) {
  const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: questions.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) }
  return <div className={styles.home}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, '\\u003c') }} />
    <section className={styles.hero} aria-labelledby="home-title">
      <div className={styles.container}>
        <p className={styles.eyebrow}><span className={styles.dot} aria-hidden="true" />Independent studio / Los Angeles</p>
        <div className={styles.heroGrid}>
          <div>
            <h1 id="home-title" className={styles.heroTitle}>Get found.<br /><span>Give customers<br />a reason to call.</span></h1>
            <p className={styles.heroIntro}>Website design, local SEO and AI-search visibility for service businesses across Los Angeles and Orange County. Help customers find your services, understand your value and get in touch.</p>
            <div className={styles.heroActions}><a href="#contact" className={styles.primaryButton}>Discuss my business<ArrowUpRight size={18} aria-hidden="true" /></a><a href="#services" className={styles.textLink}>See services &amp; pricing<ArrowDown size={16} aria-hidden="true" /></a></div>
          </div>

          <aside className={styles.opportunityCard} aria-labelledby="opportunity-heading">
            <div className={styles.opportunityTop}><span>PICSHAW / THE CUSTOMER JOURNEY</span><Search size={19} aria-hidden="true" /></div>
            <h2 id="opportunity-heading">Good at what you do.<br /><em>Clear online, too.</em></h2>
            <p>Three places your next customer needs clarity.</p>
            <ol className={styles.opportunitySteps}>
              <li><span>01</span><div><h3>Can they find you?</h3><p>Search-ready pages that explain your services and where you work.</p></div></li>
              <li><span>02</span><div><h3>Why should they choose you?</h3><p>A distinctive website with real work, useful answers and a clear offer.</p></div></li>
              <li><span>03</span><div><h3>What happens next?</h3><p>Simple enquiries and a clear route to a conversation with your business.</p></div></li>
            </ol>
            <a href="#example" className={styles.opportunityLink}>See how we approach it <ArrowUpRight size={18} aria-hidden="true" /></a>
          </aside>
        </div>
        <p className={styles.heroReassurance}>Work directly with Ash Patel. Clear scope. No ranking or lead guarantees.</p>
        <div className={styles.audience}><span>Built around local expertise.</span><p>Practices<span aria-hidden="true">/</span>Professional services<span aria-hidden="true">/</span>Trades<span aria-hidden="true">/</span>Hospitality</p></div>
      </div>
    </section>

    <section id="example" className={styles.example} aria-labelledby="example-heading">
      <div className={`${styles.container} ${styles.exampleGrid}`}>
        <div><p className={styles.eyebrow}>01 / Visibility, made tangible</p><h2 id="example-heading" className={styles.sectionTitle}>Less mystery.<br /><em>More clarity.</em></h2><p className={styles.sectionIntro}>An audit should leave you with something useful: a clear baseline, the gaps worth fixing, and a plan for what comes next.</p><Link href="/ai-visibility-audit" className={styles.textLink}>Inside the AI Visibility Audit<ArrowUpRight size={18} aria-hidden="true" /></Link></div>
        <figure className={styles.auditFigure}><div className={styles.auditSheet}>
          <div className={styles.auditTop}><span>PICSHAW / FIELD NOTES</span><span className={styles.sampleTag}>Sample deliverable</span></div>
          <h3>AI visibility<br /><em>starts here.</em></h3><p className={styles.auditSubtitle}>A practical view of what to work on next.</p>
          <div className={styles.auditRows}>{[['01', 'Access', 'Can your key pages be read?'], ['02', 'Clarity', 'Do your services answer buyer questions?'], ['03', 'Evidence', 'Is your expertise supported by real work?']].map(([number, title, description]) => <div className={styles.auditRow} key={number}><span>{number}</span><div><strong>{title}</strong><p>{description}</p></div><ArrowUpRight size={17} aria-hidden="true" /></div>)}</div>
          <div className={styles.auditBottom}><span>Baseline → Priorities → Next steps</span><span aria-hidden="true">↗</span></div>
        </div><figcaption>Example format. These are not findings about your business.</figcaption></figure>
      </div>
    </section>



    <section id="services" className={styles.services} aria-labelledby="services-heading"><div className={styles.container}>
      <span id="pricing" className={styles.anchor} />
      <div className={styles.sectionHead}><div><p className={styles.eyebrow}>02 / What we do</p><h2 id="services-heading" className={styles.sectionTitle}>Get found.<br />Make it count.</h2></div><p className={styles.sideNote}>AI visibility is the starting point.<br />Design and useful tools support it.</p></div>

      <div className={styles.offerGrid}>
        <article className={styles.offerCard}><p className={styles.offerLabel}>Make a better first impression</p><h3>Website refresh</h3><p className={styles.offerPrice}>$1,000 <span>defined scope</span></p><p>Improve your existing website&apos;s presentation and route to enquiry. Larger Growth Sites start at $2,500.</p><Link href="/website-redesign" className={styles.textLink}>See website options <ArrowUpRight size={17} aria-hidden="true" /></Link></article>
        <article className={styles.offerCard}><p className={styles.offerLabel}>Know what to fix first</p><h3>AI Visibility Audit</h3><p className={styles.offerPrice}>{usd(auditPrice)} <span>one location</span></p><p>A baseline of your visibility, the gaps worth fixing, and a prioritised plan. A separate paid service.</p><Link href="/ai-visibility-audit" className={styles.textLink}>See the audit scope <ArrowUpRight size={17} aria-hidden="true" /></Link></article>
        <article className={styles.offerCard}><p className={styles.offerLabel}>Keep improving</p><h3>Monthly AI visibility</h3><p className={styles.offerPrice}>{usd(corePrice)} <span>/ month · Core</span></p><p>Ongoing improvements and measurement after your audit. Three-month minimum, then month to month.</p><Link href={RETAINER_PATH} className={styles.textLink}>Compare plans &amp; terms <ArrowUpRight size={17} aria-hidden="true" /></Link></article>
      </div>
      <p className={styles.pricingNote}>Prices in USD. Scope and any applicable taxes confirmed before paid work. AI receptionist is a separate founding pilot, scoped on enquiry.</p>
      <div className={styles.serviceList}>{services.map(service => <Link href={service.href} key={service.number} className={styles.serviceRow} aria-label={service.label}><span className={styles.serviceNumber}>{service.number}</span><div className={styles.serviceTitle}><h3>{service.title}</h3>{service.tag && <span className={styles.pilot}>{service.tag}</span>}</div><p>{service.description}</p><span className={styles.serviceArrow}><ArrowUpRight size={24} aria-hidden="true" /></span></Link>)}</div>
      <div className={styles.serviceDiscovery}><Link href="/local-seo">Local SEO</Link><Link href="/google-business-profile-optimization">Google Business Profile optimization</Link><Link href="/technical-seo">Technical SEO</Link><Link href="/landing-page-design">Landing page design</Link><Link href="/services">All services <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
    </div></section>

    <HomeEnquiry />
    <section id="industries" className={styles.industrySection} aria-labelledby="home-industries-heading"><div className={styles.container}>
      <div className={styles.sectionHead}><div><p className={styles.eyebrow}>Built around your customers</p><h2 id="home-industries-heading" className={styles.sectionTitle}>Your industry.<br /><em>Their next search.</em></h2></div><p className={styles.sideNote}>SEO, AI visibility and website design shaped around the way your customers choose.</p></div>
      <div className={styles.industryGrid}>{industryLinks.map(industry => <Link key={industry.slug} href={`/industries/${industry.slug}`}>{industry.name}<ArrowUpRight size={17} aria-hidden="true" /></Link>)}</div>
      <Link href="/industries" className={styles.textLink}>Explore services for your industry<ArrowRight size={17} aria-hidden="true" /></Link>
    </div></section>
    <section id="work" className={styles.work} aria-labelledby="work-heading"><div className={styles.container}>
      <div className={styles.sectionHead}><div><p className={styles.eyebrow}>03 / Design directions</p><h2 id="work-heading" className={styles.sectionTitle}>Different businesses.<br /><em>Distinctive websites.</em></h2></div><p className={styles.sideNote}>A selection of illustrative concepts.<br />Design capability, not client results.</p></div>
      <div className={styles.workGrid}>{projects.map(project => <article key={project.title} className={styles.workCard}>
        <figure><div className={styles.workPreview}><ProjectPreview project={project} /></div><figcaption className={styles.photoCredit}><span>Illustrative website design</span><a href={project.photography.url} target="_blank" rel="noopener noreferrer">Photography: {project.photography.name} / Unsplash</a></figcaption></figure>
        <div className={styles.workCaption}><div><p>{project.category} / {project.tag}</p><h3>{project.title}</h3></div>{project.destination ? <a href={project.destination.url} target="_blank" rel="noopener noreferrer" className={styles.textLink}>Visit {project.destination.host}<ArrowUpRight size={18} aria-hidden="true" /></a> : <Link href="/website-redesign" className={styles.projectLink} aria-label={`Discuss a design like ${project.title}`}><ArrowUpRight size={22} aria-hidden="true" /></Link>}{project.result && <p className={styles.verifiedResult}>{project.result.label} <a href={project.result.evidence.url}>{project.result.evidence.label}</a></p>}</div>
      </article>)}</div>
    </div></section>

    <PortalShowcase />
    <section id="process" className={styles.approach} aria-labelledby="approach-heading"><div className={`${styles.container} ${styles.approachGrid}`}>
      <div><p className={styles.eyebrow}>04 / A considered approach</p><h2 id="approach-heading" className={styles.sectionTitle}>Small studio.<br /><em>Direct connection.</em></h2><p className={styles.sectionIntro}>Work directly with Ash Patel on a clearer online presence for your business. Practical decisions, an agreed scope, and a next step you understand.</p><Link href="/about" className={styles.textLink}>Meet Ash<ArrowUpRight size={18} aria-hidden="true" /></Link></div>
      <div className={styles.method}><ol>{[['Audit', 'Understand where you are.'], ['Improve', 'Fix what gets in the way.'], ['Measure', 'Review the evidence. Choose what is next.']].map(([title, description], index) => <li key={title}><span>0{index + 1}</span><div><h3>{title}<span aria-hidden="true">↗</span></h3><p>{description}</p></div></li>)}</ol><Link href="/methodology" className={styles.textLink}>Our measurement methodology<ArrowUpRight size={17} aria-hidden="true" /></Link></div>
    </div></section>

    {guides.length > 0 && <section className={styles.insights} aria-labelledby="insights-heading"><div className={styles.container}>
      <div className={styles.sectionHead}><div><p className={styles.eyebrow}>05 / Useful reading</p><h2 id="insights-heading" className={styles.sectionTitle}>A little more insight.</h2></div><Link href="/blog" className={styles.textLink}>All guides<ArrowUpRight size={18} aria-hidden="true" /></Link></div>
      <div className={styles.guideGrid}>{guides.slice(0, 2).map((guide, index) => <article key={guide.slug}><Link href={`/blog/${guide.slug}`} className={styles.guideLink}><div className={`${styles.guideArt} ${index === 0 ? styles.answerArt : styles.websiteArt}`} aria-hidden="true">{index === 0 ? <><span className={styles.artQuestion}>Q</span><ArrowUpRight /><span className={styles.artAnswer}>A</span></> : <><div className={styles.artWindow}><span /><i /><i /><i /></div><span className={styles.artCross}>+</span></>}</div><div className={styles.guideMeta}><span>{guide.category}</span><ArrowUpRight size={18} aria-hidden="true" /></div><h3>{guide.title}</h3></Link></article>)}</div>
    </div></section>}

    <section id="faq" className={styles.faq} aria-labelledby="faq-heading"><div className={`${styles.container} ${styles.faqGrid}`}><div><p className={styles.eyebrow}>A few good questions</p><h2 id="faq-heading" className={styles.sectionTitle}>Before we<br /><em>get started.</em></h2></div><div>{questions.map(item => <details className={styles.question} key={item.question}><summary>{item.question}<Plus size={19} aria-hidden="true" /></summary><p>{item.answer}</p></details>)}</div></div></section>

  </div>
}
