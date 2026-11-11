/** Public, reviewed deployment boundary. Never derive this from request headers. */
export const PORTAL_ORIGIN = 'https://app.picshaw.com'
export const PORTAL_HOST = 'app.picshaw.com'
export const MARKETING_HOSTS = ['picshaw.com', 'www.picshaw.com'] as const

/** Link presentation only. Proxy and server auth independently deny preview auth. */
export function portalNavigationOrigin(hostname: string, previewDeployment: boolean) {
  return previewDeployment || ['localhost', '127.0.0.1', '[::1]'].includes(hostname) ? '' : PORTAL_ORIGIN
}

export function portalHref(path: '/platform/sign-in' | '/platform/sign-up' | '/platform/preview') {
  return `${PORTAL_ORIGIN}${path}`
}

export type BoundaryDecision = 'allow' | 'deny' | 'redirect'
/** No extension-based exclusions: dotted paths must pass the same boundary. */
export function portalBoundary(host: string, path: string, method: string, preview = false): BoundaryDecision {
  // Next emits URL-encoded brackets for dynamic-route JS chunks (for example
  // app/(marketing)/%5Bservice%5D/page-HASH.js). Decode only those two bytes,
  // only under the literal static-chunk prefix, and only for read requests.
  // Never decode separators, dots, percent signs, controls or arbitrary paths.
  if ((method === 'GET' || method === 'HEAD') &&
      path.startsWith('/_next/static/chunks/') && path.endsWith('.js')) {
    path = path.replace(/%5b/gi, '[').replace(/%5d/gi, ']')
  }
  // Reject ambiguous spellings rather than letting downstream decoding reinterpret them.
  if (!path.startsWith('/') || /[%\\\x00-\x20]/.test(path) || path.includes('//') ||
      path.split('/').some(segment => segment === '.' || segment === '..')) return 'deny'
  const page = path === '/platform' || path.startsWith('/platform/')
  const api = path === '/api/platform' || path.startsWith('/api/platform/')
  const callback = path === '/platform/auth' || path.startsWith('/platform/auth/')
  const read = method === 'GET' || method === 'HEAD'
  if (host === PORTAL_HOST) {
    if (path === '/') return read ? 'redirect' : 'deny'
    if (page || api) return 'allow'
    const asset = path.startsWith('/_next/static/') || path === '/icon.svg' || path === '/brand/picshaw-mark.svg'
    return read && asset ? 'allow' : 'deny'
  }
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/.test(host)
  const review = local || (preview && /^[a-z0-9-]+\.vercel\.app$/.test(host))
  if (review) return api || callback || (page && !read) ? 'deny' : 'allow'
  if (!MARKETING_HOSTS.some(approved => host === approved)) return 'deny'
  if (api || callback) return 'deny'
  // Fixed redirect only. Never forward callback, token, return URL or query data.
  if (page) return read && ['/platform', '/platform/sign-in', '/platform/sign-up', '/platform/preview'].includes(path) ? 'redirect' : 'deny'
  return 'allow'
}
