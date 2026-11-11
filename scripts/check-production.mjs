import assert from "node:assert/strict"
import { readFile, mkdir, writeFile } from "node:fs/promises"
import { setTimeout as pause } from "node:timers/promises"

const normalizeLineEndings = text => text.replaceAll("\r\n", "\n")
const expectedMark = normalizeLineEndings((await readFile("public/brand/picshaw-mark.svg", "utf8")).trim())
const photos = ["photo-1629079447777-1e605162dc8d", "photo-1581182800629-7d90925ad072", "photo-1508424757105-b6d5ad9329d0"]
const expectedBathroomAlt = "A contemporary bathroom with a white double vanity and blue-tinted window"
const report = { checkedAt: null, requestedURL: "https://picshaw.com", ready: false, attempts: [] }


// Deployment query strings do not change asset identity; origin and pathname do.
function isBrandMarkSource(src, pageURL) {
  if (!src) return false
  try {
    const url = new URL(src, pageURL)
    return url.origin === new URL(pageURL).origin && url.pathname === '/brand/picshaw-mark.svg'
  } catch { return false }
}
for (const src of ['/brand/picshaw-mark.svg', '/brand/picshaw-mark.svg?dpl=dpl_fixture']) {
  assert.equal(isBrandMarkSource(src, 'https://www.picshaw.com/'), true)
}
for (const src of ['', 'https://evil.test/brand/picshaw-mark.svg', '//evil.test/brand/picshaw-mark.svg?dpl=x', '/brand/picshaw-mark.svg.fake', '/other/picshaw-mark.svg']) {
  assert.equal(isBrandMarkSource(src, 'https://www.picshaw.com/'), false)
}

for (let attempt = 1; attempt <= 18; attempt++) {
  try {
    const home = await fetch(`https://picshaw.com/?brand-check=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(15000) })
    const html = await home.text()
    const images = html.match(/<img\b[^>]*>/gi) || []
    const bathroomImages = images.filter(tag => tag.includes(photos[0]))
    const bathroomAltText = bathroomImages.map(tag => tag.match(/\salt="([^"]*)"/)?.[1] ?? null)
    const logo = await fetch(new URL("/brand/picshaw-mark.svg", home.url), { cache: "no-store", signal: AbortSignal.timeout(15000) })
    const svg = await logo.text()
    const check = {
      attempt,
      finalURL: home.url,
      homepageStatus: home.status,
      logoStatus: logo.status,
      correctLogo: normalizeLineEndings(svg.trim()) === expectedMark,
      logoReferences: images.filter(tag => isBrandMarkSource(tag.match(/\ssrc="([^"]*)"/)?.[1], home.url)).length,
      newShowcase: html.includes("Distinctive websites."),
      photographs: photos.every((photo) => html.includes(photo)),
      conversionJourneyReady: html.includes('id="opportunity-heading"') && html.includes("Can they find you?")
        && html.includes("Why should they choose you?") && html.includes("What happens next?")
        && html.includes("Discuss my business") && html.includes("$1,000") && html.includes("$1,250") && html.includes("$1,500")
        && html.includes("Three-month minimum") && html.includes('href="/#services"')
        && html.includes("Portal coming soon") && !html.includes('href="https://app.picshaw.com'),
      bathroomImageCount: bathroomImages.length,
      bathroomAltText,
      bathroomAltTextCorrect: bathroomAltText.length === 1 && bathroomAltText.every(alt => alt === expectedBathroomAlt),
      svgFavicon: html.includes("icon.svg"),
    }
    report.attempts.push(check)
    if (home.ok && logo.ok && check.correctLogo && check.logoReferences === 2 && check.newShowcase && check.photographs && check.conversionJourneyReady && check.bathroomAltTextCorrect && check.svgFavicon) {
      report.ready = true
      break
    }
  } catch (error) {
    report.attempts.push({ attempt, error: String(error) })
  }
  await pause(5000)
}
report.checkedAt = new Date().toISOString()
await mkdir("validation", { recursive: true })
await writeFile("validation/production-report.json", JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
assert.ok(report.ready, "The public domain did not return the expected brand/showcase deployment and image alt text within the check window")
