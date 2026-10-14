import { createHash, timingSafeEqual } from 'node:crypto'
import { revalidatePath, revalidateTag } from 'next/cache'
import { BLOG_CACHE_TAG } from '@/lib/babylovegrowth-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  const secret = process.env.BABYLOVEGROWTH_REVALIDATE_SECRET
  if (!secret || secret.length < 32) return Response.json({ error: 'Refresh is not configured' }, { status: 503 })
  const supplied = request.headers.get('authorization') || ''
  const digest = (value: string) => createHash('sha256').update(value).digest()
  if (!timingSafeEqual(digest(supplied), digest(`Bearer ${secret}`))) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  revalidateTag(BLOG_CACHE_TAG, { expire: 0 })
  revalidatePath('/blog', 'layout')
  revalidatePath('/sitemap.xml')
  return Response.json({ revalidated: true }, { headers: { 'Cache-Control': 'no-store' } })
}
