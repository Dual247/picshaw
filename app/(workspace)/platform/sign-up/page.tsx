import { AuthForm } from '@/components/platform/auth/auth-form'
import { authAvailability } from '@/lib/supabase/portal-config'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Create account | Picshaw' }
export default function SignUpPage() { return <AuthForm mode="sign-up" available={authAvailability()} /> }
