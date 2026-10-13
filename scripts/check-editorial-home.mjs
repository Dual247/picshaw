import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseURL = process.env.PREVIEW_URL || 'http://127.0.0.1:3000'
await mkdir('validation', { recursive: true })
const browser = await chromium.launch({ headless: true })
const report = []
try {
  for (const width of [1440, 1024, 768, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/_vercel/**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }))
    await page.goto(baseURL, { waitUntil: 'networkidle' })
    assert.equal(await page.locator('h1').count(), 1)
    assert.match(await page.locator('h1').innerText(), /Be found\./)
    assert.equal(await page.locator('#work article').count(), 3)
    assert.equal(await page.locator('#faq details').count(), 4)
    const ids = await page.locator('[id]').evaluateAll(elements => elements.map(element => element.id))
    assert.equal(ids.length, new Set(ids).size, 'IDs must be unique')
    for (const id of ['example', 'services', 'work', 'process', 'faq', 'contact']) assert.ok(ids.includes(id), id)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    assert.ok(overflow <= 1, `Horizontal overflow at ${width}px: ${overflow}`)
    const headingFits = await page.locator('h1').evaluate(el => el.scrollWidth <= el.clientWidth + 1)
    assert.ok(headingFits, `Hero heading clipped at ${width}px`)
    await page.screenshot({ path: `validation/editorial-hero-${width}.png` })
    // Activate lazy images before taking a full-page capture.
    for (const article of await page.locator('#work article').all()) { await article.scrollIntoViewIfNeeded(); await page.waitForTimeout(400) }
    await page.locator('#contact').scrollIntoViewIfNeeded()
    await page.evaluate(() => scrollTo(0, 0))
    await page.screenshot({ path: `validation/editorial-full-${width}.png`, fullPage: true })
    await page.locator('#faq details').first().locator('summary').focus()
    await page.keyboard.press('Enter')
    assert.ok(await page.locator('#faq details').first().locator('p').isVisible(), 'Keyboard-operable FAQ')
    assert.deepEqual(errors, [])
    report.push({ width, overflow, headingFits, faqKeyboard: true, errors })
    await page.close()
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const deliveries = []
  // The browser never contacts a real email provider in these tests.
  await page.route('**/api/contact', route => { deliveries.push(route.request().postDataJSON()); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' }) })
  await page.goto(baseURL + '/#contact', { waitUntil: 'networkidle' })
  for (const service of ['audit', 'aeo', '1k', '2.5k', 'monthly', 'unsure']) {
    await page.locator('#home-name').fill('Automated test only')
    await page.locator('#home-email').fill('test@example.com')
    await page.locator('#home-website').fill('example.com')
    await page.locator('#home-service').selectOption(service)
    await page.getByRole('button', { name: 'Send enquiry', exact: true }).click()
    await page.getByRole('heading', { name: "You're on our radar.", exact: true }).waitFor()
    assert.equal(deliveries.at(-1).service_interest, service)
    await page.getByRole('button', { name: 'Send another enquiry', exact: true }).click()
    assert.equal(await page.locator('#home-email').inputValue(), '')
  }
  await page.unroute('**/api/contact')
  await page.route('**/api/contact', route => route.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"test failure"}' }))
  await page.locator('#home-email').fill('test@example.com'); await page.locator('#home-website').fill('example.com')
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click()
  await page.getByRole('alert').waitFor()
  assert.equal(await page.getByRole('heading', { name: "You're on our radar.", exact: true }).count(), 0)
  assert.equal(await page.locator('#home-email').inputValue(), 'test@example.com', 'Preserve input after failure')
  report.push({ forms: 'All six service options, success/reset and failure validated with intercepted delivery only' })
  await page.close()
  const nojs = await browser.newPage({ javaScriptEnabled: false })
  await nojs.goto(baseURL, { waitUntil: 'networkidle' })
  assert.match(await nojs.locator('h1').innerText(), /AI search\./)
  const faq = JSON.parse((await nojs.locator('script[type="application/ld+json"]').allTextContents()).find(text => JSON.parse(text)['@type'] === 'FAQPage'))
  for (const [index, item] of faq.mainEntity.entries()) {
    const detail = nojs.locator('#faq details').nth(index)
    assert.equal((await detail.locator('summary').innerText()).trim(), item.name)
    assert.equal((await detail.locator('p').textContent()).trim(), item.acceptedAnswer.text)
    await detail.locator('summary').click(); assert.ok(await detail.locator('p').isVisible())
  }
  assert.equal(faq.mainEntity.length, 4)
  report.push({ noJavaScript: 'Hero and four native FAQ answers readable; FAQ schema matches visible content' })
  await nojs.close()
  console.log(JSON.stringify(report, null, 2))
  await writeFile('validation/editorial-report.json', JSON.stringify(report, null, 2))
} finally { await browser.close() }
