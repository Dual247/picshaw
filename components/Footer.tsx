import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { BrandLogo } from './BrandLogo'
import { serviceLinks, editorialLinks } from '@/lib/site'

export function Footer() {
  const links = [...serviceLinks, ...editorialLinks, { label: 'Website packages', href: '/#pricing' }, { label: 'Contact', href: '/#contact' }]
  return <footer className="relative border-t border-border bg-card/20 pb-28 pt-16 lg:pb-16"><div className="mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20">
    <div className="mb-14 flex flex-col gap-6 rounded-xl border border-border bg-card p-7 md:flex-row md:items-center md:justify-between"><div className="max-w-xl"><h2 className="text-xl font-semibold">Start with an informed next step.</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">See what an AI Visibility Audit examines, what you receive and how we separate evidence from guesswork.</p></div><Link href="/ai-visibility-audit" className="inline-flex shrink-0 items-center gap-2 self-start text-sm font-medium text-primary md:self-auto">Explore the audit<ArrowRight size={16} aria-hidden="true" /></Link></div>
    <div className="grid gap-12 lg:grid-cols-2"><div><Link href="/" aria-label="Picshaw home" className="inline-flex items-center gap-4 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"><BrandLogo placement="footer" /></Link><p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">AEO & AI-search visibility</p><p className="mt-5 max-w-sm leading-7 text-muted-foreground">Search foundations, original content and clearer routes to enquiries. Built around your business.</p><a href="mailto:hello@picshaw.com" className="mt-4 inline-block text-sm text-primary">hello@picshaw.com</a></div><nav aria-label="Footer navigation" className="grid grid-cols-2 content-start gap-x-5 gap-y-5">{links.map(link => <Link key={link.href} href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">{link.label}</Link>)}</nav></div>
    <div className="mt-12 flex flex-col gap-4 border-t border-border pt-7 text-xs leading-6 text-muted-foreground md:flex-row md:justify-between"><p>&copy; {new Date().getFullYear()} Picshaw. Based in Los Angeles, CA.</p><p className="max-w-lg">Independent service provider. Not affiliated with or endorsed by OpenAI, Google or other search platforms.</p></div>
  </div></footer>
}
