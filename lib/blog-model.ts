import sanitizeHtml from 'sanitize-html'
import { Parser } from 'htmlparser2'
import { z } from 'zod'
import type { Article } from './content'

export type RemoteSummary = {
  source: 'babylovegrowth'; id: number; slug: string; title: string
  description: string; intro: string; category: string; publishedAt: string
  updatedAt?: string; author?: never; language: string
}
export type RemoteArticle = RemoteSummary & { html: string }
export type LocalArticle = Article & { source: 'local' }
export type BlogSummary = LocalArticle | RemoteSummary
export type BlogArticle = LocalArticle | RemoteArticle
export const validSlug = (slug: string) => slug.length <= 180 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)

/** Extract text with a parser, not an HTML-removal regular expression. */
export function plainText(value: string, max = 1000) {
  let text = ''
  const parser = new Parser({ ontext(part) { text += `${part} ` } }, { decodeEntities: true })
  parser.write(sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }))
  parser.end()
  return text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

export function safeContentUrl(value: string, image = false): string | undefined {
  if (!value || /[\u0000-\u0020\u007f\\]/.test(value) || value.startsWith('//')) return undefined
  if (!image && value.startsWith('#')) return /^#[a-zA-Z][\w:-]*$/.test(value) ? `#blg-${value.slice(1)}` : undefined
  if (value.startsWith('/')) return value
  if (!image && /^(mailto|tel):[^<>]+$/i.test(value)) return value
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    if (url.protocol !== 'https:' || url.username || url.password || !host.includes('.') ||
      host === 'localhost' || /\.(localhost|local|internal)$/.test(host) ||
      /^[\d.]+$/.test(host) || host.startsWith('[')) return undefined
    return url.href
  } catch { return undefined }
}

/** Imported content never supplies scripts, styles, embeds, forms or page metadata. */
export function sanitizeArticleHtml(input: string): string {
  const ids = new Set<string>()
  return sanitizeHtml(input, {
    allowedTags: ['p', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption',
      'strong', 'em', 'b', 'i', 'u', 's', 'del', 'blockquote', 'pre', 'code', 'br', 'hr',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'span', 'div', 'sup', 'sub'],
    allowedAttributes: {
      '*': ['id'], a: ['href', 'title', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'loading', 'decoding', 'referrerpolicy'],
      th: ['colspan', 'rowspan', 'scope'], td: ['colspan', 'rowspan'], ol: ['start'],
    },
    allowedSchemes: ['https', 'mailto', 'tel'], allowedSchemesByTag: { img: ['https'] },
    allowProtocolRelative: false, disallowedTagsMode: 'discard',
    nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'template', 'iframe', 'object',
      'embed', 'svg', 'math', 'form', 'button', 'video', 'audio', 'head'],
    transformTags: {
      '*': (tag, attributes) => {
        const attrs = { ...attributes }
        if (attrs.id) {
          const id = `blg-${attrs.id}`
          if (/^[a-zA-Z][\w:-]*$/.test(attrs.id) && !ids.has(id)) { ids.add(id); attrs.id = id }
          else delete attrs.id
        }
        if (tag === 'a') {
          const href = safeContentUrl(attrs.href || '')
          if (href) attrs.href = href
          else delete attrs.href
          attrs.rel = 'noopener noreferrer'
        }
        if (tag === 'img') {
          const src = safeContentUrl(attrs.src || '', true)
          if (src) attrs.src = src
          else delete attrs.src
          attrs.alt = plainText(attrs.alt || '', 300)
          attrs.loading = 'lazy'; attrs.decoding = 'async'; attrs.referrerpolicy = 'no-referrer'
          for (const dimension of ['width', 'height']) {
            if (!/^\d{1,4}$/.test(attrs[dimension] || '')) delete attrs[dimension]
          }
        }
        return { tagName: tag === 'h1' ? 'h2' : tag, attribs: attrs }
      },
    },
    // Omit images lacking a genuine description rather than inventing an alt text.
    exclusiveFilter: frame => frame.tag === 'img' && (!frame.attribs.src || !frame.attribs.alt?.trim()),
  })
}

const summarySchema = z.object({
  id: z.number().int().positive(), slug: z.string().refine(validSlug), title: z.string().min(1).max(500),
  published: z.literal(true), published_at: z.string().datetime({ offset: true }),
  updated_at: z.string().optional().nullable(), languageCode: z.string().max(20),
  orgWebsite: z.string().max(2048), meta_description: z.string().max(10000).optional().nullable(),
  excerpt: z.string().max(20000).optional().nullable(), status: z.string().optional(),
}).passthrough()

export function normalizeSummary(input: unknown, now = Date.now()): RemoteSummary | undefined {
  const parsed = summarySchema.safeParse(input)
  if (!parsed.success) return undefined
  const data = parsed.data
  if (Date.parse(data.published_at) > now || (data.status && data.status !== 'published')) return undefined
  try {
    const website = new URL(data.orgWebsite.includes('://') ? data.orgWebsite : `https://${data.orgWebsite}`)
    if (!['picshaw.com', 'www.picshaw.com'].includes(website.hostname.toLowerCase())) return undefined
  } catch { return undefined }
  if (!/^[a-z]{2}(?:-[a-zA-Z]{2,8})?$/.test(data.languageCode)) return undefined
  const title = plainText(data.title, 250)
  if (!title) return undefined
  const intro = plainText(data.excerpt || data.meta_description || '', 700)
  const description = plainText(data.meta_description || data.excerpt || title, 160)
  const updated = data.updated_at && z.string().datetime({ offset: true }).safeParse(data.updated_at).success
    && Date.parse(data.updated_at) >= Date.parse(data.published_at) && Date.parse(data.updated_at) <= now
    ? data.updated_at : undefined
  return { source: 'babylovegrowth', id: data.id, slug: data.slug, title, description, intro,
    category: 'Guides & insights', publishedAt: data.published_at, updatedAt: updated, language: data.languageCode }
}

export function normalizeArticle(input: unknown, slug: string, now = Date.now()): RemoteArticle | undefined {
  const summary = normalizeSummary(input, now)
  if (!summary || summary.slug !== slug || !input || typeof input !== 'object') return undefined
  const html = (input as Record<string, unknown>).content_html
  if (typeof html !== 'string' || html.length > 500000) return undefined
  const clean = sanitizeArticleHtml(html)
  if (!plainText(clean)) return undefined
  return { ...summary, html: clean }
}

export function mergeArticles(local: Article[], remote: unknown[], reservedSlugs: ReadonlySet<string>, now = Date.now()): BlogSummary[] {
  const unique = new Map<string, BlogSummary>()
  const normalized = remote.map(item => normalizeSummary(item, now)).filter((item): item is RemoteSummary => Boolean(item))
  // Deterministic tie-breaker if an upstream response repeats a slug.
  normalized.sort((a, b) => Date.parse(b.updatedAt ?? b.publishedAt) - Date.parse(a.updatedAt ?? a.publishedAt) || b.id - a.id)
  for (const article of normalized) if (!reservedSlugs.has(article.slug) && !unique.has(article.slug)) unique.set(article.slug, article)
  for (const article of local) if (article.status === 'published' && Date.parse(article.publishedAt) <= now) unique.set(article.slug, { ...article, source: 'local' })
  return [...unique.values()].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.slug.localeCompare(b.slug))
}

export function conciseSearchTitle(title: string) {
  if (title.length <= 50) return title
  const shortened = title.slice(0, 49).replace(/\s+\S*$/, '').trim()
  return `${shortened || title.slice(0, 49)}…`
}
