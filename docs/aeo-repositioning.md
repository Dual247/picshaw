# Picshaw: AEO-first repositioning

Prepared 12 October 2026. This change is a review build until merged and production is verified.

## Positioning
Primary: AEO and AI-search visibility for local service businesses, with contractors/remodelers as an initial focus. The website refresh is a supporting service, not required for every engagement.

Homepage: “Help customers find your business in AI search.”
Primary conversion: request a scope for an AI Visibility Audit.
Offer ladder: Audit → AEO Foundations → Ongoing AI Visibility.

## Commercial boundaries
- An enquiry is free; a full audit is a separately quoted service.
- No new AEO prices, minimum terms, payment authorisations or delivery guarantees have been invented.
- The existing website prices remain: $1,000 refresh, Growth Site from $2,500, Monthly Partner from $500/month. Ongoing AEO is not thrown in free.
- No platform affiliation, client endorsements, ranking results or artificial scarcity claims.
- No directory submissions, outreach messages, ads, new analytics subscriptions or payments.

## Changes
Repositioned homepage, navigation, footer, FAQ, About, blog introduction, shared article/service CTAs, social metadata and Organization schema. Added /ai-visibility-audit and /methodology. Retained all existing public URLs, four articles, four service pages, original publication dates, private-draft exclusions, logo and labelled design concepts. Sitemap now contains 13 public content routes in production and no routes in previews.

## Lead handling
Existing contact endpoint extended with audit/aeo interests; old website interests preserved. Server-side type validation and HTML escaping retained. New audit leads use an AI-visibility subject. Success requires provider acceptance, not a button click; provider acceptance is not proof of inbox delivery. No paid service starts on submission. Custom event collection stays opt-in through the existing environment flag. No personal details in event payloads. Mock tests must not send actual email.

## Validation
Run content checks, 16 mocked contact cases, targeted lint, independent TypeScript check, production build, mobile/desktop route tests, metadata/canonical/JSON-LD/sitemap checks, all new and old form flows, failure-state checks, no-JavaScript readability and legacy brand tests. Screenshots are retained as workflow artifacts. Record actual results in the pull request; a workflow start is not a pass.

The previously recorded dependency audit and full-repository lint findings in issue #7 are not resolved by this branding change. Do not claim the repository is security-cleared or full lint is clean because the scoped checks pass.

## Release
Review the preview before merging. After an approved merge, verify production title, new pages, successful deployment, canonical sitemap and crawler controls. Test real delivery only with explicit authority; do not claim inbox success from mocks. No sitemap resubmission or live account changes are required merely to preview the repositioning.

Technical copy references: https://developers.google.com/search/docs/appearance/ai-features and https://developers.openai.com/api/docs/bots (checked 12 October 2026). Source guidance does not guarantee placement or recommendations.
