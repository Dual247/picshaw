import assert from 'node:assert/strict'
const base = new URL(process.env.PREVIEW_URL || 'http://127.0.0.1:3000')
assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname), 'Run against a local test server only')
const privatePages = ['/platform', '/platform/preview', '/platform/onboarding', '/platform/sign-in', '/platform/sign-up', '/platform/forgot-password', '/platform/reset-password', '/platform/account']
function privacy(response) {
  assert.ok(response.headers.get('cache-control')?.includes('no-store'))
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
  assert.ok(response.headers.get('x-robots-tag')?.includes('noindex'))
}
for (const path of [...privatePages, '/platform/missing/example', '/api/platform', '/api/platform/missing/example']) {
  const response = await fetch(new URL(path, base), { redirect: 'error' })
  const body = await response.text()
  assert.equal(response.status, privatePages.includes(path) ? 200 : 404, path)
  privacy(response)
  assert.ok(!body.includes('data-picshaw-chat'))
  assert.ok(!body.includes('googletagmanager.com'))
  assert.ok(!body.includes('/_vercel/insights'))
  if (path.startsWith('/api/')) assert.equal(body, 'Not found')
}
// Intentionally invalid payloads: these checks must be run with auth unconfigured.
// No personal data or valid credentials are submitted, and no live SDK call is expected.
for (const action of ['google', 'apple', 'sign-in', 'sign-up', 'recover', 'reset-password', 'session', 'sign-out', 'sign-out-all']) {
  const response = await fetch(new URL(`/api/platform/auth/${action}`, base), {
    method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json', Origin: base.origin }, body: '{}',
  })
  assert.equal(response.status, 404, `${action}: local auth must be rejected at the host boundary`)
  privacy(response)
  assert.equal(await response.text(), 'Not found')
}
const callback = await fetch(new URL('/platform/auth/callback?code=synthetic-invalid-code', base), { redirect: 'error' })
assert.equal(callback.status, 404)
privacy(callback)
const sitemap = await (await fetch(new URL('/sitemap.xml', base))).text()
assert.ok(!sitemap.includes('/platform'))
console.log('PASS 8 private pages, unknown routes, 9 disabled auth actions and callback; no-store/noindex/no-referrer; no marketing scripts; sitemap exclusion')

