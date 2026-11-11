import assert from 'node:assert/strict'
import http from 'node:http'
const port = Number(process.env.PORTAL_TEST_PORT || 4175)
function request(host, path, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, method, path,
      headers: { host, 'x-forwarded-host': 'app.picshaw.com', ...headers } }, res => {
      let body = ''; res.setEncoding('utf8'); res.on('data', chunk => { body += chunk })
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }))
    })
    req.on('error', reject); req.end()
  })
}
let checks = 0
for (const proto of ['http', 'https', 'javascript', 'https,http']) {
  const headers = { 'x-forwarded-host': 'hostile.example.com', 'x-forwarded-proto': proto }
  const page = await request('app.picshaw.com', '/platform/preview', 'GET', headers)
  assert.equal(page.status, 200, `canonical Host with forwarded proto ${proto}`)
  assert.doesNotMatch(page.body, /googletagmanager\.com|data-picshaw-chat/)
  const denied = await request('app.picshaw.com', '/blog', 'GET', headers)
  assert.equal(denied.status, 404); assert.equal(denied.body, 'Not found'); checks += 2
}
for (const host of ['app.picshaw.com', 'picshaw.com', 'www.picshaw.com', 'alias.vercel.app']) {
  const paths = host === 'app.picshaw.com'
    ? ['/blog', '/about', '/missing.js', '/platformish', '/api/contact', '/api/portal-access', '/%62log', '/platform/../blog', '/platform/%2e%2e/blog']
    : ['/api/platform/auth/session', '/platform/auth/callback?code=fixture']
  for (const path of paths) {
    const r = await request(host, path)
    assert.equal(r.status, 404, `${host}${path}`); assert.equal(r.body, 'Not found')
    assert.equal(r.headers['set-cookie'], undefined); assert.equal(r.headers['access-control-allow-origin'], undefined)
    assert.equal(r.headers['x-frame-options'], 'DENY'); checks++
  }
}
for (const [host, path] of [['app.picshaw.com', '/?code=fixture'], ['picshaw.com', '/platform/sign-in?code=fixture']]) {
  const r = await request(host, path)
  assert.equal(r.status, 303); assert.equal(r.headers.location, 'https://app.picshaw.com/platform'); checks++
}
for (const path of ['/platform/preview', '/platform/sign-in', '/platform/missing.js']) {
  const r = await request('app.picshaw.com', path)
  assert.ok([200, 404].includes(r.status)); assert.match(r.headers['content-security-policy'], /frame-ancestors 'none'/)
  assert.doesNotMatch(r.body, /googletagmanager\.com|chat-widget|vercel\/analytics/); checks++
  if (path === '/platform/preview') {
    const assets = [...new Set([...r.body.matchAll(/(?:src|href)="(\/_next\/static\/[^"?]+)[^"]*"/g)].map(match => match[1]))]
    assert.ok(assets.length > 0)
    for (const asset of assets) {
      assert.equal((await request('app.picshaw.com', asset)).status, 200, asset); checks++
    }
  }
}
const local = await request(`localhost:${port}`, '/platform/preview')
assert.equal(local.status, 200); checks++
const capability = await request('picshaw.com', '/api/portal-access')
assert.equal(capability.status, 200); assert.equal(JSON.parse(capability.body).ready, false); checks++
const marketing = await request('picshaw.com', '/')
assert.equal(marketing.status, 200)
assert.doesNotMatch(marketing.body, /href="(?:https:\/\/app\.picshaw\.com|\/platform)(?:\/|"|\?)/)
assert.match(marketing.body, /Portal coming soon/)
assert.match(marketing.body, /Account creation and login are not enabled yet/); checks++
console.log(`PASS ${checks} production-server HTTP boundary checks on port ${port}`)
