# AI receptionist service page

## Scope

Adds `/ai-receptionist` as a complementary Picshaw service, preserving the AEO-first homepage proposition, existing logo, dark/orange design tokens, public URLs, articles and draft exclusions.

The page promotes a **founding-pilot enquiry**, not a live voice product. It includes a clearly labelled illustrative plumbing conversation, capabilities, setup process, pricing, eight FAQs, an enquiry form and a link back to the AI Visibility Audit. No fabricated customer, testimonial, recovered-revenue metric, guaranteed availability, working voice demo or vendor endorsement is claimed.

## Commercial copy

User-supplied proposed test price: **USD $500 setup + $399/month, 500 included minutes, $0.50 per additional minute**. Shown as a founding-pilot guide price. Exact scope, applicable taxes, bespoke integrations, review cadence and terms are confirmed in the proposal. No checkout, subscription creation, number purchase or paid vendor provisioning is included.

## Implementation

- Server-rendered page and native `details` FAQs. No external images, autoplay audio, new SDK or additional dependency.
- Reuses the existing site metadata helpers and organisation identity; adds Service, BreadcrumbList and FAQPage structured data. FAQs have one source of truth in `lib/receptionist.ts`.
- Adds the page to `additionalPagePaths`, feeding the production sitemap while retaining preview exclusions.
- Adds desktop/mobile navigation, contextual receptionist-page CTA, footer service link and a secondary homepage panel. Other pages retain their audit CTA.
- Dedicated `ReceptionistEnquiry` posts `service_interest: receptionist` to the existing `/api/contact` endpoint and existing `hello@picshaw.com` recipient.
- Website optional only for receptionist enquiries. Name, business and email required for that flow. Existing website/audit requirements are preserved. User-provided text remains HTML-escaped.
- Analytics event `receptionist_enquiry_completed` only after email-provider acceptance, and only under the existing production/opt-in environment gates. No lead details go to analytics. This means accepted delivery, not guaranteed inbox receipt.
- Submission has duplicate-click protection, a timeout, visible success/error states, retained values after failure and a no-JavaScript email fallback.

## Not implemented / before activating customer calls

This PR is a marketing/enquiry page, not a Vapi integration. Before advertising a callable demo or activating customer service: confirm the relevant provider commercial permissions; provision and test the actual voice workflow; agree AI notices and recording/transcription consent, retention and deletion for the launch location; authenticate tool endpoints; implement idempotent actions; verify calendar results; configure carrier fallback, spending controls and escalation; and confirm the customer proposal and payment terms. The illustrative call must not be relabelled as a real demo.

Confirm production Resend configuration and inbox delivery with an explicitly approved real smoke test. Automated tests mock delivery and must not send real emails or invoke voice providers.

## Review and publication

Review the branch/PR preview before merge. Creating this page does not publish it to production. Existing full-repository lint, dependency and stale-lockfile findings tracked by issue #7 are separate; this change does not claim to resolve them. Automated test status must be read from this PR's actual run before asserting that it passed.
