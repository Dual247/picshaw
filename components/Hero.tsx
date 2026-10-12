import Link from 'next/link'
import { ArrowUpRight, Check, Search } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-background">
      <div aria-hidden="true" className="absolute inset-0 hero-gradient" />
      <div aria-hidden="true" className="absolute inset-0 grid-lines opacity-60" />
      <div className="relative mx-auto max-w-[1400px] px-6 pb-20 pt-36 md:px-12 md:pb-24 md:pt-44 lg:px-20">
        <p className="mb-8 flex flex-wrap items-center gap-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"><span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />AEO & AI-search visibility<span aria-hidden="true" className="text-border">/</span>Los Angeles</p>
        <div className="grid items-center gap-14 lg:grid-cols-[1.3fr_1fr] lg:gap-12">
          <div className="min-w-0">
            <h1 className="text-[clamp(2.8rem,6.4vw,6rem)] font-bold leading-[1.02] tracking-[-0.055em]">Help customers<br className="hidden sm:block" /> find your business<br className="hidden sm:block" /><span className="text-gradient"> in AI search.</span></h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-muted-foreground md:text-xl">Make your business easier to discover, understand and choose. We improve your search foundations, turn your expertise into useful content, and measure what changes.</p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link href="/ai-visibility-audit" className="inline-flex items-center justify-center gap-3 rounded-lg bg-primary px-6 py-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">Explore your AI Visibility Audit<ArrowUpRight size={17} aria-hidden="true" /></Link>
              <Link href="/methodology" className="inline-flex items-center justify-center rounded-lg border border-border px-6 py-4 text-sm font-medium transition-colors hover:border-primary/50">How we measure progress</Link>
            </div>
            <p className="mt-5 max-w-lg text-sm leading-6 text-muted-foreground">Already have a good website? Start there. A redesign is not a requirement.</p>
          </div>
          <aside aria-label="What an AI Visibility Audit examines" className="min-w-0 rounded-2xl border border-border bg-card p-6 shadow-2xl md:p-8">
            <div className="mb-7 flex items-center justify-between gap-4"><p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Start with the right questions</p><Search size={20} className="shrink-0 text-muted-foreground" aria-hidden="true" /></div>
            <p className="text-2xl font-medium leading-snug tracking-tight md:text-3xl">When someone searches for a business like yours, what do they find?</p>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">An audit looks at the information behind the answer—not just a screenshot of a mention.</p>
            <ul className="mt-7 divide-y divide-border">
              {[
                ['Access', 'Can search systems read your important pages?'],
                ['Accuracy', 'Are your services and business details clear?'],
                ['Evidence', 'What supports choosing you over an alternative?'],
                ['Enquiries', 'Can a visitor take the next step?'],
              ].map(([label, text]) => <li key={label} className="flex items-start gap-3 py-4"><Check size={16} className="mt-1 shrink-0 text-primary" aria-hidden="true" /><div><p className="text-sm font-semibold">{label}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p></div></li>)}
            </ul>
            <p className="mt-4 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">Audit framework shown. Not a live report or a claim of client results.</p>
          </aside>
        </div>
        <div className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-border pt-7 text-sm text-muted-foreground"><p className="text-foreground">Built for local service businesses.</p><span>Contractors & remodelers</span><span>Home services</span><span>Owner-led businesses</span></div>
      </div>
    </section>
  )
}
