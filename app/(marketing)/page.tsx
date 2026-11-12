import { Header } from '@/components/Header'
import { EditorialHome } from '@/components/EditorialHome'
import { Footer } from '@/components/Footer'
import { pageMetadata } from '@/lib/site'
import { getPublishedArticles } from '@/lib/content'
import { industries } from '@/lib/industries'

export const metadata = pageMetadata('SEO, AEO & Web Design in Los Angeles', 'Picshaw helps service businesses get found with local SEO, AI-search optimization, website design and AI receptionist services in Los Angeles and Orange County.', '/')

export default function Home() {
  const articles = getPublishedArticles()
  const priority = ['chatgpt-search-visibility', 'website-not-appearing-in-google']
  const guides = priority.flatMap(slug => {
    const article = articles.find(item => item.slug === slug)
    return article ? [{ slug: article.slug, title: article.title, category: article.category }] : []
  })
  return <>
    <Header />
    <main id="main-content"><EditorialHome guides={guides} industryLinks={industries.map(({ slug, name }) => ({ slug, name }))} /></main>
    <Footer />
  </>
}
