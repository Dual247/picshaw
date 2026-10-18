'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Menu, X, ArrowUpRight } from 'lucide-react'
import { BrandLogo } from './BrandLogo'

const navItems = [
  { label: 'AEO', href: '/ai-search-optimization' },
  { label: 'Monthly plan', href: '/ai-visibility-retainer' },
  { label: 'AI receptionist', href: '/ai-receptionist' },
  { label: 'Our approach', href: '/methodology' },
  { label: 'Guides', href: '/blog' },
  { label: 'Work', href: '/#work' },
  { label: 'About', href: '/about' },
]
export function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const isReceptionist = pathname === '/ai-receptionist'
  const isRetainer = pathname === '/ai-visibility-retainer'
  const ctaHref = isReceptionist ? '/ai-receptionist#enquiry' : isRetainer ? '/ai-visibility-retainer#contact' : '/ai-visibility-audit#contact'
  const ctaLabel = isReceptionist ? 'Request a demo' : isRetainer ? 'Discuss my plan' : 'Request an AI audit'
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50)
    const frame = requestAnimationFrame(handleScroll)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', handleScroll) }
  }, [])
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsMobileMenuOpen(false) }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])
  return <>
    <header className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${isScrolled || pathname !== '/' || isMobileMenuOpen ? 'glass border-b border-border py-4' : 'py-6'}`}>
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 md:px-12 lg:px-20">
        <Link href="/" onClick={() => setIsMobileMenuOpen(false)} aria-label="Picshaw home" className="relative z-10 flex shrink-0 items-center gap-3 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"><BrandLogo showStudio /></Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-4 xl:flex">{navItems.map(item => <Link key={item.label} href={item.href} className="whitespace-nowrap text-xs text-muted-foreground transition-colors hover:text-foreground" aria-current={item.href === pathname ? 'page' : undefined}>{item.label}</Link>)}</nav>
        <Link href={ctaHref} className="hidden shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 xl:inline-flex">{ctaLabel}<ArrowUpRight size={15} aria-hidden="true" /></Link>
        <button type="button" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card xl:hidden" aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={isMobileMenuOpen} aria-controls={isMobileMenuOpen ? 'mobile-navigation' : undefined}>{isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}</button>
      </div>
      {isMobileMenuOpen && <nav id="mobile-navigation" aria-label="Mobile navigation" className="max-h-[70svh] overflow-y-auto border-t border-border bg-background px-6 py-8 lg:hidden"><div className="flex flex-col gap-6">{navItems.map(item => <Link key={item.label} href={item.href} onClick={() => setIsMobileMenuOpen(false)} className="text-xl font-medium" aria-current={item.href === pathname ? 'page' : undefined}>{item.label}</Link>)}<Link href={ctaHref} onClick={() => setIsMobileMenuOpen(false)} className="text-primary">{ctaLabel}</Link></div></nav>}
    </header>
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 p-3 backdrop-blur lg:hidden"><div className="mx-auto flex max-w-md items-center justify-center gap-4"><Link href={ctaHref} className="flex-1 rounded-lg bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground">{ctaLabel}</Link><a href="tel:+17379009237" className="px-2 text-sm text-muted-foreground underline underline-offset-2">Call Picshaw</a></div></div>
  </>
}
