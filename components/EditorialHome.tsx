'use client'

import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Plus, Search } from 'lucide-react'
import { ProjectPreview } from '@/components/ProjectPreview'
import { projects } from '@/lib/work-showcase'
import styles from './EditorialHome.module.css'

type Guide = { slug: string; title: string; category: string }
const questions = [
  { question: 'What is AI-search visibility?', answer: 'It is how easily people can discover and understand your business through AI-powered search. Answer engine optimization (AEO) improves the technical foundations, service information and evidence that support that discovery.' },
  { question: 'Do I need a new website?', answer: 'Not necessarily. We start with what you have. A redesign is a separate scope, recommended only when the existing website or enquiry experience needs it.' },
  { question: 'Can you guarantee a ChatGPT recommendation?', answer: 'No. AI answers vary and placements are not ours to sell. We document the questions tested, changes made and evidence observed, alongside relevant visits and enquiries.' },
  { question: 'What does it cost to get started?', answer: 'An enquiry is free. A full AI Visibility Audit is a paid, separately quoted service. We agree the scope, fee and delivery date before paid work begins. Website projects and the AI receptionist pilot have their own pricing.' },
]
const services = [
  { number: '01', title: 'AI-search visibility.', description: 'Find the gaps. Strengthen your search foundations. Make your expertise easier to discover.', href: '/ai-search-optimization', label: 'Explore AEO' },
  { number: '02', title: 'Websites with purpose.', description: 'A better first impression. Clearer services. A simpler route from visitor to enquiry.', href: '/website-redesign', label: 'Explore website design' },
  { number: '03', title: 'Ready for the call.', description: 'Explore after-hours enquiry capture and callbacks, configured around your business.', href: '/ai-receptionist', label: 'Explore AI receptionist', tag: 'Founding pilot' },
]
const enquiryOptions = [
  { value: 'audit', label: 'AI Visibility Audit' },
  { value: 'aeo', label: 'AEO implementation / ongoing support' },
  { value: '1k', label: 'Website Refresh — $1,000 scope' },
  { value: '2.5k', label: 'Growth Site — from $2,500' },
  { value: 'monthly', label: 'Website partnership' },
  { value: 'unsure', label: 'Help me decide' },
]

/** Retains the existing contact API and analytics classification. */
function HomeEnquiry() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [service, setService] = useState('audit')
  const submitting = useRef(false)
  const statusRef = useRef<HTMLDivElement>(null)
  const isWebsite = ['1k', '2.5k', 'monthly'].includes(service)

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
      setStatus('success')
      form.reset()
      requestAnimationFrame(() => statusRef.current?.focus())
    } catch { setStatus('error') }
    finally { clearTimeout(timeout); submitting.current = false }
  }

  return <section id="contact" className={styles.contact} aria-labelledby="home-contact-heading">
    <div className={`${styles.container} ${styles.contactGrid}`}>
      <div>
        <p className={styles.eyebrow}>Your next chapter</p>
        <h2 id="home-contact-heading" className={styles.contactHeading}>Good business.<br />Let&apos;s get it<br /><span>found.</span></h2>
        <p className={styles.contactIntro}>Tell us where you are now.<br />We&apos;ll help you find the next useful step.</p>
        <a className={styles.emailLink} href="mailto:hello@picshaw.com">hello@picshaw.com <ArrowUpRight size={18} aria-hidden="true" /></a>
      </div>
      <div className={styles.enquiryPanel}>
        {status === 'success' ? <div ref={statusRef} tabIndex={-1} role="status" className={styles.success}>
          <Check size={32} aria-hidden="true" /><h3>You&apos;re on our radar.</h3>
          <p>Your enquiry has been accepted. We&apos;ll review it and reply about the next step. No paid work has started.</p>
          <button className={styles.textLink} type="button" onClick={() => { setStatus('idle'); setService('audit') }}>Send another enquiry <ArrowRight size={16} aria-hidden="true" /></button>
        </div> : <form onSubmit={submit} className={styles.form} data-enquiry-type={isWebsite ? 'website' : 'aeo'} aria-busy={status === 'submitting'}>
          <h3>A little about your business.</h3>
          <p className={styles.formNote}>Free to enquire. Audits and projects are quoted before paid work begins.</p>
          <div className={styles.fieldPair}>
            <label htmlFor="home-name">Your name <span>(optional)</span><input id="home-name" name="name" autoComplete="name" maxLength={150} /></label>
            <label htmlFor="home-email">Email <span>(required)</span><input id="home-email" name="email" type="email" autoComplete="email" maxLength={254} required /></label>
          </div>
          <label htmlFor="home-website">Website <span>(required)</span><input id="home-website" name="website" type="text" inputMode="url" autoComplete="url" maxLength={2048} required placeholder="yourbusiness.com" /></label>
          <label htmlFor="home-service">What are you exploring?<select id="home-service" name="service_interest" value={service} onChange={event => setService(event.target.value)}>{enquiryOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label htmlFor="home-message">What would you like to improve? <span>(optional)</span><textarea id="home-message" name="message" rows={3} maxLength={5000} placeholder="Your services, location and what you have in mind." /></label>
          <button className={styles.primaryButton} type="submit" disabled={status === 'submitting'}>{status === 'submitting' ? 'Sending…' : 'Send enquiry'}<ArrowUpRight size={18} aria-hidden="true" /></button>
          {status === 'error' && <p className={styles.error} role="alert">Your message could not be sent. Please try again or email <a href="mailto:hello@picshaw.com">hello@picshaw.com</a>.</p>}
          <p className={styles.privacy}>Used only to respond to your enquiry. No newsletter signup or payment authorisation. Please leave out confidential customer information.</p>
        </form>}
      </div>
    </div>
  </section>
}

export function EditorialHome({ guides }: { guides: Guide[] }) {
  const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: questions.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) }
  return <div className={styles.home}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, '\\u003c') }} />
    <section className={styles.hero} aria-labelledby="home-title">
      <div className={styles.container}>
        <p className={styles.eyebrow}><span className={styles.dot} aria-hidden="true" />Independent studio / Los Angeles</p>
        <div className={styles.heroGrid}>
          <div>
            <h1 id="home-title" className={styles.heroTitle}>Be found.<br /><span>In AI search.</span></h1>
            <p className={styles.heroIntro}>We help local businesses improve their AI-search visibility through clearer websites, useful content and practical improvements.</p>
            <div className={styles.heroActions}><Link href="/ai-visibility-audit" className={styles.primaryButton}>Explore your AI audit<ArrowUpRight size={18} aria-hidden="true" /></Link><a href="#example" className={styles.textLink}>See the approach<ArrowDown size={16} aria-hidden="true" /></a></div>
          </div>
          {projects[0] && <figure className={styles.heroVisual}>
            <div className={styles.query}><Search size={18} aria-hidden="true" /><span>Who can help with my home project?</span><span className={styles.queryCursor} aria-hidden="true" /></div>
            <div className={styles.journeyLine} aria-hidden="true"><span /><ArrowDown size={18} /></div>
            <div className={styles.heroBrowser}><div className={styles.browserBar}><span className={styles.browserDots} aria-hidden="true">•••</span><span>A clearer place to land</span><ArrowUpRight size={13} aria-hidden="true" /></div><ProjectPreview project={projects[0]} /></div>
            <figcaption>Illustrative journey. Not a live search result or client outcome.</figcaption>
          </figure>}
        </div>
        <div className={styles.audience}><span>Built around local expertise.</span><p>Home services<span aria-hidden="true">/</span>Contractors<span aria-hidden="true">/</span>Owner-led businesses</p></div>
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
      <div className={styles.serviceList}>{services.map(service => <Link href={service.href} key={service.number} className={styles.serviceRow} aria-label={service.label}><span className={styles.serviceNumber}>{service.number}</span><div className={styles.serviceTitle}><h3>{service.title}</h3>{service.tag && <span className={styles.pilot}>{service.tag}</span>}</div><p>{service.description}</p><span className={styles.serviceArrow}><ArrowUpRight size={24} aria-hidden="true" /></span></Link>)}</div>
    </div></section>

    <section id="work" className={styles.work} aria-labelledby="work-heading"><div className={styles.container}>
      <div className={styles.sectionHead}><div><p className={styles.eyebrow}>03 / Design directions</p><h2 id="work-heading" className={styles.sectionTitle}>Different businesses.<br /><em>Distinctive websites.</em></h2></div><p className={styles.sideNote}>A selection of illustrative concepts.<br />Design capability, not client results.</p></div>
      <div className={styles.workGrid}>{projects.map(project => <article key={project.title} className={styles.workCard}>
        <figure><div className={styles.workPreview}><ProjectPreview project={project} /></div><figcaption className={styles.photoCredit}><span>Illustrative website design</span><a href={project.photography.url} target="_blank" rel="noopener noreferrer">Photography: {project.photography.name} / Unsplash</a></figcaption></figure>
        <div className={styles.workCaption}><div><p>{project.category} / {project.tag}</p><h3>{project.title}</h3></div>{project.destination ? <a href={project.destination.url} target="_blank" rel="noopener noreferrer" className={styles.textLink}>Visit {project.destination.host}<ArrowUpRight size={18} aria-hidden="true" /></a> : <Link href="/website-redesign" className={styles.projectLink} aria-label={`Discuss a design like ${project.title}`}><ArrowUpRight size={22} aria-hidden="true" /></Link>}{project.result && <p className={styles.verifiedResult}>{project.result.label} <a href={project.result.evidence.url}>{project.result.evidence.label}</a></p>}</div>
      </article>)}</div>
    </div></section>

    <section id="process" className={styles.approach} aria-labelledby="approach-heading"><div className={`${styles.container} ${styles.approachGrid}`}>
      <div><p className={styles.eyebrow}>04 / A considered approach</p><h2 id="approach-heading" className={styles.sectionTitle}>Small studio.<br /><em>Direct connection.</em></h2><p className={styles.sectionIntro}>Work directly with Ash Patel on a clearer online presence for your business. Practical decisions, an agreed scope, and a next step you understand.</p><Link href="/about" className={styles.textLink}>Meet Ash<ArrowUpRight size={18} aria-hidden="true" /></Link></div>
      <div className={styles.method}><ol>{[['Audit', 'Understand where you are.'], ['Improve', 'Fix what gets in the way.'], ['Measure', 'Review the evidence. Choose what is next.']].map(([title, description], index) => <li key={title}><span>0{index + 1}</span><div><h3>{title}<span aria-hidden="true">↗</span></h3><p>{description}</p></div></li>)}</ol><Link href="/methodology" className={styles.textLink}>Our measurement methodology<ArrowUpRight size={17} aria-hidden="true" /></Link></div>
    </div></section>

    {guides.length > 0 && <section className={styles.insights} aria-labelledby="insights-heading"><div className={styles.container}>
      <div className={styles.sectionHead}><div><p className={styles.eyebrow}>05 / Useful reading</p><h2 id="insights-heading" className={styles.sectionTitle}>A little more insight.</h2></div><Link href="/blog" className={styles.textLink}>All guides<ArrowUpRight size={18} aria-hidden="true" /></Link></div>
      <div className={styles.guideGrid}>{guides.slice(0, 2).map((guide, index) => <article key={guide.slug}><Link href={`/blog/${guide.slug}`} className={styles.guideLink}><div className={`${styles.guideArt} ${index === 0 ? styles.answerArt : styles.websiteArt}`} aria-hidden="true">{index === 0 ? <><span className={styles.artQuestion}>Q</span><ArrowUpRight /><span className={styles.artAnswer}>A</span></> : <><div className={styles.artWindow}><span /><i /><i /><i /></div><span className={styles.artCross}>+</span></>}</div><div className={styles.guideMeta}><span>{guide.category}</span><ArrowUpRight size={18} aria-hidden="true" /></div><h3>{guide.title}</h3></Link></article>)}</div>
    </div></section>}

    <section id="faq" className={styles.faq} aria-labelledby="faq-heading"><div className={`${styles.container} ${styles.faqGrid}`}><div><p className={styles.eyebrow}>A few good questions</p><h2 id="faq-heading" className={styles.sectionTitle}>Before we<br /><em>get started.</em></h2></div><div>{questions.map(item => <details className={styles.question} key={item.question}><summary>{item.question}<Plus size={19} aria-hidden="true" /></summary><p>{item.answer}</p></details>)}</div></div></section>
    <HomeEnquiry />
  </div>
}
