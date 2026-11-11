import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { NextRequest, NextResponse } from 'next/server.js'
function load(file, deps = {}, env = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, module: { exports }, process: { env }, require: name => deps[name] })
  return exports
}
const boundary = load('lib/portal-origin.ts')
const { portalBoundary: decide } = boundary
let checks = 0
for (const host of ['preview.vercel.app', 'picshaw.com', 'app.picshaw.com', 'arbitrary.example']) {
  assert.equal(boundary.portalNavigationOrigin(host, false), 'https://app.picshaw.com')
  assert.equal(boundary.portalNavigationOrigin(host, true), '')
  checks += 2
}
assert.equal(boundary.portalNavigationOrigin('localhost', false), '')
assert.equal(boundary.portalNavigationOrigin('', true), '', 'preview SSR must also render relative links')
checks += 2
// Build metadata must be derived solely from server VERCEL_ENV, never a hostname
// or an independently supplied public flag. No build or network is needed here.
for (const deployment of ['preview', 'production', 'development', undefined]) {
  const env = { VERCEL_ENV: deployment, NEXT_PUBLIC_PICSHAW_PREVIEW_NAVIGATION: 'true' }
  const source = readFileSync('next.config.mjs', 'utf8').replace('export default nextConfig', 'globalThis.result = nextConfig')
  const context = { process: { env } }; vm.runInNewContext(source, context)
  assert.equal(context.result.env.NEXT_PUBLIC_PICSHAW_PREVIEW_NAVIGATION, deployment === 'preview' ? 'true' : 'false')
  const hook = load('hooks/use-portal-access.ts', {
    react: { useSyncExternalStore: (_subscribe, _readBrowser, readServer) => readServer() },
    '@/lib/portal-origin': boundary,
  }, context.result.env)
  assert.equal(hook.usePortalOrigin(), deployment === 'preview' ? '' : 'https://app.picshaw.com')
  checks++
}
function check(host, path, method, expected, preview = false) {
  assert.equal(decide(host, path, method, preview), expected, `${host} ${method} ${path}`); checks++
}
for (const method of ['GET', 'HEAD', 'POST', 'OPTIONS']) {
  for (const path of ['/platform', '/platform/preview', '/platform/sign-in', '/platform/auth/callback', '/api/platform/auth/sign-in']) {
    check('app.picshaw.com', path, method, 'allow')
  }
  for (const path of ['/blog', '/blog/x.js', '/about', '/api/contact', '/api/portal-access', '/platform-other', '/platform.js', '/_next/data/build/blog.json', '/_next/image', '/not-found.svg']) {
    check('app.picshaw.com', path, method, 'deny')
  }
  for (const host of ['picshaw.com', 'www.picshaw.com', 'evil.test', 'app.picshaw.com.evil.test', 'app.picshaw.com.', 'app.picshaw.com:443', 'APP.PICSHAW.COM', 'alias.vercel.app']) {
    check(host, '/api/platform/auth/sign-in', method, 'deny')
    check(host, '/platform/auth/callback', method, 'deny')
  }
}
for (const path of ['/%70latform', '/platform%2fauth/callback', '/platform/%2e%2e/blog', '/platform/../blog', '/platform/./x', '/platform//x', '/platform\\x', '/%252fblog']) {
  for (const host of ['app.picshaw.com', 'picshaw.com', 'localhost:4174']) check(host, path, 'GET', 'deny')
}
for (const host of ['localhost:4174', '127.0.0.1:4174', '[::1]:4174', 'preview.vercel.app']) {
  check(host, '/platform/preview', 'GET', 'allow', true)
  check(host, '/api/platform/auth/session', 'POST', 'deny', true)
  check(host, '/platform/auth/callback', 'GET', 'deny', true)
}
for (const path of ['/_next/static/chunks/app.js', '/icon.svg', '/brand/picshaw-mark.svg']) {
  check('app.picshaw.com', path, 'GET', 'allow'); check('app.picshaw.com', path, 'POST', 'deny')
}

const dynamicChunk = '/_next/static/chunks/app/(marketing)/%5Bservice%5D/page-123.js'
for (const host of ['picshaw.com', 'www.picshaw.com', 'app.picshaw.com', 'localhost:4174', 'preview.vercel.app']) {
  for (const method of ['GET', 'HEAD']) {
    check(host, dynamicChunk, method, 'allow', true)
    check(host, dynamicChunk.replace('%5B', '%5b').replace('%5D', '%5d'), method, 'allow', true)
  }
  for (const method of ['POST', 'OPTIONS']) check(host, dynamicChunk, method, 'deny', true)
  for (const path of [
    '/platform/%5Bservice%5D', '/api/platform/%5Bservice%5D',
    '/_next/static/chunks/%5Bservice%5D/page.js%2f',
    '/_next/static/chunks/%5Bservice%5D%2fpage.js',
    '/_next/static/chunks/%5Bservice%5D/%2e%2e/page.js',
    '/_next/static/chunks/%5Bservice%5D/../page.js',
    '/_next/static/chunks/%255Bservice%255D/page.js',
    '/_next/static/chunks/%5Bservice%5D/%00page.js',
    '/_next/static/chunks/%5Bservice%5D/%5cpage.js',
    '/_next/static/chunks/%5Bservice%5D//page.js',
    '/_next/static/chunks/%5Bservice%5D/page.css',
    '/_next/static%2fchunks/%5Bservice%5D/page.js',
  ]) check(host, path, 'GET', 'deny', true)
}
for (const host of ['evil.test', 'app.picshaw.com.evil.test', 'app.picshaw.com.', 'app.picshaw.com:443', 'APP.PICSHAW.COM', 'alias.vercel.app']) {
  check(host, dynamicChunk, 'GET', 'deny')
}

const { proxy } = load('proxy.ts', { './lib/portal-origin': boundary, 'next/server': { NextRequest, NextResponse } })
for (const [host, path, expected] of [
  ['app.picshaw.com', '/', 303], ['picshaw.com', '/platform/sign-in?code=secret&next=https://evil.test', 303],
  ['app.picshaw.com', '/blog/nonexistent.js', 404], ['evil.test', '/platform', 404],
  ['picshaw.com', '/platform/auth/callback?code=secret', 404],
]) {
  const r = proxy(new NextRequest(`https://${host}${path}`, { headers: { host, 'x-forwarded-host': 'app.picshaw.com' } }))
  assert.equal(r.status, expected)
  assert.equal(r.headers.get('x-frame-options'), 'DENY')
  assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/)
  assert.equal(r.headers.get('access-control-allow-origin'), null)
  assert.equal(r.headers.get('set-cookie'), null)
  if (expected === 303) assert.equal(r.headers.get('location'), 'https://app.picshaw.com/platform')
  else assert.equal(await r.text(), 'Not found')
  checks++
}
console.log(`PASS ${checks} host/path/method, forwarding, encoding, preview, redirect and response boundary checks`)
