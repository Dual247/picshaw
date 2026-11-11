# First workspace: local implementation, not activated

The first-workspace flow is implemented behind fail-closed production configuration. No hosted migration, login role/password provisioning, authentication activation or deployment was performed for this work.

## Runtime flow

- `/platform/onboarding` renders a disabled form until workspace runtime and distributed admission configuration exist. It does not load client data into static HTML or use sample records as a real workspace.
- A signed-in user explicitly opens their workspace with `POST /api/platform/workspaces/current`. The request uses HttpOnly session cookies, exact canonical host/URL/Origin and same-origin Fetch Metadata. No organization, user or session identifier is accepted from the body.
- A new user may submit a trimmed 1–160-character name and a lowercase public-shaped hostname (maximum 253 characters) to `POST /api/platform/workspaces/bootstrap`. The hostname is only an unverified label. It is never fetched, used for membership matching or treated as proof of Search Console ownership.
- Both endpoints require distributed ingress admission before Auth/database calls. Bodies are streamed with a 2 KiB limit, and responses are private/no-store with no diagnostic secrets. All SDK cookie rotations are copied to the response. No browser Supabase client or service-role credential is used.
- `requireWorkspaceActor(client, projectUrl)` verifies claims through Supabase `getClaims`, checks the signed issuer, audience, authenticated role, nonanonymous status, UUID subject/session and unexpired token, then requires `getUser` to return the same subject. An unsigned decode is never an authorization source.
- The concrete `postgres@4.1.0` adapter uses bound parameters, certificate-verified TLS, Supavisor transaction port 6543, no prepared statements, no arbitrary connection URI and bounded connection/query/cancel timeouts. Connection pools are reused, but session/authorization results are not cached.

## Database boundary

CLI-generated local migration: `20261111003056_workspace_bootstrap.sql`.

`picshaw_workspace` is a NOLOGIN/NOINHERIT role intended to become a dedicated password-authenticated runtime login only during separately approved secure provisioning. It has usage of the unexposed private schema and execution of exactly the workspace function. It has no direct Auth/application/private table privileges and no membership in the function-owner role.

The fixed-search-path SECURITY DEFINER function is owned by `picshaw_workspace_owner`, a separate NOLOGIN/NOINHERIT nonsuperuser without BYPASSRLS. PUBLIC, anon, authenticated and service_role execution/schema access are explicitly revoked. Do not expose this schema through PostgREST or grant either role to browser roles.

The owner has only:

- SELECT on Auth user columns `id`, `is_anonymous`, `email_confirmed_at`, `phone_confirmed_at`, `banned_until`, `deleted_at`.
- SELECT on Auth session columns `id`, `user_id`, `not_after`, plus UPDATE on **only `id`**, because PostgreSQL requires an UPDATE privilege for `SELECT ... FOR SHARE`. The function never updates an Auth row. This is a managed Auth-schema grant requiring separate hosted review. No managed Auth policies are changed by this migration. If the target Auth tables have RLS that denies this role, the call fails closed; do not work around it with BYPASSRLS or broad grants.
- SELECT/INSERT on organizations and memberships, with policies scoped only to the function owner. Browser roles retain SELECT-only access. Membership creation can only produce an active owner record for the server-bound actor. The owner owns the private durable bootstrap ledger, which enables and forces RLS.

Each invocation verifies the exact Auth session/user pairing and session expiry, locks the session row against deletion during the operation, and checks current nonanonymous, confirmed, nondeleted, nonbanned user status. A prior completed logout rejects a still-unexpired JWT. An operation holding the session lock can complete before a concurrent logout; the logout waits and later operations fail. Maximum-lifetime/inactivity/single-session Auth settings are not independently reproduced; Supabase documents that some cleanup is deferred until refresh. Test real deployed Auth settings before activation.

The function then serializes operations for that user with a transaction advisory lock. Organization creation, owner membership and durable ledger insertion are atomic in one SQL statement. A user has one permanent ledger entry. Identical retries return its same organization, including after response loss. Different details return a conflict rather than silently updating or making another workspace. Revoked/changed owner membership prevents both reads and retries; bootstrap cannot reinstate it. There is no invite acceptance, tenant selector, join-by-domain/email, last-owner management, delete/reset API or public sharing.

The ledger returns only the user's newly created workspace after current membership checks. Accounts that already belong to some other organization are not automatically assigned that organization by this API. A returned workspace is not authorization for subsequent data actions: each future operation must independently check current session, membership, required role and exact tenant-bound resource inside its transaction.

## Secure provisioning needed before activation

1. Review the local migration, exact managed Auth grants and target role/table/RLS state on the dedicated empty pilot. Apply only after approval and verify security advisors. No credential is embedded in migration SQL.
2. Securely provision a unique strong password and LOGIN for `picshaw_workspace`, without owner membership, superuser, BYPASSRLS, CREATE ROLE or extra grants. Do not reuse the admission or GSC connection credential. Review database CONNECT limits and Supavisor custom-role support on the actual project.
3. Production-only server secrets/config: `PIC_SHAW_WORKSPACE_DB_HOST` (verified project Supavisor hostname), `PIC_SHAW_WORKSPACE_DB_PASSWORD` (32–256 characters), `PIC_SHAW_WORKSPACE_ENABLED=true`. Also require `VERCEL=1`, `VERCEL_ENV=production`, canonical `PIC_SHAW_AUTH_ORIGIN=https://app.picshaw.com`, the project's public URL/key, `PIC_SHAW_AUTH_SESSION_ENABLED=true`, and the separately tested admission backend. Keep workspace enabled false/absent until the following tests pass. Never put the password in NEXT_PUBLIC variables, logs, commits or preview environments.
4. Test real issued Google/Apple/email sessions, confirmation requirements, malformed and expired tokens, two independent accounts, logout/membership revocation, cookie rotations, host separation, distributed rate limiting, ambiguous-response retry and native PostgreSQL concurrent creation/revocation. Recheck no unexpected Auth/application fixtures remain.

## Verification and limits

- `node scripts/check-workspace-database.mjs`: 33 isolated PGlite SQL assertions covering create/read, durable retries, cross-session denial, separate tenants for identical name/site, revoked membership/session, user state, bounded inputs, least-privilege role access and injected receipt failure rolling back both organization and membership. Mock Auth tables are not Supabase Auth integration tests.
- `node scripts/check-workspace-runtime.mjs`: mock SDK/driver execution of the concrete production adapter, verified claim checks, accepted real-shaped configuration, bound SQL arguments, fail-closed configuration, strict CSRF, body bounds, admission ordering, cookie propagation and redacted errors. It deliberately does not connect to a network or use credentials.
- Existing 124 SQL assertions pass with the bootstrap migration present. The old global assertion that no non-SELECT policies exist now checks the intended PUBLIC/anon/authenticated roles; the new private server-only INSERT policies do not weaken browser protections.
- Scoped lint and TypeScript passed. Actual hosted/custom-role connectivity, Postgres concurrency, issued JWT lifecycle and rendered browser interaction remain required before activation.

References checked: [Supabase sessions and revocation](https://supabase.com/docs/guides/auth/sessions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase changelog](https://supabase.com/changelog), and bundled Next.js 16.4.6 route-handler docs. Changelog review found no applicable Auth API breaking change; CLI v3's local/default target change was respected.
