# Portal live acceptance: blocked until separately authorized

Local tests do not establish production readiness. The default remains disabled.
No account, recipient, credential, hosted migration, flag, or deployment is created
by this runbook or its evidence harness. An evidence JSON file is never approval.

## Preflight and permission boundary

Record the exact deployment commit and independently verified dedicated Supabase
project origin. The production portal is `https://app.picshaw.com`; preview aliases
and localhost deliberately cannot perform authentication. Test the canonical host
only after a separately approved, access-restricted pilot deployment. Do not add
a test bypass to the production origin, authentication or tenant checks.

Before the first live request, an authorized operator must verify:

1. Owner authorization for the deployment/target, two synthetic test accounts and
   their controlled email recipients, fixture writes, local/global logout and
   membership revocation, and a retention/cleanup plan. Email delivery and signup
   are external actions, not read-only verification. Never use customer accounts.
2. Exact Supabase Site URL and callback allowlist:
   `https://app.picshaw.com/platform/auth/callback`. The provider callback is the
   dedicated project's own `/auth/v1/callback`, not the application callback.
   Do not broaden allowlists or enable the SDK's experimental redirect parameters
   simply to make a test pass. The pinned SDK's default recovery callback omits
   `sb_flow_id`; its legacy verifier is still browser-bound and consumed on use.
3. Approved SMTP sender/domain and deliverability, email confirmation enabled,
   password policy, secure password-change/reauthentication settings, JWT lifetime
   and session timeout. Public Auth settings cannot establish these prerequisites.
4. Reviewed runtime migrations actually applied, least-privilege login roles and
   grants verified, TLS verified, runtime secrets in approved server-only storage,
   and distributed admission tested through Vercel's real ingress. Foundation
   tenant tables alone do not establish runtime readiness. Credential creation or
   persistent access changes require their own action-time approval.
5. No-store behavior at the actual CDN, auth/callback query and body redaction in
   logs, no analytics or marketing scripts on portal/auth pages, monitoring,
   operator rollback procedure and a tested retention policy.

PostgreSQL `FOR SHARE` on `auth.sessions` requires an UPDATE privilege even when
no value changes. The managed project may disallow this grant. Never change Auth
ownership, triggers, foreign keys or broad role privileges to work around it.
A bounded in-flight V1 replacement requires explicit READ COMMITTED enforcement,
VOLATILE functions, fresh session/account checks at entry and every successful
return, database-clock deadlines, and unchanged membership/connection locks.
SELECT/getUser checks cannot serialize with Auth's own revocation: a revocation
committed after the final check can still race the result or commit. Long source
collection must revalidate before persistence/return. The gate stays blocked until
the replacement is integrated, reviewed and validated on the actual hosted runtime;
it is not the original strict session-row-lock contract or instantaneous logout.

Keep Google and Apple disabled for an email-only pilot. Each later provider needs
separate consent/configuration review and a successful real provider browser flow.
GSC permissions and retained Google data credentials are separate from sign-in.

## Fixture and observation rules

Prefer distinct browser profiles A and B and separate controlled synthetic accounts.
If only one Chrome profile is available, use the separately coordinated in-memory
API jars and sequential browser plan in [the pilot API lab](portal-pilot-api-lab.md).
Two tabs are not separate sessions. Each account receives only its own synthetic
organization. Use `example.com` hostnames and fictional workspace names, no client
data or real business imports. Use an additional signed-out profile when available;
otherwise follow the API-lab plan and do browser cases sequentially. Private browser
state stays on the test computer; never commit or attach cookies, HAR files,
storage-state exports, raw email links, JWTs, passwords, query strings or keys.

Record only pass/fail, HTTP status, cookie **attributes/names**, row counts and
fixture labels. Redact screenshots. Do not collect a diagnostic HAR by default.
Inspect JWT claims only inside an authorized test runtime, never print them. The
issued-token/PostgREST step requires the separately reviewed private-stdin API lab
or another approved secure test transport. That lab is inert by default and keeps
generated passwords and issued tokens in memory; its synthetic tests are not live evidence.

## Required cases and expected outcomes

- `email-signup-confirmation`: eligible signup, confirmation in the originating
  browser, confirmation expiry and duplicate signup. Before confirmation, no
  workspace grant. Neutral wording must not reveal account existence.
- `email-login-and-navigation`: valid login applies Secure/HttpOnly/SameSite=Lax,
  Path=/, host-only `__Host-` cookies, then navigates to the fixed `/platform`.
  Pending confirmation does not navigate. Back/Forward and refresh stay safe.
- `invalid-and-duplicate-login`: wrong credentials, repeated clicks and interrupted
  requests produce no duplicate action or unverified signed-in screen.
- `pkce-cancel-expire-replay-and-wrong-browser`: canceled, expired, reused and
  wrong-browser callback fail. Wrong explicit flow ID cannot borrow another
  verifier. Parallel attempts may require restarting the older flow with the
  default fixed-verifier behavior; they must never mix accounts or recovery type.
- `recovery-and-password-change`: neutral recovery response, actual approved email
  delivery, same-browser callback, password update and explicit global logout.
  Test error and partial-success UI. Neither delivery nor revocation is inferred
  from a successful browser HTTP request alone.
- `reauthentication-required`: an old signed-in session must respect secure
  password-change protection. This version does not accept a reauthentication
  nonce; it fails safely and directs users to a fresh recovery link or sign-in.
  Do not disable the protection to make the test pass.
- `expired-session-refresh`: expire an authorized fixture token using approved
  test settings or wait for its natural expiry; then POST session/workspace.
  Verify the response rotates all cookies, removes obsolete chunks and succeeds
  again on the next request. No read-only Server Component refresh is assumed.
- `local-and-global-revocation`: profile A local logout, then all-device logout
  with another session of A. Confirm both Auth session termination and browser
  state. Verify 401/403/404/gateway outage never reports confirmed global success.
  Existing access tokens may remain cryptographically valid until expiry.
- `csrf-and-alias-denial`: foreign/missing Origin, foreign Fetch Metadata,
  forwarded-host spoof, marketing host and deployment alias cannot initiate any
  credential, recovery, logout or workspace action. No request reaches Auth/DB.
- `two-tenant-read-write-denial`: with real issued tokens, A can read only A's
  synthetic authorized rows, B only B's. Swap organization, connection, property,
  report and snapshot identifiers in every exposed endpoint and Data API path.
  Anonymous access, cross-tenant SELECT/INSERT/UPDATE/DELETE, and editable
  `user_metadata` role claims cannot gain access. Record zero unauthorized rows
  and zero unauthorized writes. SQL role simulations alone do not satisfy this.
- `membership-revocation`: revoke A's fixture membership through the authorized
  operator path. Already open pages and retried reads/writes must deny further
  access. Do not restore real memberships or infer authorization from the token.
- `revoked-session-workspace-denial`: revoke the fixture session while keeping an
  otherwise unexpired issued token. Workspace/persistence checks must deny it via
  current session authority. Test a concurrent operation: a transaction already
  admitted can finish only within the documented bounds. Revocation committed
  before the final fresh check must deny/roll back; revocation after that check may
  race the result/commit. Verify the actual transaction isolation, volatility and
  deadline, not just an SDK mock. No claim of instantaneous JWT invalidation.
- `concurrent-bootstrap-and-retry`: simultaneous exact create retries return one
  durable workspace; changed input does not create another. Simulate lost response
  without blindly repeating an uncertain mutation. Confirm no cross-tenant grant.
- `admission-limit-and-outage`: approved bounded test requests exercise the shared
  limit across instances and fail closed during a controlled backend failure.
  Do not load-test public services or disable production controls. Logout remains
  available while initiation is paused.
- `response-cache-isolation`: repeat A/B requests through the actual CDN. No shared
  cached authenticated response, cookie transfer, user ID or token in JSON. Verify
  the public/marketing site does not receive auth cookies or portal data.
- `fixture-cleanup`: confirm all temporary sessions revoked and fixtures handled
  according to the approved retention plan. Immutable evidence/FKs may prohibit
  normal deletion; never disable RLS/triggers, purge Auth users or cascade-delete
  records as an improvised cleanup. If cleanup is blocked, stop and report it.

For `google-oauth` / `apple-oauth`, additionally verify approved consent scopes,
real cancellation/replay behavior, exact callbacks, account isolation, and Apple
relay/secret-expiry ownership. Only add those cases when that provider is approved.

## Evidence harness

`node scripts/check-portal-live-evidence.mjs` is offline and fails closed with a
list of missing gates (exit code 2). It cannot contact a service, accept credentials,
run a live case or enable a deployment. It is a checklist-completeness validator,
not an approval system and not independent proof that an operator's claims are true.

After a separately authorized live run, store its **redacted** report under ignored
`validation/`. Use these fields:

- `commit`: exact 40-character tested commit; `projectOrigin`: independently
  verified dedicated Supabase origin; `portalOrigin`: canonical portal above.
- `execution`: `live`; `startedAt`: UTC ISO timestamp; `providers`: `['email']`
  for the initial pilot, adding another provider only after approval and tests.
- `approvals`, `configuration`, `checks`: objects keyed by the IDs exported by
  the script. Each record has `status: 'passed'`, `observedAt` (UTC ISO) and
  `evidence`: a safe redacted report/reference label such as `pilot/session-check`.
  Do not include personal identifiers, secrets, raw URLs or transcripts here.
- Approvals/configuration must precede this run by at most 24 hours. Checks must
  be observed during the run, and the run must be at most 24 hours old.

Review with `--report=validation/portal-live.json`,
`--expected-commit=FULL_COMMIT`, and `--expected-project=VERIFIED_PROJECT_ORIGIN`.
Targets must be independently supplied, not copied blindly from the report.
Missing, stale, mocked or mismatched evidence fails. Even a complete report returns
`activationAuthorized: false`. The responsible operator still verifies the source
evidence, current configuration, approvals and exact release commit before launch.

Local `npm run check:supabase` includes synthetic tests of this validator, actual
SDK/route tests with mocked HTTP transport, and component event tests. None counts
as a live case above. Existing `check:database` tests also remain SQL simulations.
