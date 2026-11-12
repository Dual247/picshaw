import assert from 'node:assert/strict'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'

const services = JSON.parse(readFileSync('content/services.json', 'utf8'))
const industries = JSON.parse(readFileSync('content/industries.json', 'utf8'))
const articles = JSON.parse(readFileSync('content/articles.json', 'utf8'))
const published = articles.filter(article => article.status === 'published' && Date.parse(article.publishedAt) <= Date.now())
const additional = ['/ai-visibility-audit', '/methodology', '/ai-receptionist', '/privacy-policy', '/ai-visibility-retainer', '/services', '/industries']
const servicePaths = new Set([...services.map(service => `/${service.slug}`), '/ai-visibility-audit', '/ai-visibility-retainer', '/ai-receptionist'])
const routes = new Set(['/', '/about', '/blog', ...additional, ...servicePaths, ...industries.map(industry => `/industries/${industry.slug}`), ...published.map(article => `/blog/${article.slug}`)])
const publicContent = [...services, ...industries, ...published]
assert.equal(services.length, 7)
assert.equal(industries.length, 12)
assert.equal(published.length, 4)
for (const route of additional) assert.ok(existsSync(`app/(marketing)${route}/page.tsx`))
assert.equal(new Set([...services, ...articles].map(item => item.slug)).size, services.length + articles.length)
assert.equal(new Set(industries.map(industry => industry.slug)).size, industries.length, 'Industry slugs must be unique')
for (const field of ['title', 'description']) {
  assert.equal(new Set(publicContent.map(item => item[field].trim().toLowerCase())).size, publicContent.length, `Published ${field} values must be unique`)
}
for (const item of publicContent) {
  assert.match(item.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  assert.ok(item.description && item.intro && item.sections.length >= 2)
  assert.equal(new Set(item.sections.map(section => section.id)).size, item.sections.length, `Duplicate section ID in ${item.slug}`)
  for (const section of item.sections) {
    assert.match(section.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    assert.ok(section.title && section.paragraphs.length)
    for (const link of section.links ?? []) assert.ok(routes.has(link.href.split('#')[0] || '/'), `Unknown link ${link.href}`)
    for (const source of section.sources ?? []) assert.equal(new URL(source.href).protocol, 'https:')
  }
}
for (const industry of industries) {
  assert.ok(industry.name && industry.summary && industry.eyebrow)
  assert.ok(industry.services.length, `${industry.slug} must link to a service`)
  assert.equal(new Set(industry.services).size, industry.services.length, `Duplicate service in ${industry.slug}`)
  for (const path of industry.services) assert.ok(servicePaths.has(path), `Unknown service ${path} in ${industry.slug}`)
  assert.ok(industry.questions.length, `${industry.slug} must answer customer questions`)
  for (const question of industry.questions) assert.ok(question.question && question.answer)
}
for (const article of articles) {
  assert.ok(['published', 'draft'].includes(article.status))
  assert.ok(Number.isFinite(Date.parse(article.publishedAt)))
  if (article.updatedAt) assert.ok(Date.parse(article.updatedAt) >= Date.parse(article.publishedAt))
  for (const slug of article.relatedServices) assert.ok(services.some(service => service.slug === slug))
  if (article.status === 'draft') assert.ok(!routes.has(`/blog/${article.slug}`))
}
const hero = readFileSync('components/Hero.tsx', 'utf8')
assert.ok(hero.includes('AI search.'))
assert.ok(!hero.includes('$1k') && !hero.includes('Every visitor who bounces'))
const report = { servicePages: services.length, industryPages: industries.length, newPages: additional, publishedArticles: published.length, excludedDrafts: articles.length - published.length, publicRoutes: [...routes], checkedAt: new Date().toISOString() }
mkdirSync('validation', { recursive: true })
writeFileSync('validation/search-content.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
