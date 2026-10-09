import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { BrandLogo } from './BrandLogo'
import { serviceLinks, editorialLinks } from '@/lib/site'

export function Footer() {
  const links = [...serviceLinks, ...editorialLinks, { label: 'Pricing', href: '/#pricing' }, { label: 'Contact', href: '/#contact' }]
  return <footer className="relative border-t border-border bg-card/20 pb-32 pt-20 lg:pb-20">
    <div className="mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20">
      <div className="mb-16 rounded-xl border border-border bg-card/50 p-6 md:p-8"><div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between"><div className="max-w-xl"><h2 className="text-lg font-semibold">Not ready yet? Start with the free checklist.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Twelve practical checks for a contractor website. Read it now—no email signup required.</p></div><Link href="/blog/contractor-website-checklist" className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground md:self-auto">Read the checklist<ArrowRight size={14} aria-hidden="true" /></Link></div></div>
      <div className="grid gap-12 lg:grid-cols-2"><div><Link href="/" aria-label="Picshaw home" className="inline-flex items-center gap-4 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"><BrandLogo placement="footer" /></Link><p className="mt-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">Los Angeles Web Design Studio</p><p className="mt-6 max-w-sm leading-7 text-muted-foreground">Practical websites, useful content and search foundations for local businesses.</p></div><nav aria-label="Footer navigation" className="grid grid-cols-2 content-start gap-x-6 gap-y-5">{links.map(link => <Link key={link.href} href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">{link.label}</Link>)}</nav></div>
      <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 text-sm text-muted-foreground md:flex-row"><p>&copy; {new Date().getFullYear()} Picshaw. All rights reserved.</p><p>Designed in <span className="text-foreground">Los Angeles, CA</span></p></div>
    </div>
  </footer>
}
