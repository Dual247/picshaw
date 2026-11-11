import type { NextRequest } from 'next/server'
import { handleAuthPost } from '@/lib/supabase/portal-handlers'

export const dynamic = 'force-dynamic'
export async function POST(request: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  return handleAuthPost(request, (await params).action)
}
