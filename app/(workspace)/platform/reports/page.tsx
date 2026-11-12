import { PortalHeader } from '@/components/platform/portal-header'
import { SearchReportDashboard } from '@/components/platform/search-report-dashboard'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const metadata = { title: 'Google Search report | Picshaw', robots: { index: false, follow: false } }

// Public shell only. Private records are loaded through authorized no-store POSTs.
export default function SearchReportsPage() {
  return <><PortalHeader /><main id="main-content" className="portal-container py-8"><SearchReportDashboard /></main></>
}
