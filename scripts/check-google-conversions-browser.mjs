import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

// Never submit these fixtures to the live site or contact Google.
const baseURL = process.env.PREVIEW_URL || 'http://127.0.0.1:3000'
const origin = new URL(baseURL).origin
assert.ok(['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname), 'Local build only')
const enabled = process.env.CONVERSION_TEST_ENV === 'production'
assert.ok(['production', 'preview'].includes(process.env.CONVERSION_TEST_ENV))
const eventName = 'conversion_event_submit_lead_form'
const report = []
const browser = await chromium.launch({ headless: true })
const definitions = [
  { path: '/', form: '#contact form', success: "You're on our radar.", reset: 'Send another enquiry', prepare: async page => {
    await page.locator('#home-email').fill('conversion-test@example.com')
    await page.locator('#home-website').fill('example.com')
  } },
  { path: '/ai-visibility-audit', form: '#contact form', success: 'Message sent!', reset: 'Send another message', prepare: async page => {
    await page.locator('#contact-email').fill('conversion-test@example.com')
    await page.locator('#contact-website').fill('example.com')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.locator('#contact-name').fill('Conversion test only')
  } },
  { path: '/ai-receptionist', form: 'form[data-enquiry-type="receptionist"]', success: 'Demo enquiry sent.', reset: 'Send another enquiry', prepare: async page => {
    await page.locator('#receptionist-name').fill('Conversion test only')
    await page.locator('#receptionist-business').fill('Test business only')
    await page.locator('#receptionist-email').fill('conversion-test@example.com')
  } },
]
async function count(page) {
  return page.evaluate(name => (window.dataLayer || []).filter(entry => entry[0] === 'event' && entry[1] === name).length, eventName)
}
async function open(def, initialMode = 'success', tracking = 'normal') {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  let mode = initialMode
  const deliveries = [], errors = []
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== origin || url.pathname.startsWith('/_vercel/')) {
      if (route.request().resourceType() === 'script') return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
      return route.abort()
    }
    if (url.pathname === '/api/contact') {
      deliveries.push(route.request().postDataJSON())
      const outcome = mode
      await new Promise(resolve => setTimeout(resolve, 150))
      if (outcome === 'network') return route.abort()
      return route.fulfill({ status: outcome === 'http-error' ? 502 : 200, contentType: 'application/json', body: outcome === 'malformed' ? 'not-json' : JSON.stringify({ success: outcome === 'success' }) })
    }
    return route.continue()
  })
  await page.goto(new URL(def.path, baseURL).href, { waitUntil: 'networkidle' })
  // New privacy flow: no optional Google scripts until the visitor explicitly accepts.
  await page.locator('#privacy-preferences-panel').waitFor()
  assert.equal(await page.locator('script[src*="googletagmanager.com/gtag/js"]').count(), 0)
  if (enabled) {
    await page.getByRole('button', { name: 'Allow analytics', exact: true }).click()
    await page.waitForFunction(() => typeof window.gtagSendEvent === 'function')
    assert.equal(await page.locator('script[src*="googletagmanager.com/gtag/js"]').count(), 1, 'No duplicate Google base tag')
    assert.equal(await page.evaluate(() => (window.dataLayer || []).filter(entry => entry[0] === 'config' && entry[1] === 'G-LFJFHY63RR').length), 1)
  } else {
    await page.getByRole('button', { name: 'Reject optional', exact: true }).click()
    assert.equal(await page.evaluate(() => typeof window.gtagSendEvent), 'undefined')
    assert.equal(await page.locator('script[src*="googletagmanager.com/gtag/js"]').count(), 0)
  }
  assert.equal(await count(page), 0, 'No conversion on page load')
  await page.locator(def.form).evaluate(form => form.requestSubmit())
  assert.equal(deliveries.length, 0, 'Browser validation is not a conversion or delivery')
  await def.prepare(page)
  assert.equal(await count(page), 0, 'Starting or continuing a form is not a conversion')
  if (enabled && tracking !== 'normal') await page.evaluate(mode => {
    if (mode === 'missing') window.gtag = undefined
    if (mode === 'throws') window.gtag = () => { throw new Error('Analytics unavailable') }
    if (mode === 'disabled') window['ga-disable-G-LFJFHY63RR'] = true
  }, tracking)
  return { page, context, deliveries, errors, setMode: value => { mode = value } }
}
async function submit(page, form, duplicate = false) {
  if (!duplicate) {
    await page.locator(form).locator('button[type="submit"]').click()
    return
  }
  await page.locator(form).evaluate(element => {
    element.requestSubmit()
    element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}
async function checkPayload(page) {
  const entries = await page.evaluate(name => (window.dataLayer || []).filter(entry => entry[0] === 'event' && entry[1] === name).map(entry => ({ keys: Object.keys(entry[2]).sort(), timeout: entry[2].event_timeout, callback: typeof entry[2].event_callback })), eventName)
  for (const entry of entries) assert.deepEqual(entry, { keys: ['event_callback', 'event_timeout'], timeout: 2000, callback: 'function' })
}
try {
  for (const def of definitions) {
    const f = await open(def)
    await submit(f.page, def.form, true)
    await f.page.getByRole('heading', { name: def.success, exact: true }).waitFor()
    assert.equal(f.deliveries.length, 1, 'Repeated pending submission is ignored')
    assert.equal(await count(f.page), enabled ? 1 : 0, 'Exactly one event per accepted enquiry')
    assert.equal(new URL(f.page.url()).pathname, def.path, 'In-page success does not redirect')
    await f.page.getByRole('button', { name: def.reset, exact: true }).click()
    assert.equal(await count(f.page), enabled ? 1 : 0, 'Reset does not duplicate conversion')
    await def.prepare(f.page)
    await submit(f.page, def.form)
    await f.page.getByRole('heading', { name: def.success, exact: true }).waitFor()
    assert.equal(f.deliveries.length, 2)
    assert.equal(await count(f.page), enabled ? 2 : 0, 'Separate accepted enquiry can count separately')
    await checkPayload(f.page)
    assert.deepEqual(f.errors, [])
    report.push({ path: def.path, test: 'Accepted submissions, duplicate-pending guard, reset, no redirect and minimal event payload', passed: true, conversions: await count(f.page) })
    await f.context.close()
    for (const mode of ['http-error', 'success-false', 'malformed', 'network']) {
      const f = await open(def, mode)
      await submit(f.page, def.form)
      // Do not mistake Next.js's route-announcer alert for the form's error.
      await f.page.locator(def.form).getByRole('alert').waitFor()
      assert.equal(await count(f.page), 0, `${mode}: no false conversion`)
      assert.equal(await f.page.getByRole('heading', { name: def.success, exact: true }).count(), 0)
      f.setMode('success')
      await submit(f.page, def.form)
      await f.page.getByRole('heading', { name: def.success, exact: true }).waitFor()
      assert.equal(f.deliveries.length, 2, 'One failed request and one accepted retry')
      assert.equal(await count(f.page), enabled ? 1 : 0, 'Only successful retry counts')
      assert.deepEqual(f.errors, [])
      report.push({ path: def.path, test: `${mode}: no conversion; accepted retry counts only once`, passed: true })
      await f.context.close()
    }
  }
  if (enabled) for (const tracking of ['missing', 'throws', 'disabled']) {
    const f = await open(definitions[0], 'success', tracking)
    await submit(f.page, definitions[0].form)
    await f.page.getByRole('heading', { name: definitions[0].success, exact: true }).waitFor()
    assert.equal(f.deliveries.length, 1)
    assert.equal(await count(f.page), 0)
    assert.deepEqual(f.errors, [])
    report.push({ test: `${tracking} Google tracking preserves accepted form success`, passed: true })
    await f.context.close()
  }
} finally {
  await mkdir('validation', { recursive: true })
  await writeFile(`validation/google-conversions-${process.env.CONVERSION_TEST_ENV}.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ environment: process.env.CONVERSION_TEST_ENV, googleTraffic: 'All external requests intercepted; no events transmitted', report }, null, 2))
  await browser.close()
}
