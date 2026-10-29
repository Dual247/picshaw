import Link from 'next/link'
import { ArrowUpRight, Check, ChevronDown, ClipboardList, Phone, PhoneForwarded, Play, ShieldCheck } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { ReceptionistEnquiry } from '@/components/ReceptionistEnquiry'
import { ReceptionistExplainer } from '@/components/ReceptionistExplainer'
import { ReceptionistUsageEstimator } from '@/components/ReceptionistUsageEstimator'
import { absoluteUrl, jsonLd, ORGANIZATION_ID, pageMetadata } from '@/lib/site'
import { receptionistFAQs, receptionistOffer } from '@/lib/receptionist'
import { receptionistMoney as money } from '@/lib/receptionist-usage'

const description = 'See how Picshaw’s AI receptionist pilot turns unanswered calls into enquiries. $399/month, $500 setup, 500 included minutes and $0.50 per additional minute.'
export const metadata = pageMetadata('AI Receptionist for Plumbing & Local Service Businesses', description, '/ai-receptionist')
const container = 'mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20'
const eyebrow = 'text-xs font-medium uppercase tracking-[0.18em] text-primary'
const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary'
const primaryButton = `inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 ${focus}`
const capabilities = [
  { icon: Phone, title: 'Pick up the opportunity.', text: 'Handle agreed unanswered or after-hours calls using your approved services, hours and business information.' },
  { icon: ClipboardList, title: 'Find out what they need.', text: 'Capture a name, callback details, service area and job request. Ask the questions that help your team qualify the enquiry.' },
  { icon: PhoneForwarded, title: 'Give your team a next step.', text: 'Pass on a clear summary and callback request through an agreed handover process. Calendar workflows are confirmed separately.' },
]
const setupSteps = [
  ['Scope', 'Agree your services, coverage, FAQs and the calls that need a person.'],
  ['Configure', 'Build one inbound call flow and your agreed callback workflow.'],
  ['Test', 'Try realistic scenarios, transfers and failure handling together.'],
  ['Activate', 'Launch only once permissions, routing and required notices are ready.'],
] as const

export default function AIReceptionistPage() {
  const url = absoluteUrl('/ai-receptionist')
  const schema = {
    '@context': 'https://schema.org', '@graph': [
      { '@type': 'Service', '@id': `${url}#service`, name: 'Picshaw AI Receptionist Founding Pilot', serviceType: 'Managed inbound AI receptionist pilot', description, url, provider: { '@id': ORGANIZATION_ID }, offers: { '@type': 'Offer', price: String(receptionistOffer.monthly), priceCurrency: 'USD', url: `${url}#pricing`, description: '$399 monthly base fee, plus $500 one-time setup. Includes 500 call minutes per month; additional minutes $0.50. Activation and terms confirmed in a written proposal.' } },
      { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') }, { '@type': 'ListItem', position: 2, name: 'AI receptionist', item: url }] },
      { '@type': 'FAQPage', '@id': `${url}#faq`, mainEntity: receptionistFAQs.map(faq => ({ '@type': 'Question', name: faq.question, acceptedAnswer: { '@type': 'Answer', text: faq.answer } })) },
      { '@type': 'VideoObject', '@id': `${url}#explainer`, name: 'Picshaw AI receptionist: from call to follow-up', description: 'A 42-second silent, illustrated workflow: an incoming call, AI introduction, job qualification, example enquiry summary and callback handover. Not a real customer call or live voice demonstration.', thumbnailUrl: absoluteUrl('/media/receptionist-poster.jpg'), contentUrl: absoluteUrl('/media/receptionist-walkthrough.mp4'), uploadDate: '2026-10-29T19:32:21Z', duration: 'PT42S', publisher: { '@id': ORGANIZATION_ID } },
    ],
  }
  return <>
    <Header />
    <main id="main-content" className="relative min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
      <section className="relative border-b border-border bg-[#10140f] pb-14 pt-32 md:pb-20 md:pt-40" aria-labelledby="receptionist-title">
        <div className={container}>
          <nav aria-label="Breadcrumb" className="mb-9 flex items-center gap-3 text-xs text-muted-foreground"><Link href="/" className={`hover:text-foreground ${focus}`}>Home</Link><span aria-hidden="true">/</span><span aria-current="page">AI receptionist</span></nav>
          <div className="grid items-center gap-10 lg:grid-cols-[.9fr_1.1fr] lg:gap-12">
            <div className="min-w-0">
              <p className={eyebrow}>Managed by Picshaw / Founding pilot</p>
              <h1 id="receptionist-title" className="mt-6 text-[clamp(2.6rem,4.7vw,4.3rem)] font-semibold leading-[1.05] tracking-[-0.045em]">You do the work.<br /><span className="text-primary">Let AI take<br />the call.</span></h1>
              <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">Turn unanswered calls into clear enquiries for your team. See the workflow, understand the cost, then discuss a setup for your business.</p>
              <p className="mt-6 text-xl font-medium">{money(receptionistOffer.monthly)}<span className="text-sm font-normal text-muted-foreground"> / month</span><span className="mx-3 text-muted-foreground">+</span>{money(receptionistOffer.setup)}<span className="text-sm font-normal text-muted-foreground"> setup</span></p>
              <p className="mt-2 text-sm text-muted-foreground">{receptionistOffer.includedMinutes} included minutes · ${receptionistOffer.additionalMinute.toFixed(2)} per extra minute · USD</p>
              <div className="mt-7 flex flex-wrap items-center gap-5"><a href="#enquiry" className={primaryButton}>Request a demo<ArrowUpRight size={18} aria-hidden="true" /></a><a href="#pricing" className={`inline-flex min-h-12 items-center gap-2 text-sm font-medium ${focus}`}>See the full pricing<ArrowUpRight size={16} aria-hidden="true" /></a></div>
              <p className="mt-4 max-w-md text-xs leading-6 text-muted-foreground">Demo availability and activation are confirmed after a fit check. No payment required to enquire.</p>
            </div>
            <div className="min-w-0"><p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"><Play size={15} aria-hidden="true" />See the workflow in 42 seconds</p><ReceptionistExplainer /></div>
          </div>
        </div>
      </section>

      <section className="border-b border-border py-12 md:py-16" aria-labelledby="call-flow-title"><div className={container}>
        <h2 id="call-flow-title" className="sr-only">From call to enquiry</h2>
        <div className="grid gap-8 md:grid-cols-3">{capabilities.map(({ icon: Icon, title, text }) => <article key={title}><Icon size={23} className="text-primary" aria-hidden="true" /><h3 className="mt-4 text-xl font-semibold tracking-tight">{title}</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">{text}</p></article>)}</div>
      </div></section>

      <section id="pricing" className="scroll-mt-28 py-16 md:py-24" aria-labelledby="pricing-title"><div className={container}>
        <div className="mb-9 max-w-2xl"><p className={eyebrow}>Founding-pilot pricing</p><h2 id="pricing-title" className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">Know what you are paying for.</h2><p className="mt-5 text-base leading-8 text-muted-foreground">One managed pilot for one business. A monthly fee, one-time setup and a clear rate for extra call time.</p></div>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="min-w-0 rounded-2xl border border-primary/35 bg-card p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">AI receptionist pilot</h3><span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">Managed by Picshaw</span></div>
            <p className="mt-7"><span className="text-6xl font-semibold tracking-tight">{money(receptionistOffer.monthly)}</span><span className="ml-2 text-sm text-muted-foreground">/ month</span></p>
            <dl className="my-6 divide-y divide-border border-y border-border text-sm">
              <div className="flex flex-wrap justify-between gap-2 py-4"><dt className="text-muted-foreground">One-time setup</dt><dd className="font-medium">{money(receptionistOffer.setup)}</dd></div>
              <div className="flex flex-wrap justify-between gap-2 py-4"><dt className="text-muted-foreground">Included call time</dt><dd className="font-medium">{receptionistOffer.includedMinutes} minutes / month</dd></div>
              <div className="flex flex-wrap justify-between gap-2 py-4"><dt className="text-muted-foreground">Additional minutes</dt><dd className="font-medium">${receptionistOffer.additionalMinute.toFixed(2)} / minute</dd></div>
              <div className="flex flex-wrap justify-between gap-2 py-4"><dt className="font-medium">Setup + first month, before extras</dt><dd className="font-semibold text-primary">{money(receptionistOffer.setup + receptionistOffer.monthly)}</dd></div>
            </dl>
            <ul className="space-y-3 text-sm">{['Your approved FAQs and business information', 'One inbound call flow with agreed hours and routing', 'Caller details, job information and enquiry summaries', 'One agreed callback or consultation workflow', 'Pre-launch testing and agreed pilot support'].map(item => <li key={item} className="flex items-start gap-3 leading-6"><Check size={16} className="mt-1 shrink-0 text-primary" aria-hidden="true" />{item}</li>)}</ul>
            <a href="#enquiry" className={`${primaryButton} mt-7 w-full`}>Discuss my pilot<ArrowUpRight size={18} aria-hidden="true" /></a>
            <p className="mt-4 text-xs leading-6 text-muted-foreground">All prices USD. Applicable taxes, bespoke integrations, any additional service costs, billing and cancellation terms are confirmed in the written proposal. No unlimited-use promise. No payment is taken on this page.</p>
          </div>
          <ReceptionistUsageEstimator />
        </div>
        <p className="mt-6 text-sm leading-7 text-muted-foreground">For context: 1,000 call minutes would be {money(receptionistOffer.monthly + 500 * receptionistOffer.additionalMinute)} for the month before tax, with setup charged separately. Minutes—not a guaranteed number of calls—determine usage. Additional workflows, locations or non-standard integrations need a separate quote.</p>
      </div></section>

      <section id="how-it-works" className="scroll-mt-28 border-y border-border bg-card/35 py-16 md:py-20" aria-labelledby="setup-title"><div className={container}>
        <p className={eyebrow}>Done for you. Tested with you.</p><h2 id="setup-title" className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">Your calls. Your rules.</h2>
        <ol className="mt-9 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">{setupSteps.map(([title, text], index) => <li key={title} className="border-t border-border pt-5"><span className="font-mono text-xs text-primary">0{index + 1}</span><h3 className="mt-3 text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">{text}</p></li>)}</ol>
        <aside className="mt-9 flex items-start gap-4 rounded-xl border border-border bg-background p-6"><ShieldCheck size={22} className="mt-1 shrink-0 text-primary" aria-hidden="true" /><div><h3 className="font-semibold">People stay in control.</h3><p className="mt-2 max-w-4xl text-sm leading-7 text-muted-foreground">The assistant identifies itself as AI. The initial pilot is not emergency dispatch, medical intake, payment collection or a source of binding quotes. A calendar booking is only confirmed when the booking system accepts it. Caller notices, consent settings, handover and fallback rules are agreed before launch.</p></div></aside>
      </div></section>

      <section id="faq" className="scroll-mt-28 py-16 md:py-20" aria-labelledby="faq-title"><div className={`${container} grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:gap-16`}>
        <div><p className={eyebrow}>Before your first call</p><h2 id="faq-title" className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">A few good questions.</h2><p className="mt-5 text-sm leading-7 text-muted-foreground">Designed initially for independent plumbing businesses. Other local service businesses can enquire; fit and availability are confirmed individually.</p></div>
        <div className="divide-y divide-border border-y border-border">{receptionistFAQs.map(faq => <details key={faq.question} className="group py-5"><summary className={`flex cursor-pointer list-none items-center justify-between gap-5 text-sm font-medium [&::-webkit-details-marker]:hidden ${focus}`}>{faq.question}<ChevronDown size={18} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" /></summary><p className="mt-4 text-sm leading-7 text-muted-foreground">{faq.answer}</p></details>)}</div>
      </div></section>

      <section id="enquiry" className="scroll-mt-28 border-t border-border pb-20 pt-16 md:py-24" aria-labelledby="enquiry-title"><div className={`${container} grid items-start gap-10 lg:grid-cols-2 lg:gap-16`}>
        <div><p className={eyebrow}>Make it relevant to your business</p><h2 id="enquiry-title" className="mt-5 text-3xl font-semibold leading-tight tracking-tight md:text-5xl">Let us walk through<br />your next call.</h2><p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">Tell us what your business does and when calls go unanswered. We will discuss a realistic demonstration and confirm the setup, price and next steps.</p><p className="mt-5 text-sm leading-7 text-muted-foreground">No subscription, appointment or phone service starts when you submit this form. Do not include sensitive customer information.</p><a href="mailto:hello@picshaw.com?subject=AI%20receptionist%20pilot%20enquiry" className={`mt-6 inline-flex min-h-11 items-center gap-2 text-sm text-primary ${focus}`}>hello@picshaw.com<ArrowUpRight size={16} aria-hidden="true" /></a></div>
        <ReceptionistEnquiry />
      </div></section>
    </main>
    <Footer />
  </>
}
