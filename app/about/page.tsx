import Link from 'next/link'
import { ContentPage, ReviewCTA } from '@/components/ContentPage'
import { absoluteUrl, jsonLd, ORGANIZATION_ID, pageMetadata } from '@/lib/site'

export const metadata = pageMetadata('About Picshaw and Ash Patel', 'Meet Ash Patel, the founder behind Picshaw, a Los Angeles web design studio focused on practical websites for local businesses.', '/about')
export default function AboutPage() {
  return <ContentPage title="Good design. A practical business purpose." intro="Picshaw is a Los Angeles web design studio run by Ash Patel, helping local businesses improve the way they present themselves online." eyebrow="About Picshaw" path="/about">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ '@context': 'https://schema.org', '@type': 'AboutPage', url: absoluteUrl('/about'), about: { '@id': ORGANIZATION_ID }, mainEntity: { '@type': 'Person', '@id': absoluteUrl('/about#ash-patel'), name: 'Ash Patel', jobTitle: 'Founder', worksFor: { '@id': ORGANIZATION_ID } } }) }} />
    <div className="max-w-3xl space-y-10 text-lg leading-8 text-muted-foreground">
      <section><h2 className="mb-4 text-2xl font-semibold text-foreground">From building websites in 2005 to Picshaw today</h2><p>Ash began creating websites from scratch in 2005 using Dreamweaver. Picshaw brings that longstanding interest in the web to a specific goal: helping smaller businesses improve an outdated digital presence without an unnecessarily complicated agency process.</p></section>
      <section><h2 className="mb-4 text-2xl font-semibold text-foreground">Built around the business, not just the design</h2><p>The work starts with what customers need to know: the services you provide, where you work and how to contact you. Design, content, technical search foundations and the enquiry path should support that purpose.</p><p className="mt-4">Picshaw offers website refreshes, multi-page sites and ongoing improvements. Project scope is agreed before work begins; search rankings, AI citations and increases in revenue are not guaranteed.</p></section>
      <section><h2 className="mb-4 text-2xl font-semibold text-foreground">Clear about what is evidence</h2><p>Illustrative projects are labelled as design concepts. We do not present them as paid client work or attach invented performance results. Educational articles include source references where external guidance is used, and can be updated when that guidance changes.</p><p className="mt-4">Editorial responsibility sits with Picshaw. To flag a correction or discuss a project, email <a href="mailto:hello@picshaw.com" className="text-primary underline underline-offset-4">hello@picshaw.com</a>.</p></section>
      <p><Link href="/blog" className="text-primary underline underline-offset-4">Explore the practical guides</Link> or <Link href="/website-redesign" className="text-primary underline underline-offset-4">see the website-redesign approach</Link>.</p>
    </div>
    <ReviewCTA />
  </ContentPage>
}
