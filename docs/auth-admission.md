# Distributed admission for the Picshaw portal

Status: implemented and tested locally with mocks/WASM. Not provisioned, applied,
connected, or verified on hosted Supabase/Vercel. Google, Apple and email must stay
disabled until the deployment checks below pass. Configuration readiness is not
proof of a working service; every request still requires an affirmative DB result.

## Design

`auth-admission.ts` selects the production adapter only with Vercel production
system variables, the exact portal origin, the dedicated project's public URL,
and all three private admission settings. There is no manual "verified" switch.
Preview, local and other hosting environments fail closed. The configuration is
server-only and never accepts a DB URL, database name, user, port, or TLS mode from
the caller. A lazy module-scoped client targets the shared transaction pooler on
6543 as `picshaw_admission.<projectref>`, with verified TLS, one connection,
prepared statements disabled and `max_pipeline: 1`. All driver waits are bounded.

The Vercel `ipAddress` helper reads the platform's `x-real-ip`. Vercel documents
that it replaces externally supplied forwarding IPs. We also require agreement
with `x-vercel-forwarded-for`, a valid single IP, and the exact portal request host
and origin. This relies on the real Vercel ingress, not on headers as proof of
hosting. Never copy the Vercel system variables into a self-hosted deployment.
Any upstream proxy or Vercel Enterprise Trusted Proxy configuration needs its own
review before activation. IPv6 addresses share a /64 bucket; IPv4-mapped IPv6 and
IPv4 normalize identically. Missing/malformed identity is unavailable, not allowed.

Only an HMAC-SHA256 network identity and a fixed action name go to Postgres. No raw
IP, email, body, password, cookie, session/token, or OAuth data is stored in these
counters. HMAC keys must be high entropy and shared by every production instance.
Hashed identities still deserve restricted access. Counters are deleted on the
next admission call after expiry; they can remain while idle, and normal database
backup retention still applies. Do not claim immediate physical erasure.

The SQL function holds one transaction-scoped advisory lock, checks all budgets,
then debits all of them atomically. Time and budgets are DB-owned, never caller
inputs. Fixed windows begin with the first accepted call:

| Scope | Limits |
| --- | --- |
| All instances, all actions | 300/minute and 3,000/hour |
| Network principal, all actions | 20/minute and 100/hour |
| Network principal, individual action | 8/minute |

Actions include Google, Apple, sign-in, sign-up, recovery, password reset, callback, workspace
bootstrap and workspace read. Windows are not sliding; boundary bursts are
possible. Shared NAT users share limits. Account-based attack controls are still
required in Supabase Auth. This portal limiter does not protect direct calls to
the public Supabase Auth endpoint. Review hosted Auth rate limits, signup policy,
SMTP limits, CAPTCHA/bot controls and Vercel abuse controls separately.
The 3,000/hour global budget is not an email delivery or spending cap, and must
never be used as evidence that an SMTP free-tier allowance is protected.

Only `picshaw_admission` can execute the private function. It cannot read/write
counters directly or access tenant tables. The function owner is a separate
NOLOGIN role owning only the admission schema/table/function. The owner is granted
to `postgres` for migration administration, never to the runtime role. The private
schema must not be exposed through the Data API. No service-role key, project
admin password, JWT signing secret or custom server JWT is used by this adapter.

Errors, unexpected results, cancellation and timeouts fail closed without logging
sensitive diagnostics. An ambiguous timeout can consume quota despite denial;
there is no retry. Logout/session inspection remain separately controlled.

## Secure provisioning, not performed by this change

1. Review and apply `20261111002801_auth_admission.sql` to the dedicated Picshaw
   project through an authorized migration workflow. It creates a NOLOGIN role
   with no password. Run Supabase security advisors and inspect inherited PUBLIC
   permissions and role memberships before enabling anything.
2. Through an approved administrative connection and secure credential workflow,
   generate a unique random password of at least 32 characters. Set it using a
   secure password prompt (for example psql `\password picshaw_admission`), not a
   literal in a SQL file, shell history, chat, log or migration. Enable LOGIN on
   that role only, preserving NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/
   NOBYPASSRLS and no other role memberships. Grant CONNECT on the project's
   database only if the existing database ACL requires it. Do not grant the role
   to `authenticator`, `anon`, `authenticated`, `service_role`, or bootstrap users.
3. Copy the exact shared transaction-pooler hostname from Dashboard > Connect;
   do not infer its index from the region. Use the narrow role credentials, not
   the postgres connection-string password. Verify custom-role authentication
   works on this hosted project's pooler. If it does not, stop and resolve the
   supported configuration; do not fall back to an admin credential.
4. In Vercel's production-only secure environment settings, provision:
   - `PIC_SHAW_ADMISSION_DB_HOST`: hostname only.
   - `PIC_SHAW_ADMISSION_DB_PASSWORD`: narrow role's password.
   - `PIC_SHAW_ADMISSION_HMAC_KEY`: 32 cryptographically random bytes encoded as
     64 lowercase hex characters. This is not a Supabase key.
   Keep them out of preview/development and all `NEXT_PUBLIC_*` variables.
   Use the same HMAC key across production replicas. Rotation resets principal
   budgets; global budgets remain, and rotations must not be routine per deploy.
5. Confirm real Vercel system variables, direct ingress, exact app.picshaw.com
   host, and the dedicated Supabase public URL. Never manually set platform
   variables to force readiness. Leave provider enable flags off during testing.
6. Over a real restricted test deployment, test forged forwarding headers,
   missing headers, IPv4/IPv6, alias/preview denial, TLS verification failures,
   revoked credentials, unavailable DB, lock contention, and actual pooler role
   defaults (`statement_timeout=1s`, `lock_timeout=500ms`). Check that no sensitive
   details appear in application/DB logs. Verify the private schema stays absent
   from exposed Data API schemas and tenant data is inaccessible as the login.
7. Run concurrent calls through multiple independent native PostgreSQL sessions
   and Vercel instances, proving exactly 8 of a same-action 40-call burst pass,
   global limits cap distinct principals, and rollback/expiry/outages deny safely.
   Also inspect connection counts and tune only after evidence. No PGlite result
   substitutes for this deployment test.
8. Only then enable requested provider flags after their own OAuth/email setup
   and end-to-end verification. No paid provider is introduced by this design.

Rollback: disable provider flags, revoke LOGIN or rotate the narrow credential
through the secure workflow, and redeploy. Do not drop live counters or rotate
the HMAC just to bypass limits. Existing sessions/logout have separate gates.

## Local validation

- `node scripts/check-auth-admission.mjs`: mocked driver; no network or secrets.
- `node scripts/check-auth-admission-database.mjs`: fresh disposable PGlite;
  ACLs, constraints, budgets, expiry, queued bursts and rollback.
- `node supabase/tests/run-isolated.mjs`: full migration/policy regression suite.

PGlite executes real PostgreSQL SQL but serializes queued calls in one WASM
connection. It cannot establish native concurrent transaction contention,
Supavisor authentication/TLS, Vercel header behavior or hosted Auth readiness.

## Sources reviewed

- https://vercel.com/docs/headers/request-headers
- https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/database/postgres/roles
- https://supabase.com/docs/guides/database/postgres-js
- Pinned Postgres.js 4.1.0 README: Supavisor and timeout sections.

Dependency note: pnpm's existing lockfile rejected electron-to-chromium 1.5.479
under its release-age policy. It was replaced with registry-verified eligible
1.5.478; the policy was not relaxed. New runtime dependencies are exact versions
postgres 4.1.0 and @vercel/functions 3.11.1. An existing moderate minimatch advisory
remains in ESLint development dependencies; no broad audit fix was applied.
