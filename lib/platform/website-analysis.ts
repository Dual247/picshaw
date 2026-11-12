import 'server-only'
import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import { isIP } from 'node:net'
import { Parser } from 'htmlparser2'

const MAX_BYTES = 1024 * 1024
const TIMEOUT_MS = 12_000
export class WebsiteAnalysisError extends Error {
  constructor(public readonly code: 'INVALID_URL' | 'UNSAFE_TARGET' | 'UNAVAILABLE' | 'TOO_LARGE' | 'UNSUPPORTED_CONTENT') {
    super('This page could not be analyzed safely. Check the public HTTPS URL and try again.')
  }
}
export type WebsiteAnalysis = {
  source: 'single-page-html'; url: string; requestedUrl: string; finalUrl: string; retrievedAt: string; findings: Array<{ title: string; detail: string }>;
  title: string | null; description: string | null; headings: string[]; headingCount: number;
  canonical: string | null; robots: string[]; images: number; imagesWithoutAlt: number;
  structuredDataBlocks: number; suggestions: string[]; limitations: string[];
}
function fail(code: ConstructorParameters<typeof WebsiteAnalysisError>[0]): never { throw new WebsiteAnalysisError(code) }
export function validateAnalysisUrl(input: string): URL {
  if (typeof input !== 'string' || input.length > 2048 || /[\u0000-\u0020\u007f]/.test(input)) fail('INVALID_URL')
  let url: URL
  try { url = new URL(input) } catch { return fail('INVALID_URL') }
  const host = url.hostname.toLowerCase()
  if (url.protocol !== 'https:' || url.port && url.port !== '443' || url.username || url.password || url.search || url.hash) fail('INVALID_URL')
  if (isIP(host) || host.startsWith('[') || !host.includes('.') || host.endsWith('.') || !/^[a-z0-9.-]+$/.test(host) || host.split('.').some(part => !part || part.length > 63 || part.startsWith('-') || part.endsWith('-'))) fail('UNSAFE_TARGET')
  if (/(^|\.)(localhost|local|internal|test|invalid|onion|home|lan)$/.test(host)) fail('UNSAFE_TARGET')
  url.hash = ''
  return url
}
export function isPublicAnalysisAddress(address: string): boolean {
  if (isIP(address) !== 4) return false
  const [a,b,c] = address.split('.').map(Number)
  return !(address === '168.63.129.16' || a === 0 || a === 10 || a === 127 || a >= 224 || a === 100 && b >= 64 && b <= 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && (b === 0 || b === 168 || b === 88 && c === 99) || a === 198 && (b === 18 || b === 19 || b === 51 && c === 100) || a === 203 && b === 0 && c === 113)
}
async function resolveAddress(hostname: string, remaining: number): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const records = await Promise.race([lookup(hostname, { all: true, family: 4 }), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new WebsiteAnalysisError('UNAVAILABLE')), remaining) })])
    if (!records.length || records.some(record => !isPublicAnalysisAddress(record.address))) fail('UNSAFE_TARGET')
    return records[0].address
  } finally { clearTimeout(timer) }
}
type Page = { status: number; location?: string; html: string; robots: string }
async function readPage(url: URL, deadline: number): Promise<Page> {
  const address = await resolveAddress(url.hostname, Math.max(1, deadline - Date.now()))
  if (Date.now() >= deadline) fail('UNAVAILABLE')
  return new Promise((resolve, reject) => {
    // Only this validated address may be used. TLS still verifies the original hostname.
    // No agent pooling, proxy, cookies, authorization headers or browser fetch are used.
    const req = request(url, { method: 'GET', agent: false, family: 4, maxHeaderSize: 16384,
      headers: { Accept: 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity', 'User-Agent': 'Picshaw-Page-Review/1.0' },
      lookup: (_hostname, options, callback) => {
        if (typeof options === 'object' && options.all) callback(null, [{ address, family: 4 }])
        else callback(null, address, 4)
      },
    }, response => {
      const status = response.statusCode ?? 0
      if ([301,302,303,307,308].includes(status)) {
        const location = response.headers.location
        response.destroy(); resolve({ status, location, html: '', robots: '' }); return
      }
      const type = response.headers['content-type'] ?? ''
      if (status !== 200) { response.destroy(); reject(new WebsiteAnalysisError('UNAVAILABLE')); return }
      if (!/^(text\/html|application\/xhtml\+xml)(\s*;|$)/i.test(type) || response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity' || /charset\s*=\s*["']?(?!utf-8\b|us-ascii\b)[\w-]+/i.test(type)) { response.destroy(); reject(new WebsiteAnalysisError('UNSUPPORTED_CONTENT')); return }
      if (Number(response.headers['content-length']) > MAX_BYTES) { response.destroy(); reject(new WebsiteAnalysisError('TOO_LARGE')); return }
      const chunks: Buffer[] = []; let bytes = 0
      response.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > MAX_BYTES) { response.destroy(); reject(new WebsiteAnalysisError('TOO_LARGE')) } else chunks.push(chunk) })
      response.on('error', () => reject(new WebsiteAnalysisError('UNAVAILABLE')))
      response.on('aborted', () => reject(new WebsiteAnalysisError('UNAVAILABLE')))
      response.on('end', () => resolve({ status, html: Buffer.concat(chunks).toString('utf8'), robots: String(response.headers['x-robots-tag'] ?? '').slice(0, 2000) }))
    })
    const timer = setTimeout(() => req.destroy(new WebsiteAnalysisError('UNAVAILABLE')), Math.max(1, deadline - Date.now()))
    req.on('close', () => clearTimeout(timer))
    req.on('error', error => reject(error instanceof WebsiteAnalysisError ? error : new WebsiteAnalysisError('UNAVAILABLE')))
    req.end()
  })
}
const text = (value: string, limit = 500) => value.replace(/\s+/g, ' ').trim().slice(0, limit)
export function extractWebsiteEvidence(html: string, requestedUrl: string, finalUrl: string, headerRobots = ''): WebsiteAnalysis {
  if (Buffer.byteLength(html, 'utf8') > MAX_BYTES) fail('TOO_LARGE')
  let title = '', description: string | null = null, canonical: string | null = null
  const headings: string[] = [], robots: string[] = headerRobots ? [text(headerRobots)] : []
  let headingCount = 0, images = 0, imagesWithoutAlt = 0, structuredDataBlocks = 0, inTitle = false, inHeading = false, heading = ''
  const parser = new Parser({
    onopentag(name, attrs) {
      if (name === 'title') inTitle = true
      if (name === 'h1') { inHeading = true; heading = ''; headingCount++ }
      if (name === 'meta' && attrs.name?.toLowerCase() === 'description' && description === null) description = text(attrs.content ?? '') || null
      if (name === 'meta' && ['robots','googlebot'].includes(attrs.name?.toLowerCase()) && robots.length < 20) robots.push(text(attrs.content ?? ''))
      if (name === 'link' && attrs.rel?.toLowerCase().split(/\s+/).includes('canonical') && canonical === null) {
        try { const url = new URL(attrs.href, finalUrl); if (['https:','http:'].includes(url.protocol) && !url.username && !url.password) canonical = url.toString().slice(0,2048) } catch { /* Invalid canonical is treated as missing. */ }
      }
      if (name === 'img') { images++; if (!Object.hasOwn(attrs, 'alt')) imagesWithoutAlt++ }
      if (name === 'script' && attrs.type?.toLowerCase() === 'application/ld+json') structuredDataBlocks++
    },
    ontext(value) { if (inTitle) title = (title + value).slice(0,1000); if (inHeading) heading = (heading + value).slice(0,1000) },
    onclosetag(name) { if (name === 'title') inTitle = false; if (name === 'h1' && inHeading) { if (headings.length < 20) headings.push(text(heading)); inHeading = false } },
  }, { decodeEntities: true })
  parser.write(html); parser.end()
  const suggestions: string[] = []
  if (!text(title)) suggestions.push('Review the missing HTML page title.')
  if (!description) suggestions.push('Review the missing meta description.')
  if (headingCount !== 1) suggestions.push(`Review the page heading structure: ${headingCount} H1 elements were observed.`)
  if (!canonical) suggestions.push('Review whether this page needs a valid canonical link.')
  if (imagesWithoutAlt) suggestions.push(`Review ${imagesWithoutAlt} image elements without an alt attribute. Decorative images may use an empty alt attribute.`)
  if (robots.some(value => /\b(noindex|none)\b/i.test(value))) suggestions.push('A noindex directive was observed. Confirm whether exclusion from search is intentional.')
  return { source: 'single-page-html', url: requestedUrl, findings: suggestions.map(detail => ({ title: 'Review observed markup', detail })), requestedUrl, finalUrl, retrievedAt: new Date().toISOString(), title: text(title) || null, description, headings, headingCount, canonical, robots, images, imagesWithoutAlt, structuredDataBlocks, suggestions, limitations: ['One public HTML response only; JavaScript was not executed and other pages were not crawled.', 'This is not a ranking, performance, accessibility, AI visibility or indexing audit. Robots.txt and Search Console were not checked.', 'Markup observations may differ from rendered content. Structured data blocks are counted, not validated. Suggestions require human review.'] }
}
export async function analyzeWebsite(input: string): Promise<WebsiteAnalysis> {
  const requested = validateAnalysisUrl(input); let url = requested
  const seen = new Set<string>(), deadline = Date.now() + TIMEOUT_MS
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      if (seen.has(url.href)) fail('UNAVAILABLE')
      seen.add(url.href)
      const page = await readPage(url, deadline)
      if (page.status === 200) return extractWebsiteEvidence(page.html, requested.href, url.href, page.robots)
      if (!page.location || redirects === 3) fail('UNAVAILABLE')
      url = validateAnalysisUrl(new URL(page.location, url).href)
    }
    return fail('UNAVAILABLE')
  } catch (error) { if (error instanceof WebsiteAnalysisError) throw error; return fail('UNAVAILABLE') }
}


