import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile('lib/work-showcase.ts', 'utf8')
const photo = 'photo-1508424757105-b6d5ad9329d0'
const selected = source.match(new RegExp(`image: "(https://images\\.unsplash\\.com/${photo}[^"\\n]+)"`))?.[1]
assert.ok(selected, 'Restaurant image URL must be defined in project data')
async function measure(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
  const body = Buffer.from(await response.arrayBuffer())
  const result = { url, status: response.status, bytes: body.length, contentType: response.headers.get('content-type'), webp: body.toString('ascii', 0, 4) === 'RIFF' && body.toString('ascii', 8, 12) === 'WEBP' }
  console.log(JSON.stringify(result))
  return result
}
const result = await measure(selected)
if (result.bytes >= 100000) {
  // Diagnostics only: measure possible alternatives without changing the selected asset.
  for (const [width, height, quality] of [[800, 550, 40], [640, 440, 35], [600, 413, 30], [480, 330, 30]]) {
    await measure(`https://images.unsplash.com/${photo}?fm=webp&fit=crop&w=${width}&h=${height}&q=${quality}`)
  }
}
assert.equal(result.status, 200)
assert.ok(result.webp, 'The selected image must be a real WebP')
assert.ok(result.bytes > 0 && result.bytes < 100000, `Selected restaurant image exceeds the 100 KB budget: ${result.bytes} bytes`)
