import type { MetadataRoute } from 'next'
import { services, getPublishedArticles } from '@/lib/content'
import { absoluteUrl, isPreview } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  if (isPreview) return []
  return [
    ...['/', '/about', '/blog', ...services.map(service => `/${service.slug}`)].map(path => ({ url: absoluteUrl(path) })),
    ...getPublishedArticles().map(article => ({ url: absoluteUrl(`/blog/${article.slug}`), lastModified: article.updatedAt ?? article.publishedAt })),
  ]
}
