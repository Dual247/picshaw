import { NextRequest } from 'next/server'
import { handleReports } from '@/lib/platform/report-handlers'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
export async function POST(request: NextRequest) { return handleReports(request, 'read') }
