import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ContentPage, ContentSections, ReviewCTA } from '@/components/ContentPage'
import { getPublishedArticles, displayDate, getService } from '@/lib/content'
import { getBlogArticle, getBlogArticles } from '@/lib/blog'
import { conciseSearchTitle } from '@/lib/blog-model'
import { absoluteUrl, jsonLd, ORGANIZATION_ID, pageMetadata } from '@/lib/site'
import styles from '../imported-article.module.css'

type Props = { params: Promise<{ slug: string }> }
export const dynamicParams = true
export const dynamic = 'force-static'
export const revalidate = 300
// Keep local pages prerendered. New remote slugs are generated on demand, not at build time.
export function generateStaticParams() { return getPublishedArticles().map(article => ({ slug: article.slug })) }
export async function generateMetadata({ params }: Props) {
  const article = await getBlogArticle((await params).slug)
  if (!article) return {}
  const metadata = pageMetadata(article.source === 'local' ? article.title : conciseSearchTitle(article.title), article.description, `/blog/${article.slug}`)
  return { ...metadata, openGraph: { ...metadata.openGraph, type: 'article' as const, publishedTime: article.publishedAt, modifiedTime: article.updatedAt ?? article.publishedAt, ...(article.source === 'local' ? { authors: [absoluteUrl('/about')] } : {}) } }
}
export default async function ArticlePage({ params }: Props) {
  const article = await getBlogArticle((await params).slug)
  if (!article) notFound()
  const articles = await getBlogArticles()
  const relatedArticles = articles.filter(other => other.slug !== article.slug && (article.source !== 'local' || (other.source === 'local' && other.relatedServices.some(service => article.relatedServices.includes(service))))).slice(0, 2)
  const sources = article.source === 'local' ? [...new Set(article.sections.flatMap(section => (section.sources ?? []).map(source => source.href)))] : []
  const schema = {
    '@context': 'https://schema.org', '@type': 'BlogPosting', '@id': absoluteUrl(`/blog/${article.slug}#article`),
    mainEntityOfPage: absoluteUrl(`/blog/${article.slug}`), headline: article.title, description: article.description,
    datePublished: article.publishedAt, ...(article.updatedAt ? { dateModified: article.updatedAt } : {}),
    ...(article.source === 'local' ? { author: { '@type': 'Organization', '@id': ORGANIZATION_ID, name: 'Picshaw', url: absoluteUrl('/about') }, dateModified: article.updatedAt ?? article.publishedAt, citation: sources } : {}),
    publisher: { '@id': ORGANIZATION_ID }, inLanguage: article.source === 'local' ? 'en-US' : article.language,
  }
  return <ContentPage title={article.title} intro={article.intro} eyebrow={article.category} path={`/blog/${article.slug}`}>
    <article lang={article.source === 'babylovegrowth' ? article.language : undefined}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
      <p className="mb-8 text-sm leading-7 text-muted-foreground">{article.source === 'local' && <>By <Link href="/about" className="underline underline-offset-4">{article.author}</Link> · </>}Published <time dateTime={article.publishedAt}>{displayDate(article.publishedAt)}</time>{article.updatedAt && <> · Updated <time dateTime={article.updatedAt}>{displayDate(article.updatedAt)}</time></>}</p>
      {article.source === 'local' ? <>
        <nav aria-label="On this page" className="mb-12 max-w-3xl rounded-xl border border-border bg-card/40 p-6"><p className="mb-4 font-medium">In this guide</p><ul className="space-y-3">{article.sections.map(section => <li key={section.id}><a href={`#${section.id}`} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">{section.title}</a></li>)}</ul></nav>
        <ContentSections sections={article.sections} />
        <aside className="mt-12 max-w-3xl border-t border-border pt-7"><h2 className="text-xl font-semibold">Related services</h2><div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">{article.relatedServices.map(slug => { const service = getService(slug); return service ? <Link key={slug} href={`/${slug}`} className="text-primary underline underline-offset-4">{service.title}</Link> : null })}</div></aside>
      </> : <div data-imported-article="babylovegrowth" className={styles.body} dangerouslySetInnerHTML={{ __html: article.html }} />}
    </article>
    <ReviewCTA />
    {relatedArticles.length > 0 && <section aria-labelledby="related-guides"><h2 id="related-guides" className="mb-6 text-2xl font-semibold">Keep reading</h2><div className="grid gap-6 md:grid-cols-2">{relatedArticles.map(other => <Link key={other.slug} href={`/blog/${other.slug}`} className="rounded-xl border border-border bg-card/50 p-6 text-lg font-medium hover:border-primary">{other.title}</Link>)}</div></section>}
  </ContentPage>
}
