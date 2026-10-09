import type { Metadata } from 'next'
import { Space_Grotesk, Geist_Mono } from 'next/font/google'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { SiteAnalytics } from '@/components/SiteAnalytics'
import { absoluteUrl, isPreview, jsonLd, ORGANIZATION_ID, SITE_URL } from '@/lib/site'
import './globals.css'

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'Picshaw | Web Design Agency in Los Angeles', template: '%s | Picshaw' },
  description: 'Web design, website refreshes and search foundations for local businesses in Los Angeles. Clear enquiry paths and a $1,000 website refresh option.',
  metadataBase: new URL(SITE_URL),
  authors: [{ name: 'Picshaw', url: absoluteUrl('/about') }], creator: 'Picshaw', publisher: 'Picshaw',
  openGraph: { title: 'Picshaw | Web Design Agency in Los Angeles', description: 'Practical websites, useful content and search foundations for local businesses.', url: SITE_URL, siteName: 'Picshaw', locale: 'en_US', type: 'website' },
  twitter: { card: 'summary', title: 'Picshaw | Web Design Agency in Los Angeles', description: 'Web design and search foundations for local businesses.' },
  robots: isPreview ? { index: false, follow: false } : { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const organization = { '@context': 'https://schema.org', '@type': 'ProfessionalService', '@id': ORGANIZATION_ID, name: 'Picshaw', description: 'Web design and search foundations for local businesses in Los Angeles.', url: SITE_URL, logo: absoluteUrl('/brand/picshaw-mark.svg'), email: 'hello@picshaw.com', areaServed: { '@type': 'City', name: 'Los Angeles' }, serviceType: ['Web Design', 'Website Redesign', 'Landing Page Design', 'Local SEO Website Structure'], priceRange: '$1,000 - $5,000', address: { '@type': 'PostalAddress', addressLocality: 'Los Angeles', addressRegion: 'CA', addressCountry: 'US' } }
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${geistMono.variable} bg-background`}>
      <head><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(organization) }} /></head>
      <body className="font-sans antialiased">
        <a href="#main-content" className="sr-only fixed left-4 top-4 z-[100] rounded bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only">Skip to content</a>
        <noscript><style>{'[style*="opacity:0"], [style*="opacity: 0"] {opacity:1!important;transform:none!important} header[style] {transform:none!important}'}</style><p className="relative z-[60] bg-card p-4 text-center">JavaScript is off. Read our pages normally, or email <a href="mailto:hello@picshaw.com" className="underline">hello@picshaw.com</a> for a website review.</p></noscript>
        {children}
        <SiteAnalytics production={!isPreview} />
        <SpeedInsights />
      </body>
    </html>
  )
}
