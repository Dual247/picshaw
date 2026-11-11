import Link from 'next/link'
import { PortalHeader } from '@/components/platform/portal-header'
import { WorkspaceSetup } from '@/components/platform/workspace-setup'
import { readWorkspaceConfig } from '@/lib/supabase/workspace-runtime'
import { authAdmissionConfigured } from '@/lib/supabase/auth-admission'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export default function OnboardingPage() {
  return <><PortalHeader/><main id="main-content" className="portal-container portal-onboarding">
    <Link href="/platform" className="portal-text-link">Back to portal overview</Link>
    <p className="portal-eyebrow">GETTING STARTED</p><h1>A private place<br/>for your business.</h1>
    <p className="portal-intro">Sign in, create your own workspace, then connect evidence when integrations become available. Existing client workspaces are never assigned automatically.</p>
    <WorkspaceSetup available={readWorkspaceConfig() !== null && authAdmissionConfigured}/>
  </main></>
}
