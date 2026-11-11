import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import config from '../next.config.mjs'

const read = path => readFileSync(path, 'utf8')
const sources = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const path = join(dir, entry.name)
  return entry.isDirectory() ? sources(path) : /\.(tsx?|jsx?)$/.test(path) ? [path] : []
})
assert.equal(existsSync('app/layout.tsx'), false, 'A shared root would retain marketing scripts')
const marketing = read('app/(marketing)/layout.tsx')
const workspace = read('app/(workspace)/layout.tsx')
assert.match(marketing, /<html/)
assert.match(workspace, /<html/)
assert.match(marketing, /<SiteAnalytics/)
assert.match(marketing, /<ChatWidget/)
for (const path of [...sources('app/(workspace)'), ...(existsSync('components/platform') ? sources('components/platform') : [])]) {
  assert.doesNotMatch(read(path), /SiteAnalytics|ChatWidget|next\/script|next\/font\/google|googletagmanager\.com|@vercel\/analytics/, `${path} imports marketing telemetry`)
}
assert.match(workspace, /index: false/)
assert.match(workspace, /referrer: 'no-referrer'/)
const page = read('app/(workspace)/platform/page.tsx')
assert.match(page, /dynamic = 'force-dynamic'/)
assert.match(page, /revalidate = 0/)
const fallback = read('app/(workspace)/platform/[...path]/page.tsx')
assert.match(fallback, /notFound\(\)/)
assert.doesNotMatch(fallback, /params|searchParams/)
const missing = read('app/(workspace)/platform/not-found.tsx')
assert.doesNotMatch(missing, /SiteAnalytics|ChatWidget|params|searchParams/)
const apiFallback = read('app/api/platform/[[...path]]/route.ts')
assert.match(apiFallback, /status: 404/)
assert.match(apiFallback, /no-store/)
assert.match(apiFallback, /no-referrer/)
assert.match(apiFallback, /noindex/)
assert.doesNotMatch(apiFallback, /request\.url|params|searchParams/)
for (const method of ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
  assert.ok(apiFallback.includes(`export const ${method} = unavailable`))
}
assert.match(read('app/robots.ts'), /'\/platform'/)
const rules = await config.headers()
for (const source of ['/platform/:path*', '/api/platform/:path*']) {
  const headers = rules.find(rule => rule.source === source)?.headers
  assert.ok(headers, source)
  const value = key => headers.find(header => header.key === key)?.value
  assert.match(value('X-Robots-Tag'), /noindex/)
  assert.match(value('Cache-Control'), /no-store/)
  assert.equal(value('Referrer-Policy'), 'no-referrer')
}
console.log('Platform structural privacy boundary checks passed (not an auth or browser test)')
