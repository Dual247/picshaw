# Private Google Search reports V1

## Implemented locally

`/platform/reports` is a private-data-free shell. Its same-origin POST endpoints
at `/api/platform/reports/{read,status,sync}` verify the signed-in Supabase actor,
resolve the server-owned workspace and execute a narrow private database RPC.
All responses are private/no-store, no-referrer, noindex. No tenant, actor,
operation, lease, plan timestamp or source artifacts are accepted from HTTP.
Only `read` may accept a UUID `reportId`, still scoped by current authorization.
Opening the page reads retained data only. Google is contacted only by an
explicit import request. Client report state is ephemeral and cleared on access
failure, hidden/navigation state or the portal sign-out broadcast.

The report role has no direct tenant table, auth table or token access. Its
NOLOGIN owner runs the fixed function under tenant RLS. Report and GSC operations
lock membership and connection, using the lifecycle lock order. Auth session and
account checks are SELECT-only, fresh at entry and immediately before each successful
return. Functions require READ COMMITTED isolation and are explicitly VOLATILE.
Owner/admin membership and the active selected connection generation are required
for reads as well as writes. Selection changes advance a generation; disconnect,
revocation, membership removal and session invalidation deny subsequent access.
Database clock deadlines reject successful operations exceeding three seconds for
workspace metadata or five seconds for GSC/reports, in addition to driver query
timeouts and aborts. Session/account revocation immediately after the final check
may still allow an already-authorized in-flight request to finish. This is bounded
in-flight authorization, not an instantaneous revocation guarantee. Workspace
metadata checks membership without a membership lock; report/GSC authorization
separately takes strict membership locks. Data already delivered cannot be revoked
from memory or screenshots.

An operation is durable per workspace, actor/session, connection generation,
property and Pacific reporting end date. Database-minted run/report/snapshot IDs
and the plan timestamp survive failures. A five-minute fenced lease prevents
concurrent completions. A crashed worker can be retried explicitly after its
lease expires. A completed operation returns its existing report without another
Google fetch, including after an uncertain commit acknowledgement. Completion
atomically writes all six source snapshots, the normalized run/actions/report,
and the retained review. A different replay is rejected. A partial provider
failure writes no report. No network call happens while database locks are held.
Google property access is checked during source collection; saved report reads
check current local authorization without contacting Google. A grant revoked
directly at Google is learned on a later provider operation, not instantly.

Retries recover the same daily operation in the same session. A new session or
reporting day creates a new operation. This is a synchronous V1 import, not a
background queue, recurring sync or a cross-day resumable job. Route maxDuration
is 300 seconds and the worker lease is five minutes. A timeout may still have
committed; check status before retrying. There is no automatic provider retry.

## Measurement contract

Imports request final Web Search with no filters for 28 Pacific calendar days,
ending three days before today, plus the adjacent prior 28 days. Each period
fetches property totals, daily observations and page observations independently.
The production V1 pagination bound is one page (at most 1,000 rows per source).
A full page is treated as bounded, not exhaustive. Missing dates are unknown,
not zero. Comparisons and review actions are withheld unless both periods pass
coverage/consistency checks. Every read reconstructs totals, comparisons and
actions from validated source snapshots rather than trusting stored summaries.

No AI-answer samples, Generative AI feed, leads, revenue or causal attribution
are manufactured. The fictional sample remains separately labelled and never
substitutes for customer data. Stored page URLs render as escaped text.

## Reviewed session design and pending hosted eligibility

The dedicated hosted project's managed `postgres` role was checked read-only:
`UPDATE(id) WITH GRANT OPTION` on `auth.sessions` is unavailable. The reviewed
implementation no longer requests that privilege or locks Auth session rows.
The parent also verified SELECT WITH GRANT OPTION for all required session and
account columns on that project. Revised SELECT-only grants therefore meet that
read-only privilege check; actual migration and runtime tests remain pending.
Instead it uses the bounded fresh-read model above, including a fresh account
status check before every successful return. No privileged Auth helper or Auth
schema modification is introduced. This resolves the design's dependency on the
unavailable UPDATE grant; actual hosted eligibility and behavior are still pending.
Keep runtime flags disabled until review and hosted gates pass. Local superuser/
PGlite success does not establish hosted grantability or multi-session behavior.

A read-only hosted check on 2026-11-12 confirmed admission is applied as migration version
`20261112000717` (`auth_admission`), corresponding to local
`20261111002801_auth_admission.sql`. Reconcile its content/history; do not apply it
again merely because the local timestamp differs. Workspace, GSC and report
migrations have not been applied.

## Configuration and hosted gates (not completed by this change)

1. Reconcile the already-applied admission migration, then review and apply only
   pending workspace, GSC lifecycle and durable report migrations in order.
   Keep all private schemas
   out of the Data API. Run security advisors and confirm function/role ACLs.
2. With explicit approval for persistent access, provision separate high-entropy
   LOGIN passwords only for the narrow application roles. Never grant membership
   in owner roles or use postgres/service_role in the app. Reports use
   `picshaw_reports.<project-ref>` at the verified transaction pooler on 6543.
3. Set server-only `PIC_SHAW_REPORTS_DB_HOST` and `PIC_SHAW_REPORTS_DB_PASSWORD`
   in production Vercel. Keep `PIC_SHAW_REPORTS_ENABLED=false` until validation.
   Existing Auth session, admission, workspace and GSC runtime configuration must
   already work. No key/password/refresh token is committed or returned to UI.
4. Complete separately approved Google OAuth consent/client setup, exact callback
   URL, token-encryption key provisioning, verified sign-in and property selection.
   Do not reuse portal social-login scopes as Search Console consent.
5. Test actual multi-session PostgreSQL contention: simultaneous claims and
   completions, lock waits/deadlocks, session removal, role downgrade, disconnect
   and selection changes during import/commit, and lost commit responses. PGlite
   tests are single-session and do not prove hosted lock timing or pooler behavior.
6. Validate hosted Supabase JWT/cookie refresh and revocation, least-privilege
   pooler login/TLS, Google quota/access/reconnect behavior, Vercel duration and
   payload limits, and a real authorized six-source import/read. Test two tenants
   with genuine separate sessions and inaccessible cross-tenant report IDs.
7. Browser-QA mobile/desktop, sign-out in another tab, Back/Forward, interrupted
   imports and explicit retry. Mock/render tests do not prove browser hydration.
8. Only after these gates, enable reports and verify the exact deployed commit.
   Existing source flags remain separately gated. Marketing claims must remain
   truthful until the authenticated journey actually works in production.

Run `npm run check:reports`, the existing platform/Supabase/database/UI suites,
lint, typecheck and production build. Tests use deterministic fixtures/mock
transports and an isolated local PostgreSQL WASM database. They are not evidence
of live Google data, live production access, or real multi-session concurrency.
