import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'

const services = JSON.parse(readFileSync('content/services.json', 'utf8'))
const articles = JSON.parse(readFileSync('content/articles.json', 'utf8'))
const published = articles.filter(article => article.status === 'published' && Date.parse(article.publishedAt) <= Date.now())
const routes = new Set(['/', '/about', '/blog', ...services.map(service => `/${service.slug}`), ...published.map(article => `/blog/${article.slug}`)])
assert.equal(services.length, 4)
assert.equal(published.length, 4)
assert.equal(new Set([...services, ...articles].map(item => item.slug)).size, services.length + articles.length, 'Unique slugs required')
assert.equal(new Set([...services, ...published].map(item => item.title)).size, services.length + published.length, 'Unique titles required')
for (const item of [...services, ...published]) {
  assert.match(item.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  assert.ok(item.description && item.intro && item.sections.length >= 2)
  assert.equal(new Set(item.sections.map(section => section.id)).size, item.sections.length)
  for (const section of item.sections) {
    assert.ok(section.title && section.paragraphs.length)
    for (const link of section.links ?? []) assert.ok(routes.has(link.href.split('#')[0] || '/'), `Unknown link ${link.href}`)
    for (const source of section.sources ?? []) assert.equal(new URL(source.href).protocol, 'https:')
  }
}
for (const article of articles) {
  assert.ok(['published', 'draft'].includes(article.status))
  assert.ok(Number.isFinite(Date.parse(article.publishedAt)))
  if (article.updatedAt) assert.ok(Date.parse(article.updatedAt) >= Date.parse(article.publishedAt))
  for (const slug of article.relatedServices) assert.ok(services.some(service => service.slug === slug))
  if (article.status === 'draft') assert.ok(!routes.has(`/blog/${article.slug}`))
}
const report = { servicePages: services.length, publishedArticles: published.length, excludedDrafts: articles.length - published.length, publicRoutes: [...routes], checkedAt: new Date().toISOString() }
mkdirSync('validation', { recursive: true })
writeFileSync('validation/search-content.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
