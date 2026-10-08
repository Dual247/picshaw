import assert from "node:assert/strict"
import { readFile, mkdir, writeFile } from "node:fs/promises"
import { setTimeout as pause } from "node:timers/promises"

const expectedMark = (await readFile("public/brand/picshaw-mark.svg", "utf8")).trim()
const photos = ["photo-1629079447777-1e605162dc8d", "photo-1581182800629-7d90925ad072", "photo-1508424757105-b6d5ad9329d0"]
const report = { checkedAt: null, requestedURL: "https://picshaw.com", ready: false, attempts: [] }

for (let attempt = 1; attempt <= 18; attempt++) {
  try {
    const home = await fetch(`https://picshaw.com/?brand-check=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(15000) })
    const html = await home.text()
    const logo = await fetch(new URL("/brand/picshaw-mark.svg", home.url), { cache: "no-store", signal: AbortSignal.timeout(15000) })
    const svg = await logo.text()
    const check = {
      attempt,
      finalURL: home.url,
      homepageStatus: home.status,
      logoStatus: logo.status,
      correctLogo: svg.trim() === expectedMark,
      logoReferences: (html.match(/src="\/brand\/picshaw-mark.svg"/g) || []).length,
      newShowcase: html.includes("Distinctive websites."),
      photographs: photos.every((photo) => html.includes(photo)),
      svgFavicon: html.includes("icon.svg"),
    }
    report.attempts.push(check)
    if (home.ok && logo.ok && check.correctLogo && check.logoReferences === 2 && check.newShowcase && check.photographs && check.svgFavicon) {
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
assert.ok(report.ready, "The public domain did not return the expected brand/showcase deployment within the check window")
