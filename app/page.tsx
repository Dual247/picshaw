import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/Header'
import { Hero } from '@/components/Hero'
import { AEOOverview, AEOProcess, WebsiteSupport } from '@/components/AEOLanding'
import { WorkShowcase } from '@/components/WorkShowcase'
import { FAQ } from '@/components/FAQ'
import { Contact } from '@/components/Contact'
import { Footer } from '@/components/Footer'
import { absoluteUrl } from '@/lib/site'
import { getPublishedArticles } from '@/lib/content'

export const metadata: Metadata = { alternates: { canonical: absoluteUrl('/') } }
export default function Home() {
  const articles = getPublishedArticles()
  const priority = ['chatgpt-search-visibility', 'website-not-appearing-in-google', 'contractor-website-checklist']
  const featured = priority.map(slug => articles.find(article => article.slug === slug)).filter((article): article is NonNullable<typeof article> => Boolean(article))
  return <>
    <Header />
    <main id="main-content" className="relative min-h-screen">
      <Hero /><AEOOverview /><AEOProcess />
      <section aria-labelledby="latest-guides" className="border-t border-border py-20 md:py-24"><div className="mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20"><div className="mb-10 flex flex-wrap items-end justify-between gap-5"><div><p className="mb-5 text-xs font-medium uppercase tracking-[0.2em] text-primary">Practical knowledge</p><h2 id="latest-guides" className="text-3xl font-semibold tracking-tight md:text-4xl">Understand the search behind the answer.</h2></div><Link href="/blog" className="text-sm font-medium text-primary underline underline-offset-4">Explore our guides</Link></div><div className="grid gap-5 md:grid-cols-3">{featured.map(article => <article key={article.slug} className="rounded-xl border border-border bg-card p-7"><p className="mb-4 text-xs uppercase tracking-widest text-primary">{article.category}</p><h3 className="text-xl font-semibold leading-snug"><Link href={`/blog/${article.slug}`} className="hover:text-primary">{article.title}</Link></h3><p className="mt-4 text-sm leading-7 text-muted-foreground">{article.description}</p></article>)}</div></div></section>
      <WebsiteSupport /><WorkShowcase /><FAQ /><Contact />
    </main>
    <Footer />
  </>
}
