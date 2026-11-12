import { NextRequest } from 'next/server'
import { handleAnalysis } from '@/lib/platform/analysis-handlers'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30
export async function POST(request: NextRequest) { return handleAnalysis(request) }
