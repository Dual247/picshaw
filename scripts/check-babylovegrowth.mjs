import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const memo = new Map(), modules = new Map()
let requests = 0, outage = false
const now = Date.now()
const timestamp = new Date(now - 86400000).toISOString()
const key = 'fixture-only-credential-never-for-production'
const raw = { id: 1, slug: 'new-remote-article', title: 'A useful new article & practical checklist', published: true,
  published_at: timestamp, updated_at: timestamp, languageCode: 'en-US', orgWebsite: 'https://www.picshaw.com',
  meta_description: 'A practical description of the test article.', excerpt: 'Useful guidance for service businesses.',
  content_html: '<h1 id="main-content">Imported heading</h1><p>Server rendered full article.</p>',
  jsonLd: { author: { name: 'Invented expert' }, review: { rating: 5 } } }
const remote = [raw, { ...raw, id: 2, published: false, slug: 'hidden-draft' }, { ...raw, id: 3, slug: 'future-article', published_at: '2099-01-01T00:00:00Z' }]
const transport = async input => {
  requests++
  if (outage) return new Response(key, { status: 503 })
  const url = new URL(input)
  return Response.json(url.pathname.endsWith('/articles') ? remote : raw)
}
function load(file) {
  const full = path.resolve(file)
  if (modules.has(full)) return modules.get(full)
  const result = { exports: {} }
  const source = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, resolveJsonModule: true } }).outputText
  const localRequire = name => {
    if (name === 'server-only') return {}
    if (name === 'react') return { cache: fn => fn }
    if (name === 'next/cache') return { unstable_cache: (fn, parts) => async (...args) => {
      const cacheKey = JSON.stringify([parts, args]); if (!memo.has(cacheKey)) { const value = await fn(...args); memo.set(cacheKey, value) }; return memo.get(cacheKey)
    } }
    if (name.startsWith('@/')) return resolve(name.slice(2))
    if (name.startsWith('.')) return resolve(path.resolve(path.dirname(full), name))
    return require(name)
  }
  function resolve(name) { return name.endsWith('.json') ? JSON.parse(fs.readFileSync(name, 'utf8')) : load(`${name}.ts`) }
  vm.runInNewContext(source, { require: localRequire, module: result, exports: result.exports, process, console, URL, Response, Request,
    AbortSignal, Buffer, fetch: transport, setTimeout, clearTimeout }, { filename: full })
  modules.set(full, result.exports)
  return result.exports
}
const model = load('lib/blog-model.ts')
const original = JSON.parse(fs.readFileSync('content/articles.json', 'utf8'))
const published = original.filter(a => a.status === 'published' && Date.parse(a.publishedAt) <= now)
const reserved = new Set(original.map(a => a.slug))
const localSlug = published[0].slug
const draftSlug = original.find(a => a.status === 'draft').slug
const merged = model.mergeArticles(published, [...remote, { ...raw, id: 4 }, { ...raw, slug: localSlug }, { ...raw, slug: draftSlug }, { ...raw, slug: '../escape' }, { ...raw, orgWebsite: 'wrong-site.example' }], reserved, now)
assert.equal(merged.filter(a => a.source === 'local').length, published.length)
assert.equal(merged.filter(a => a.source === 'babylovegrowth').length, 1)
assert.equal(merged.find(a => a.slug === localSlug).title, published[0].title)
assert.ok(!merged.some(a => a.slug === draftSlug || a.slug === 'hidden-draft' || a.slug === 'future-article'))
assert.equal(model.normalizeSummary({ ...raw, published: 'true' }, now), undefined)
assert.equal(model.normalizeSummary({ ...raw, status: 'draft' }, now), undefined)
assert.equal(model.normalizeSummary({ ...raw, published_at: 'nonsense' }, now), undefined)
assert.equal(model.normalizeArticle({ ...raw, content_html: '' }, raw.slug), undefined)
assert.equal(model.normalizeArticle(raw, 'mismatched-slug'), undefined)
assert.equal(model.plainText('A &amp; B <b>test</b>'), 'A & B test')
const hostile = '<h1 id="main-content">Heading</h1><h2 id="main-content">Duplicate</h2><p onclick="evil()">Safe <a href="#main-content">jump</a></p>' +
  '<script>evil()</script><style>body{display:none}</style><iframe src="https://bad.example"></iframe><svg onload="evil()"></svg>' +
  '<form action="https://bad.example"><input name="x"></form><a href="jav&#x61;script:evil()">Bad link</a>' +
  '<img src="https://images.unsplash.com/test.jpg" alt="A bright kitchen" onerror="evil()"><img src="https://example.com/missing.jpg">' +
  '<img src="data:image/svg+xml,evil" alt="Bad"><img src="https://127.0.0.1/test" alt="Bad"><a href="//bad.example">relative</a>'
const sanitized = model.sanitizeArticleHtml(hostile)
assert.ok(!/<(?:script|style|iframe|svg|form|input|h1)\b|onclick=|onerror=|javascript:|data:image|127\.0\.0\.1/i.test(sanitized))
assert.equal((sanitized.match(/<img /g) || []).length, 1)
assert.equal((sanitized.match(/id="blg-main-content"/g) || []).length, 1)
assert.ok(sanitized.includes('href="#blg-main-content"'))
assert.ok(!('jsonLd' in model.normalizeArticle(raw, raw.slug)))
const adapter = load('lib/babylovegrowth-client.ts')
const client = adapter.createReadClient(key, undefined, transport)
assert.equal((await adapter.readArticleIndex(client)).length, 3)
outage = true
await assert.rejects(() => adapter.readArticleIndex(client), error => !error.message.includes(key) && error.message.includes('unavailable'))
outage = false
let pages = 0
const batches = await adapter.readArticleIndex({ listArticles: async () => (++pages === 1 ? Array(50).fill(raw) : [raw]) })
assert.equal(batches.length, 51); assert.equal(pages, 2)
const previous = process.env.BABYLOVEGROWTH_BLOG_API_KEY
try {
  delete process.env.BABYLOVEGROWTH_BLOG_API_KEY
  const blog = load('lib/blog.ts')
  assert.equal((await blog.getBlogArticles()).length, published.length)
  process.env.BABYLOVEGROWTH_BLOG_API_KEY = key
  const before = requests
  await blog.getBlogArticles(); await blog.getBlogArticles()
  assert.equal(requests - before, 1, 'Successful index reused through cache')
  const local = await blog.getBlogArticle(localSlug)
  assert.equal(local.source, 'local')
  assert.equal(await blog.getBlogArticle(draftSlug), undefined)
  const article = await blog.getBlogArticle(raw.slug)
  assert.equal(article.source, 'babylovegrowth'); assert.ok(article.html.includes('Server rendered full article.'))
  assert.ok(!JSON.stringify(article).includes(key))
  memo.clear(); outage = true
  assert.equal((await blog.getBlogArticles()).length, published.length, 'API failure keeps local index')
  assert.equal((await blog.getBlogArticle(localSlug)).title, published[0].title, 'API failure keeps local article')
  await assert.rejects(() => blog.getBlogArticle('uncached-article'), error => !error.message.includes(key))
} finally { if (previous === undefined) delete process.env.BABYLOVEGROWTH_BLOG_API_KEY; else process.env.BABYLOVEGROWTH_BLOG_API_KEY = previous }
console.log('PASS: local preservation, duplicate/draft reservations, publication dates, sanitization, official SDK, pagination, cache reuse, missing key and API failures; credentials not emitted.')
