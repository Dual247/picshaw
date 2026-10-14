import type { MetadataRoute } from 'next'
import { services } from '@/lib/content'
import { getBlogArticles } from '@/lib/blog'
import { absoluteUrl, additionalPagePaths, isPreview } from '@/lib/site'

export const revalidate = 300
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isPreview) return []
  const articles = await getBlogArticles()
  return [
    ...['/', '/about', '/blog', ...additionalPagePaths, ...services.map(service => `/${service.slug}`)].map(path => ({ url: absoluteUrl(path) })),
    ...articles.map(article => ({ url: absoluteUrl(`/blog/${article.slug}`), lastModified: article.updatedAt ?? article.publishedAt })),
  ]
}
