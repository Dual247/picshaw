import { handleGsc } from '@/lib/platform/gsc-handlers'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const POST = (request: import('next/server').NextRequest) => handleGsc(request, 'properties')
