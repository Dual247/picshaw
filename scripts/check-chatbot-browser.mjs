import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseURL = process.env.PREVIEW_URL || 'http://127.0.0.1:3000'
const origin = new URL(baseURL).origin
assert.ok(['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname), 'Mock tests must never submit to production')
const production = process.env.VERCEL_ENV === 'production'
const browser = await chromium.launch({ headless: true })
const report = []
await mkdir('validation', { recursive: true })
async function fixture({ consent, gpc = false, width = 1440, height = 900 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' })
  await context.addInitScript(({ consent, gpc }) => {
    if (consent) localStorage.setItem('picshaw-analytics-consent-v1', JSON.stringify({ value: consent, at: Date.now() }))
    if (gpc) Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true })
  }, { consent, gpc })
  const page = await context.newPage(), submissions = [], outbound = [], errors = []
  let mode = 'success'
  page.on('pageerror', e => errors.push(e.message))
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== origin || url.pathname.startsWith('/_vercel/')) {
      outbound.push(url.href)
      if (route.request().resourceType() === 'script') return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
      return route.abort()
    }
    if (url.pathname === '/api/contact') {
      submissions.push(route.request().postDataJSON())
      const outcome = mode
      await new Promise(resolve => setTimeout(resolve, 150))
      if (outcome === 'network') return route.abort()
      return route.fulfill({ status: outcome === 'http-error' ? 502 : 200, contentType: 'application/json', body: outcome === 'malformed' ? 'not-json' : JSON.stringify({ success: outcome === 'success' }) })
    }
    return route.continue()
  })
  return { context, page, submissions, outbound, errors, setMode: next => { mode = next } }
}
async function open(page) {
  await page.getByRole('button', { name: 'Ask Picshaw a question', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Ask Picshaw', exact: true })
  await dialog.waitFor()
  assert.equal(await dialog.getAttribute('aria-modal'), 'false')
  return dialog
}
async function ask(dialog, text) {
  await dialog.locator('#picshaw-chat-question').fill(text)
  await dialog.getByRole('button', { name: 'Send question', exact: true }).click()
  return dialog.locator('[role="log"]').innerText()
}
async function conversionCount(page) {
  return page.evaluate(() => (window.dataLayer || []).filter(e => e[0] === 'event' && e[1] === 'conversion_event_submit_lead_form').length)
}
try {
  const f = await fixture(), page = f.page
  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await page.locator('#privacy-preferences-panel').waitFor()
  assert.ok(!await page.getByRole('button', { name: 'Ask Picshaw a question' }).isVisible(), 'Consent controls take precedence')
  await page.getByRole('button', { name: 'Reject optional', exact: true }).click()
  assert.equal(await page.getByRole('dialog', { name: 'Ask Picshaw' }).count(), 0, 'No auto-opening')
  let dialog = await open(page)
  assert.ok((await dialog.innerText()).includes('Automated answers'))
  assert.match(await ask(dialog, 'What does it cost?'), /\$1,500/)
  assert.match(await ask(dialog, 'What is included in the audit?'), /\$1,250/)
  assert.match(await ask(dialog, 'Is that per month?'), /once/)
  assert.match(await ask(dialog, 'Tell me about the AI receptionist'), /\$399/)
  assert.match(await ask(dialog, 'How much?'), /\$399/)
  assert.match(await ask(dialog, 'Annual discount for receptionist?'), /not this voice service/)
  assert.equal(f.submissions.length, 0, 'Questions never submit enquiry data')
  assert.equal(await conversionCount(page), 0)
  assert.ok(!f.outbound.some(url => /google-analytics|googletagmanager|_vercel\/insights/.test(url)))
  await ask(dialog, '<img src=x onerror="window.chatInjected=true">')
  assert.equal(await page.evaluate(() => window.chatInjected), undefined)
  assert.equal(await dialog.locator('img').count(), 0, 'Questions are text, not injected markup')
  await dialog.getByRole('button', { name: 'Clear Picshaw conversation' }).click()
  assert.equal(await dialog.locator('[role="log"]').innerText(), '')
  await ask(dialog, 'Can you improve my website?')
  await dialog.getByRole('link', { name: 'Website design options' }).last().click()
  await page.waitForURL(origin + '/website-redesign')
  dialog = await open(page)
  assert.match(await dialog.locator('[role="log"]').innerText(), /Can you improve my website/)
  await ask(dialog, 'Can you help with a custom booking integration?')
  await dialog.getByRole('button', { name: 'Send a request to Ash', exact: true }).click()
  assert.equal(await dialog.locator('#chat-lead-message').inputValue(), 'Can you help with a custom booking integration?')
  await dialog.locator('#chat-lead-email').fill('visitor-test@example.com')
  await dialog.locator('#chat-lead-name').fill('Test Visitor')
  await dialog.locator('#chat-lead-message').fill('Reviewed request only. New business; no website yet.')
  for (const mode of ['http-error', 'malformed', 'network']) {
    f.setMode(mode)
    await dialog.getByRole('button', { name: 'Send my request', exact: true }).click()
    await dialog.getByRole('alert').waitFor()
    assert.equal(await dialog.locator('#chat-lead-email').inputValue(), 'visitor-test@example.com')
    assert.equal(await dialog.getByRole('heading', { name: 'Your request is with Picshaw.' }).count(), 0)
    assert.equal(await conversionCount(page), 0)
  }
  f.setMode('success')
  const sentBefore = f.submissions.length
  await dialog.locator('form[data-enquiry-type="chatbot"]').evaluate(form => { form.requestSubmit(); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
  await dialog.getByRole('heading', { name: 'Your request is with Picshaw.' }).waitFor()
  assert.equal(f.submissions.length, sentBefore + 1)
  const payload = f.submissions.at(-1)
  assert.equal(payload.service_interest, 'chatbot')
  assert.equal(payload.website, '')
  assert.match(payload.message, /Reviewed request only/)
  assert.ok(!JSON.stringify(payload).includes('Can you improve my website'))
  assert.ok(!JSON.stringify(payload).includes('window.chatInjected'))
  assert.equal(await conversionCount(page), 0, 'Rejecting analytics still allows lead delivery, without conversion event')
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  // Closing hides the panel first; focus is deliberately restored on the next frame.
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Ask Picshaw a question', undefined, { timeout: 5000 })
  assert.equal(await page.getByRole('button', { name: 'Ask Picshaw a question' }).evaluate(el => document.activeElement === el), true)
  assert.deepEqual(f.errors, [])
  report.push({ test: 'Instant answers, pricing/context, text safety, navigation retention, reviewed lead, errors/retry, duplicate guard, optional website and consent refusal', passed: true })
  console.log('Chat interaction and reviewed enquiry checks passed')
  await f.context.close()

  for (const gpc of [false, true]) {
    const f = await fixture({ consent: 'granted', gpc })
    await f.page.goto(baseURL, { waitUntil: 'networkidle' })
    if (production && !gpc) await f.page.waitForFunction(() => typeof window.gtagSendEvent === 'function')
    const dialog = await open(f.page)
    await ask(dialog, 'I would like a Core proposal')
    await dialog.getByRole('button', { name: 'Send a request to Ash', exact: true }).click()
    await dialog.locator('#chat-lead-email').fill('consent-chat-test@example.com')
    await dialog.getByRole('button', { name: 'Send my request', exact: true }).click()
    await dialog.getByRole('heading', { name: 'Your request is with Picshaw.' }).waitFor()
    assert.equal(f.submissions.length, 1)
    assert.equal(await conversionCount(f.page), production && !gpc ? 1 : 0)
    const events = await f.page.evaluate(() => (window.dataLayer || []).filter(e => e[0] === 'event').map(e => [e[1], e[2]]))
    assert.ok(!JSON.stringify(events).includes('consent-chat-test@example.com'))
    assert.ok(!JSON.stringify(events).includes('I would like a Core proposal'))
    assert.deepEqual(f.errors, [])
    report.push({ test: 'Accepted lead respects production/preview and GPC', environment: process.env.VERCEL_ENV, gpc, passed: true })
    await f.context.close()
  }
  for (const [width, height] of [[320, 800], [390, 844], [768, 900], [1280, 900], [1440, 1000], [640, 360]]) {
    const f = await fixture({ consent: 'denied', width, height })
    await f.page.goto(baseURL, { waitUntil: 'networkidle' })
    const dialog = await open(f.page)
    const box = await dialog.boundingBox()
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, 'Panel fits ' + width + 'x' + height)
    assert.ok(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    if (height > 520 && width < 1280) {
      const sticky = f.page.locator('div.fixed.bottom-0').first()
      const stickyBox = await sticky.boundingBox()
      const launcher = await f.page.getByRole('button', { name: 'Close Picshaw chat', exact: true }).boundingBox()
      assert.ok(!stickyBox || launcher.y + launcher.height <= stickyBox.y, 'Launcher avoids the mobile contact bar')
    }
    await dialog.screenshot({ path: 'validation/chat-open-' + width + 'x' + height + '.png' })
    await f.page.screenshot({ path: 'validation/chat-page-' + width + 'x' + height + '.png' })
    await ask(dialog, 'Show me monthly plans')
    await dialog.screenshot({ path: 'validation/chat-answer-' + width + 'x' + height + '.png' })
    await dialog.getByRole('button', { name: 'Send a request to Ash', exact: true }).click()
    await dialog.locator('#chat-lead-email').focus()
    assert.equal(await dialog.locator('#chat-lead-email').evaluate(el => el === document.activeElement), true)
    await dialog.screenshot({ path: 'validation/chat-lead-' + width + 'x' + height + '.png' })
    assert.deepEqual(f.errors, [])
    report.push({ viewport: [width, height], fits: true, noOverflow: true, passed: true })
    console.log('Chat viewport passed: ' + width + 'x' + height)
    await f.context.close()
  }
  console.log(JSON.stringify(report, null, 2))
} finally {
  await writeFile('validation/chat-browser-' + process.env.VERCEL_ENV + '.json', JSON.stringify(report, null, 2))
  await browser.close()
}
