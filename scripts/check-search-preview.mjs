import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseURL = process.env.PREVIEW_URL || 'http://127.0.0.1:3000'
const origin = 'https://www.picshaw.com'
const services = JSON.parse(await readFile('content/services.json', 'utf8'))
const allArticles = JSON.parse(await readFile('content/articles.json', 'utf8'))
const articles = allArticles.filter(article => article.status === 'published' && Date.parse(article.publishedAt) <= Date.now())
const paths = ['/', '/about', '/blog', '/ai-visibility-audit', '/methodology', ...services.map(service => `/${service.slug}`), ...articles.map(article => `/blog/${article.slug}`)]
await mkdir('validation', { recursive: true })
const browser = await chromium.launch({ headless: true })
const report = []
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  await context.route('**/_vercel/**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }))
  const page = await context.newPage(), errors = [], titles = new Set()
  page.on('pageerror', error => errors.push(error.message))
  for (const path of paths) {
    const response = await page.goto(baseURL + path, { waitUntil: 'networkidle' })
    assert.equal(response.status(), 200, path)
    assert.equal(await page.locator('h1').count(), 1, path)
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
    assert.equal(new URL(canonical).href, new URL(origin + path).href, path)
    assert.ok(!(await page.locator('meta[name="robots"]').getAttribute('content') || '').includes('noindex'), path)
    assert.ok((await page.locator('meta[name="description"]').getAttribute('content')).length > 20)
    const title = await page.title(); assert.ok(!titles.has(title)); titles.add(title)
    const scripts = await page.locator('script[type="application/ld+json"]').allTextContents()
    assert.ok(scripts.length >= 1); scripts.forEach(script => JSON.parse(script))
    assert.ok(await page.locator('a[href="/#contact"]').count() > 0)
    assert.ok(await page.locator('a[href^="/ai-visibility-audit"]').count() > 0)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    assert.ok(overflow <= 1, `${path}: overflow ${overflow}`)
    // Check that same-site links point to real routes and existing anchors without sending enquiries.
    const links = await page.locator('a[href]').evaluateAll(elements => elements.map(element => element.getAttribute('href')).filter(href => href.startsWith('/')))
    for (const href of links) assert.ok(paths.includes(href.split('#')[0] || '/'), `Unknown internal destination ${href} on ${path}`)
    report.push({ path, status: response.status(), canonical, title, jsonLdBlocks: scripts.length, overflow })
    if (['/', '/ai-visibility-audit', '/methodology'].includes(path)) await page.screenshot({ path: `validation/reposition-${path === '/' ? 'home' : path.slice(1)}.png`, fullPage: true })
  }
  const robots = await page.request.get(baseURL + '/robots.txt')
  assert.equal(robots.status(), 200); assert.match(await robots.text(), /User-Agent: \*/i); assert.match(await robots.text(), /Sitemap: https:\/\/www\.picshaw\.com\/sitemap\.xml/i); assert.match(await robots.text(), /Disallow: \/api\//i)
  const sitemap = await page.request.get(baseURL + '/sitemap.xml'); assert.equal(sitemap.status(), 200)
  const xml = await sitemap.text(); const entries = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => new URL(match[1]).href)
  assert.equal(entries.length, paths.length)
  for (const path of paths) assert.ok(entries.includes(new URL(origin + path).href), path)
  for (const draft of allArticles.filter(article => article.status === 'draft')) { assert.ok(!xml.includes(draft.slug)); assert.equal((await page.request.get(baseURL + '/blog/' + draft.slug)).status(), 404) }
  assert.equal((await page.request.get(baseURL + '/this-page-does-not-exist')).status(), 404)
  assert.equal((await page.request.get(baseURL + '/blog/this-post-does-not-exist')).status(), 404)
  assert.equal((await page.request.post(baseURL + '/api/contact', { data: {} })).status(), 400)
  let intercepted = []
  await page.route('**/api/contact', route => { intercepted.push(route.request().postDataJSON()); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' }) })
  // Both the retained website offer and the new audit funnel must work. Never send a real email.
  for (const [path, type, button] of [['/', '1k', 'Get My Free Website Review'], ['/ai-visibility-audit', 'audit', 'Request my audit scope']]) {
    await page.goto(baseURL + path + '#contact', { waitUntil: 'networkidle' })
    await page.locator('#contact-website').fill('example.com'); await page.locator('#contact-email').fill('test@example.com')
    await page.locator(`input[name="service_interest"][value="${type}"]`).check()
    await page.locator('#contact').getByRole('button', { name: 'Continue', exact: true }).click()
    await page.locator('#contact-name').fill('Automated test only')
    await page.locator('#contact').getByRole('button', { name: button, exact: true }).click()
    await page.getByRole('heading', { name: 'Message sent!', exact: true }).waitFor()
    assert.equal(intercepted.at(-1).service_interest, type)
  }
  assert.equal(intercepted.length, 2)
  await page.unroute('**/api/contact')
  await page.route('**/api/contact', route => route.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"test failure"}' }))
  await page.goto(baseURL + '/ai-visibility-audit#contact', { waitUntil: 'networkidle' })
  await page.locator('#contact-website').fill('example.com'); await page.locator('#contact-email').fill('test@example.com')
  await page.getByRole('button', { name: 'Continue', exact: true }).click(); await page.getByRole('button', { name: 'Request my audit scope', exact: true }).click()
  await page.getByRole('alert').waitFor(); assert.equal(await page.getByRole('heading', { name: 'Message sent!', exact: true }).count(), 0)
  report.push({ enquiryUI: 'website and audit accepted; failed audit shows an error; all deliveries intercepted' })
  assert.deepEqual(errors, []); await context.close()
  for (const width of [1440, 1024, 390, 320]) {
    const mobile = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
    await mobile.route('**/_vercel/**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }))
    for (const path of ['/', '/ai-visibility-audit', '/methodology', '/blog']) {
      await mobile.goto(baseURL + path, { waitUntil: 'networkidle' })
      assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 1), `${path}: overflow ${width}`)
      if (path === '/') await mobile.screenshot({ path: `validation/reposition-header-${width}.png` })
    }
    if (width < 1024) { await mobile.getByRole('button', { name: 'Open menu', exact: true }).click(); await mobile.locator('#mobile-navigation').getByRole('link', { name: 'Our approach', exact: true }).click(); await mobile.waitForURL(baseURL + '/methodology'); await mobile.locator('#mobile-navigation').waitFor({ state: 'detached' }) }
    report.push({ viewportWidth: width, overflow: false, navigation: 'passed' }); await mobile.close()
  }
  const nojs = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 1440, height: 1000 } })
  await nojs.goto(baseURL, { waitUntil: 'networkidle' })
  assert.equal(await nojs.locator('#faq details').count(), 7); assert.equal(await nojs.locator('#faq details p').count(), 7)
  await nojs.locator('#faq details').last().locator('summary').click(); assert.ok(await nojs.locator('#faq details').last().locator('p').isVisible())
  assert.ok((await nojs.locator('h1').innerText()).includes('AI search.'))
  for (const path of ['/ai-visibility-audit', '/methodology', ...articles.map(article => '/blog/' + article.slug)]) {
    await nojs.goto(baseURL + path, { waitUntil: 'networkidle' }); const text = await nojs.locator('main').innerText(); assert.ok(text.length > 500)
    const article = articles.find(item => path === '/blog/' + item.slug)
    if (article) for (const section of article.sections) assert.ok(text.includes(section.paragraphs[0]), article.slug)
  }
  report.push({ noJavaScript: 'AEO hero, audit and methodology copy, seven FAQ answers and all existing article sections readable' }); await nojs.close()
  console.log(JSON.stringify(report, null, 2)); await writeFile('validation/search-browser-report.json', JSON.stringify(report, null, 2))
} finally { await browser.close() }
