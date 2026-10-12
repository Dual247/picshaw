import Link from 'next/link'
import { ContentPage, ReviewCTA } from '@/components/ContentPage'
import { getPublishedArticles, displayDate } from '@/lib/content'
import { pageMetadata } from '@/lib/site'

export const metadata = pageMetadata('AEO, AI Search and Website Guides', 'Practical Picshaw guides to AI-search visibility, useful content, search foundations and websites that make it easier to enquire.', '/blog')
export default function BlogPage() {
  const articles = getPublishedArticles()
  return <ContentPage title="Understand it. Improve it. Measure it." intro="Practical guides to AI-search visibility and the websites behind it. Useful explanations for business owners—not promises of a secret ranking formula." eyebrow="AEO & search insights" path="/blog"><div className="grid gap-6 md:grid-cols-2">{articles.map(article => <article key={article.slug} className="flex flex-col rounded-xl border border-border bg-card p-7"><p className="mb-4 text-xs uppercase tracking-widest text-primary">{article.category}</p><h2 className="text-2xl font-semibold leading-snug"><Link href={`/blog/${article.slug}`} className="hover:text-primary">{article.title}</Link></h2><p className="mt-4 text-sm leading-7 text-muted-foreground">{article.description}</p><p className="mt-6 text-xs text-muted-foreground">{article.author} · <time dateTime={article.publishedAt}>{displayDate(article.publishedAt)}</time></p><Link href={`/blog/${article.slug}`} className="mt-5 text-sm font-medium text-primary">Read the guide<span className="sr-only">: {article.title}</span></Link></article>)}</div><ReviewCTA /></ContentPage>
}
