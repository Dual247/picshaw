import { authAvailability, lifecycleAvailability } from '@/lib/supabase/portal-config'
export const dynamic = 'force-dynamic'
/** Public capability only. No session read, data collection or authorization. */
export function GET() {
  const ready = lifecycleAvailability().session && Object.values(authAvailability()).some(Boolean)
  return Response.json({ ready }, { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' } })
}
