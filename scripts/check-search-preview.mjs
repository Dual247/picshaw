import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseURL = process.env.PREVIEW_URL || 'http://127.0.0.1:3000'
const origin = 'https://www.picshaw.com'
const services = JSON.parse(await readFile('content/services.json', 'utf8'))
const allArticles = JSON.parse(await readFile('content/articles.json', 'utf8'))
const articles = allArticles.filter(article => article.status === 'published' && Date.parse(article.publishedAt) <= Date.now())
const paths = ['/', '/about', '/blog', ...services.map(service => `/${service.slug}`), ...articles.map(article => `/blog/${article.slug}`)]
await mkdir('validation', { recursive: true })
const browser = await chromium.launch({ headless: true })
const report = []
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  await context.route('**/_vercel/**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }))
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  for (const path of paths) {
    const response = await page.goto(baseURL + path, { waitUntil: 'networkidle' })
    assert.equal(response.status(), 200, path)
    assert.equal(await page.locator('h1').count(), 1, path)
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), origin + path, path)
    assert.ok((await page.locator('meta[name="description"]').getAttribute('content')).length > 20)
    const scripts = await page.locator('script[type="application/ld+json"]').allTextContents()
    assert.ok(scripts.length >= 1)
    scripts.forEach(script => JSON.parse(script))
    assert.ok(await page.locator('a[href="/#contact"]').count() > 0)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    assert.ok(overflow <= 1, `${path}: overflow ${overflow}`)
    report.push({ path, status: response.status(), canonical: origin + path, jsonLdBlocks: scripts.length, overflow })
    if (path !== '/') await page.screenshot({ path: `validation/search-${path.slice(1).replaceAll('/', '-')}.png`, fullPage: true })
  }
  const robots = await page.request.get(baseURL + '/robots.txt')
  assert.equal(robots.status(), 200)
  assert.match(await robots.text(), /User-Agent: \*/i)
  assert.match(await robots.text(), /Sitemap: https:\/\/www\.picshaw\.com\/sitemap\.xml/i)
  assert.match(await robots.text(), /Disallow: \/api\//i)
  const sitemap = await page.request.get(baseURL + '/sitemap.xml')
  assert.equal(sitemap.status(), 200)
  const xml = await sitemap.text()
  assert.equal((xml.match(/<loc>/g) || []).length, paths.length)
  for (const path of paths) assert.ok(xml.includes(`<loc>${origin}${path}</loc>`), path)
  for (const draft of allArticles.filter(article => article.status === 'draft')) {
    assert.ok(!xml.includes(draft.slug))
    assert.equal((await page.request.get(baseURL + '/blog/' + draft.slug)).status(), 404)
  }
  assert.equal((await page.request.get(baseURL + '/this-page-does-not-exist')).status(), 404)
  assert.equal((await page.request.get(baseURL + '/blog/this-post-does-not-exist')).status(), 404)
  const response = await page.request.get(baseURL + '/api/contact', { method: 'POST', data: {} })
  assert.equal(response.status(), 400)
  // UI test intercepts delivery. No real test email is sent.
  await page.route('**/api/contact', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' }))
  await page.goto(baseURL + '/#contact', { waitUntil: 'networkidle' })
  await page.locator('#contact-website').fill('example.com')
  await page.locator('#contact-email').fill('test@example.com')
  await page.locator('#contact').getByText('$1,000 Website Refresh', { exact: true }).click()
  await page.locator('#contact').getByRole('button', { name: 'Continue', exact: true }).click()
  await page.locator('#contact').getByRole('button', { name: 'Get My Free Website Review', exact: true }).click()
  await page.getByRole('heading', { name: 'Message sent!', exact: true }).waitFor()
  report.push({ contactUI: 'passed with intercepted request; no email sent' })
  assert.deepEqual(errors, [])
  await context.close()
  for (const width of [390, 320]) {
    const mobile = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
    await mobile.route('**/_vercel/**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }))
    for (const path of ['/blog', '/website-redesign', '/blog/contractor-website-checklist']) {
      await mobile.goto(baseURL + path, { waitUntil: 'networkidle' })
      assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 1), `${path}: mobile overflow ${width}`)
      await mobile.screenshot({ path: `validation/mobile-${width}-${path.slice(1).replaceAll('/', '-')}.png`, fullPage: true })
    }
    await mobile.getByRole('button', { name: 'Open menu', exact: true }).click()
    await mobile.locator('#mobile-navigation').getByRole('link', { name: 'Guides', exact: true }).click()
    await mobile.waitForURL(baseURL + '/blog')
    report.push({ mobileWidth: width, overflow: false, navigation: 'passed' })
    await mobile.close()
  }
  const nojs = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 1440, height: 1000 } })
  await nojs.goto(baseURL, { waitUntil: 'networkidle' })
  assert.equal(await nojs.locator('#faq details').count(), 7)
  assert.equal(await nojs.locator('#faq details p').count(), 7)
  await nojs.locator('#faq details').last().locator('summary').click()
  assert.ok(await nojs.locator('#faq details').last().locator('p').isVisible())
  assert.ok(await nojs.locator('h1').evaluate(element => Number(getComputedStyle(element).opacity) > 0.99))
  await nojs.locator('#faq').screenshot({ path: 'validation/faq-no-javascript.png' })
  for (const article of articles) {
    await nojs.goto(baseURL + '/blog/' + article.slug, { waitUntil: 'networkidle' })
    const text = await nojs.locator('main').innerText()
    for (const section of article.sections) assert.ok(text.includes(section.paragraphs[0]), article.slug)
  }
  report.push({ noJavaScript: 'all seven FAQ answers and all published article sections readable' })
  await nojs.close()
  console.log(JSON.stringify(report, null, 2))
  await writeFile('validation/search-browser-report.json', JSON.stringify(report, null, 2))
} finally { await browser.close() }
