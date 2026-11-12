import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { ContentPage } from '@/components/ContentPage'
import { industries } from '@/lib/industries'
import { absoluteUrl, jsonLd, pageMetadata } from '@/lib/site'

export const metadata = pageMetadata(
  'SEO, AEO & Web Design by Industry',
  'Explore Picshaw SEO, AI-search visibility, website design and enquiry capture for dental practices, accountants, trades, venues and other service businesses.',
  '/industries',
)

export default function IndustriesPage() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Picshaw industry services',
    itemListElement: industries.map((industry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: industry.name,
      url: absoluteUrl(`/industries/${industry.slug}`),
    })),
  }

  return (
    <ContentPage
      title="SEO, AEO and web design for your industry"
      eyebrow="Built around your customers"
      path="/industries"
      intro="An urgent repair, a first consultation and a wedding enquiry start with different questions. Find the search, website and enquiry improvements that fit how your customers choose."
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(schema) }}
      />
      <div className="grid gap-x-10 md:grid-cols-2">
        {industries.map((industry, index) => (
          <Link
            key={industry.slug}
            href={`/industries/${industry.slug}`}
            className="group flex min-w-0 gap-5 border-t border-border py-8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            <span className="pt-1 font-mono text-xs text-primary" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold tracking-tight group-hover:text-primary">
                {industry.name}
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {industry.summary}
              </p>
            </div>
            <ArrowUpRight
              size={20}
              className="mt-1 shrink-0 text-primary"
              aria-hidden="true"
            />
          </Link>
        ))}
      </div>
      <section
        className="mt-12 rounded-2xl border border-border bg-card p-7 md:p-10"
        aria-labelledby="industry-local"
      >
        <p className="text-xs uppercase tracking-widest text-primary">
          Los Angeles and Orange County
        </p>
        <h2 id="industry-local" className="mt-4 text-2xl font-semibold">
          Make your service area part of the brief.
        </h2>
        <p className="mt-4 max-w-3xl leading-8 text-muted-foreground">
          Picshaw is based in Los Angeles and works with service businesses across LA, Long Beach, Orange County and Irvine. We scope local SEO around the places you actually serve, your locations, your services and the enquiries you want to receive. Remote projects can be discussed for other markets.
        </p>
        <div className="mt-6 flex flex-wrap gap-6">
          <Link href="/services" className="font-medium text-primary underline underline-offset-4">
            Compare all services
          </Link>
          <Link href="/#contact" className="font-medium text-primary underline underline-offset-4">
            Discuss your industry
          </Link>
        </div>
      </section>
    </ContentPage>
  )
}
