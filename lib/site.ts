import type { Metadata } from 'next'
import seoTitleData from '@/content/seo-titles.json'

export const SITE_URL = 'https://www.picshaw.com'
export const SITE_NAME = 'Picshaw'
export const ORGANIZATION_ID = `${SITE_URL}/#organization`
export const isPreview = Boolean(process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production')
export const absoluteUrl = (path = '/') => new URL(path, SITE_URL).toString()
export const additionalPagePaths = ['/ai-visibility-audit', '/methodology', '/ai-receptionist', '/privacy-policy']

export const serviceLinks = [
  { label: 'AI Visibility Audit', href: '/ai-visibility-audit' },
  { label: 'AI-search optimization', href: '/ai-search-optimization' },
  { label: 'AI receptionist', href: '/ai-receptionist' },
  { label: 'Website redesign', href: '/website-redesign' },
  { label: 'Local SEO', href: '/local-seo' },
  { label: 'Contractor websites', href: '/web-design-for-contractors' },
]
export const editorialLinks = [
  { label: 'Our methodology', href: '/methodology' },
  { label: 'About Picshaw', href: '/about' },
  { label: 'Guides & insights', href: '/blog' },
]
// Complete search titles are separate from the longer on-page editorial headings.
// Absolute titles prevent the root layout from appending the brand a second time.
const seoTitles: Readonly<Record<string, string>> = seoTitleData
export function pageMetadata(title: string, description: string, path: string): Metadata {
  const url = absoluteUrl(path)
  const searchTitle = seoTitles[path] ?? `${title} | ${SITE_NAME}`
  return { title: { absolute: searchTitle }, description, alternates: { canonical: url }, openGraph: { title: searchTitle, description, url, siteName: SITE_NAME, type: 'website', locale: 'en_US' }, twitter: { card: 'summary', title: searchTitle, description } }
}
export function jsonLd(value: unknown) { return JSON.stringify(value).replace(/</g, '\\u003c') }
