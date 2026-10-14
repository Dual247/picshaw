import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseURL = process.env.PREVIEW_URL || 'http://127.0.0.1:3000'
const expectedTitles = JSON.parse(await readFile('content/seo-titles.json', 'utf8'))
const photos = [
  { id: 'photo-1629079447777-1e605162dc8d', count: 2, alt: 'A contemporary bathroom with a white double vanity and blue-tinted window' },
  { id: 'photo-1581182800629-7d90925ad072', count: 1, alt: 'A sunlit natural-beauty portrait used as illustrative editorial photography' },
  { id: 'photo-1508424757105-b6d5ad9329d0', count: 1, alt: 'A warm restaurant interior with timber tables, pendant lights, and greenery' },
]
const originalRestaurantURL = 'https://images.unsplash.com/photo-1508424757105-b6d5ad9329d0?auto=format&fit=crop&w=1200&q=85'
const report = { baseURL, checkedAt: new Date().toISOString(), titles: [], images: [], restaurant: null }
await mkdir('validation', { recursive: true })
assert.equal(Object.keys(expectedTitles).length, 9, 'Cover all nine reported title issues')
assert.equal(new Set(Object.values(expectedTitles)).size, 9, 'Search titles must be unique')
const browser = await chromium.launch({ headless: true })
try {
  // Check server-rendered HTML, with no analytics events or hydration-dependent alt text.
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 1000 } })
  await context.route('https://images.unsplash.com/**', route => route.abort())
  const page = await context.newPage()
  for (const [path, expected] of Object.entries(expectedTitles)) {
    // 45–60 characters is this audit's budget, not a Google ranking requirement.
    assert.ok(expected.length >= 45 && expected.length <= 60, `${path}: title budget`)
    const response = await page.goto(new URL(path, baseURL).href, { waitUntil: 'domcontentloaded' })
    assert.equal(response.status(), 200, path)
    assert.equal(await page.locator('title').count(), 1, `${path}: exactly one title`)
    const title = await page.title()
    assert.equal(title, expected, path)
    assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'), expected, `${path}: Open Graph title`)
    assert.equal(await page.locator('meta[name="twitter:title"]').getAttribute('content'), expected, `${path}: Twitter title`)
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), new URL(path, 'https://www.picshaw.com').href, `${path}: canonical unchanged`)
    assert.equal(await page.locator('h1').count(), 1, `${path}: editorial heading retained`)
    report.titles.push({ path, title, characters: title.length, status: response.status() })
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    const home = await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
    assert.equal(home.status(), 200, 'Homepage')
    for (const photo of photos) {
      const descriptions = await page.locator(`img[src*="${photo.id}"]`).evaluateAll(images => images.map(image => image.getAttribute('alt')))
      assert.deepEqual(descriptions, Array(photo.count).fill(photo.alt), `${photo.id}: every occurrence at ${width}px`)
      report.images.push({ width, photo: photo.id, count: descriptions.length, alt: photo.alt })
    }
  }
  const imageSrc = await page.locator(`img[src*="${photos[2].id}"]`).getAttribute('src')
  const imageURL = new URL(imageSrc, baseURL).href
  const image = await context.request.get(imageURL, { timeout: 30000 })
  assert.equal(image.status(), 200, 'Optimized restaurant photograph')
  const bytes = await image.body()
  report.restaurant = { url: imageURL, contentType: image.headers()['content-type'], bytes: bytes.length, budgetBytes: 100000 }
  assert.match(report.restaurant.contentType, /^image\/webp(?:;|$)/i)
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', 'Actual WebP file signature')
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', 'Actual WebP file signature')
  await writeFile('validation/restaurant-optimized.webp', bytes)
  try {
    const original = await context.request.get(originalRestaurantURL, { timeout: 30000 })
    if (original.ok()) {
      report.restaurant.originalBytes = (await original.body()).length
      report.restaurant.reductionPercent = Math.round((1 - bytes.length / report.restaurant.originalBytes) * 1000) / 10
    }
  } catch { /* The previous URL is comparison data, not a production dependency. */ }
  assert.ok(bytes.length > 0 && bytes.length < 100000, `Restaurant image must be below 100 KB; received ${bytes.length} bytes`)
  await context.close()
} finally {
  console.log(JSON.stringify(report, null, 2))
  await writeFile(`validation/${process.env.SEO_AUDIT_REPORT || 'seo-audit-report.json'}`, JSON.stringify(report, null, 2))
  await browser.close()
}
