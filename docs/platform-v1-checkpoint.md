# Picshaw V1 implementation checkpoint

Updated 2026-11-11 (UTC). This is a local reviewable foundation, not a launched customer pilot.

## Delivery status

This is an unlaunched implementation checkpoint for a Vercel-hosted application using Supabase database/auth. Sample screens are fictional. Repository code and local validation do not establish production provider configuration or customer readiness. Verify the exact deployment commit, environment mapping and HTTPS portal hostname before activation.

Account identifiers, billing approvals and live configuration inventories are deployment-specific and do not belong in this public repository.

## Implemented locally

- Separate Next.js marketing and workspace root layouts preserve existing public URLs. Root-to-root navigation replaces the document so marketing trackers and chat are not retained on private routes. Private pages, auth endpoints and unknown paths specify noindex, no-store and no-referrer. These protections are not authorization.
- `/platform` is a truthful setup overview. `/platform/onboarding` explains the required sequence without collecting or saving data. `/platform/preview` is a prominently fictional sample dashboard: Google Search change, sampled AI answer coverage, expandable source evidence, and a work ledger with owners, deliverables and recheck dates.
- The sample keeps Google Search, sampled AI answers and unavailable Google AI impressions separate. It does not invent leads, revenue, causation or completed real work. Current and prior Search clicks are represented by aggregate bars rather than an unsupported daily sparkline. See `docs/portal-measurement-contract.md`.
- Workspace light/dark/system controls persist across navigation and reload. Typography, contrast and narrow layouts were reviewed; mobile authentication places the form before the long desktop introduction.
- Google, Apple, email/password sign-in and email signup UI plus server-side route flows are prepared. All providers remain disabled by default and accurately labelled not active. Exact HTTPS-origin checks, bounded requests, fixed redirects, SDK PKCE exchange, Secure/HttpOnly/SameSite cookies, generic errors and fail-closed configuration are implemented. Local/global logout, verified-session refresh, recovery/reset and partial-failure handling are also implemented. Password changes request global sign-out but clearly disclose that access tokens can remain valid until expiry. A deployment abuse-admission interface fails closed until a real distributed backend is wired. No credentials, accounts, emails or real sessions were created. See `lib/supabase/README.md` for the full secure setup checklist and missing launch controls.
- Provider-independent server-only Search Console adapter: exact property IDs, read-only scope, fixed Google endpoints, final Web-search data, bounded pagination, sanitized failures and no demo fallback. Actor/organization/connection ownership is an explicit resolver contract; it is not yet backed by a membership database.
- A server-only six-snapshot journey collects separate current/prior aggregate, daily and page data through the authorized adapter boundary. It validates trusted IDs and cohorts, checks exact daily coverage, reconciles daily/property totals, freezes copied evidence and suppresses comparisons/actions on missing, bounded or inconsistent data. It never infers totals from page sums. Deterministic actions retain evidence; report contracts are not yet authenticated pages, downloads or live persistence.
- The applied Supabase foundation has eight tenant-owned tables with current-membership RLS, browser SELECT-only access, composite tenant/run/property references and append-only evidence/work/reports. There are no credentials or public shares. The second migration removes unintended default public table/sequence browser privileges without changing existing Auth grants. See `docs/tenant-database.md`.
- `lib/platform/persistence.ts` implements parameterized, pinned-session atomic persistence of a reviewed run, six snapshots, exact actions and report. Every commit/replay verifies current identity, membership, connection and a mandatory transaction-local session authority, with locked authority checks, immutable evidence, exact-cohort idempotency checks and explicit uncertain-commit/rollback outcomes. This is an injected contract, not a production driver or endpoint. Real Supabase session binding and durable operation/retry recovery are still missing; an in-memory prepared handle is insufficient for stateless Vercel retries.
- Targeted dependency hardening: Next and eslint-config-next 16.4.6, Zod 4.6.7, compatible transitive updates, exact-pinned Supabase packages and synchronized lockfiles. TypeScript errors fail builds; full lint is a required CI check. Pre-existing shared UI lint/store problems were fixed without disabling rules.

## Verified local results

- 26 mocked GSC/action/report tests plus 32 six-snapshot journey tests.
- 14 mocked Supabase helper tests plus 32 mocked authentication/lifecycle flow groups. That is 104 core/journey/auth groups, not live integration tests.
- 124 SQL policy/default-privilege assertions passed in isolated PGlite 0.5.16 with synthetic Supabase Auth roles. Static schema guardrails passed. The same 124 assertions passed on the dedicated hosted PostgreSQL database using simulated claims; anonymous HTTP requests to all eight application tables were denied. Hosted verification retained no fixture rows. Real sign-in, issued JWTs, authenticated PostgREST access and session behavior remain untested.
- 22 persistence tests execute the actual transaction SQL in isolated PostgreSQL WASM: exact commits/replays, serialized same-handle retries, failure rollback, session/tenant revocation, changed identities, lost commit confirmation and evidence conflicts. Source and session providers are synthetic. No independent multi-backend concurrency or production-driver test is implied.
- Offline public-auth readiness tests use mocked responses. The readiness CLI is offline by default; live public-settings inspection is explicit and GET-only. Verify production email delivery, exact Site URL/redirect allowlists and password protections before activation. Template auth/session flags remain off.
- Structural privacy boundary checks and HTTP checks for eight portal pages, unknown page/API 404s, nine disabled auth actions and the unconfigured callback. Expected status codes and privacy headers passed, with no marketing chat/analytics or private sitemap entries.
- React server-render tests for the portal pages and theme script, plus shared UI store tests for breakpoints, carousel cleanup and stable skeleton widths.
- Full-repository ESLint, independent TypeScript and the final production Next.js build passed. The synchronized npm lockfile passed an `npm ci --dry-run`; CI now uses `npm ci` and includes the 124 isolated database assertions, 22 persistence checks and offline readiness suite. Both lockfiles match every direct dependency spec; scripts-only edits need no lockfile change. Stale marketing workflow paths were updated to the new route group with shell-safe quoting. Workflow YAML parses successfully; remote CI was not run.
- Existing contact validation (36 cases), contact conversion, blog preservation, retainer-pricing and search-content checks passed.
- Browser review of local development and the production build covered light/dark persistence, narrow sign-in/signup/onboarding/sample/recovery/reset/session layouts, evidence keyboard expansion, navigation and Back/Forward. The final visual pass found and fixed phone-header clipping; actual browser geometry now keeps theme controls inside the header at 320, 390, 760 and 1280 viewport widths. No page-level horizontal overflow was found at those widths. The sample section navigation scrolls within its own row.
- The final production dependency audit reported zero findings on 2026-11-10; no application dependencies were added by the overnight UI/auth-flow/database-test work. Repeat the audit before deployment. This is not a claim of vulnerability-free software.
- Prior independent review found no must-fix security issue in the disabled auth, tenant schema or journey foundations. This checkpoint reran the 104 mocked core/journey/auth groups, 124 isolated SQL assertions and 22 persistence checks, plus readiness, boundary, UI and rendering checks. Persistence review found no additional material defect; required production authority/driver/concurrency tests remain launch gates.

Local review servers and generated artifacts are not deployments or remotely shareable URLs. Keep generated validation output in ignored `validation/`; never publish private operational notes as CI artifacts.

## Remaining launch gates

1. Verify the target Supabase migration history before applying changes; never reapply an existing migration. Agree retention, backup recovery and a provider-specific cost/usage plan before retaining client data. See `docs/supabase-setup.md`.
2. Confirm a fixed HTTPS portal hostname, hosting limits and preview environment isolation. Spend controls may exclude products or react after usage occurs; verify current terms rather than promising a hard cost cap. Keep production secrets out of arbitrary preview deployments. Sources: [Spend Management](https://vercel.com/docs/spend-management), [Flat-rate CDN](https://vercel.com/docs/pricing/flat-rate-cdn).
3. Configure approved Google and Apple identity providers and production email delivery securely in Supabase. The app callback and provider callback are different URLs. Do not paste secrets into chat. Apple membership and six-month client-secret rotation require explicit ownership.
4. Before real public authentication, wire and verify a real distributed abuse-admission backend, provider password/reauthentication policies, and hosting/access-log callback redaction. Live-test the prepared logout/recovery/session handlers. Future authenticated server rendering still needs response-capable refresh integration. Feature flags alone do not make sign-in production-ready.
5. Do not reapply the completed migrations. Implement invitation redemption, tenant bootstrap and privileged membership management with last-owner safeguards. Verify policies with real Auth/PostgREST sessions and two tenants. A verified identity must never grant workspace access automatically.
6. Choose the pilot Google account/property and approve retained read-only Search Console access and storage. This is separate from Google sign-in. Implement bound OAuth state/PKCE, encrypted refresh-token storage, refresh/revocation/disconnect and safe property selection. A GSC Wizard subscription is not required for the planned direct Google integration.
7. Connect the implemented atomic persistence contract to a least-privilege production pinned-session driver, revocation-safe current-session authority, durable server-owned operation/retry recovery and authorized private reads. Verify native/hosted multi-session lock races. Database constraints and isolated SQL tests alone do not prove production authorization/source completeness. Wire domain selection, work status and report rendering/export; completion is not proof of improvement.
8. Run live HTTPS end-to-end authentication, email confirmation, cookie/PKCE/replay, membership/RLS, revoked-access, partial-data, repeat-sync, disconnect/deletion and report-access tests. Approve storage/retention disclosures.
9. Verify remote CI and the exact Vercel preview commit/environment, then complete the applicable launch approval. No preview or production deployment was made here.

## Repeatable checks

- `npm run check:platform`
- `npm run check:supabase`
- `npm run check:ui`
- `npm run check:database` after the documented isolated PGlite tooling install
- `node components/platform/portal-render.test.cjs`
- `npm run lint`
- `npm run typecheck`
- `npm run build -- --webpack`
- Against the local production server: `node scripts/check-platform-http.mjs` (set `PREVIEW_URL` for a nondefault port).
- Existing contact/blog/content/pricing checks and a fresh production dependency audit.

Remote CI, live OAuth/email/session/authenticated-PostgREST tests, real Google sync and authenticated report delivery have not run. Hosted RLS SQL tests used simulated claims only. Existing unrelated marketing browser suites were not rerun end-to-end. Generated local validation artifacts belong in ignored `validation/`.

## Marketing portal entry (2026-11-11 UTC)

The homepage now introduces the portal with a condensed, code-rendered view of the existing fictional sample, not a screenshot or real customer evidence. Existing enquiry, pricing and content remain unchanged. The marketing header has a portal entry on desktop and mobile. The 1024–1279px mobile-menu visibility gap is fixed.

The public /api/platform/access GET returns only { ready: boolean }, with no-store/noindex/no-referrer. It reads no cookies or user identity. The client requests it without credentials and defaults closed on failure. Readiness requires the existing server-side auth admission gate, an enabled provider with valid configuration, and enabled session handling. At present it is false. The primary CTA therefore opens /platform/preview; the secondary login/access link opens the existing disabled /platform/sign-in view. When real auth is implemented and verified through the existing configuration, the primary CTA can become /platform/sign-up without a separate marketing override. This is UI capability, never authorization or proof of provider health. Do not enable the existing flags until their operational checks pass. Invitation redemption and tenant bootstrap remain unimplemented; authentication never grants workspace access automatically.

Google OAuth project/client provisioning, consent configuration and provider activation require separate deployment verification. No launch is established by the marketing entry.

Validation: full ESLint, TypeScript and Next production build pass. Marketing portal real React renders cover disabled/enabled CTA branches; the capability gate matrix and no-store contract pass. Existing platform core/journey/privacy boundary, UI state, Supabase foundation/flow/readiness and portal render checks pass. Local HTTP checks pass for eight private pages, unknown routes, disabled auth and callback handling. The readiness response is verified false. See node scripts/check-marketing-portal.mjs for the added regression suite.

Local browser QA covered desktop and mobile layouts, overflow at 320/390/768/1024/1280/1440px, mobile navigation at 1024px, homepage-to-login/sample links, disabled login controls and light/dark sample modes. Portal pages contained no marketing script sources; no console errors were observed. These local checks do not verify a remote deployment.

Preserved marketing checks passed: retainer pricing, search content, mocked contact handling and conversion helper tests. The legacy check-privacy.mjs browser suite could not run because its standalone Playwright dependency is absent; no browser package was installed. The local browser review above and structural/HTTP boundary checks were used instead. Screenshot images were inspected through the browser tool, but no screenshot file was exported or delivered. The new product visual is honest code-native content, not an invented screenshot asset.
