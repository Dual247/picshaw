import { handleGsc } from '@/lib/platform/gsc-handlers'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const GET = (request: import('next/server').NextRequest) => handleGsc(request, 'callback')
