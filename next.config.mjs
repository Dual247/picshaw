/** @type {import('next').NextConfig} */
const nextConfig = {
  // Public navigation metadata only, derived from the server deployment type.
  // Never infer preview privileges from a hostname or use this for auth.
  env: { NEXT_PUBLIC_PICSHAW_PREVIEW_NAVIGATION: process.env.VERCEL_ENV === 'preview' ? 'true' : 'false' },
  skipProxyUrlNormalize: true,
  skipTrailingSlashRedirect: true,
  // Fail builds on type errors; CI also runs an independent full type check.
  typescript: { ignoreBuildErrors: false },
  images: { unoptimized: true },
  async headers() {
    const privateHeaders = [
      { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
      { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
    ]
    // Indexing/cache hints are not authentication. Future handlers still need
    // server-side session and workspace authorization on every request.
    return [
      ...(process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production'
        ? [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }]
        : []),
      { source: '/platform/:path*', headers: privateHeaders },
      { source: '/api/platform/:path*', headers: privateHeaders },
    ]
  },
}
export default nextConfig
