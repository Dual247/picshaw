import Link from 'next/link'
import { ContentPage, ReviewCTA } from '@/components/ContentPage'
import { getPublishedArticles, displayDate } from '@/lib/content'
import { pageMetadata } from '@/lib/site'

export const metadata = pageMetadata('Small-business website, SEO and AI-search guides', 'Practical guides from Picshaw on website redesign, local SEO, ChatGPT search eligibility and making contractor websites easier to enquire through.', '/blog')
export default function BlogPage() {
  return <ContentPage title="Practical answers. Better business websites." intro="Guides for business owners making decisions about design, search visibility and the next useful improvement to their website." eyebrow="Guides & insights" path="/blog">
    <div className="grid gap-6 md:grid-cols-2">{getPublishedArticles().map(article => <article key={article.slug} className="flex flex-col rounded-2xl border border-border bg-card/50 p-7 md:p-9">
      <p className="mb-4 text-xs font-medium uppercase tracking-[0.15em] text-primary">{article.category}</p>
      <h2 className="text-2xl font-semibold leading-snug"><Link href={`/blog/${article.slug}`} className="transition-colors hover:text-primary">{article.title}</Link></h2>
      <p className="mt-5 flex-1 leading-7 text-muted-foreground">{article.description}</p>
      <p className="mt-7 text-sm text-muted-foreground">{article.author} · <time dateTime={article.publishedAt}>{displayDate(article.publishedAt)}</time></p>
    </article>)}</div>
    <ReviewCTA />
  </ContentPage>
}
