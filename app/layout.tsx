import type { Metadata } from 'next'
import { Space_Grotesk, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const spaceGrotesk = Space_Grotesk({ 
  subsets: ["latin"],
  variable: '--font-sans',
  display: 'swap',
})

const geistMono = Geist_Mono({ 
  subsets: ["latin"],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Picshaw | Web Design Agency in Los Angeles',
  description: 'Picshaw builds fast, cinematic, conversion-focused websites for local businesses in Los Angeles. Website refreshes, landing pages, local SEO structure, and launch-ready redesigns from $1,000.',
  keywords: 'Los Angeles web design, LA web design agency, local business websites, website redesign Los Angeles, small business web design, landing page design, conversion-focused websites, local SEO websites',
  authors: [{ name: 'Picshaw' }],
  creator: 'Picshaw',
  publisher: 'Picshaw',
  metadataBase: new URL('https://picshaw.com'),
  openGraph: {
    title: 'Picshaw | Cinematic Web Design for LA Businesses',
    description: 'Premium, fast-launch websites for local businesses that want to look sharper, rank better, and convert more visitors.',
    url: 'https://picshaw.com',
    siteName: 'Picshaw',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Picshaw | Cinematic Web Design for LA Businesses',
    description: 'Premium, fast-launch websites for local businesses that want to look sharper, rank better, and convert more visitors.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: 'Picshaw',
    description: 'Picshaw builds cinematic, high-converting websites for local businesses in Los Angeles.',
    url: 'https://picshaw.com',
    email: 'hello@picshaw.com',
    areaServed: {
      '@type': 'City',
      name: 'Los Angeles',
      '@id': 'https://www.wikidata.org/wiki/Q65'
    },
    serviceType: ['Web Design', 'Website Redesign', 'Landing Page Design', 'Local SEO Website Structure'],
    priceRange: '$1,000 - $5,000',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Los Angeles',
      addressRegion: 'CA',
      addressCountry: 'US'
    }
  }

  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${geistMono.variable} bg-background`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
