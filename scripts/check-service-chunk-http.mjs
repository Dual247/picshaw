import assert from 'node:assert/strict'
import http from 'node:http'
const port = Number(process.env.PORTAL_TEST_PORT || 4175)
function request(host, path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers: { host } }, res => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', chunk => { body += chunk })
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body }))
    })
    req.on('error', reject); req.end()
  })
}
let count = 0
for (const path of ['/website-redesign', '/ai-search-optimization', '/local-seo', '/web-design-for-contractors', '/blog/chatgpt-search-visibility']) {
  const page = await request('picshaw.com', path)
  assert.equal(page.status, 200, path)
  assert.match(page.body, /rel="canonical"/)
  const assets = [...new Set([...page.body.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g)].map(match => match[1]))]
  const dynamic = assets.filter(asset => /%5b|\[/i.test(asset))
  assert.ok(dynamic.length > 0, 'Dynamic route must exercise a bracket-named chunk: ' + path)
  for (const asset of assets) {
    const result = await request('picshaw.com', asset)
    assert.equal(result.status, 200, asset)
    assert.match(result.type, /javascript/)
    count++
  }
  for (const asset of dynamic) {
    const encoded = asset.replaceAll('[', '%5B').replaceAll(']', '%5D')
    for (const host of ['picshaw.com', 'app.picshaw.com', 'localhost:' + port]) {
      const result = await request(host, encoded)
      assert.equal(result.status, 200, host + encoded)
      assert.match(result.type, /javascript/)
      assert.equal((await request(host, encoded, 'HEAD')).status, 200)
      count += 2
    }
    const denied = await request('evil.test', encoded)
    assert.equal(denied.status, 404)
    assert.equal(denied.body, 'Not found')
    assert.equal((await request('app.picshaw.com', encoded, 'POST')).status, 404)
    count += 2
  }
}
console.log('PASS ' + count + ' service/blog dynamic JS chunk HTTP checks; unknown host and non-read access remain denied')

