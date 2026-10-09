'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Menu, X, ArrowUpRight } from 'lucide-react'
import { AnimatedButton } from './AnimatedButton'
import { BrandLogo } from './BrandLogo'

const navItems = [
  { label: 'Work', href: '/#work' },
  { label: 'Services', href: '/#services' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'Guides', href: '/blog' },
  { label: 'About', href: '/about' },
]
export function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
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
        <nav aria-label="Main navigation" className="hidden items-center gap-6 lg:flex xl:gap-8">{navItems.map(item => <Link key={item.label} href={item.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground" aria-current={item.href === pathname ? 'page' : undefined}>{item.label}</Link>)}</nav>
        <div className="hidden shrink-0 lg:block"><AnimatedButton href="/#contact" size="sm">Get Your Free Website Review<ArrowUpRight size={14} /></AnimatedButton></div>
        <button type="button" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card lg:hidden" aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={isMobileMenuOpen} aria-controls={isMobileMenuOpen ? 'mobile-navigation' : undefined}>{isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}</button>
      </div>
      {isMobileMenuOpen && <nav id="mobile-navigation" aria-label="Mobile navigation" className="border-t border-border bg-background px-6 py-8 lg:hidden"><div className="flex flex-col gap-6">{navItems.map(item => <Link key={item.label} href={item.href} onClick={() => setIsMobileMenuOpen(false)} className="text-xl font-medium">{item.label}</Link>)}<Link href="/#contact" onClick={() => setIsMobileMenuOpen(false)} className="text-primary">Get your free website review</Link></div></nav>}
    </header>
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 p-4 backdrop-blur lg:hidden"><div className="flex flex-col items-center gap-2"><AnimatedButton href="/#contact" className="w-full justify-center" showArrow>Get Your Free Website Review</AnimatedButton><a href="tel:+17379009237" className="text-sm text-muted-foreground">Or call <span className="underline underline-offset-2">(737) 900-9237</span></a></div></div>
  </>
}
