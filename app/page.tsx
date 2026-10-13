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
      <WebsiteSupport />
      <section aria-labelledby="receptionist-intro" className="border-t border-border py-14"><div className="mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20"><div className="flex flex-col justify-between gap-7 rounded-xl border border-border bg-card p-7 md:flex-row md:items-center md:p-9"><div className="max-w-2xl"><p className="mb-4 text-xs uppercase tracking-[0.2em] text-primary">New · AI receptionist founding pilot</p><h2 id="receptionist-intro" className="text-2xl font-semibold tracking-tight md:text-3xl">Get found. Be ready for the call.</h2><p className="mt-4 text-sm leading-7 text-muted-foreground">Explore after-hours enquiry capture and callback handling, configured around your business. Pilot enquiries are open; activation follows a fit check and testing.</p></div><Link href="/ai-receptionist" className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-lg border border-primary/40 px-5 py-3 text-sm font-medium text-primary hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">Explore AI receptionist</Link></div></div></section>
      <WorkShowcase /><FAQ /><Contact />
    </main>
    <Footer />
  </>
}
