import { NextRequest } from 'next/server'
import { handleDataForSeoJob } from '@/lib/platform/dataforseo-job-handlers'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 180
export async function POST(request: NextRequest) { return handleDataForSeoJob(request, 'submit') }
