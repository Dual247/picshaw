import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ContentPage, ContentSections, ReviewCTA } from '@/components/ContentPage'
import { getArticle, getPublishedArticles, displayDate, getService } from '@/lib/content'
import { absoluteUrl, jsonLd, ORGANIZATION_ID, pageMetadata } from '@/lib/site'

type Props = { params: Promise<{ slug: string }> }
export const dynamicParams = false
export function generateStaticParams() { return getPublishedArticles().map(article => ({ slug: article.slug })) }
export async function generateMetadata({ params }: Props) {
  const article = getArticle((await params).slug)
  if (!article) return {}
  return { ...pageMetadata(article.title, article.description, `/blog/${article.slug}`), openGraph: { title: `${article.title} | Picshaw`, description: article.description, url: absoluteUrl(`/blog/${article.slug}`), siteName: 'Picshaw', type: 'article' as const, publishedTime: article.publishedAt, modifiedTime: article.updatedAt ?? article.publishedAt, authors: [absoluteUrl('/about')] } }
}
export default async function ArticlePage({ params }: Props) {
  const article = getArticle((await params).slug)
  if (!article) notFound()
  const relatedArticles = getPublishedArticles().filter(other => other.slug !== article.slug && other.relatedServices.some(service => article.relatedServices.includes(service))).slice(0, 2)
  const sources = [...new Set(article.sections.flatMap(section => (section.sources ?? []).map(source => source.href)))]
  return <ContentPage title={article.title} intro={article.intro} eyebrow={article.category} path={`/blog/${article.slug}`}>
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ '@context': 'https://schema.org', '@type': 'BlogPosting', '@id': absoluteUrl(`/blog/${article.slug}#article`), mainEntityOfPage: absoluteUrl(`/blog/${article.slug}`), headline: article.title, description: article.description, datePublished: article.publishedAt, dateModified: article.updatedAt ?? article.publishedAt, author: { '@type': 'Organization', '@id': ORGANIZATION_ID, name: 'Picshaw', url: absoluteUrl('/about') }, publisher: { '@id': ORGANIZATION_ID }, inLanguage: 'en-US', citation: sources }) }} />
      <p className="mb-8 text-sm leading-7 text-muted-foreground">By <Link href="/about" className="underline underline-offset-4">{article.author}</Link> · Published <time dateTime={article.publishedAt}>{displayDate(article.publishedAt)}</time>{article.updatedAt && <> · Updated <time dateTime={article.updatedAt}>{displayDate(article.updatedAt)}</time></>}</p>
      <nav aria-label="On this page" className="mb-12 max-w-3xl rounded-xl border border-border bg-card/40 p-6"><p className="mb-4 font-medium">In this guide</p><ul className="space-y-3">{article.sections.map(section => <li key={section.id}><a href={`#${section.id}`} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">{section.title}</a></li>)}</ul></nav>
      <ContentSections sections={article.sections} />
      <aside className="mt-12 max-w-3xl border-t border-border pt-7"><h2 className="text-xl font-semibold">Related services</h2><div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">{article.relatedServices.map(slug => { const service = getService(slug); return service ? <Link key={slug} href={`/${slug}`} className="text-primary underline underline-offset-4">{service.title}</Link> : null })}</div></aside>
    </article>
    <ReviewCTA />
    {relatedArticles.length > 0 && <section aria-labelledby="related-guides"><h2 id="related-guides" className="mb-6 text-2xl font-semibold">Keep reading</h2><div className="grid gap-6 md:grid-cols-2">{relatedArticles.map(other => <Link key={other.slug} href={`/blog/${other.slug}`} className="rounded-xl border border-border bg-card/50 p-6 text-lg font-medium hover:border-primary">{other.title}</Link>)}</div></section>}
  </ContentPage>
}
