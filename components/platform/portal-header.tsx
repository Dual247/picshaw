import Link from 'next/link'
import { ThemeToggle } from './theme-toggle'
export function PortalHeader({sample=false}:{sample?:boolean}) {
 return <header className="portal-header"><Link href="/platform" className="portal-wordmark" aria-label="Picshaw portal home">picshaw<span>.</span><small>CLIENT PORTAL</small></Link><div className="portal-header-actions"><ThemeToggle/><Link className="portal-button secondary small" href={sample?'/platform':'/platform/sign-in'}>{sample?'Exit sample':'Sign in'}</Link></div></header>
}
