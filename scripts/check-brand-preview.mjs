import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium } from "playwright"

const baseURL = process.env.PREVIEW_URL || "http://127.0.0.1:3000"
await mkdir("validation", { recursive: true })
const browser = await chromium.launch({ headless: true })
const report = []

try {
  for (const width of [1440, 1024, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: "reduce" })
    const errors = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(baseURL, { waitUntil: "domcontentloaded" })
    await page.locator("header img[src='/brand/picshaw-mark.svg']").waitFor()
    assert.equal(await page.locator("img[src='/brand/picshaw-mark.svg']").count(), 2, "Header and footer must share the supplied mark")
    const icon = await page.locator("link[rel='icon'][href*='icon.svg']").getAttribute("href")
    assert.ok(icon, "SVG favicon missing")
    assert.equal((await page.request.get(new URL(icon, baseURL).href)).status(), 200)

    const cards = page.locator("#work article")
    assert.equal(await cards.count(), 3)
    for (let i = 0; i < 3; i++) {
      const card = cards.nth(i)
      await card.scrollIntoViewIfNeeded()
      const image = card.locator("[role='img'] img")
      await image.waitFor({ timeout: 20000 })
      await image.evaluate((img) => img.decode())
      assert.ok(await image.evaluate((img) => img.naturalWidth > 0), `Image ${i + 1} did not load`)
      assert.equal(await card.locator("[role='img'] a, [role='img'] button").count(), 0, "Mock navigation must not be interactive")
      if (width === 1440) {
        await card.locator("figure").screenshot({ path: `validation/concept-${i + 1}.png` })
      }
    }
    assert.ok(!(await page.locator("#work").innerText()).includes("pacificplumbingco..com"))
    assert.ok(!(await page.locator("#work").innerText()).match(/47%|3x consultation|First page Google|fully booked/))
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert.ok(overflow <= 1, `Horizontal overflow at ${width}px: ${overflow}px`)
    await page.locator("#work").screenshot({ path: `validation/work-${width}.png` })
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: `validation/header-${width}.png` })
    if (width < 1024) {
      await page.getByRole("button", { name: "Open menu", exact: true }).click()
      await page.locator("#mobile-navigation").waitFor()
      await page.locator("#mobile-navigation").getByRole("link", { name: "Work", exact: true }).click()
      await page.locator("#mobile-navigation").waitFor({ state: "detached" })
    }
    await page.locator("footer").scrollIntoViewIfNeeded()
    await page.locator("footer").screenshot({ path: `validation/footer-${width}.png` })
    assert.deepEqual(errors, [], "Unexpected client-side JavaScript errors")
    report.push({ width, logos: 2, conceptImages: 3, iconStatus: 200, horizontalOverflow: overflow, errors })
    await page.close()
  }
  console.log(JSON.stringify(report, null, 2))
  await writeFile("validation/browser-report.json", JSON.stringify(report, null, 2))
} finally {
  await browser.close()
}
