import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseURL = process.env.PREVIEW_URL || 'http://127.0.0.1:3000'
assert.ok(['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname), 'Local build only; never submit production leads')
const origin = new URL(baseURL).origin
const browser = await chromium.launch({ headless: true })
const report = []
await mkdir('validation', { recursive: true })
async function fixture(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', ...options })
  const requests = [], errors = []
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin !== origin || url.pathname.startsWith('/_vercel/')) {
      if (route.request().resourceType() === 'script') return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
      return route.abort()
    }
    if (url.pathname.startsWith('/api/contact')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' })
    requests.push(url.pathname)
    return route.continue()
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(baseURL + '/ai-receptionist', { waitUntil: 'networkidle' })
  if (options.javaScriptEnabled !== false) {
    await page.locator('#privacy-preferences-panel').waitFor()
    await page.getByRole('button', { name: 'Reject optional', exact: true }).click()
  }
  return { context, page, requests, errors }
}
try {
  const f = await fixture()
  const { page } = f
  assert.equal(await page.locator('h1').count(), 1)
  assert.equal(await page.locator('video').count(), 1)
  const video = page.locator('#receptionist-explainer-video')
  assert.equal(await video.getAttribute('preload'), 'none')
  assert.ok(await video.evaluate(v => v.controls && v.paused && !v.autoplay && !v.loop))
  assert.ok(!f.requests.some(path => path.endsWith('.mp4')), 'Do not download the video before visitor interaction')
  assert.equal(await video.locator('track[kind="captions"]').count(), 1)
  assert.ok((await page.locator('#explainer-disclosure').innerText()).includes('not a real customer call'))
  await page.locator('#walkthrough-text summary').focus()
  await page.keyboard.press('Enter')
  assert.ok(await page.locator('#walkthrough-text ol').isVisible())
  assert.ok((await page.locator('#walkthrough-text').innerText()).includes('Culver City'))
  await page.locator('#walkthrough-text summary').click()
  await video.evaluate(async v => { await v.play() })
  await page.waitForFunction(() => document.querySelector('video').currentTime > 0.1)
  await video.evaluate(v => v.pause())
  assert.ok(Math.abs(await video.evaluate(v => v.duration) - 42) < 0.1)
  await video.evaluate(v => { v.currentTime = 16 })
  await page.waitForFunction(() => !document.querySelector('video').seeking)
  await video.screenshot({ path: 'validation/receptionist-upgrade-video-playing.png' })
  report.push({ test: '42-second self-hosted MP4 plays; no autoplay/preload; captions and keyboard-operable text alternative', passed: true })

  const slider = page.locator('#receptionist-usage-minutes')
  await slider.focus()
  await page.keyboard.press('Home')
  assert.equal(await page.locator('[data-usage-total]').innerText(), '$399USD')
  assert.equal(await page.locator('[data-usage-with-setup]').innerText(), '$899')
  for (let index = 0; index < 15; index++) await page.keyboard.press('ArrowRight')
  assert.equal(await slider.inputValue(), '750')
  assert.equal(await page.locator('[data-usage-extra]').innerText(), '$125')
  assert.equal(await page.locator('[data-usage-total]').innerText(), '$524USD')
  assert.equal(await page.locator('[data-usage-with-setup]').innerText(), '$1,024')
  for (let index = 0; index < 5; index++) await page.keyboard.press('ArrowRight')
  assert.equal(await page.locator('[data-usage-total]').innerText(), '$649USD')
  await page.keyboard.press('End')
  assert.equal(await page.locator('[data-usage-total]').innerText(), '$1,149USD')
  assert.equal(await page.locator('[data-usage-with-setup]').innerText(), '$1,649')
  assert.ok((await page.locator('#pricing').innerText()).includes('$0.50 / minute'))
  const schema = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap(text => { const data = JSON.parse(text); return data['@graph'] || [data] })
  const service = schema.find(item => item['@type'] === 'Service')
  const media = schema.find(item => item['@type'] === 'VideoObject')
  assert.equal(service.offers.price, '399')
  assert.equal(media.duration, 'PT42S')
  assert.equal(media.contentUrl, 'https://www.picshaw.com/media/receptionist-walkthrough.mp4')
  assert.deepEqual(f.errors, [])
  report.push({ test: 'Keyboard usage calculator matches shared prices; setup separate; service/video schema accurate', passed: true })
  await f.context.close()

  for (const width of [320,390,768,1024,1440]) {
    const f = await fixture({ viewport: { width, height: 1000 } })
    assert.ok(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow at ' + width)
    await f.page.screenshot({ path: `validation/receptionist-upgrade-hero-${width}.png` })
    await f.page.locator('#pricing').scrollIntoViewIfNeeded()
    await f.page.screenshot({ path: `validation/receptionist-upgrade-pricing-${width}.png` })
    await f.page.screenshot({ path: `validation/receptionist-upgrade-full-${width}.png`, fullPage: true })
    assert.deepEqual(f.errors, [])
    report.push({ width, test: 'Responsive page and pricing', passed: true })
    await f.context.close()
  }
  const n = await fixture({ javaScriptEnabled: false, viewport: { width: 390, height: 1000 } })
  assert.ok((await n.page.locator('#pricing').innerText()).includes('$399'))
  await n.page.locator('#walkthrough-text summary').click()
  assert.ok(await n.page.locator('#walkthrough-text ol').isVisible())
  assert.ok((await n.page.locator('noscript').allTextContents()).join(' ').includes('750 minutes: $524'))
  await n.context.close()
  report.push({ test: 'Pricing, captions source and full text walkthrough work without JavaScript; estimator fallback provided', passed: true })
  console.log(JSON.stringify(report, null, 2))
} finally {
  await writeFile('validation/receptionist-upgrade-browser.json', JSON.stringify(report, null, 2))
  await browser.close()
}
