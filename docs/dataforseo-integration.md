# Picshaw DataForSEO integration foundation

Status: local, unconnected provider adapter. Not deployed, not an end-to-end integration. No provider account, credential, payment, or paid request was created or used. Existing HTML analysis is unchanged.

## Product fit

Picshaw's existing `lib/platform/website-analysis.ts` reviews one HTML response and explicitly does not measure AI visibility. Keep that technical evidence separate. Add an AI visibility evidence panel populated by provider observations, not an invented readiness score.

Start with DataForSEO LLM Mentions: a domain citation lookup across separately labeled Google AI Overview and ChatGPT datasets. Show questions, safe citation links, model, observation date, retrieval date, location, language, sampled rows and total matches. Empty results mean no records in this dataset, not zero visibility. The provider says its database is continuously enriched with a full update cycle of 60 days. This initial adapter intentionally scopes to US/English, and queries sources rather than conflating unused search results with final citations.

Future stages: LLM Scraper for controlled prompt benchmarks (ChatGPT/Gemini interfaces), Google SERP/AI Mode for search presence, OnPage/Lighthouse for crawl/performance evidence. LLM Responses are model API experiments and should not be represented as the consumer UI experience. API coverage does not replace first-party Search Console/analytics for customer traffic.

## Verified commercial facts (2026-11-12)

- LLM Mentions: $0.10/task + $0.001/returned row. Default 20-row maximum costs up to $0.12 at current published rates; 100 rows $0.20. Two platforms queried separately at 20 rows each: up to $0.24. 100 such two-platform snapshots: $24, excluding tax, other services and hosting.
- LLM Scraper: $0.0012 standard result, $0.0024 priority, $0.004 live. Listed latency: up to 45 minutes, 5 minutes, and 120 seconds on average respectively.
- API pricing is pay-as-you-go; minimum account funding is $50. General terms also cover subscription products; do not enable auto-recharge or subscriptions implicitly.
- First-time API-credit purchase has a 30-day refund policy. Duplicate-task/user integration errors are not refundable. SERP-data usage restrictions apply. Confirm commercial terms and acceptable use before launch; this is not a legal clearance.

Sources:
- https://dataforseo.com/pricing/ai-optimization/llm-mentions
- https://dataforseo.com/pricing/ai-optimization/llm-scraper
- https://dataforseo.com/pricing
- https://dataforseo.com/help-center/making-a-payment-changing-details-refunds
- https://dataforseo.com/terms-of-service
- https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/search_mentions/live/

## Current implementation (local, not deployed)

The isolated pilot now includes a server-only provider adapter, authenticated durable jobs, normalized saved evidence and an AI visibility panel. The existing HTML analysis remains separate. New routes and UI are disabled by default. No credentials, hosted migration or real provider call has been configured or executed.

- `/platform/ai-visibility` resolves the authenticated workspace and provides an explicit domain/platform consent step, a 20-row lookup, and read-only recovery of the last saved result. Provider strings render as plain text; links are sanitized. Observation dates, retrieval dates and no-data limitations remain visible.
- POST `/api/platform/ai-visibility/submit` persists a job before one provider call. Its 180-second route budget covers the bounded 125-second provider timeout. This is synchronous durable execution, not a distributed scheduler. A crashed or uncertain dispatch is never automatically reclaimed or retried.
- POST `read` and `latest` only read stored results. Re-login can recover the original user's result. Same-workspace users cannot read another user's saved evidence. Every result requires fresh session/membership checks, including after provider completion.
- Server-side workspace identity determines the domain. Browser job IDs are only idempotency keys. The approved-domain allowlist, production-host/pilot gate and explicit feature flag are mandatory. API credentials never reach the browser.
- The provider endpoint is fixed to `search_mentions/live`. It validates echoed target/platform/location/language, status and bounded response content; raw answers are not saved. A single uncertain request cannot trigger a retry.
- Two private RPC-only migrations implement durable jobs and globally serialized account/workspace lifetime budgets. Both runtime and owner roles start NOLOGIN. Budget rows start disabled and zero. The runtime cannot directly access tables.
- Reservations atomically consume budget before network work. Any reserved or uncertain claim freezes new reservations globally. Trusted settlement records known cost even after session expiry or access revocation. It never releases unknown charges or reduces consumed budget. Saved-result completion requires the matching confirmed accounting record.
- Published estimates are not provider-enforced billing caps. Recheck rates immediately before paid use. Reconcile unknown or overage accounting operationally without resubmitting a request. Provider-side spending limits must be checked where supported.

## Local validation

The desktop worktree `platform-dataforseo` is authoritative; older cloud patches are stale. Full TypeScript, ESLint and production webpack build passed with the new routes. The existing repository uses a dependency junction incompatible with the default Turbopack build, so use `node node_modules/next/dist/bin/next build --webpack`.

`check:dataforseo` runs provider, runtime, authenticated handler, orchestration, job handler, panel, integrated runtime/SQL and both database test suites. It passed without network requests or real credentials. This includes 13 provider scenarios, 19 ledger scenarios and 22 durable-job scenarios. The integrated test uses actual migrations and runtime code with a synthetic provider: completion, exact cost settlement, dedupe, read-only recovery, re-login cached submit and in-flight membership revocation all passed. Existing database checks passed 110 tenant and 14 default-privilege assertions; migration guards now expect eight migrations.

Single-instance PostgreSQL WASM tests do not establish multi-connection contention, hosted JWT or pooler behavior. Browser visual QA, real provider schema/billing verification and production end-to-end operation remain outstanding. A supplemental dashboard transport/lifecycle test passed in the cloud; its desktop transfer is pending a supported file-transfer runtime.

## Activation gates and authorized scope

The owner approved server-side DataForSEO login/password provisioning in Picshaw Vercel for ongoing access, and two initial lookups for public picshaw.com, US/English, one Google AI Overview and one ChatGPT, capped at 20 rows each and $0.24 combined, without retries or auto-top-up. No secrets are stored in this document. Do not increase that scope or infer recurring paid use.

Before activation:

1. Complete independent review, preserve latest production main (including the exact revoked-membership 403 fix), and integrate the separately reviewed owner-access change. Do not broaden pilot identity gates from this feature.
2. Obtain separate approval for applying both private migrations and activating/storing the limited database login for ongoing access. Verify the Picshaw Supabase/Vercel projects and minimum privileges. Never use an administrator/service-role credential as runtime authority.
3. Prove true concurrent reservation/idempotency and revocation behavior with separate PostgreSQL connections before any paid provider call. Configure the global and intended workspace limits for the exact approved test only.
4. Securely provision API and database credentials through an approved handoff, not command logs, source files or public variables. Default feature flag remains off until all gates pass.
5. Reverify provider rates, current endpoint, billing limits and terms. Run only the two approved calls, reconcile actual charges and attribution, and stop on any uncertain outcome or material change.
6. Verify the authenticated owner UI and saved-result recovery before reporting that the tool is live. No public URL currently demonstrates this local feature.