import { NextRequest } from 'next/server'
import { handleWorkspacePost } from '@/lib/supabase/workspace-handlers'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function POST(request: NextRequest) { return handleWorkspacePost(request, false) }
