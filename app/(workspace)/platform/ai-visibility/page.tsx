import { PortalHeader } from '@/components/platform/portal-header'
import { DataForSeoDashboard } from '@/components/platform/dataforseo-dashboard'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const metadata = { title: 'AI visibility evidence | Picshaw', robots: { index: false, follow: false } }
export default function AiVisibilityPage() {
  const enabled = process.env.PIC_SHAW_DATAFORSEO_ENABLED === 'true'
  return <><PortalHeader /><main id="main-content" className="portal-container py-8"><h1 className="mb-5 text-3xl font-semibold">Your AI visibility evidence</h1>{enabled ? <DataForSeoDashboard /> : <section className="portal-card p-6"><p>AI visibility is not connected for this deployment yet. No provider request has been made.</p></section>}</main></>
}
