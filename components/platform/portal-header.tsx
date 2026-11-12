import Link from 'next/link'
import { ThemeToggle } from './theme-toggle'
export function PortalHeader({sample=false}:{sample?:boolean}) {
 return <><header className="portal-header"><Link href="/platform" className="portal-wordmark" aria-label="Picshaw portal home">picshaw<span>.</span><small>CLIENT PORTAL</small></Link><div className="portal-header-actions"><ThemeToggle/><Link className="portal-button secondary small" href={sample?'/platform':'/platform/sign-in'}>{sample?'Exit sample':'Sign in'}</Link></div></header>{!sample && <nav aria-label="Portal navigation" className="portal-container flex flex-wrap gap-x-6 gap-y-3 py-4 text-sm">{[["/platform","Overview"],["/platform/reports","Google Search"],["/platform/ai-visibility","AI evidence"],["/platform/analyze","Page review"],["/platform/onboarding","Setup"],["/platform/account","Account"]].map(([href,label])=><Link key={href} href={href} prefetch={false} className="portal-text-link">{label}</Link>)}</nav>}</>
}
