import Link from 'next/link'
import { ArrowRight, Database, ShieldCheck, Sparkles } from 'lucide-react'
import { PortalHeader } from '@/components/platform/portal-header'
import { DataForSeoDashboard } from '@/components/platform/dataforseo-dashboard'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const metadata = { title: 'AI visibility evidence | Picshaw', robots: { index: false, follow: false } }
export default function AiVisibilityPage() {
  const enabled = process.env.PIC_SHAW_DATAFORSEO_ENABLED === 'true'
  return <><PortalHeader /><main id="main-content" className="portal-container portal-command-center"><div className="portal-overview-title"><div><p className="portal-eyebrow">CITATION RESEARCH</p><h1>Your AI visibility evidence</h1><p className="portal-intro">Understand the questions and sources associated with your domain. Inspect the evidence behind every observation.</p></div><span className="portal-badge"><ShieldCheck size={14}/>Private workspace</span></div>{enabled ? <DataForSeoDashboard /> : <section className="portal-card portal-ai-empty"><div className="portal-tool-icon"><Sparkles size={25}/></div><span className="portal-badge orange">Not connected</span><h2>AI evidence is not available yet.</h2><p>AI visibility is not connected for this deployment yet. No provider request has been made.</p><div className="portal-ai-empty-detail"><Database size={19}/><p>When enabled, this tool will let you load saved citation observations or explicitly request a new lookup. Missing evidence is not a zero visibility score.</p></div><div className="portal-actions"><Link href="/platform/reports" prefetch={false} className="portal-button">Review Google Search<ArrowRight size={16}/></Link><Link href="/platform/analyze" prefetch={false} className="portal-button secondary">Review a page</Link></div></section>}<p className="portal-fine">Database coverage is not a live buyer-question test. Availability, source dates and coverage limits are shown with the evidence.</p></main></>
}
