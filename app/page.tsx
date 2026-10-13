import type { Metadata } from 'next'
import { Header } from '@/components/Header'
import { EditorialHome } from '@/components/EditorialHome'
import { Footer } from '@/components/Footer'
import { absoluteUrl } from '@/lib/site'
import { getPublishedArticles } from '@/lib/content'

export const metadata: Metadata = { alternates: { canonical: absoluteUrl('/') } }

export default function Home() {
  const articles = getPublishedArticles()
  const priority = ['chatgpt-search-visibility', 'website-not-appearing-in-google']
  const guides = priority.flatMap(slug => {
    const article = articles.find(item => item.slug === slug)
    return article ? [{ slug: article.slug, title: article.title, category: article.category }] : []
  })
  return <>
    <Header />
    <main id="main-content"><EditorialHome guides={guides} /></main>
    <Footer />
  </>
}
