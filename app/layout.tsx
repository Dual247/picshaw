import type { Metadata } from 'next'
import { Space_Grotesk, Geist_Mono } from 'next/font/google'
import { SiteAnalytics } from '@/components/SiteAnalytics'
import { ChatWidget } from '@/components/ChatWidget'
import { absoluteUrl, isPreview, jsonLd, ORGANIZATION_ID, SITE_URL } from '@/lib/site'
import './globals.css'

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })
const title = 'Picshaw | AEO & AI Search Visibility for Service Businesses'
const description = 'Help customers discover and understand your business in AI search. Picshaw provides AEO audits, search foundations, useful content and website improvements.'
export const metadata: Metadata = {
  title: { default: title, template: '%s | Picshaw' }, description,
  metadataBase: new URL(SITE_URL), authors: [{ name: 'Picshaw', url: absoluteUrl('/about') }], creator: 'Picshaw', publisher: 'Picshaw',
  openGraph: { title, description, url: SITE_URL, siteName: 'Picshaw', locale: 'en_US', type: 'website' },
  twitter: { card: 'summary', title, description },
  robots: isPreview ? { index: false, follow: false } : { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } },
}
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const organization = { '@context': 'https://schema.org', '@type': 'Organization', '@id': ORGANIZATION_ID, name: 'Picshaw', description: 'AEO, AI-search visibility and website improvements for local service businesses.', url: SITE_URL, logo: absoluteUrl('/brand/picshaw-mark.svg'), email: 'hello@picshaw.com', founder: { '@type': 'Person', '@id': absoluteUrl('/about#ash-patel'), name: 'Ash Patel' }, address: { '@type': 'PostalAddress', addressLocality: 'Los Angeles', addressRegion: 'CA', addressCountry: 'US' } }
  return <html lang="en" className={`${spaceGrotesk.variable} ${geistMono.variable} bg-background`}>
    <head><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(organization) }} /></head>
    <body className="font-sans antialiased">
      <a href="#main-content" className="sr-only fixed left-4 top-4 z-[100] rounded bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only">Skip to content</a>
      <noscript><style>{'[style*="opacity:0"], [style*="opacity: 0"] {opacity:1!important;transform:none!important} header[style] {transform:none!important}'}</style><p className="relative z-[60] bg-card p-4 text-center">JavaScript is off. Read our pages normally, or email <a href="mailto:hello@picshaw.com" className="underline">hello@picshaw.com</a> to discuss an audit or website project.</p></noscript>
      {children}
      <ChatWidget />
      <SiteAnalytics production={process.env.VERCEL_ENV === 'production'} />
    </body>
  </html>
}
