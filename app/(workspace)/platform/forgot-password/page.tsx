import { AccountLifecycle } from '@/components/platform/auth/account-lifecycle'
import { lifecycleAvailability } from '@/lib/supabase/portal-config'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Password recovery | Picshaw' }
export default function ForgotPasswordPage() { return <AccountLifecycle mode="recover" available={lifecycleAvailability().email} /> }
