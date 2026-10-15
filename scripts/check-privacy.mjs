import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

// These checks never submit real contact forms or send data to Google.
const baseURL = process.env.PREVIEW_URL || 'http://127.0.0.1:3000'
const origin = new URL(baseURL).origin
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname))
const production = process.env.VERCEL_ENV === 'production'
const browser = await chromium.launch({ headless: true })
const report = []

async function safeContext(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, ...options })
  const tracked = []
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) {
      tracked.push(url.href)
      if (route.request().resourceType() === 'script') return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
      return route.abort()
    }
    if (url.pathname.startsWith('/_vercel/')) {
      tracked.push(url.pathname)
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
    }
    return route.continue()
  })
  return { context, tracked }
}
function isOptional(url) { return /googletagmanager|google-analytics|\/_vercel\/insights/.test(url) }

try {
  const { context, tracked } = await safeContext()
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', err => errors.push(err.message))
  const response = await page.goto(baseURL + '/privacy-policy', { waitUntil: 'networkidle' })
  assert.equal(response.status(), 200)
  assert.equal(await page.locator('h1').innerText(), 'Privacy Policy')
  assert.equal(await page.locator('section#analytics').count(), 1)
  assert.equal(await page.locator('section#rights').count(), 1)
  assert.equal(await page.locator('section#receptionist').count(), 1)
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://www.picshaw.com/privacy-policy')
  assert.ok((await page.locator('main').innerText()).includes('October 15, 2026'))
  await page.locator('#privacy-preferences-panel').waitFor()
  assert.equal(await page.locator('script[src*="googletagmanager.com/gtag/js"]').count(), 0)
  assert.equal(tracked.filter(isOptional).length, 0, 'No optional analytics request without consent')
  await page.getByRole('button', { name: 'Reject optional', exact: true }).click()
  await page.locator('#privacy-preferences-panel').waitFor({ state: 'detached' })
  assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('picshaw-analytics-consent-v1')).value)), 'denied')
  await page.goto(baseURL, { waitUntil: 'networkidle' })
  assert.equal(await page.locator('#privacy-preferences-panel').count(), 0, 'Saved refusal must persist')
  assert.equal(await page.locator('script[src*="googletagmanager.com/gtag/js"]').count(), 0)
  assert.equal(tracked.filter(isOptional).length, 0)
  assert.ok(await page.locator('footer a[href="/privacy-policy"]').count() > 0)
  assert.ok(await page.locator('#contact a[href="/privacy-policy"]').count() > 0)
  await page.getByRole('button', { name: 'Privacy settings' }).last().click()
  await page.locator('#privacy-preferences-panel').waitFor()
  await page.getByRole('button', { name: 'Allow analytics', exact: true }).click()
  await page.locator('#privacy-preferences-panel').waitFor({ state: 'detached' })
  assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('picshaw-analytics-consent-v1')).value)), 'granted')
  if (production) {
    await page.waitForFunction(() => typeof window.gtagSendEvent === 'function')
    assert.equal(await page.locator('script[src*="googletagmanager.com/gtag/js"]').count(), 1)
    const commands = await page.evaluate(() => Array.from(window.dataLayer || [], e => [...e]))
    assert.ok(commands.some(e => e[0] === 'consent' && e[1] === 'default' && e[2].ad_storage === 'denied'))
    assert.ok(commands.some(e => e[0] === 'consent' && e[1] === 'update' && e[2].analytics_storage === 'granted'))
    assert.ok(commands.some(e => e[0] === 'config' && e[2].allow_google_signals === false && e[2].allow_ad_personalization_signals === false))
    await page.evaluate(() => { document.cookie = '_ga=mock_1; Path=/; SameSite=Lax' })
  } else {
    assert.equal(await page.locator('script[src*="googletagmanager.com/gtag/js"]').count(), 0)
  }
  await page.getByRole('button', { name: 'Privacy settings' }).last().click()
  await page.getByRole('button', { name: 'Reject optional', exact: true }).click()
  if (production) await page.waitForLoadState('networkidle')
  assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('picshaw-analytics-consent-v1')).value)), 'denied')
  assert.equal(await page.locator('script[src*="googletagmanager.com/gtag/js"]').count(), 0, 'Withdrawal must remove Google tag on page refresh')
  if (production) assert.equal((await page.context().cookies()).filter(c => c.name === '_ga').length, 0, 'First-party GA cookies removed')
  assert.deepEqual(errors, [])
  report.push({ test: 'Privacy page, consent block/allow/revoke, persistent choice, Google ad denial, footer and homepage notice', passed: true })
  await context.close()

  const { context: gpcContext, tracked: gpcTraffic } = await safeContext()
  await gpcContext.addInitScript((key) => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true })
    localStorage.setItem(key, JSON.stringify({ value: 'granted', at: Date.now() }))
  }, 'picshaw-analytics-consent-v1')
  const gpcPage = await gpcContext.newPage()
  await gpcPage.goto(baseURL + '/privacy-policy', { waitUntil: 'networkidle' })
  assert.equal(await gpcPage.locator('script[src*="googletagmanager.com/gtag/js"]').count(), 0)
  await gpcPage.getByRole('button', { name: 'Privacy settings' }).first().click()
  await gpcPage.locator('#privacy-preferences-panel').waitFor()
  assert.ok((await gpcPage.locator('#privacy-preferences-panel').innerText()).includes('Global Privacy Control'))
  assert.ok(await gpcPage.getByRole('button', { name: 'Allow analytics' }).isDisabled())
  assert.equal(gpcTraffic.filter(isOptional).length, 0)
  report.push({ test: 'Global Privacy Control overrides saved consent', passed: true })
  await gpcContext.close()

  const { context: expiredContext } = await safeContext()
  await expiredContext.addInitScript(key => {
    localStorage.setItem(key, JSON.stringify({ value: 'granted', at: Date.now() - 181 * 24 * 3600 * 1000 }))
  }, 'picshaw-analytics-consent-v1')
  const expiredPage = await expiredContext.newPage()
  await expiredPage.goto(baseURL, { waitUntil: 'networkidle' })
  await expiredPage.locator('#privacy-preferences-panel').waitFor()
  assert.equal(await expiredPage.locator('script[src*="googletagmanager.com/gtag/js"]').count(), 0)
  report.push({ test: 'Expired 180-day preference re-prompts without tracking', passed: true })
  await expiredContext.close()

  for (const width of [320, 390, 1440]) {
    const { context: responsiveContext } = await safeContext({ viewport: { width, height: 900 } })
    const p = await responsiveContext.newPage()
    await p.goto(baseURL + '/privacy-policy', { waitUntil: 'networkidle' })
    await p.locator('#privacy-preferences-panel').waitFor()
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Privacy page overflow at ' + width)
    await p.screenshot({ path: 'validation/privacy-' + width + '.png', fullPage: true })
    await responsiveContext.close()
  }
  const { context: nojs } = await safeContext({ javaScriptEnabled: false })
  const np = await nojs.newPage()
  await np.goto(baseURL + '/privacy-policy')
  assert.ok((await np.locator('main').innerText()).includes('Your privacy rights'))
  assert.ok((await np.locator('main').innerText()).includes('Google Analytics'))
  assert.equal(await np.locator('#privacy-preferences-panel').count(), 0)
  report.push({ test: 'Privacy page readable without JavaScript and at mobile widths', passed: true })
  await nojs.close()

  console.log(JSON.stringify(report, null, 2))
} finally {
  await mkdir('validation', { recursive: true })
  await writeFile('validation/privacy-tests.json', JSON.stringify(report, null, 2))
  await browser.close()
}
