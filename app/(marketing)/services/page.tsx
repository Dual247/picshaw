import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { ContentPage } from '@/components/ContentPage'
import { services } from '@/lib/content'
import { absoluteUrl, jsonLd, ORGANIZATION_ID, pageMetadata, serviceLinks } from '@/lib/site'

export const metadata = pageMetadata(
  'SEO, AEO, Website Design & AI Receptionist Services',
  'Find Picshaw services for local SEO, AEO and GEO, website redesign, technical SEO, Google Business Profile optimization, landing pages and AI receptionists.',
  '/services',
)

const summaries: Record<string, string> = {
  '/ai-visibility-audit': 'A scoped review of search access, business information, buyer questions and enquiry paths, with a prioritised implementation plan.',
  '/ai-visibility-retainer': 'An ongoing programme of search improvements, useful content, sampled AI visibility testing and monthly reporting.',
  '/ai-receptionist': 'A managed AI phone answering pilot for inbound enquiries, after-hours call capture, qualification and callback handover.',
}

export default function ServicesPage() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'OfferCatalog',
    name: 'Picshaw services',
    itemListElement: serviceLinks.map(service => ({
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: service.label,
        url: absoluteUrl(service.href),
        provider: { '@id': ORGANIZATION_ID },
      },
    })),
  }

  return (
    <ContentPage
      title="Search visibility, websites and better enquiries"
      eyebrow="Picshaw services"
      path="/services"
      intro="Choose the work that connects discovery to a useful conversation. Picshaw provides SEO, answer engine optimization, website design and managed AI receptionist services for local and owner-led businesses."
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
      <div className="grid gap-5 md:grid-cols-2">
        {serviceLinks.map(service => (
          <article
            key={service.href}
            className="flex flex-col rounded-xl border border-border bg-card p-7"
          >
            <h2 className="text-2xl font-semibold tracking-tight">
              <Link href={service.href} className="hover:text-primary">
                {service.label}
              </Link>
            </h2>
            <p className="mb-6 mt-4 text-sm leading-7 text-muted-foreground">
              {summaries[service.href] ?? services.find(item => `/${item.slug}` === service.href)?.description}
            </p>
            <Link
              href={service.href}
              className="mt-auto inline-flex min-h-11 items-center gap-3 text-sm font-medium text-primary"
            >
              Explore {service.label}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
      <section className="mt-14 max-w-3xl" aria-labelledby="services-scope">
        <h2 id="services-scope" className="text-2xl font-semibold">
          Start with your customer journey.
        </h2>
        <p className="mt-5 leading-8 text-muted-foreground">
          A new website, an AI visibility audit and monthly SEO support each solve a different problem. We look at how customers find you, what they need to know and what happens when they get in touch. Your proposal sets the pages, integrations, account access and deliverables for the agreed work.
        </p>
        <p className="mt-5 leading-8 text-muted-foreground">
          Based in Los Angeles, Picshaw supports local businesses across LA and Orange County, including Long Beach and Irvine. Explore the industry pages for examples of service content, local search questions and enquiry handling that fit your business.
        </p>
        <div className="mt-6 flex flex-wrap gap-6">
          <Link href="/industries" className="font-medium text-primary underline underline-offset-4">
            Find your industry
          </Link>
          <Link href="/#contact" className="font-medium text-primary underline underline-offset-4">
            Discuss your priorities
          </Link>
        </div>
      </section>
    </ContentPage>
  )
}
