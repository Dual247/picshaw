import Image from 'next/image'
import Link from 'next/link'
import { ArrowDown, ArrowUpRight, Check, ChevronRight, LayoutTemplate, MapPin, MessageSquare, MousePointer2, Phone, Plus, Search, Smartphone } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Contact } from '@/components/Contact'
import type { ContentSection, Service } from '@/lib/content'
import { absoluteUrl, jsonLd, ORGANIZATION_ID } from '@/lib/site'
import styles from './ContractorLanding.module.css'

const featureIcons = [LayoutTemplate, Smartphone, MessageSquare, Search, MousePointer2, Phone]
const trades = ['Plumbing', 'HVAC', 'Roofing', 'Electrical', 'Landscaping', 'Remodeling']
const journeys = [
  { label: 'Repairs & maintenance', title: 'Make it easy to call.', text: 'Plumbers, HVAC technicians and electricians need clear services, coverage areas and availability. Put the phone number within reach when a homeowner needs help.', steps: ['Find the right service', 'Check the service area', 'Call your team'] },
  { label: 'Home improvement', title: 'Let the work speak.', text: 'Roofing, remodeling and renovation projects need more consideration. Show relevant project photos, explain your process and help homeowners request an estimate.', steps: ['Explore past projects', 'Understand the process', 'Request an estimate'] },
  { label: 'Outdoor & recurring services', title: 'Make the next visit simple.', text: 'Landscaping, cleaning and property care websites should explain one-off and recurring options. Help visitors check coverage and ask about the service they need.', steps: ['Compare service options', 'Check local coverage', 'Ask about a visit'] },
]

function SectionCopy({ section }: { section: ContentSection }) {
  return <>
    {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
    {section.bullets && <ul className={styles.checkList}>{section.bullets.map(item => <li key={item}><Check size={16} aria-hidden="true" /><span>{item}</span></li>)}</ul>}
    {section.links && <div className={styles.sectionLinks}>{section.links.map(link => <Link key={link.href} href={link.href}>{link.label}<ArrowUpRight size={15} aria-hidden="true" /></Link>)}</div>}
  </>
}

/** Server-rendered design example; the composition contains no pretend controls. */
function ContractorConcept() {
  return <figure className={styles.concept}>
    <div className={styles.conceptFrame}>
      <div className={styles.browserBar} aria-hidden="true"><span /><span /><span /><p>YOUR NEXT FIRST IMPRESSION</p></div>
      <div className={styles.conceptSite} role="img" aria-label="Illustrative Pacific Plumbing website design with a bathroom photograph, clear plumbing services and a request-a-visit call to action.">
        <div aria-hidden="true">
          <div className={styles.conceptNav}><p>PACIFIC<span>PLUMBING CO.</span></p><span>Services&nbsp;&nbsp; / &nbsp;&nbsp;Our approach</span><ArrowUpRight size={18} /></div>
          <div className={styles.conceptHero}>
            <Image src="https://images.unsplash.com/photo-1629079447777-1e605162dc8d?fm=webp&fit=crop&w=800&h=800&q=65" alt="" width={800} height={800} sizes="(max-width: 767px) 90vw, 540px" loading="eager" className={styles.conceptPhoto} />
            <div className={styles.conceptShade} />
            <div className={styles.conceptWords}><p>CARE FOR THE PLACE YOU CALL HOME</p><div>Good homes.<br /><em>Great plumbing.</em></div><span>Repairs, installations and everyday care.</span><span className={styles.conceptAction}>Request a visit <ArrowUpRight size={16} /></span></div>
          </div>
          <div className={styles.conceptServices}><span>Repair</span><span>Install</span><span>Maintain</span></div>
        </div>
      </div>
      <div className={styles.conceptNote}><Phone size={19} aria-hidden="true" /><div><strong>A clear route to the next job.</strong><span>Services. Local coverage. A simple enquiry.</span></div><ArrowUpRight size={19} aria-hidden="true" /></div>
    </div>
    <figcaption>Illustrative design concept. Photography by <a href="https://unsplash.com/photos/white-ceramic-sink-with-mirror-1AF5hP6F4tI">Steven Ungermann / Unsplash</a>.</figcaption>
  </figure>
}

export function ContractorLanding({ service }: { service: Service }) {
  const path = `/${service.slug}`
  const features = service.sections.filter(section => !['process', 'website-pricing'].includes(section.id))
  const process = service.sections.find(section => section.id === 'process')
  const pricing = service.sections.find(section => section.id === 'website-pricing')
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
        { '@type': 'ListItem', position: 2, name: service.title, item: absoluteUrl(path) },
      ] },
      { '@type': 'Service', '@id': absoluteUrl(`${path}#service`), name: service.title, description: service.description, url: absoluteUrl(path), provider: { '@id': ORGANIZATION_ID } },
    ],
  }

  return <><Header /><main id="main-content" className={styles.page}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    <section className={styles.hero} aria-labelledby="contractor-title">
      <div className={styles.container}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}><Link href="/">Home</Link><ChevronRight size={12} aria-hidden="true" /><span aria-current="page">Contractor website design</span></nav>
        <div className={styles.heroGrid}>
          <div><p className={styles.eyebrow}><span />{service.eyebrow}</p><h1 id="contractor-title">Website design for <span>home service contractors</span></h1><p className={styles.heroIntro}>{service.intro}</p>
            <div className={styles.heroActions}><a href="#contact" className={styles.primaryButton}>Discuss my website<ArrowUpRight size={18} aria-hidden="true" /></a><a href="#website-pricing" className={styles.textLink}>See packages<ArrowDown size={16} aria-hidden="true" /></a></div>
            <p className={styles.heroNote}>Website Refresh $1,000 · Growth Site from $2,500</p>
            <p className={styles.location}><MapPin size={14} aria-hidden="true" />Based in Los Angeles. Built around your service area.</p>
          </div>
          <ContractorConcept />
        </div>
        <div className={styles.tradeStrip}><span>Built for the work you do</span><ul>{trades.map(trade => <li key={trade}>{trade}</li>)}</ul></div>
      </div>
    </section>

    <nav aria-label="On this page" className={styles.jumpNav}><div className={styles.container}><span>Explore</span><a href="#what-you-get">What you get</a><a href="#your-trade">Your trade</a><a href="#process">Our process</a><a href="#website-pricing">Pricing</a><a href="#contractor-faq">Questions</a></div></nav>

    <section id="what-you-get" className={styles.features} aria-labelledby="features-title"><div className={styles.container}>
      <div className={styles.sectionHead}><div><p className={styles.eyebrow}>A website with a job to do</p><h2 id="features-title">Help homeowners choose<br /><em>your business.</em></h2></div><p>A useful website answers three things quickly: can you do the job, do you cover the area, and how can someone get in touch?</p></div>
      <div className={styles.featureGrid}>{features.map((section, index) => { const Icon = featureIcons[index] ?? LayoutTemplate; return <article key={section.id} id={section.id} className={styles.feature}><div className={styles.featureTop}><Icon size={24} strokeWidth={1.5} aria-hidden="true" /><span>0{index + 1}</span></div><h3>{section.title}</h3><SectionCopy section={section} /></article> })}</div>
    </div></section>

    <section id="your-trade" className={styles.trades} aria-labelledby="trades-title"><div className={styles.container}>
      <div className={styles.sectionHead}><div><p className={styles.eyebrow}>Different trades. Different decisions.</p><h2 id="trades-title">Designed around how<br />your customers choose.</h2></div><p>A small business website should reflect the jobs you want to win. These examples show how the route to an enquiry changes by trade.</p></div>
      <div className={styles.journeyGrid}>{journeys.map(journey => <article key={journey.label} className={styles.journey}><p className={styles.journeyLabel}>{journey.label}</p><h3>{journey.title}</h3><p>{journey.text}</p><ol>{journey.steps.map((step, index) => <li key={step}><span>0{index + 1}</span>{step}<ChevronRight size={14} aria-hidden="true" /></li>)}</ol></article>)}</div>
    </div></section>

    {process && <section id="process" className={styles.process} aria-labelledby="process-title"><div className={`${styles.container} ${styles.split}`}><div><p className={styles.eyebrow}>From first conversation to launch</p><h2 id="process-title">{process.title}</h2><div className={styles.bodyCopy}>{process.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div></div><div><ol className={styles.processSteps}>{process.bullets?.map((step, index) => <li key={step}><span>0{index + 1}</span><p>{step}</p></li>)}</ol><div className={styles.sectionLinks}>{process.links?.map(link => <Link key={link.href} href={link.href}>{link.label}<ArrowUpRight size={16} aria-hidden="true" /></Link>)}</div></div></div></section>}

    {pricing && <section id="website-pricing" className={styles.pricing} aria-labelledby="pricing-title"><div className={styles.container}>
      <div className={styles.sectionHead}><div><p className={styles.eyebrow}>Clear starting points</p><h2 id="pricing-title">{pricing.title}</h2></div><p>Choose a focused refresh or a fuller website. We confirm the pages, content, integrations and delivery date in your written scope.</p></div>
      <div className={styles.pricingGrid}><article className={styles.priceCard}><p className={styles.packageLabel}>Improve the site you have</p><h3>Website Refresh</h3><p className={styles.price}>$1,000 <span>defined scope</span></p><p>For an existing contractor website that needs clearer services, a stronger design and an easier route to enquiry.</p><ul className={styles.checkList}>{['Visual redesign and mobile-friendly layout', 'Clear service content and contact options', 'SEO structure and basic analytics setup'].map(item => <li key={item}><Check size={16} aria-hidden="true" /><span>{item}</span></li>)}</ul><a href="#contact" className={styles.textLink}>Discuss a refresh<ArrowUpRight size={17} aria-hidden="true" /></a></article>
        <article className={`${styles.priceCard} ${styles.growthCard}`}><p className={styles.packageLabel}>Give your services more room</p><h3>Growth Site</h3><p className={styles.price}><span>from</span> $2,500</p><p>For a business that needs a broader website, with room to explain its services, projects and service area.</p><ul className={styles.checkList}>{['A 5–10 page website', 'A planned service and content structure', 'A scope built around your enquiry goals'].map(item => <li key={item}><Check size={16} aria-hidden="true" /><span>{item}</span></li>)}</ul><a href="#contact" className={styles.textLink}>Discuss a Growth Site<ArrowUpRight size={17} aria-hidden="true" /></a></article></div>
      <div className={styles.pricingNotes}><SectionCopy section={pricing} /></div>
    </div></section>}

    <section id="contractor-faq" className={styles.faq} aria-labelledby="faq-title"><div className={`${styles.container} ${styles.split}`}><div><p className={styles.eyebrow}>Before you get started</p><h2 id="faq-title">Your website<br />questions, answered.</h2><p className={styles.faqIntro}>Need help deciding what your site needs? Tell us about your business and the jobs you want to attract.</p><a href="#contact" className={styles.textLink}>Talk through your website<ArrowUpRight size={17} aria-hidden="true" /></a></div><div>{service.questions.map(item => <details className={styles.question} key={item.question}><summary>{item.question}<Plus size={18} aria-hidden="true" /></summary><p>{item.answer}</p></details>)}</div></div></section>
    <div className={`${styles.container} ${styles.contact}`}><Contact compact initialService="unsure" variant="contractor" /></div>
  </main><Footer /></>
}
