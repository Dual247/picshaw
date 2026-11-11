import { notFound } from 'next/navigation'
import { ContentPage, ContentSections, ReviewCTA } from '@/components/ContentPage'
import { services, getService } from '@/lib/content'
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
  return <ContentPage title={service.title} intro={service.intro} eyebrow={service.eyebrow} path={`/${service.slug}`}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ '@context': 'https://schema.org', '@type': 'Service', '@id': absoluteUrl(`/${service.slug}#service`), name: service.title, description: service.description, url: absoluteUrl(`/${service.slug}`), provider: { '@id': ORGANIZATION_ID } }) }} />
    <ContentSections sections={service.sections} />
    <section className="mt-14 max-w-3xl" aria-labelledby="service-questions">
      <h2 id="service-questions" className="mb-6 text-2xl font-semibold">Questions before you start</h2>
      {service.questions.map(item => <details key={item.question} className="group border-b border-border py-5"><summary className="cursor-pointer text-lg font-medium">{item.question}</summary><p className="pt-4 leading-7 text-muted-foreground">{item.answer}</p></details>)}
    </section>
    <ReviewCTA />
  </ContentPage>
}
