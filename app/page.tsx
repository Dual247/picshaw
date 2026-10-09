import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/Header'
import { Hero } from '@/components/Hero'
import { Marquee } from '@/components/Marquee'
import { ValueProps } from '@/components/ValueProps'
import { WorkShowcase } from '@/components/WorkShowcase'
import { Services } from '@/components/Services'
import { Process } from '@/components/Process'
import { Pricing } from '@/components/Pricing'
import { FAQ } from '@/components/FAQ'
import { Contact } from '@/components/Contact'
import { Footer } from '@/components/Footer'
import { absoluteUrl, serviceLinks } from '@/lib/site'
import { getPublishedArticles } from '@/lib/content'

export const metadata: Metadata = { alternates: { canonical: absoluteUrl('/') } }
export default function Home() {
  return <>
    <Header />
    <main id="main-content" className="relative min-h-screen">
      <div className="noise-texture pointer-events-none fixed inset-0 z-50" />
      <Hero /><Marquee /><ValueProps /><WorkShowcase /><Services />
      <section aria-labelledby="explore-services" className="mx-auto max-w-[1400px] px-6 pb-20 md:px-12 lg:px-20"><h2 id="explore-services" className="mb-6 text-2xl font-semibold">Explore the right next step for your website</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{serviceLinks.map(link => <Link key={link.href} href={link.href} className="rounded-xl border border-border bg-card/50 p-6 font-medium transition-colors hover:border-primary">{link.label}<span aria-hidden="true" className="ml-2 text-primary">↗</span></Link>)}</div></section>
      <Process /><Pricing /><FAQ />
      <section aria-labelledby="latest-guides" className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 lg:px-20"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><h2 id="latest-guides" className="text-3xl font-semibold">Practical guides for business owners</h2><Link href="/blog" className="text-primary underline underline-offset-4">View all guides</Link></div><div className="grid gap-6 md:grid-cols-3">{getPublishedArticles().slice(0, 3).map(article => <article key={article.slug} className="rounded-xl border border-border bg-card/50 p-7"><p className="mb-3 text-xs uppercase tracking-widest text-primary">{article.category}</p><h3 className="text-xl font-semibold"><Link href={`/blog/${article.slug}`} className="hover:text-primary">{article.title}</Link></h3><p className="mt-4 text-sm leading-7 text-muted-foreground">{article.description}</p></article>)}</div></section>
      <Contact />
    </main>
    <Footer />
  </>
}
