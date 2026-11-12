import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import { ContentPage, ContentSections } from '@/components/ContentPage'
import { getIndustry, industries } from '@/lib/industries'
import { absoluteUrl, jsonLd, ORGANIZATION_ID, pageMetadata, serviceLinks } from '@/lib/site'

type Props = {
  params: Promise<{ industry: string }>
}

export const dynamicParams = false

export function generateStaticParams() {
  return industries.map(industry => ({ industry: industry.slug }))
}

export async function generateMetadata({ params }: Props) {
  const industry = getIndustry((await params).industry)
  if (!industry) notFound()
  return pageMetadata(industry.title, industry.description, `/industries/${industry.slug}`)
}

export default async function IndustryPage({ params }: Props) {
  const industry = getIndustry((await params).industry)
  if (!industry) notFound()
  const path = `/industries/${industry.slug}`
  const relevantServices = serviceLinks.filter(service => industry.services.includes(service.href))
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        '@id': absoluteUrl(`${path}#service`),
        name: industry.title,
        description: industry.description,
        url: absoluteUrl(path),
        provider: { '@id': ORGANIZATION_ID },
        audience: {
          '@type': 'Audience',
          audienceType: industry.name,
        },
      },
      {
        '@type': 'FAQPage',
        '@id': absoluteUrl(`${path}#questions`),
        mainEntity: industry.questions.map(item => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
    ],
  }

  return (
    <ContentPage
      title={industry.title}
      intro={industry.intro}
      eyebrow={industry.eyebrow}
      path={path}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
      <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_260px]">
        <ContentSections sections={industry.sections} />
        <aside
          className="rounded-xl border border-border bg-card p-6 lg:sticky lg:top-28"
          aria-labelledby="industry-services"
        >
          <h2 id="industry-services" className="text-lg font-semibold">
            Services for your business
          </h2>
          <ul className="mt-5 divide-y divide-border">
            {relevantServices.map(service => (
              <li key={service.href}>
                <Link
                  href={service.href}
                  className="flex min-h-12 items-center justify-between gap-3 py-3 text-sm leading-6 text-muted-foreground hover:text-primary"
                >
                  {service.label}
                  <ArrowUpRight size={16} className="shrink-0" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/#contact"
            className="mt-6 flex min-h-12 items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
          >
            Discuss your business
          </Link>
        </aside>
      </div>
      <section
        id="questions"
        className="mt-14 max-w-3xl scroll-mt-32"
        aria-labelledby="industry-questions"
      >
        <h2 id="industry-questions" className="mb-6 text-2xl font-semibold">
          Questions before you start
        </h2>
        {industry.questions.map(item => (
          <details key={item.question} className="border-b border-border py-5">
            <summary className="cursor-pointer text-lg font-medium">{item.question}</summary>
            <p className="pt-4 leading-7 text-muted-foreground">{item.answer}</p>
          </details>
        ))}
      </section>
      <div className="mt-12 flex flex-wrap gap-6">
        <Link href="/industries" className="font-medium text-primary underline underline-offset-4">
          Explore all industries
        </Link>
        <Link
          href="/ai-visibility-retainer"
          className="font-medium text-primary underline underline-offset-4"
        >
          Monthly plans and pricing
        </Link>
      </div>
    </ContentPage>
  )
}
