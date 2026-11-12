import Link from 'next/link'
import { PortalHeader } from '@/components/platform/portal-header'
import { WebsiteAnalysisPanel } from '@/components/platform/website-analysis-panel'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export default function AnalyzePage() {
  return <><PortalHeader /><main id="main-content" className="portal-container space-y-6"><Link className="portal-text-link" href="/platform">Back to workspace</Link><h1 className="text-3xl font-semibold">Analyze a website page</h1><WebsiteAnalysisPanel /></main></>
}
