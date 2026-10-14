import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { once } from 'node:events'
import { chromium } from 'playwright'

await mkdir('validation', { recursive: true })
const local = JSON.parse(await readFile('content/articles.json', 'utf8'))
const originals = local.filter(a => a.status === 'published' && Date.parse(a.publishedAt) <= Date.now())
const titles = JSON.parse(await readFile('content/seo-titles.json', 'utf8'))
const key = randomBytes(24).toString('hex'), secret = randomBytes(32).toString('hex')
let stage = 0, indexRequests = 0, detailRequests = 0
const published = new Date(Date.now() - 86400000).toISOString()
const sample = {
  id: 7001, slug: 'integration-test-service-business-guide', title: 'Integration test: a service business guide',
  published: true, published_at: published, updated_at: published, languageCode: 'en-US', orgWebsite: 'https://www.picshaw.com',
  meta_description: 'Integration test content only. This article is not a real Picshaw publication.',
  excerpt: 'Preview fixture for validating the publishing connection. Not live content.',
  hero_image_url: 'https://example.com/no-description.jpg',
  content_html: '<h1 id="sample">An imported heading</h1><p>Full article content rendered on the server, not just an excerpt.</p><h2>Useful next steps</h2>' +
    '<p>This is clearly labelled test content for the integration, not a client result.</p><ul><li>Check access</li><li>Review service pages</li></ul>' +
    '<img src="/brand/picshaw-mark.svg" alt="Picshaw letter P logo" width="80" height="80">' +
    '<img src="https://example.com/without-alt.jpg"><a href="javascript:alert(1)">Unsafe link removed</a>' +
    '<script>window.BLG_XSS=true</script><iframe src="https://example.com"></iframe><p onmouseover="alert(1)">Safe text remains.</p>',
  jsonLd: { '@type': 'Review', author: { name: 'Fabricated authority' }, reviewRating: { ratingValue: 5 } },
  faqJsonLd: { '@type': 'FAQPage', mainEntity: [] },
}
function records() {
  if (stage === 0) return []
  return [sample, { ...sample, id: 7002, slug: originals[0].slug, title: 'Do not overwrite the local article' },
    { ...sample, id: 7003, slug: 'hidden-remote-draft', published: false },
    { ...sample, id: 7004, slug: 'future-remote-article', published_at: '2099-01-01T00:00:00Z' },
    { ...sample, id: 7005, slug: local.find(a => a.status === 'draft').slug },
    { ...sample, id: 7006, slug: 'wrong-website-article', orgWebsite: 'https://unrelated.example' },
    ...(stage >= 2 ? [{ ...sample, id: 7007, slug: 'published-after-the-build', title: 'Published after the same production build' }] : [])]
}
const api = createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  if (req.headers['x-api-key'] !== key) { res.writeHead(401); res.end('{}'); return }
  if (stage === 3) { res.writeHead(503); res.end(JSON.stringify({ error: key })); return }
  const url = new URL(req.url, 'http://localhost')
  if (url.pathname === '/api/integrations/v1/articles') {
    indexRequests++; const offset = Number(url.searchParams.get('offset') || 0)
    res.end(JSON.stringify(records().slice(offset, offset + 50))); return
  }
  if (url.pathname.startsWith('/api/integrations/v1/articles/by-slug/')) {
    detailRequests++; const slug = decodeURIComponent(url.pathname.split('/').at(-1))
    const article = records().find(a => a.slug === slug)
    res.writeHead(article ? 200 : 404); res.end(JSON.stringify(article || {})); return
  }
  res.writeHead(404); res.end('{}')
})
api.listen(0, '127.0.0.1'); await once(api, 'listening')
const env = { ...process.env, CI: 'true', BABYLOVEGROWTH_TEST_MODE: 'true', BABYLOVEGROWTH_BLOG_API_KEY: key,
  BABYLOVEGROWTH_BLOG_API_URL: `http://127.0.0.1:${api.address().port}/api/integrations/v1`,
  BABYLOVEGROWTH_REVALIDATE_SECRET: secret, VERCEL_ENV: 'production', NEXT_PUBLIC_VERCEL_ENV: 'production',
  NEXT_PUBLIC_ANALYTICS_EVENTS: 'false', RESEND_API_KEY: 're_build_validation_only', NEXT_TELEMETRY_DISABLED: '1' }
delete env.VERCEL
const scrub = text => text.replaceAll(key, '[redacted]').replaceAll(secret, '[redacted]')
let app, browser, buildLog = '', serverLog = ''
const report = { testedCommit: process.env.TESTED_COMMIT || '', tests: [], indexRequests: 0, detailRequests: 0 }
const baseURL = 'http://127.0.0.1:3101'
try {
  const build = spawn('npm', ['run', 'build', '--', '--webpack'], { env })
  build.stdout.on('data', chunk => { buildLog += chunk }); build.stderr.on('data', chunk => { buildLog += chunk })
  assert.equal((await once(build, 'exit'))[0], 0, 'Production build must pass')
  await writeFile('validation/babylovegrowth-build.log', scrub(buildLog))
  app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3101'], { env })
  app.stdout.on('data', chunk => { serverLog += chunk }); app.stderr.on('data', chunk => { serverLog += chunk })
  let ready = false
  for (let i = 0; i < 60; i++) { try { ready = (await fetch(baseURL)).ok } catch {} if (ready) break; await new Promise(r => setTimeout(r, 500)) }
  assert.ok(ready, 'Production server started')
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const refresh = () => fetch(`${baseURL}/api/blog/revalidate`, { method: 'POST', headers: { Authorization: `Bearer ${secret}` } })
  assert.equal((await fetch(`${baseURL}/api/blog/revalidate`, { method: 'POST' })).status, 401)
  assert.equal((await fetch(`${baseURL}/api/blog/revalidate`)).status, 405)
  await page.goto(`${baseURL}/blog`, { waitUntil: 'domcontentloaded' })
  assert.ok(!(await page.content()).includes(sample.slug), 'No remote article at build time')
  stage = 1
  assert.equal((await refresh()).status, 200)
  const before = indexRequests
  await page.goto(`${baseURL}/blog`, { waitUntil: 'networkidle' })
  const links = await page.locator('main a[href^="/blog/"]').evaluateAll(items => items.map(a => a.getAttribute('href')))
  assert.ok(links.includes(`/blog/${sample.slug}`))
  assert.equal(await page.locator('main article').count(), originals.length + 1)
  const blogHTML = await page.content()
  for (const denied of ['hidden-remote-draft', 'future-remote-article', 'wrong-website-article']) assert.ok(!blogHTML.includes(denied))
  await page.screenshot({ path: 'validation/babylovegrowth-blog-preview.png', fullPage: true })
  for (const [route, expected] of Object.entries(titles)) {
    assert.equal((await page.goto(baseURL + route, { waitUntil: 'domcontentloaded' })).status(), 200)
    assert.equal(await page.title(), expected, 'Existing SEO override preserved')
  }
  assert.equal((await page.goto(`${baseURL}/blog/${sample.slug}`, { waitUntil: 'networkidle' })).status(), 200)
  assert.equal(await page.locator('h1').count(), 1)
  const imported = page.locator('[data-imported-article]')
  assert.ok((await imported.innerText()).includes('Full article content rendered on the server'))
  assert.equal(await imported.locator('script,iframe,style,form,svg,[onmouseover]').count(), 0)
  assert.equal(await imported.locator('img').count(), 1)
  assert.equal(await imported.locator('img').getAttribute('alt'), 'Picshaw letter P logo')
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://www.picshaw.com/blog/${sample.slug}`)
  assert.equal(await page.locator('meta[name="description"]').getAttribute('content'), sample.meta_description)
  assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'), await page.title())
  const schemas = (await page.locator('script[type="application/ld+json"]').allTextContents()).map(text => JSON.parse(text))
  const schema = schemas.find(value => value['@type'] === 'BlogPosting')
  assert.equal(schema.datePublished, published); assert.equal(schema.author, undefined)
  assert.ok(!schemas.some(value => value['@type'] === 'Review' || value['@type'] === 'FAQPage'))
  const html = await page.content(); assert.ok(!html.includes(key)); assert.ok(!html.includes(secret)); assert.ok(!html.includes('Fabricated authority'))
  await page.screenshot({ path: 'validation/babylovegrowth-article-preview.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.screenshot({ path: 'validation/babylovegrowth-article-mobile.png', fullPage: true })
  const xml = await (await fetch(`${baseURL}/sitemap.xml`)).text()
  assert.ok(xml.includes(`/blog/${sample.slug}`)); assert.equal((xml.match(new RegExp(`/blog/${originals[0].slug}<`, 'g')) || []).length, 1)
  for (const denied of ['hidden-remote-draft', 'future-remote-article', 'wrong-website-article']) {
    assert.ok(!xml.includes(denied)); assert.equal((await page.request.get(`${baseURL}/blog/${denied}`)).status(), 404)
  }
  assert.ok(indexRequests - before <= 2, 'Index is shared across pages instead of refetched per view')
  report.tests.push('Existing pages and SEO overrides preserved; published article SSR; four exclusion cases; safe HTML; metadata/schema; sitemap; desktop/mobile; shared data cache')
  stage = 2
  assert.equal((await refresh()).status, 200)
  assert.equal((await page.goto(`${baseURL}/blog/published-after-the-build`, { waitUntil: 'domcontentloaded' })).status(), 200)
  await page.goto(`${baseURL}/blog`, { waitUntil: 'domcontentloaded' })
  assert.ok((await page.content()).includes('published-after-the-build'))
  assert.ok((await (await fetch(`${baseURL}/sitemap.xml`)).text()).includes('published-after-the-build'))
  report.tests.push('A second article became available after the same build, through cache invalidation only')
  stage = 3
  assert.equal((await refresh()).status, 200)
  assert.equal((await page.goto(`${baseURL}/blog/${originals[0].slug}`, { waitUntil: 'domcontentloaded' })).status(), 200)
  assert.equal(await page.locator('h1').innerText(), originals[0].title)
  assert.equal((await page.goto(`${baseURL}/blog`, { waitUntil: 'domcontentloaded' })).status(), 200)
  assert.equal(await page.locator('main article').count(), originals.length)
  report.tests.push('Service failure preserves the local blog and articles; unauthorized refresh requests rejected')
  async function inspectChunks(folder) {
    for (const item of await readdir(folder, { withFileTypes: true })) {
      const target = `${folder}/${item.name}`
      if (item.isDirectory()) await inspectChunks(target)
      else if (item.name.endsWith('.js')) { const source = await readFile(target, 'utf8'); assert.ok(!source.includes(key) && !source.includes(secret), 'No credential in browser JavaScript') }
    }
  }
  await inspectChunks('.next/static')
  assert.ok(!serverLog.includes(key) && !buildLog.includes(key), 'Upstream errors must not expose credentials in logs')
  report.tests.push('No credential in browser HTML, client JavaScript or server/build logs')
  await context.close()
} finally {
  await browser?.close(); app?.kill('SIGTERM'); api.close()
  report.indexRequests = indexRequests; report.detailRequests = detailRequests
  await writeFile('validation/babylovegrowth-integration.json', JSON.stringify(report, null, 2))
  await writeFile('validation/babylovegrowth-build.log', scrub(buildLog))
  await writeFile('validation/babylovegrowth-server.log', scrub(serverLog))
  console.log(JSON.stringify(report, null, 2))
}
