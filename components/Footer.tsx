import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { BrandLogo } from './BrandLogo'
import { PrivacySettingsButton } from './SiteAnalytics'
import { featuredIndustries } from '@/lib/industries'
import { serviceLinks, editorialLinks } from '@/lib/site'

const footerLinkClass = 'inline-block max-w-full rounded-sm py-1 text-sm leading-6 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary'

export function Footer() {
  const exploreLinks = [
    ...editorialLinks.filter(link => link.href !== '/industries'),
    { label: 'Website packages', href: '/#services' },
    { label: 'Contact', href: '/#contact' },
    { label: 'Privacy Policy', href: '/privacy-policy' },
  ]

  return (
    <footer className="relative border-t border-border bg-card/20 pb-28 pt-16 lg:pb-16">
      <div className="mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20">
        <div className="mb-14 flex flex-col gap-6 rounded-xl border border-border bg-card p-7 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <h2 className="text-xl font-semibold">Start with an informed next step.</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              See what an AI Visibility Audit examines, what you receive and how we separate evidence from guesswork.
            </p>
          </div>
          <Link
            href="/ai-visibility-audit"
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-sm text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary md:self-auto"
          >
            Explore the audit
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="min-w-0">
            <Link href="/" aria-label="Picshaw home" className="inline-flex items-center gap-4 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
              <BrandLogo placement="footer" />
            </Link>
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              AEO &amp; AI-search visibility
            </p>
            <p className="mt-5 max-w-sm leading-7 text-muted-foreground">
              Search foundations, original content and clearer routes to enquiries. Built around your business.
            </p>
            <a href="mailto:hello@picshaw.com" className="mt-4 inline-block rounded-sm text-sm text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
              hello@picshaw.com
            </a>
          </div>

          <nav aria-label="Footer navigation" className="grid min-w-0 grid-cols-2 content-start gap-x-6 gap-y-10 sm:grid-cols-3">
            <section aria-labelledby="footer-services" className="min-w-0">
              <h2 id="footer-services" className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-foreground">
                Services
              </h2>
              <ul className="space-y-2">
                {serviceLinks.map(link => (
                  <li key={link.href}>
                    <Link href={link.href} className={footerLinkClass}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="footer-industries" className="min-w-0">
              <h2 id="footer-industries" className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-foreground">
                Industries
              </h2>
              <ul className="space-y-2">
                {featuredIndustries.map(industry => (
                  <li key={industry.slug}>
                    <Link href={`/industries/${industry.slug}`} className={footerLinkClass}>{industry.name}</Link>
                  </li>
                ))}
                <li className="pt-2">
                  <Link href="/industries" className={`${footerLinkClass} text-primary`}>
                    View all industries
                    <ArrowRight size={14} className="ml-1 inline-block align-middle" aria-hidden="true" />
                  </Link>
                </li>
              </ul>
            </section>

            <section aria-labelledby="footer-explore" className="min-w-0">
              <h2 id="footer-explore" className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-foreground">
                Explore
              </h2>
              <ul className="space-y-2">
                {exploreLinks.map(link => (
                  <li key={link.href}>
                    <Link href={link.href} className={footerLinkClass}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </section>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-border pt-7 text-xs leading-6 text-muted-foreground md:flex-row md:justify-between">
          <p>&copy; {new Date().getFullYear()} Picshaw. Based in Los Angeles, CA.</p>
          <p className="max-w-lg">Independent service provider. Not affiliated with or endorsed by OpenAI, Google or other search platforms.</p>
          <p className="flex flex-wrap items-center gap-4">
            <Link href="/privacy-policy" className="rounded-sm underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
              Privacy Policy
            </Link>
            <PrivacySettingsButton className="rounded-sm underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" />
          </p>
        </div>
      </div>
    </footer>
  )
}
