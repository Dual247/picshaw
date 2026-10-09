import type { ReactNode } from 'react'
import Link from 'next/link'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import type { ContentSection } from '@/lib/content'
import { absoluteUrl, jsonLd } from '@/lib/site'

export function ContentPage({ title, intro, eyebrow, path, children }: { title: string; intro: string; eyebrow: string; path: string; children: ReactNode }) {
  const breadcrumbs = [{ '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') }]
  if (path.startsWith('/blog/')) breadcrumbs.push({ '@type': 'ListItem', position: 2, name: 'Guides & insights', item: absoluteUrl('/blog') })
  breadcrumbs.push({ '@type': 'ListItem', position: breadcrumbs.length + 1, name: title, item: absoluteUrl(path) })
  return (
    <>
      <Header />
      <main id="main-content" className="mx-auto max-w-[1200px] px-6 pb-20 pt-36 md:px-12 md:pt-44">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: breadcrumbs }) }} />
        <nav aria-label="Breadcrumb" className="mb-10 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Home</Link><span aria-hidden="true">/</span>
          {path.startsWith('/blog/') && <><Link href="/blog" className="hover:text-foreground">Guides</Link><span aria-hidden="true">/</span></>}
          <span aria-current="page" className="max-w-full break-words">{title}</span>
        </nav>
        <header className="mb-14 max-w-4xl border-b border-border pb-12">
          <p className="mb-5 text-xs font-medium uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
          <h1 className="headline-editorial text-4xl font-bold leading-tight md:text-6xl">{title}</h1>
          <p className="mt-7 max-w-3xl text-lg leading-relaxed text-muted-foreground md:text-xl">{intro}</p>
        </header>
        {children}
      </main>
      <Footer />
    </>
  )
}

export function ContentSections({ sections }: { sections: ContentSection[] }) {
  return <div className="max-w-3xl space-y-12">{sections.map(section => (
    <section key={section.id} id={section.id} className="scroll-mt-32">
      <h2 className="mb-5 text-2xl font-semibold leading-snug md:text-3xl">{section.title}</h2>
      {section.paragraphs.map(paragraph => <p key={paragraph} className="mb-5 text-base leading-8 text-muted-foreground md:text-lg">{paragraph}</p>)}
      {section.bullets && <ul className="my-5 list-disc space-y-3 pl-6 text-muted-foreground">{section.bullets.map(item => <li key={item} className="leading-7">{item}</li>)}</ul>}
      {section.links && <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3">{section.links.map(link => <Link key={link.href} href={link.href} className="font-medium text-primary underline underline-offset-4">{link.label}</Link>)}</div>}
      {section.sources && <p className="mt-5 text-sm leading-7 text-muted-foreground">Sources: {section.sources.map((source, index) => <span key={source.href}>{index > 0 && ' · '}<a href={source.href} className="underline underline-offset-4">{source.label}</a></span>)}</p>}
    </section>
  ))}</div>
}

export function ReviewCTA() {
  return <aside className="my-14 rounded-2xl border border-border bg-card p-7 md:p-10">
    <h2 className="text-2xl font-semibold">Find the next useful improvement.</h2>
    <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">Send your current website for a free review. Get a practical recommendation on the design, search foundations and route to an enquiry.</p>
    <Link href="/#contact" className="mt-6 inline-flex rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90">Get your free website review</Link>
  </aside>
}
