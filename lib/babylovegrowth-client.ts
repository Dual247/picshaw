import 'server-only'
import { BlogClient } from 'babylovegrowth-next-js-blog'

export const BLOG_API_URL = 'https://api.babylovegrowth.ai/api/integrations/v1'
export const BLOG_CACHE_TAG = 'babylovegrowth-articles'
export const BLOG_CACHE_SECONDS = 3600

export function blogApiUrl() {
  // Local integration tests only. A Vercel deployment can never redirect a real key.
  const candidate = process.env.BABYLOVEGROWTH_BLOG_API_URL
  if (candidate && process.env.CI === 'true' && !process.env.VERCEL && process.env.BABYLOVEGROWTH_TEST_MODE === 'true') {
    const url = new URL(candidate)
    if (url.protocol === 'http:' && url.hostname === '127.0.0.1' && !url.username && !url.password) return url.href.replace(/\/$/, '')
    throw new Error('Invalid local blog test endpoint')
  }
  return BLOG_API_URL
}

export function createReadClient(apiKey: string, baseUrl = BLOG_API_URL, transport: typeof fetch = globalThis.fetch) {
  const origin = new URL(baseUrl).origin
  const safeFetch: typeof fetch = async (input, init) => {
    try {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.origin !== origin || !url.pathname.startsWith(`${new URL(baseUrl).pathname}/`)) throw new Error()
      const response = await transport(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(8000) })
      if (!response.ok && response.status !== 404) throw new Error()
      return response
    } catch {
      // Never log the SDK's raw errors: upstream bodies may contain credentials.
      throw new Error('The article service is temporarily unavailable')
    }
  }
  // The outer Next.js Data Cache is the single cache owner, avoiding stacked TTLs.
  return new BlogClient({ apiKey, baseUrl, revalidate: false, fetch: safeFetch })
}

export async function readArticleIndex(client: BlogClient): Promise<unknown[]> {
  const articles: unknown[] = []
  const deadline = Date.now() + 20000
  for (let offset = 0; offset < 5000; offset += 50) {
    if (Date.now() > deadline) throw new Error('The article service is temporarily unavailable')
    // Filter strictly after validation; do not trust JavaScript truthiness or discard
    // drafts before checking pagination, which can otherwise truncate the index.
    const batch = await client.listArticles({ limit: 50, offset, publishedOnly: false })
    if (!Array.isArray(batch) || batch.length > 50) throw new Error('Invalid article index')
    articles.push(...batch)
    if (batch.length < 50) return articles
  }
  throw new Error('Article index exceeds the configured 5000-record limit')
}
