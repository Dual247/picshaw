# BabyLoveGrowth connection — preview pending approval

This extends the existing `/blog`, `/blog/[slug]` and `/sitemap.xml`. It does not run the vendor scaffold, replace the theme, modify `content/articles.json`, or publish to BabyLoveGrowth. Do not merge until Ash reviews the preview.

## Configuration

Add `BABYLOVEGROWTH_BLOG_API_KEY` to the existing Vercel project's trusted Preview environment. Obtain the read key from BabyLoveGrowth Settings > Publishing > For developers > Next.js Blog. Redeploy the preview after saving it. Add Production scope only for the eventual approved release. Never prefix the credential with `NEXT_PUBLIC_`, commit it, paste it into an issue or print it. The existing canonical `https://www.picshaw.com` is retained; this adaptation does not need `NEXT_PUBLIC_SITE_URL`.

Without a read key, local articles still render and imported articles are absent. A key with no published content looks the same. The official `babylovegrowth-next-js-blog@0.2.4` read client is used directly, without its generator.

## Publishing and cache

Only strictly published records with valid non-future publication dates, valid slugs and the Picshaw website are accepted. Every local slug is reserved, including local drafts. Local content and SEO overrides take precedence; remote duplicates appear once.

The shared Next.js Data Cache revalidates hourly. Rendered blog pages and the sitemap revalidate every five minutes. This is request-driven revalidation, not a cron job: allow about an hour plus the page cache interval and a subsequent request without an explicit refresh. No deployment per article is required. Failed requests throw inside the cache rather than caching an empty successful index. Initial outages retain the local listing and articles. An uncached remote detail outage is a temporary error, not a fabricated permanent 404.

Optionally add a separate randomly generated `BABYLOVEGROWTH_REVALIDATE_SECRET` of at least 32 characters to Vercel. A trusted webhook or automation can POST to `/api/blog/revalidate` with that secret in an Authorization Bearer header. It invalidates article, index and sitemap caches but never writes files or accepts article HTML from a webhook. Without this optional secret, refresh is disabled. Use the preview hostname during review. The publication/date rules still apply after refresh.

## Content safeguards

Full article HTML is validated and sanitized on the server with an allowlist. Scripts, styles, inline events, forms, embedded frames, SVG/math and provider JSON-LD are omitted. Imported H1s become H2s and IDs are namespaced. Ordinary text, links, lists, tables, code and described images retain the site's styling. Images without genuine nonempty alternative text are omitted instead of receiving invented descriptions. The API does not provide a typed hero-image alt field, so no separate hero image is invented; use described images in the article body.

Imported BlogPosting data uses actual publication/update dates, title, description, language, the local canonical URL and Picshaw as publisher. The documented read API does not supply an author, so no author, credential, review date, rating or testimonial is invented. Existing local author and structured data are retained.

Requests use a fixed production origin, redirect protection, timeouts and generic errors. API-origin overrides work only with local loopback CI fixtures, never on Vercel. Pagination reads 50 records per page with a 5,000-record and elapsed-time safety limit; exceeding a limit fails safely rather than silently truncating the index.

## Tests and review

`node scripts/check-babylovegrowth.mjs` exercises the real SDK with mocked transport, publication filters, local/duplicate priority, pagination, sanitization, missing keys, cache reuse and outages.

`node scripts/check-babylovegrowth-integration.mjs` starts a local fixture API, builds the actual application, and publishes two fixture articles after that same build. It checks full server-rendered HTML with JavaScript disabled, unchanged SEO overrides, metadata/schema, canonical URLs, sitemap inclusion, draft/future/wrong-site exclusions, desktop/mobile layout, authenticated refresh, outages and credential non-exposure. Generated fixture credentials stay local and are never sent to BabyLoveGrowth. Screenshots are labelled integration-test content, not real publications.

Review the Vercel preview and one real published article after adding the Preview read key. The preview sitemap remains empty/noindexed under the existing preview policy; sitemap inclusion is tested in production mode against fixtures. Only after approval should this branch be merged and regular publishing enabled in BabyLoveGrowth. The real account connection is not established by mock tests alone.

Official documentation: https://www.babylovegrowth.ai/docs/integrations/nextjs-blog
