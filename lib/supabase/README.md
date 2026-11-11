# Picshaw authentication: prepared, not activated

Google, Apple, email/password sign-in, signup, recovery, password update, session
checks and logout have reviewable UI and server-side flow code. All auth/session flags in `.env.example` are false. Local mocked tests do not establish live signup, login, email delivery or customer readiness. The sample workspace is fictional.

## Deployment readiness

Use a dedicated Supabase project and an exact approved HTTPS portal origin. Provider callbacks use `https://PROJECT-REF.supabase.co/auth/v1/callback` (or a verified custom Auth domain); the application callback uses `https://PORTAL-HOST/platform/auth/callback`.

Before activation, verify provider enablement, confirmation requirements, SMTP/sender identity, Site URL/redirect allowlists, CAPTCHA/abuse controls, password protections, session timeout and JWT expiry. Public Auth settings are not a privileged configuration audit and `email=true` is not proof of deliverability.

Keep configuration in approved environment-specific secret storage. Do not publish account inventories, real project identifiers, credentials or local configuration contents. The tracked `.env.example` supplies blank project values and disabled flags. Verify anonymous and authenticated PostgREST behavior independently; SQL role/claim simulations are not issued JWT or browser-session tests.

## Routes and fail-closed configuration

- `/platform/sign-in` and `/platform/sign-up`: accessible forms and provider
  logos. Options unavailable in server configuration are disabled, with setup copy.
- POST `/api/platform/auth/google`, `apple`, `sign-in`, `sign-up`: a bounded JSON
  body, exact configured HTTPS request origin AND Origin header, same-origin Fetch
  Metadata where present. Disabled/missing config returns 503 before creating an SDK
  client. GET cannot initiate sign-in. Origin validation does not trust forwarded hosts.
- `/platform/forgot-password`, `/platform/reset-password`, `/platform/account`:
  recovery/reset forms and session controls, disabled until their setup is ready.
- POST `/api/platform/auth/recover`, `reset-password`, `session`, `sign-out`,
  `sign-out-all`: the same origin/body/privacy boundaries. `session` is the only
  explicit session-check/refresh endpoint and returns no user ID, email or tokens.
- GET `/platform/auth/callback`: exchanges a code through the SSR SDK's PKCE
  verifier cookie and optional validated `sb_flow_id`. Errors redirect to a fixed
  sign-in error state; success redirects to `/platform`, or `/platform/reset-password`
  only when the SDK returns recovery redirectType and lifecycle/email are enabled. Incoming `next`,
  `returnTo`, provider error strings and forwarded hosts never choose destinations.
- `PIC_SHAW_AUTH_ORIGIN` must be the approved exact HTTPS hostname origin. No HTTP,
  localhost bypass, credentials, paths, ports or wildcard. Separate server-only
  `PIC_SHAW_AUTH_{GOOGLE,APPLE,EMAIL}_ENABLED=true` flags opt in after setup/testing.
  They are operator gates, not automatic provider-configuration verification.
  `PIC_SHAW_AUTH_SESSION_ENABLED` separately gates checks, logout and password update;
  it can remain enabled during a provider pause so existing sessions can be revoked.
  All four flags are false in the template. A provider flag cannot bypass the
  missing distributed admission adapter; initiation UI remains unavailable too.

Project URL and modern `sb_publishable_` key are validated lazily. No service-role,
legacy JWT or secret key is accepted. Provider secrets belong in Supabase settings,
never the repository, public environment variables, application responses or chat.

## Authentication boundary

The request-scoped SSR client owns PKCE challenge/verifier creation and cookie
storage. Supabase Auth owns provider OAuth state validation and the upstream
provider callback. Never replace this with a hand-built state/verifier or accept
an arbitrary OAuth URL. The route accepts only its configured project's exact
`/auth/v1/authorize` endpoint for Google/Apple initiation.

Every handler response, including errors and redirects, gets private/no-store,
no-referrer and noindex headers. All SDK cookie writes and options are retained
on the final response, including verifier deletion after a failed exchange.
An in-request cookie view is updated on every write so later SDK operations can
read and remove newly rotated cookie chunks in that same request.
Session and verifier cookies are Secure, HttpOnly, SameSite=Lax, Path=/; no browser
Supabase client is used. Upstream fetch is no-store and rejects redirects. HTTPS
is required to test real cookies. No credentials, session objects, tokens, raw
provider errors or callback codes are logged or returned in JSON.

Signup requires a 12–128 character password and a bounded email; sign-in accepts
existing shorter passwords. The app does not trim passwords. Signup responses
avoid claiming an account was created or revealing duplicate accounts. Configure
matching or stricter password policy on Supabase. Email confirmation uses the
default confirmation-link PKCE flow; open the link in the originating browser.
Cross-browser confirmation needs a separately designed token-hash confirmation
flow and is not implemented here. Do not change the email template to an unbuilt
`/auth/confirm` endpoint.

`requireVerifiedActor` uses `getUser()`, returning only a server-verified UUID,
never editable user metadata. **This is not tenant authorization.** These auth
handlers do not grant memberships or customer-table access. The database/RLS work
and its latest verification status are described in `docs/tenant-database.md`.
Google business-data permission/token storage is not implemented by this sign-in flow.
An account must never unlock customer data automatically.

## Session lifecycle and recovery

The `/session` POST calls `getUser()` on a response-capable request-scoped client.
The SDK can refresh an expired session and write cookies to that exact response.
It returns only `signed-in`, `signed-out` (missing/rejected session, HTTP 401), or
`unknown` (transient/upstream verification failure, HTTP 503). Unknown never means
successful sign-out and never unlocks a workspace. There is no background polling,
browser SDK, broad refresh proxy or authenticated page read. The session screen
checks only on explicit button press. Auth route operations also retain SDK refresh
writes. Future authenticated server rendering still needs a response-capable
refresh design before streaming; this endpoint alone does not secure such pages.

Local logout calls `signOut({ scope: 'local' })`; all-device logout verifies the
current account and calls `scope: 'global'`. All SDK deletions, including chunked
cookies, are retained on success AND errors. A failed SDK call may already have
cleared browser cookies or may have retained them; the UI reports uncertainty,
never unconditional clearing/revocation. Existing JWT access tokens may remain
valid until expiry even after refresh sessions are revoked. Sensitive future APIs
need the appropriate session/authorization checks and short approved JWT lifetimes.

Recovery calls `resetPasswordForEmail` with the fixed callback and returns neutral
eligibility wording for success/account-specific error results. It never asserts
email delivery or reveals whether an address exists. Same-browser PKCE is required.
Callback recovery classification uses only the SDK result from the verifier flow,
not query parameters or user metadata. Installed SDK source returns `redirectType`
even though its public `AuthTokenResponse` type omits it; code narrows this property
at runtime and the mocked regression test covers it. Recheck this on SDK upgrades.

Password update requires a verified non-anonymous account and the 12-128 character
policy, then calls `updateUser({ password })`. It supports either a recovery session
or an already signed-in account, not a query-controlled recovery bypass. Configure
Supabase secure password change/reauthentication and test it before activation.
If a fresh challenge/nonce is required, the route fails safely and asks for a new
recovery link; it does not disable that server protection. After a successful update,
the route requests global sign-out. If this fails, it explicitly reports that the
password changed but revocation is unconfirmed, directing the user to session controls.

## Distributed abuse-admission adapter: not wired

`lib/supabase/auth-admission.ts` exports a server-only `AuthAdmission` interface:
`({ action, request }) => Promise<{ status: 'allow' | 'limited' | 'unavailable' }>`.
The production function currently always returns `unavailable`. Tests inject a mock
guard through server-only function dependencies; HTTP callers cannot supply one.
`authAdmissionConfigured=false` is a UI readiness signal only, not a security bypass.
Changing environment flags or creating database tables does not implement this guard.

Login, signup, OAuth initiation, recovery and password update must receive an explicit
allow before any SDK client is created. Limited returns 429; unavailable/throw returns
503. Session inspection and logout bypass this initiation guard so users can revoke
sessions during an outage, but still require exact origin and lifecycle configuration.

Choose/approve the deployment ingress and distributed backend first. Implement trusted
client identification (never trust arbitrary forwarded IP headers), atomic shared
limits across instances, email/account abuse controls without storing plaintext PII,
expiration, outage behavior and privacy-safe telemetry. Do not transmit raw passwords,
request bodies, cookies or tokens to a limiter. Strip/verify any edge assertion, prevent
direct-origin bypass, and test concurrency and backend outages. No in-memory counter,
client-controlled header or operator "verified" switch is acceptable enforcement.
No provider, paid service, backend or rule was created here. This remains a concrete
activation blocker, not a working rate-limit integration.

## Secure setup checklist

This is not a request to paste secrets into chat.

1. Confirm the intended dedicated project and environment-specific public configuration.
   No user needs to paste Supabase keys into chat. Still choose the final production
   HTTPS hostname and hosting/ingress, plus an approved sender identity and deployment
   abuse backend. Do not activate from local preview configuration.
2. Configure Supabase Site URL for that hostname and allow only the exact
   `https://FINAL-HOST/platform/auth/callback` app redirect. Avoid broad production
   wildcard redirects. The provider's callback is a **different** URL: copy the
   actual `https://PROJECT-REF.supabase.co/auth/v1/callback` from Supabase (or the
   verified custom Auth domain). Do not guess either hostname.
3. Google: create/choose the approved Web OAuth client and consent screen. Configure
   authorized website origin and the Supabase provider callback. Enter the Google
   OAuth client ID and client secret directly into Supabase's secure Google provider
   form. Keep scopes to sign-in only. This does not authorize Google Business Profile,
   Search Console, Analytics, Gmail or other business-data access.
4. Apple web OAuth: approved Apple Developer membership, Team ID, Sign in with
   Apple-enabled App ID, associated Services ID (web client ID), Key ID and a secure
   `.p8` signing key. Configure the Services ID website domain to the Supabase Auth
   domain and Return URL to its `/auth/v1/callback`. Generate the Apple client-secret
   JWT using an approved secure/local signing workflow and enter the Services ID
   and generated secret in Supabase's Apple provider form. The signing key must not
   be pasted into chat or committed. Keep the Services ID first if multiple client
   IDs are configured. Register approved email sources for Apple's private relay.
   Apple web secrets expire after at most six months: record actual expiry and
   an owner, rotate before expiry, test replacement and store the `.p8` securely.
   The `.p8` is not itself the expiring six-month client-secret JWT. Revoke/replace
   a compromised or lost key. No reminder or credential setup has been performed.
5. Email: approve SMTP service and sender identity/domain, securely configure SMTP
   credentials in Supabase, verify required SPF/DKIM/DMARC and relay sender settings,
   enable confirmation emails, configure safe redirects and test deliverability.
   Required SMTP inputs: host, port, username, password/API credential, From email
   and sender display name. Enter secrets directly in Supabase's secure SMTP form,
   not chat or tracked files. The default Supabase mail service is not a production
   SMTP plan: current docs restrict it to project-team recipients and two messages
   per hour, with no delivery SLA. This does not establish whether this project's
   custom SMTP is configured. No emails were sent. Verify confirmation, duplicate
   signup, expired links and generic error UX with approved test recipients.

### Google pilot audience and scope distinction

Basic Picshaw Google sign-in requests identity only. It must remain separate from
a future Search Console connection requesting
`https://www.googleapis.com/auth/webmasters.readonly` and retained offline access.
The broader `webmasters` scope is read/write and is not needed for the proposed pilot.

Google's current [audience guidance](https://support.google.com/cloud/answer/15549945)
allows an External app in Testing with up to 100 named test users; authorizations
and offline refresh tokens normally expire after seven days. Its exception for
only name/email/profile scopes (`openid`, `userinfo.email`, `userinfo.profile`,
or their equivalents) removes the named-test-user requirement, warning and seven-day
expiry. Adding GSC read-only scope is outside that exception. Therefore a named-user
GSC pilot need not wait for full public-production verification, but must plan to
reconnect weekly, respect account/admin restrictions and show test-status warnings.
Broader public launch needs the applicable branding/data-access review. We have not
verified a deployment-specific Google consent app, its audience, scopes or verification status.
Do not present them as configured or verified. See also Google's
[refresh-token expiry documentation](https://developers.google.com/identity/protocols/oauth2)
and [Search Console authorization scopes](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing).

## Launch gates: not production-ready merely by setting flags

Before enabling real public authentication, add and verify:

- Distributed abuse/rate limiting for login, signup and OAuth initiation, upstream
  limits, CAPTCHA/bot protection where needed, password/recovery policy and support.
  Origin checks prevent browser CSRF, not automated abuse. No in-memory rate limiter
  is presented as production protection. Edge/proxy request-size/time limits too.
- Live verification of the implemented logout/recovery/reset/session-check flows,
  secure password-change/reauthentication configuration, and response-capable
  refresh integration before any future authenticated server rendering.
  There is no refresh proxy because no page reads authenticated data. Do not
  add a read-only cookie client and swallow write failures. Future proxy refresh
  must update request and response cookies and preserve headers on replacements.
- Explicit workspace invitations/membership authorization, RLS on all exposed
  tables, cross-tenant denial checks and approved onboarding. Identity alone cannot
  satisfy this gate. No client-data endpoint is exposed by this implementation.
- Live HTTPS staging QA of cookies, PKCE/state, canceled/expired/replayed callbacks,
  parallel/repeated login attempts and browser navigation, provider allowlists,
  multi-user isolation, email confirmation, refresh/revocation and CDN no-store.
  Secret/callback-query redaction in hosting/access logs; no analytics on auth pages.
- A deliberate provider activation review, one flag at a time. Local tests do not
  establish that credentials, a provider, SMTP or Supabase itself are functioning.

## Verification and sources

Run `npm run check:supabase`, typecheck, lint, build and platform boundary checks.
Additional readiness tooling:
- `node scripts/check-supabase-readiness-tests.mjs`: mocked tests, no network.
- `node scripts/check-supabase-readiness.mjs`: offline inspection of `.env.local`,
  prints only safe configuration booleans; it does not activate anything. Pass `--expected-origin=https://PROJECT-REF.supabase.co` to verify a match even offline; without it, `dedicatedProjectMatches` is false.
- `node scripts/check-supabase-readiness.mjs --live --expected-origin=https://PROJECT-REF.supabase.co`: explicit
  read-only GET of the independently confirmed project public Auth settings endpoint. Replace `PROJECT-REF` with the approved 20-character project reference. The exact HTTPS origin must match the inspected configuration; paths, ports, credentials, custom domains and redirects are rejected. Sends only the
  existing publishable key to its own project, rejects redirects and prints selected
  booleans. Unknown management settings remain null. No account/email/token requests.

Tests transpile modules, mock SDK/Auth responses and forbid live SDK/network
calls. They verify config gates, validation, origin policy, route outcomes, cookie
propagation and response isolation, **not** actual OAuth, browser sessions or RLS.
Dependencies stay exactly pinned: `@supabase/ssr` 0.12.7, `@supabase/supabase-js`
2.119.0; both package lockfiles retained. Node 22+ is required.

Current documentation reviewed 2026-11-10:
- https://supabase.com/changelog.md (TLS cipher change and Node 20 deprecation relevant)
- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://supabase.com/docs/guides/auth/server-side/advanced-guide
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/social-login/auth-apple
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/reference/javascript/auth-exchangecodeforsession
- https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/password-security
- https://nextjs.org/docs/app/api-reference/functions/next-response

Next 16.4.6 installed response types/source, the installed route-handler guide in
`node_modules/next/dist/docs/`, and current NextResponse docs were reviewed. Routes mutate response cookies,
not read-only Server Component cookie stores. No proxy is needed for these explicit
POST response handlers. Auth-js source was inspected for logout and recovery behavior.

Installed SDK sources/types confirm PKCE defaults, optional flow ID exchange, and
`setAll(cookies, headers)`. The wrapper enforces privacy headers on every write and
every handler response, including when the SDK emits no cookie changes.
