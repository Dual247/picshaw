import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:3000'
const path = '/ai-receptionist'
const report = []
await mkdir('validation', { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  await context.route('**/_vercel/**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }))
  // Catch every contact request before exercising UI. Never send an actual email.
  const requests = []
  let mode = 'success'
  await context.route('**/api/contact', async route => {
    requests.push(route.request().postDataJSON())
    await new Promise(resolve => setTimeout(resolve, 100))
    if (mode === 'network') return route.abort('failed')
    if (mode === 'malformed') return route.fulfill({ status: 200, contentType: 'text/plain', body: 'not-json' })
    if (mode === 'error') return route.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"mock-only"}' })
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' })
  })
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  const response = await page.goto(base + path, { waitUntil: 'networkidle' })
  assert.equal(response.status(), 200)
  assert.equal(await page.locator('h1').count(), 1)
  assert.ok((await page.title()).includes('AI Receptionist'))
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://www.picshaw.com/ai-receptionist')
  assert.equal(await page.locator('audio, iframe').count(), 0, 'No pretend live voice widget')
  assert.ok((await page.locator('figure').innerText()).includes('Example only'))
  assert.ok((await page.locator('figure').innerText()).includes('not a real customer call'))
  assert.ok((await page.locator('#pricing').innerText()).includes('$399'))
  assert.ok((await page.locator('#pricing').innerText()).includes('$500'))
  assert.ok((await page.locator('#pricing').innerText()).includes('500 minutes / month'))
  assert.ok((await page.locator('#pricing').innerText()).includes('$0.50 / minute'))
  const graphs = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap(text => { const data = JSON.parse(text); return data['@graph'] || [data] })
  const faq = graphs.find(item => item['@type'] === 'FAQPage')
  assert.ok(graphs.some(item => item['@type'] === 'Service'))
  assert.ok(graphs.some(item => item['@type'] === 'BreadcrumbList'))
  assert.equal(faq.mainEntity.length, 8)
  const details = page.locator('#faq details')
  assert.equal(await details.count(), 8)
  for (let index = 0; index < 8; index++) {
    assert.equal((await details.nth(index).locator('summary').innerText()).trim(), faq.mainEntity[index].name)
    assert.equal(await details.nth(index).locator('p').textContent(), faq.mainEntity[index].acceptedAnswer.text)
  }
  await details.last().locator('summary').click()
  assert.ok(await details.last().locator('p').isVisible())
  // All page-local links resolve to real section IDs.
  for (const href of await page.locator('main a[href^="#"]').evaluateAll(links => links.map(link => link.getAttribute('href')))) assert.equal(await page.locator(href).count(), 1)
  assert.equal(await page.locator('header a[href="/ai-receptionist#enquiry"]').count(), 1)
  await page.locator('#receptionist-name').fill('Automated receptionist test')
  await page.locator('#receptionist-business').fill('Example plumbing')
  await page.locator('#receptionist-email').fill('test@example.com')
  await page.locator('#receptionist-phone').fill('555-0100')
  await page.locator('#receptionist-coverage').selectOption('Both')
  await page.locator('#receptionist-message').fill('Mock only. Routine quote enquiries.')
  // Two immediate submissions must still produce only one request.
  await page.locator('form[data-enquiry-type="receptionist"]').evaluate(form => { form.requestSubmit(); form.requestSubmit() })
  await page.getByRole('heading', { name: 'Demo enquiry sent.', exact: true }).waitFor()
  assert.equal(requests.length, 1)
  assert.equal(requests[0].service_interest, 'receptionist')
  assert.equal(requests[0].website, '')
  assert.ok(requests[0].message.includes('555-0100'))
  assert.ok(requests[0].message.includes('Call coverage: Both'))
  assert.ok((await page.locator('[role="status"]').innerText()).includes('No appointment'))
  report.push({ test: 'pricing, example labels, eight FAQ/schema matches, anchors and one accepted enquiry without website', passed: true })
  await page.getByRole('button', { name: 'Send another enquiry', exact: true }).click()
  assert.equal(await page.locator('#receptionist-name').inputValue(), '')
  await page.locator('#receptionist-name').fill('Retained name')
  await page.locator('#receptionist-business').fill('Retained business')
  await page.locator('#receptionist-email').fill('test@example.com')
  for (const failure of ['error', 'malformed', 'network']) {
    mode = failure
    await page.getByRole('button', { name: 'Request a demo', exact: true }).click()
    await page.getByRole('alert').waitFor()
    assert.equal(await page.getByRole('heading', { name: 'Demo enquiry sent.', exact: true }).count(), 0)
    assert.equal(await page.locator('#receptionist-name').inputValue(), 'Retained name')
    assert.ok(await page.getByRole('button', { name: 'Request a demo', exact: true }).isEnabled())
    report.push({ test: `${failure}: visible error, retained input, no false success`, passed: true })
  }
  mode = 'success'
  await page.getByRole('button', { name: 'Request a demo', exact: true }).click()
  await page.getByRole('heading', { name: 'Demo enquiry sent.', exact: true }).waitFor()
  assert.equal(requests.length, 5)
  assert.deepEqual(errors, [])
  await context.close()

  for (const width of [1440, 1280, 1024, 768, 390, 320]) {
    const responsive = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
    await responsive.route('**/_vercel/**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }))
    await responsive.goto(base + path, { waitUntil: 'networkidle' })
    assert.ok(await responsive.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 1), `Overflow at ${width}`)
    if (width < 1024) {
      const sticky = responsive.getByRole('link', { name: 'Request a demo', exact: true }).filter({ hasNot: responsive.locator('main a') })
      assert.ok(await sticky.count() > 0)
      await responsive.getByRole('button', { name: 'Open menu', exact: true }).click()
      await responsive.locator('#mobile-navigation').getByRole('link', { name: 'Request a demo', exact: true }).click()
      await responsive.locator('#mobile-navigation').waitFor({ state: 'detached' })
      assert.equal(new URL(responsive.url()).hash, '#enquiry')
      await responsive.evaluate(() => window.scrollTo(0, 0))
    }
    await responsive.screenshot({ path: `validation/receptionist-${width}.png`, fullPage: true })
    report.push({ test: `viewport ${width}: no horizontal overflow and contextual navigation`, passed: true })
    await responsive.close()
  }
  const nojs = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 1000 } })
  await nojs.goto(base + path, { waitUntil: 'networkidle' })
  assert.ok((await nojs.locator('main').innerText()).includes('Let AI take'))
  assert.equal(await nojs.locator('#faq details').count(), 8)
  await nojs.locator('#faq details').last().locator('summary').click()
  assert.ok(await nojs.locator('#faq details').last().locator('p').isVisible())
  assert.ok((await nojs.locator('noscript').allTextContents()).join(' ').includes('hello@picshaw.com'))
  report.push({ test: 'no JavaScript: service copy, pricing, native FAQs and email fallback', passed: true })
  await nojs.close()
  await writeFile('validation/receptionist-browser-report.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally { await browser.close() }
