import { NextRequest, NextResponse } from 'next/server'
import { PORTAL_HOST, PORTAL_ORIGIN, portalBoundary } from './lib/portal-origin'

/** Host is validated exactly. X-Forwarded-Host is deliberately never consulted. */
export function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const path = request.nextUrl.pathname
  const decision = portalBoundary(host, path, request.method, process.env.VERCEL_ENV === 'preview')
  const response = decision === 'deny'
    ? new NextResponse('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    : decision === 'redirect'
      ? NextResponse.redirect(`${PORTAL_ORIGIN}/platform`, 303)
      : NextResponse.next()
  if (host === PORTAL_HOST || decision !== 'allow' || path === '/platform' || path.startsWith('/platform/')) {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0')
    response.headers.set('Referrer-Policy', 'no-referrer')
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    // This deliberately does not constrain scripts: Next inline RSC/hydration must
    // work. The host/path boundary excludes marketing scripts and HTML entirely.
    response.headers.set('Content-Security-Policy', "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'")
  }
  return response
}
