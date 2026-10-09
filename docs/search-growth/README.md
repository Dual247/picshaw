# Picshaw search-growth implementation

Created 2026-10-09 on a review branch. Do not confuse a branch/PR with a production release.

## Included
- Canonicals and shared www origin, based on a live audit showing apex -> www and a successful www response.
- Native robots/sitemap routes, production-only public sitemap, preview noindex metadata and headers.
- All seven homepage FAQ answers server-rendered in native details/summary elements.
- Four service pages, an About page, blog index, four complete initial articles and two excluded editorial drafts.
- Ordinary internal links from the homepage, header, footer, articles and services.
- Service, breadcrumb and article structured data, without invented reviews or rankings.
- Working ungated checklist article replacing the footer's fake email-success alert.
- Defensive server-side form validation and optional completed-enquiry tracking after email-provider acceptance. No promise of inbox receipt.
- No added dependencies or paid CMS. Existing brand assets, package prices and labelled design concepts remain.

## Editorial release gate
Review the four service pages, About biography and four articles in this PR before merge. The biography uses Ash's supplied account of building websites in 2005; no unrelated personal information is published. Articles are attributed to Picshaw, not falsely represented as personally authored or approved by Ash.
The content dates are 2026-10-09, the preparation date. If first publication is later, set `publishedAt` to the actual release date before merge. Set `updatedAt` only for meaningful later changes. A 'published' content record means eligible for the production build after merge, not proof that the current public domain already serves it.

## Publishing a guide
Edit `content/articles.json`. Use a unique slug, accurate title and summary, author, dates, primary intent, related services and substantive sections. Keep `status: draft` until reviewed. Drafts and future-dated items are excluded from the public list, static params and sitemap. Rebuild/redeploy when publishing; future-dated records do not automatically become live without a build. Add inline sources for external factual guidance and real examples where available. Do not create empty tags/categories or near-duplicate city pages.

## Analytics activation
The existing Vercel pageview component remains. Custom events are implemented but disabled by default. Official Vercel documentation says custom events require Pro or Enterprise; no plan change or charge is authorised here. After checking the account plan and privacy setup, set `NEXT_PUBLIC_ANALYTICS_EVENTS=true` in production and redeploy. There is no GA4 ID in the repository and no analytics account has been created.
- `review_request_started`: first focus in the contact form per mounted page.
- `phone_click`: a phone-link click, not proof of a completed call.
- `review_request_completed`: one server event after the provider accepts a validated submission. No event on errors. Analytics failure must not make a sent form look failed.
- No invented booking event. No names, emails, message text or prospect website URLs are sent as custom properties. Query strings/fragments are stripped from client event URLs.
- No new session storage, cookie banner bypass or retargeting integration.
- Attribution remains limited until an owner-approved analytics configuration exists; do not claim end-to-end campaign attribution.

## Production follow-through
1. Review and merge only after CI results and editorial approval.
2. Verify real production statuses, canonical host, all new routes, robots and sitemap.
3. Submit the working canonical sitemap in Search Console. Do not submit a preview URL or a sitemap that is not live yet.
4. Reinspect important URLs. Confirm the hosting firewall admits legitimate search crawlers; spoofed user-agent tests alone do not establish this.
5. Retain authentication on separate client preview sites; these changes do not alter draft.picshaw.com.
6. Make one authorised test enquiry and verify inbox receipt. CI mocks email and never sends a real message.
7. Confirm tracking collection in the dashboard after enabling the supported plan feature.
8. Check Google AI-inclusion settings and Bing Webmaster access separately; do not assert those account settings were changed by this PR.

## Validation
The new search-growth workflow runs content/route checks, form tests with a mocked provider, lint, full TypeScript checks, a production build and browser checks on desktop/mobile and without JavaScript. Reports and screenshots are uploaded as CI artifacts. Existing whole-repository lint/type failures are recorded separately from changed-file checks; no rules are weakened. Current build configuration already ignored TypeScript errors, so a build result alone is not evidence that type checking passed.

## Not done by this implementation
No production merge, directory signup, paid membership, paid ads, fabricated backlinks, mass email, or customer-data export. No fabricated 20-site research study. The outreach pack is a draft to send only after the promised guide is actually available at the production URL.

## Official references
- https://developers.openai.com/api/docs/bots
- https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview
- https://vercel.com/docs/analytics/custom-events
