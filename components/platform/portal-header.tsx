'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, FileSearch, LayoutDashboard, Settings2, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import { ThemeToggle } from './theme-toggle'
const routes = [
  { href: '/platform', label: 'Overview', Icon: LayoutDashboard },
  { href: '/platform/reports', label: 'Google Search', Icon: BarChart3 },
  { href: '/platform/ai-visibility', label: 'AI evidence', Icon: Sparkles },
  { href: '/platform/analyze', label: 'Page review', Icon: FileSearch },
  { href: '/platform/onboarding', label: 'Setup', Icon: Settings2 },
  { href: '/platform/account', label: 'Account', Icon: UserRound },
]
export function PortalHeader({ sample = false }: { sample?: boolean }) {
  const pathname = usePathname()
  return <>
    <header className="portal-header">
      <Link href="/platform" prefetch={false} className="portal-wordmark" aria-label="Picshaw portal home">picshaw<span>.</span><small>WORKSPACE</small></Link>
      <div className="portal-header-actions"><span className="portal-private-label"><ShieldCheck size={14} aria-hidden="true"/> Private workspace</span><ThemeToggle/><Link className="portal-button secondary small" prefetch={false} href={sample ? '/platform' : '/platform/account'}>{sample ? 'Exit sample' : 'My account'}</Link></div>
    </header>
    {!sample && <nav aria-label="Portal navigation" className="portal-primary-nav">{routes.map(({href,label,Icon}) => {
      const active = pathname === href || (href === '/platform/onboarding' && pathname === '/platform/connect')
      return <Link key={href} href={href} prefetch={false} aria-current={active ? 'page' : undefined}><Icon size={17} aria-hidden="true"/>{label}</Link>
    })}</nav>}
  </>
}
