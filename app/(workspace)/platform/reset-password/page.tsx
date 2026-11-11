import { AccountLifecycle } from '@/components/platform/auth/account-lifecycle'
import { lifecycleAvailability } from '@/lib/supabase/portal-config'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Reset password | Picshaw' }
export default function ResetPasswordPage() {
  const available = lifecycleAvailability()
  return <AccountLifecycle mode="reset-password" available={available.email && available.session} />
}
