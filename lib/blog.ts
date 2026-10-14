import 'server-only'
import { createHash } from 'node:crypto'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import articleData from '@/content/articles.json'
import { getArticle, getPublishedArticles } from '@/lib/content'
import { mergeArticles, normalizeArticle, validSlug, type BlogArticle } from '@/lib/blog-model'
import { blogApiUrl, createReadClient, readArticleIndex, BLOG_CACHE_SECONDS, BLOG_CACHE_TAG } from '@/lib/babylovegrowth-client'

// Reserve every local URL, including unpublished drafts. Remote imports never replace them.
const reservedSlugs = new Set(articleData.map(article => article.slug))
function readers() {
  const apiKey = process.env.BABYLOVEGROWTH_BLOG_API_KEY?.trim()
  if (!apiKey) return undefined
  const baseUrl = blogApiUrl()
  // Isolate caches on key rotation without including the secret itself in cache keys.
  const scope = createHash('sha256').update(`${baseUrl}\n${apiKey}`).digest('hex')
  const client = createReadClient(apiKey, baseUrl)
  return {
    index: unstable_cache(async () => {
      try { return await readArticleIndex(client) }
      catch { throw new Error('The article index is temporarily unavailable') }
    }, ['picshaw-blg-index-v1', scope], { revalidate: BLOG_CACHE_SECONDS, tags: [BLOG_CACHE_TAG] }),
    article: unstable_cache(async (slug: string) => {
      try { return await client.getArticleBySlug(slug) }
      catch { throw new Error('The article is temporarily unavailable') }
    }, ['picshaw-blg-article-v1', scope], { revalidate: BLOG_CACHE_SECONDS, tags: [BLOG_CACHE_TAG] }),
  }
}

export const getBlogArticles = cache(async () => {
  let remote: unknown[] = []
  try { remote = await readers()?.index() ?? [] }
  catch { /* Local content remains available. Failed fetches are not cached as an empty index. */ }
  // Dates are checked outside the cache so future entries never leak prematurely.
  return mergeArticles(getPublishedArticles(), remote, reservedSlugs)
})

export const getBlogArticle = cache(async (slug: string): Promise<BlogArticle | undefined> => {
  if (!validSlug(slug)) return undefined
  if (reservedSlugs.has(slug)) {
    const local = getArticle(slug)
    return local ? { ...local, source: 'local' } : undefined
  }
  const reader = readers()
  if (!reader) return undefined
  // Do not turn an upstream outage into a misleading permanent 404 for a real article.
  const remote = await reader.article(slug)
  return normalizeArticle(remote, slug)
})
