import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ContentPage, ContentSections, ReviewCTA } from '@/components/ContentPage'
import { ContractorLanding } from '@/components/ContractorLanding'
import { services, getService } from '@/lib/content'
import { industries } from '@/lib/industries'
import { absoluteUrl, jsonLd, ORGANIZATION_ID, pageMetadata } from '@/lib/site'

type Props = { params: Promise<{ service: string }> }
export const dynamicParams = false
export function generateStaticParams() { return services.map(service => ({ service: service.slug })) }
export async function generateMetadata({ params }: Props) {
  const service = getService((await params).service)
  return service ? pageMetadata(service.title, service.description, `/${service.slug}`) : {}
}
export default async function ServicePage({ params }: Props) {
  const service = getService((await params).service)
  if (!service) notFound()
  if (service.slug === 'web-design-for-contractors') return <ContractorLanding service={service} />
  return <ContentPage title={service.title} intro={service.intro} eyebrow={service.eyebrow} path={`/${service.slug}`}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ '@context': 'https://schema.org', '@type': 'Service', '@id': absoluteUrl(`/${service.slug}#service`), name: service.title, description: service.description, url: absoluteUrl(`/${service.slug}`), provider: { '@id': ORGANIZATION_ID } }) }} />
    <ContentSections sections={service.sections} />
    <section className="mt-14 max-w-3xl" aria-labelledby="service-questions">
      <h2 id="service-questions" className="mb-6 text-2xl font-semibold">Questions before you start</h2>
      {service.questions.map(item => <details key={item.question} className="group border-b border-border py-5"><summary className="cursor-pointer text-lg font-medium">{item.question}</summary><p className="pt-4 leading-7 text-muted-foreground">{item.answer}</p></details>)}
    </section>
    <section className="mt-14 max-w-3xl" aria-labelledby="service-industries">
      <h2 id="service-industries" className="text-2xl font-semibold">How this works for your industry</h2>
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-4">
        {industries.filter(industry => industry.services.includes(`/${service.slug}`)).map(industry => <Link key={industry.slug} href={`/industries/${industry.slug}`} className="text-primary underline underline-offset-4">{industry.name}</Link>)}
        <Link href="/industries" className="text-primary underline underline-offset-4">All industries</Link>
      </div>
      <Link href="/services" className="mt-6 inline-block text-sm text-muted-foreground underline underline-offset-4">Compare all Picshaw services</Link>
    </section>
    <ReviewCTA />
  </ContentPage>
}
