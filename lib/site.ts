import type { Metadata } from 'next'

// Live audit on 2026-10-09: the apex redirects to this successful public host.
export const SITE_URL = 'https://www.picshaw.com'
export const SITE_NAME = 'Picshaw'
export const ORGANIZATION_ID = `${SITE_URL}/#organization`
export const isPreview = Boolean(process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production')
export const absoluteUrl = (path = '/') => new URL(path, SITE_URL).toString()

export const serviceLinks = [
  { label: 'Website redesign', href: '/website-redesign' },
  { label: 'AI-search optimization', href: '/ai-search-optimization' },
  { label: 'Local SEO', href: '/local-seo' },
  { label: 'Contractor websites', href: '/web-design-for-contractors' },
]
export const editorialLinks = [
  { label: 'About Picshaw', href: '/about' },
  { label: 'Guides & insights', href: '/blog' },
]

export function pageMetadata(title: string, description: string, path: string): Metadata {
  const url = absoluteUrl(path)
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} | Picshaw`, description, url, siteName: SITE_NAME, type: 'website', locale: 'en_US' },
    twitter: { card: 'summary', title: `${title} | Picshaw`, description },
  }
}

export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
