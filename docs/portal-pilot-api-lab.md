# Restricted pilot API lab and single-profile browser QA

This is preparation, not live evidence or permission. The API lab is inert until
an operator supplies its verified target and runs individual commands. It has no
browser automation, SQL, service/admin key, runtime database password, hosted
setting change, account deletion, file output or background work. Do not deploy it
as a route. Its approval booleans cannot grant or replace owner authorization.

## Minimal live scope

Use only `hello+portal-test-a@picshaw.com` and `hello+portal-test-b@picshaw.com`.
The operator must already have approved their signup/verification emails,
synthetic workspace creation and local/global logout. Membership revocation is a
separate exact operator action. Expected-denial insert/update probes need approval
for those two fixture targets. The lab never sends a DELETE. It never contacts
Google, creates OAuth credentials or imports real business data.

Verify the deployed commit, pilot mode, exact email-to-Auth-ID pins, canonical
callback, approved SMTP, hosted role/RLS invariants, ingress and log redaction.
Keep customer/public mode and unapproved providers disabled. No test bypasses
production origin, admission, PKCE, session or membership checks.

## Private stdin and process lifetime

Run the local script from its worktree with Node 24:

`node scripts/run-portal-pilot-api-lab.mjs`

No arguments or environment credentials. Do not use shell interpolation, here
strings, files, shell/REPL history, redirected transcripts, HARs, debug/inspector
flags, heap dumps or HTTP tracing to provide or observe secret material. The lab
does not print passwords, tokens, cookies, IDs, addresses or raw provider errors.
It prints only fixed case labels, pass/fail/pending/blocked and expiry wait seconds.

The desktop's non-PTY exec closes stdin. Use its retained PTY (`tty: true`): the
script switches stdin to raw/no-echo mode before the readiness message. Wait for
`disabled-until-reviewed-init-command`. Before any real input, send one JSON line
`{"action":"canary","value":"a fresh synthetic canary"}` through private stdin.
Verify the tool output contains only `private-stdin-canary-received-not-echoed`,
not the canary value. If it echoes or private stdin is unavailable, stop. Never
fall back to a command-line secret, file, clipboard archive or HTTP listener.

There is also a true pipe mode for a separately reviewed private controller.
Do not use the noninteractive closed pipe for a live run. On this desktop the
no-echo retained-input mechanism was checked with synthetic values only.

After operator approval, the init JSON line contains `action: "init"`,
`reviewedLiveScope: true`, the independently verified `projectOrigin` and that
project's **publishable** key. Never supply a service-role/secret key or database
password. The only allowed hosts are `https://app.picshaw.com` and that exact
`https://<20-letter-project-ref>.supabase.co` origin. Redirects are handled manually
only for the reviewed verification-to-portal callback path. TLS is not bypassed.

Keep the same process alive. Passwords are generated once inside it and are not
exportable. Every HTTP cookie jar, PKCE verifier, issued token and fixture ID stays
in process memory. `close` clears references and exits; JavaScript strings are not
guaranteed zeroizable, so terminate the process afterward. Closing is **not**
remote session cleanup. A process failure loses its passwords; use the approved
recovery flow rather than recreating accounts or guessing saved state.

## First usable phase: signup and matching email confirmation

Send commands individually as JSON lines through private stdin. Do not pipeline
live phases or repeat an uncertain request. A failure halts the lab and closes it;
the operator must inspect the outcome before deciding how to resume or recover.

1. `{"action":"signup","account":"A"}`, then the same for `B`. The actual
   canonical portal creates the PKCE verifier and handles the two signup requests.
   A neutral HTTP 200 is only a request result, not proof of an account or delivery.
2. Independently inspect the two new hosted Auth records. Configure the production
   pilot pins through the separately approved deployment workflow. Then send
   `{"action":"pins","A":"<verified UUID>","B":"<verified UUID>"}` to load
   those same expected IDs into the lab. This command does not change deployment.
3. Through connected Gmail, match each new verification message to its **exact
   approved recipient**, the just-requested signup, timestamp and verified issuing
   Supabase project. Check sender/authentication context, not display name alone.
   Do not use an older email, unsubscribe URL, tracking link or recovery message.
   Retrieve only the matching verification link without printing/saving it.
4. Send `action: "confirm"`, `account: "A"` (or `B`) and the raw matching link as
   `url`, through private stdin only. This is allowed one-time verification
   material for that issuing service, not a password or persistent credential.
   Do not put the link in exec arguments or user-facing messages. The lab accepts
   only the pinned project's `/auth/v1/verify`, type `signup`, and the exact portal
   callback redirect. It carries the original account's API cookie jar into the
   real portal callback; it does not reconstruct or bypass PKCE.

Do not open these API-phase signup emails in Chrome first: that is a different
cookie jar and cannot complete this originating flow. No browser session is being
claimed by an API callback. If the actual template format differs, stop and review
it; do not broaden the allowlist blindly. Successful replay/expiry/wrong-browser
coverage is not implied by a successful confirmation.

## Finite API sequence

Wait at least 65 seconds between the network phases below and avoid concurrent
browser auth traffic. Production admission is 20 principal requests/minute and
8 per action/minute. The lab never spoofs an ingress IP or retries 429 responses.
It has a hard 120-request budget and a 15-second timeout for every request.

- `sessions`: adopts the confirmed A/B cookie jars as A1/B1, signs A in again as
  A2, and independently verifies real issued token identity/signature/session ID
  with the installed SDK. A1 and A2 must be distinct sessions. Nothing is printed.
- `workspaces`: concurrently submits the same synthetic A workspace from A1/A2
  and creates B's distinct synthetic workspace. Server-generated IDs must agree
  for A, differ between A/B, and remain only in memory.
- `read-isolation`: genuine issued tokens must read their own organization and
  membership, and zero rows for the other's exact IDs. Anonymous Data API and
  portal reads must deny. Empty report tables are explicitly **not** evidence of
  retained report/snapshot/connection isolation.
- `request-boundaries`: missing/marketing Origin denies and a client-chosen
  workspace selector is rejected. These are HTTP contract checks, not proof of
  browser CSRF or actual browser cookie behavior.
- Optional `negative-writes` with `exactFixtureMutationApproval: true`: A attempts
  only insertion of its own viewer membership into synthetic B and a label update
  on synthetic B. Both must return HTTP 403 / PostgreSQL `42501`. If either does
  not, stop and inspect the exact fixture; do not improvise deletion or rollback.
  No DELETE probe is run. Do not supply this flag without applicable approval.
- `local-logout`: preserve A1's issued, still-unexpired cookie state in memory;
  log out A1; require its old workspace request and refresh token to deny while
  A2 and B still work. This is stronger than observing cookie removal alone.
- `global-logout`: first establish A2 works, create another A1 session, then log
  out all A sessions. A2's saved unexpired state and refresh token must deny while
  B remains functional. Separately confirm the hosted A session count if available.
- `membership-baseline`: create fresh A1 and prove its workspace still works.
  Pause. The operator separately revokes **only A's synthetic membership**, with
  exact authorization; the lab has no capability to do this itself.
- `membership-revoked`: A's existing session must lose portal access and see zero
  rows in all eight public tables. B must still work. Do not restore membership
  automatically. Denial after revocation is not confused with a logged-out session.
- `expiry-status`: returns only remaining seconds until B's natural token expiry.
  Keep the process alive and wait. `expired-refresh`, only after natural expiry,
  must obtain rotated cookies from the real portal response and succeed on the
  next request too. No shortened JWT setting or fabricated expired token is used.
- `cleanup-sessions`: explicitly sign in and globally sign out each fixture
  account, checking saved refresh-token denial. It deletes no accounts, fixtures,
  immutable reports or memberships. The operator verifies approved retention and
  any separate membership cleanup. Then send `close` and confirm process exit.

Direct Data API membership RLS does not inspect Auth sessions. Do **not** claim
global logout instantly invalidates every still-unexpired bearer JWT on Data API
reads. Session revocation is tested against the portal's session-aware SQL path
and the refresh endpoint. Membership revocation independently denies Data API
reads. The after-final-check in-flight race remains documented and accepted.

## Chrome QA afterward: one real profile

Use the approved recovery flow to establish a fresh browser session; no password
handoff from the API process is needed. Start recovery in Chrome, retrieve the
matching new recovery email, and open it in that same profile. Complete password
change using private in-memory entry; do not save the password in Chrome or copy
API cookies/tokens into it. Recovery is a new approved email action, coordinated
separately. Generate any replacement password privately in the supported runtime,
never print it or ask the owner to send it in chat.

Test A and B sequentially with explicit sign-out between them. Two tabs share
cookies, so use them only for same-account cross-tab sign-out, Back/Forward,
visibility and cache clearing. They cannot prove A/B isolation. With A's membership
still revoked, its browser must show denied access; B can exercise the positive
workspace flow. Check form errors, disabled social options, exact navigation,
recovery/replay, mobile/desktop layout, and Back to Picshaw's marketing destination.
No new hidden browser context/profile API is assumed or fabricated.

## Evidence limits and remaining gates

The lab's finite API assertions are real only when run against the approved
deployment. The test script `check-portal-pilot-api-lab.mjs` uses a fake transport
and signed synthetic JWTs; it establishes no hosted behavior. Log only case labels,
safe statuses/counts and reviewed deployment references. No automatic evidence
file or launch approval is produced.

Still separate: retained report/connection/snapshot fixtures and cross-tenant
reads/writes; real Google consent/import; API alias/forwarding matrix; browser
expiry/replay/reauthentication behavior; hosted concurrent transaction revocation
timing; controlled admission outage; complete retention/cleanup. Do not mark these
passed because workspaces work or a table is empty. Keep each feature's gate closed
until its actual required checks pass. The root coordinator owns every live action.
