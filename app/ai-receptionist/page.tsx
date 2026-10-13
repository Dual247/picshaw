import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Calendar, Check, ChevronDown, ClipboardList, Clock, MessageSquare, Phone, PhoneForwarded, ShieldCheck } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { ReceptionistEnquiry } from '@/components/ReceptionistEnquiry'
import { absoluteUrl, jsonLd, ORGANIZATION_ID, pageMetadata } from '@/lib/site'
import { receptionistFAQs, receptionistOffer } from '@/lib/receptionist'

export const metadata = pageMetadata(
  'AI Receptionist for Plumbing & Local Service Businesses',
  'Explore Picshaw’s managed AI receptionist pilot for after-hours calls, enquiry capture and callbacks. From $399/month plus setup. Request a demo.',
  '/ai-receptionist',
)

const container = 'mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20'
const eyebrow = 'text-xs font-medium uppercase tracking-[0.2em] text-primary'
const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary'
const primaryButton = `inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 ${focus}`
const capabilities = [
  { icon: Phone, title: 'Answer when you cannot.', text: 'Handle routine enquiries during the hours you choose, using your approved business information—not a generic script.' },
  { icon: ClipboardList, title: 'Get the useful details.', text: 'Capture a name, callback number, service area and job details. Ask the questions that help your team decide what comes next.' },
  { icon: Calendar, title: 'Arrange the next step.', text: 'Request a callback or, where configured, book an owner consultation against real calendar availability.' },
  { icon: PhoneForwarded, title: 'Keep people in the loop.', text: 'Pass an actionable summary to your team, with agreed transfer and fallback rules for calls the assistant cannot handle.' },
]
const steps = [
  { title: 'Map your calls', text: 'We agree your services, hours, service area, FAQs and the calls that need a person.' },
  { title: 'Build your call flow', text: 'We configure one inbound workflow, contact capture and your agreed callback process.' },
  { title: 'Test it together', text: 'You try realistic scenarios. We check failed bookings, unanswered transfers and fallback routing.' },
  { title: 'Launch a measured pilot', text: 'Once approvals and checks are complete, we review enquiry quality and follow-up—not just call counts.' },
]

export default function AIReceptionistPage() {
  const url = absoluteUrl('/ai-receptionist')
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Service', '@id': `${url}#service`, name: 'Picshaw AI Receptionist Founding Pilot', serviceType: 'Managed inbound AI receptionist pilot', description: 'Proposed managed service for after-hours and unanswered calls, enquiry capture and callback workflows. Enquiries open; activation subject to approval and testing.', url, provider: { '@id': ORGANIZATION_ID } },
      { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') }, { '@type': 'ListItem', position: 2, name: 'AI receptionist', item: url }] },
      { '@type': 'FAQPage', '@id': `${url}#faq`, mainEntity: receptionistFAQs.map(faq => ({ '@type': 'Question', name: faq.question, acceptedAnswer: { '@type': 'Answer', text: faq.answer } })) },
    ],
  }
  return <>
    <Header />
    <main id="main-content" className="relative min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
      <section className="hero-gradient relative border-b border-border pb-16 pt-32 md:pb-24 md:pt-40" aria-labelledby="receptionist-title">
        <div className={container}>
          <nav aria-label="Breadcrumb" className="mb-10 flex items-center gap-3 text-xs text-muted-foreground"><Link href="/" className={`hover:text-foreground ${focus}`}>Home</Link><span aria-hidden="true">/</span><span aria-current="page">AI receptionist</span></nav>
          <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_1fr] lg:gap-14">
            <div className="min-w-0">
              <p className="mb-7 inline-flex flex-wrap items-center gap-x-3 gap-y-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-xs font-medium text-primary"><span>Picshaw AI receptionist</span><span aria-hidden="true">/</span><span>Founding pilot</span></p>
              <h1 id="receptionist-title" className="text-[clamp(2.65rem,5.1vw,4.75rem)] font-semibold leading-[1.05] tracking-[-0.045em]">You do the work.<br /><span className="text-primary">Let AI take<br className="hidden xl:block" /> the call.</span></h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">A done-for-you AI receptionist for after-hours and unanswered calls. Capture the enquiry, qualify the job and arrange the next step—without interrupting your team.</p>
              <div className="mt-8 flex flex-wrap items-center gap-5"><a href="#enquiry" className={primaryButton}>Request a demo<ArrowUpRight size={18} aria-hidden="true" /></a><a href="#pricing" className={`inline-flex min-h-12 items-center gap-2 text-sm font-medium text-foreground ${focus}`}>See pilot pricing<ArrowRight size={16} aria-hidden="true" /></a></div>
              <p className="mt-5 max-w-lg text-xs leading-6 text-muted-foreground">Enquiries open. Demo availability and activation confirmed after a fit check. No payment required to enquire.</p>
            </div>
            <figure className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-2xl shadow-black/30 sm:p-7">
              <figcaption className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5"><div><p className={eyebrow}>From call to follow-up</p><p className="mt-2 text-sm text-muted-foreground">Illustrative plumbing scenario</p></div><span className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground">Example only</span></figcaption>
              <div className="mt-6 flex items-center gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Phone size={20} aria-hidden="true" /></span><div><p className="text-sm font-medium">After-hours enquiry</p><p className="mt-1 text-xs text-muted-foreground">A clear next step for your team</p></div></div>
              <div aria-hidden="true" className="my-6 flex h-10 items-center justify-center gap-1.5">{[10, 18, 12, 26, 34, 20, 38, 26, 16, 30, 38, 22, 12, 28, 18, 34, 24, 14, 20, 10].map((height, index) => <span key={index} className="w-1 rounded-full bg-primary/60" style={{ height }} />)}</div>
              <div className="space-y-4 text-sm leading-6">
                <div className="rounded-xl border border-border bg-muted/40 p-4"><p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-primary">AI assistant</p><p>Hi, I’m the AI assistant for your plumbing team. How can I help?</p></div>
                <div className="ml-5 rounded-xl border border-border p-4"><p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Caller</p><p>I’d like a quote to replace a kitchen tap.</p></div>
                <div className="rounded-xl border border-border bg-muted/40 p-4"><p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-primary">AI assistant</p><p>I can take your details and request a callback. Which area is the property in?</p></div>
              </div>
              <div className="mt-5 rounded-xl border border-primary/25 bg-primary/5 p-4"><p className="flex items-center gap-2 text-xs font-medium text-primary"><ClipboardList size={15} aria-hidden="true" />Sample follow-up summary</p><dl className="mt-3 space-y-2 text-xs leading-5"><div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">Enquiry</dt><dd>Kitchen tap replacement</dd></div><div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">Next step</dt><dd>Callback requested</dd></div></dl><p className="mt-3 border-t border-primary/15 pt-3 text-[11px] leading-5 text-muted-foreground">A request, not a confirmed appointment. Sample content—not a real customer call or a live demo.</p></div>
            </figure>
          </div>
        </div>
      </section>

      <div className="border-b border-border"><div className={`${container} grid gap-5 py-7 text-sm text-muted-foreground md:grid-cols-3`}>{['Your business information', 'Your call-handling rules', 'Your team in control'].map(text => <p key={text} className="flex items-center gap-3"><Check size={16} className="shrink-0 text-primary" aria-hidden="true" />{text}</p>)}</div></div>

      <section className="py-20 md:py-28" aria-labelledby="capabilities-title"><div className={container}>
        <div className="max-w-2xl"><p className={eyebrow}>A better first response</p><h2 id="capabilities-title" className="mt-5 text-3xl font-semibold leading-tight tracking-tight md:text-5xl">More than a message.<br />A useful next step.</h2><p className="mt-6 text-lg leading-8 text-muted-foreground">Start with a focused call-handling service, configured around the way your business actually works. Not another platform for you to learn.</p></div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{capabilities.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-xl border border-border bg-card p-6 sm:p-7"><Icon size={24} className="text-primary" aria-hidden="true" /><h3 className="mt-7 text-xl font-semibold leading-snug">{title}</h3><p className="mt-4 text-sm leading-7 text-muted-foreground">{text}</p></article>)}</div>
        <p className="mt-6 max-w-3xl text-sm leading-7 text-muted-foreground">Built initially for independent plumbing businesses. Other local service businesses can enquire; suitability, availability and the exact workflow are agreed before launch.</p>
      </div></section>

      <section id="how-it-works" className="scroll-mt-28 border-y border-border bg-card/40 py-20 md:py-24" aria-labelledby="setup-title"><div className={container}>
        <div className="grid gap-7 md:grid-cols-2 md:items-end"><div><p className={eyebrow}>Done for you. Tested with you.</p><h2 id="setup-title" className="mt-5 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">Your receptionist.<br />Your rules.</h2></div><p className="max-w-lg text-base leading-8 text-muted-foreground">No dashboard to configure before you can get started. We scope, set up and test the pilot with you, then agree how it will be reviewed.</p></div>
        <ol className="mt-12 grid gap-8 sm:grid-cols-2 xl:grid-cols-4">{steps.map((step, index) => <li key={step.title} className="border-t border-border pt-5"><span className="font-mono text-xs text-primary">0{index + 1}</span><h3 className="mt-4 text-lg font-semibold">{step.title}</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">{step.text}</p></li>)}</ol>
        <aside className="mt-12 flex items-start gap-4 rounded-xl border border-border bg-background p-6"><ShieldCheck size={23} className="mt-1 shrink-0 text-primary" aria-hidden="true" /><div><h3 className="text-base font-semibold">Clear boundaries from day one.</h3><p className="mt-2 max-w-4xl text-sm leading-7 text-muted-foreground">The assistant introduces itself as AI. It does not give emergency advice, dispatch technicians, take payments or make binding quotes. A booking is only confirmed when the calendar accepts it. Phone routing, human handover, required notices and fallback handling are checked before activation.</p></div></aside>
      </div></section>

      <section id="pricing" className="scroll-mt-28 py-20 md:py-28" aria-labelledby="pricing-title"><div className={`${container} grid items-start gap-10 lg:grid-cols-2 lg:gap-20`}>
        <div><p className={eyebrow}>Founding-pilot guide price</p><h2 id="pricing-title" className="mt-5 text-3xl font-semibold leading-tight tracking-tight md:text-5xl">A managed service.<br />Not a DIY project.</h2><p className="mt-6 text-lg leading-8 text-muted-foreground">You bring the business knowledge. Picshaw handles the agreed setup, call flow and pilot review, so you can focus on the follow-up.</p><div className="mt-8 space-y-5 text-sm leading-7 text-muted-foreground"><p><strong className="font-medium text-foreground">Setup includes:</strong> your approved FAQs, one inbound call flow, enquiry capture and one callback workflow for a single business.</p><p><strong className="font-medium text-foreground">Scope stays clear:</strong> we agree included changes, review cadence and service terms before launch. Bespoke integrations are quoted separately.</p><p><strong className="font-medium text-foreground">No instant activation:</strong> the pilot starts only after suitability, provider permissions, routing and workflow tests are confirmed.</p></div></div>
        <div className="min-w-0 rounded-2xl border border-primary/30 bg-card p-6 sm:p-9">
          <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">Founding pilot</h3><span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">Managed by Picshaw</span></div>
          <p className="mt-8"><span className="text-6xl font-semibold tracking-tight">${receptionistOffer.monthly}</span><span className="ml-2 text-sm text-muted-foreground">/ month</span></p><p className="mt-3 text-sm text-muted-foreground">Plus a one-time ${receptionistOffer.setup} setup fee.</p>
          <dl className="my-7 divide-y divide-border border-y border-border text-sm"><div className="flex flex-wrap justify-between gap-2 py-4"><dt className="text-muted-foreground">Included call time</dt><dd className="font-medium">{receptionistOffer.includedMinutes} minutes / month</dd></div><div className="flex flex-wrap justify-between gap-2 py-4"><dt className="text-muted-foreground">Additional minutes</dt><dd className="font-medium">${receptionistOffer.additionalMinute.toFixed(2)} / minute</dd></div></dl>
          <ul className="space-y-4 text-sm">{['Business-specific setup and approved answers', 'Agreed after-hours or unanswered-call handling', 'Lead details and actionable call summaries', 'One agreed callback or consultation workflow', 'Pilot review and agreed configuration support'].map(item => <li key={item} className="flex items-start gap-3 leading-6"><Check size={16} className="mt-1 shrink-0 text-primary" aria-hidden="true" />{item}</li>)}</ul>
          <a href="#enquiry" className={`${primaryButton} mt-8 w-full`}>Discuss my pilot<ArrowUpRight size={18} aria-hidden="true" /></a><p className="mt-5 text-xs leading-6 text-muted-foreground">All prices in USD. Applicable taxes and non-standard integration costs are confirmed in your proposal. No unlimited-use promise. No payment is taken on this page.</p>
        </div>
      </div></section>

      <section id="faq" className="scroll-mt-28 border-t border-border py-20 md:py-24" aria-labelledby="faq-title"><div className={`${container} grid gap-10 lg:grid-cols-[0.8fr_1.2fr]`}>
        <div><p className={eyebrow}>Before you get started</p><h2 id="faq-title" className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">Good questions.<br />Straight answers.</h2><p className="mt-6 max-w-sm text-sm leading-7 text-muted-foreground">What the pilot is for, what it costs and what we need to confirm before it handles your calls.</p></div>
        <div className="min-w-0 border-t border-border">{receptionistFAQs.map(faq => <details key={faq.question} className="group border-b border-border"><summary className={`flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-5 text-base font-medium [&::-webkit-details-marker]:hidden ${focus}`}>{faq.question}<ChevronDown size={18} className="shrink-0 text-primary transition-transform group-open:rotate-180" aria-hidden="true" /></summary><p className="pb-6 pr-4 text-sm leading-7 text-muted-foreground">{faq.answer}</p></details>)}</div>
      </div></section>

      <section id="enquiry" className="gradient-glow scroll-mt-28 border-t border-border py-20 md:py-28" aria-labelledby="enquiry-title"><div className={`${container} grid items-start gap-10 lg:grid-cols-2 lg:gap-20`}>
        <div><p className={eyebrow}>Start with a conversation</p><h2 id="enquiry-title" className="mt-5 text-3xl font-semibold leading-tight tracking-tight md:text-5xl">See how it could<br />answer for you.</h2><p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">Tell us what happens to your calls today. We’ll discuss your workflow, confirm suitability and arrange a demonstration when available.</p><div className="mt-8 space-y-4 text-sm text-muted-foreground"><p className="flex items-center gap-3"><MessageSquare size={17} className="text-primary" aria-hidden="true" />A conversation about your actual calls.</p><p className="flex items-center gap-3"><Clock size={17} className="text-primary" aria-hidden="true" />No subscription or appointment starts here.</p><a href="mailto:hello@picshaw.com?subject=AI%20receptionist%20pilot%20enquiry" className={`inline-flex min-h-11 items-center gap-2 text-primary ${focus}`}>hello@picshaw.com<ArrowUpRight size={15} aria-hidden="true" /></a></div></div>
        <ReceptionistEnquiry />
      </div></section>
      <section className="border-t border-border py-12"><div className={`${container} flex flex-col justify-between gap-5 md:flex-row md:items-center`}><p className="max-w-2xl text-sm leading-7 text-muted-foreground"><strong className="font-medium text-foreground">Get found. Then handle the enquiry.</strong> The receptionist pilot complements Picshaw’s AEO services. You do not need a new website or an AEO package to enquire.</p><Link href="/ai-visibility-audit" className={`inline-flex shrink-0 items-center gap-2 text-sm text-primary ${focus}`}>Explore AI visibility<ArrowRight size={16} aria-hidden="true" /></Link></div></section>
    </main>
    <Footer />
  </>
}
