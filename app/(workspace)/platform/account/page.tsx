import { AccountLifecycle } from '@/components/platform/auth/account-lifecycle'
import { lifecycleAvailability } from '@/lib/supabase/portal-config'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Account session | Picshaw' }
export default function AccountPage() { return <AccountLifecycle mode="account" available={lifecycleAvailability().session} /> }
