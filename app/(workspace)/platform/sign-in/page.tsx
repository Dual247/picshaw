import { AuthForm } from '@/components/platform/auth/auth-form'
import { authAvailability } from '@/lib/supabase/portal-config'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Sign in | Picshaw' }
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { error, notice } = await searchParams
  return <AuthForm mode="sign-in" available={authAvailability()} callbackError={error === 'callback'} accessPending={notice === 'access-pending'} />
}
