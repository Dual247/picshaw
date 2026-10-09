import type { MetadataRoute } from 'next'
import { absoluteUrl, isPreview } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  if (isPreview) return { rules: { userAgent: '*', disallow: '/' } }
  // One group avoids crawler-specific overrides. OAI-SearchBot inherits this access.
  // No new GPTBot training preference is introduced. Robots is not authentication.
  return { rules: { userAgent: '*', allow: '/', disallow: ['/api/'] }, sitemap: absoluteUrl('/sitemap.xml') }
}
