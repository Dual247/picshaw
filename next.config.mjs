/** @type {import('next').NextConfig} */
const nextConfig = {
  // Preserve existing settings; CI also runs an independent full type check.
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  async headers() {
    if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
      return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }]
    }
    return []
  },
}
export default nextConfig
