# Tenant database foundation

Updated 2026-11-11. Tenant foundation and isolated SQL verification contract. This document describes portable schema behavior, not the configuration or inventory of a live account. No customer launch is established here.

## Schema and application contract

The migration `supabase/migrations/20261110210013_tenant_foundation.sql` targets a dedicated Supabase PostgreSQL database with existing `auth.users`, `auth.uid()`, `auth.jwt()` and `anon`/`authenticated`/`service_role` roles. Verify target migration history before applying it; never reapply it or blindly target a project with identically named objects.

- `organizations`: tenant identity and display name.
- `organization_memberships`: current authority, with owner/admin/member/viewer role and a revocation timestamp. Historical actor references remain valid after revocation. Browsers can see only their own active memberships, not a member directory.
- `google_connections`: tenant-bound Google read-only connection metadata only. No tokens, raw responses, secret references, account emails or encryption keys. The separate encrypted OAuth credential store and its lifecycle are not implemented.
- `source_runs`: an immutable import cohort, including the exact connection/property and equal-length adjacent current/prior windows, each 1–90 days. These are committed imports, not in-flight job records.
- `source_snapshots`: immutable source data, exact provenance and distinct aggregate/daily/page/query grain. The exact canonical Google property string is preserved. Fixed source, Pacific timezone, final Web-search state and empty filters match `lib/platform/core.ts`. Rows use that contract's keys/clicks/impressions/ctr/position shape. Strict JSON shape rejects unexpected fields, duplicate keys, invalid counts and inconsistent CTR; rows are limited to the adapter's 10,000 maximum.
- `recommended_actions`: immutable deterministic rule output, current/prior snapshot references and matching copied evidence rows. IDs retain the core's `snapshotId:rule:page` format. Bounded source snapshots cannot create recommendations. Evidence must be adjacent page snapshots in the same tenant/run/property.
- `work_events`: append-only status/owner/deliverable/evidence/recheck records attached to an action. A completed event requires a deliverable and HTTPS evidence URL. Completion is not proof of ranking, traffic, lead or revenue improvement. Corrections append another event rather than rewriting history.
- `reports`: private saved selection of tenant/run/property/current/prior evidence with a creator. No public token or sharing policy; construct the report from retained source/action data and render strings as escaped text.

Organization, user, connection, run and snapshot IDs are UUIDs; property IDs are exact Google strings, and action IDs are deterministic text. Map TypeScript camelCase to SQL snake_case explicitly in a future server adapter. The database supports the journey's six-snapshot contract but deliberately does not claim to enforce all six records atomically. The future persistence operation must insert a completed run, both aggregate/daily/page cohorts and validated actions in **one transaction**, then a private report when requested. Keep the journey's completeness/aggregate reconciliations and action-rule checks: database constraints establish ownership and evidence integrity, not Google's completeness, rule correctness or business causation.

## Access boundary

All eight exposed tables enable and force RLS. Existing default table privileges are revoked before granting explicit access.

- `anon` has no table access.
- `authenticated` has SELECT only, including for owners/admins. Membership comes from current database rows, never user-editable JWT metadata. Missing user ID, absent membership, revoked membership and Supabase anonymous users cannot read tenant data. Revocation applies without waiting for token refresh.
- Membership RLS is a self-only lookup. Other tables use that nonrecursive membership policy; no SECURITY DEFINER functions or privileged authorization RPCs are present.
- Browser roles cannot enroll themselves, escalate roles, alter tenant IDs, insert source evidence, fabricate completed work, create/share reports or truncate tables. A role label alone is not a management API.
- `service_role` can insert/read artifacts and manage organization/membership/connection metadata. It gets no artifact UPDATE/DELETE/TRUNCATE grant. Retained artifacts also have UPDATE/DELETE rejection triggers. Every artifact relation carries tenant identity in its foreign key, with run/property where applicable. Cross-tenant references cannot slip through just because both target rows exist.
- Server insert validators require an active same-tenant creator/actor/owner for connection metadata, source runs, work events and reports. These checks do **not** authenticate the request or bind the passed actor to a Supabase session: a future privileged server endpoint must validate identity, current membership, required role and exact connection/property before using its credential. `service_role` bypasses RLS by design and must never enter a browser, a `NEXT_PUBLIC_` variable, arbitrary preview environment, logs or report data.
- Internal validators live in `picshaw_private`, have a fixed empty search path and are SECURITY INVOKER. Browser roles have neither schema usage nor execution. Never expose this schema through the Data API.

Normal authenticated reads should use the caller's Supabase session and include organization filters for performance, with RLS as the independent boundary. No write endpoint is implemented here. A future writer must accept only the reviewed journey output, recheck current membership and connection state immediately before the transaction, and never label a page-pair-only report as a complete six-snapshot reviewed bundle. A new write API must enforce caller roles, immutable tenant ownership, abuse controls and transaction boundaries before receiving any grants.

## Future-object permission defaults

The migration `supabase/migrations/20261110211020_public_table_sequence_defaults.sql` removes automatic PUBLIC/anon/authenticated privileges on future **public tables and sequences created by postgres**. Check that this matches the target migration role and history before application.

Current object grants, service-role defaults, schema CREATE/USAGE, global defaults, function defaults and the platform-managed supabase_admin defaults are unchanged. Before/after catalog fingerprints for those unaffected ACLs matched. Creating or invoking internal/public functions as their owner is not blocked.

**New functions still need explicit revokes.** PostgreSQL gives new functions EXECUTE through global PUBLIC by default; per-schema default-privilege revokes cannot subtract that grant. In every function/RPC migration, explicitly revoke EXECUTE from PUBLIC, anon and authenticated on the new function in the same transaction, then grant only required access after reviewing authorization. The current private validators already do this. Do not treat the table/sequence hardening as a guarantee that a future RPC is private, and do not widen global or managed-role defaults silently. See [PostgreSQL default-privilege semantics](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html).

The separate `default-privileges.test.sql` suite passed **14 assertions both locally and on hosted PostgreSQL**: effective future-table/sequence browser denial, preserved service/current Auth/current table rights, unchanged global defaults, owner function creation, reproduction of the inherited function permission, and explicit per-function revocation. Its probe tables, sequence, function and test-support schema all rolled back. The 110 tenant assertions passed again after this hardening, giving **124 distinct SQL assertions** overall. Fixtures were rolled back; test teardown is required independently of assertion success.

Second migration SHA-256: 49f1e6cd3d7fb6b4162199c9d6e56f3da062c522a78da1bc6dcf73885b95791e.


## What was actually verified

On 2026-11-10:

- The schema and policy SQL executed successfully in a fresh **PGlite 0.5.16 in-memory PostgreSQL WASM instance**, with synthetic Auth functions/users/roles and no network listener.
- **110 SQL assertions** passed: all-table tenant reads, anonymous/unaffiliated/revoked identity denial, user-metadata spoofing, immediate membership revocation, browser mutation privileges, owner/viewer escalation denial, cross-tenant connection/run/action/report/work references, mixed-run reports, bounded evidence suppression, evidence tampering, source immutability and observation-shape checks.
- `node supabase/tests/check-schema.mjs` provides separate static guardrails. It is not a substitute for SQL execution.
- Isolated PGlite tooling belongs under ignored `validation/tenant-database-tooling/`, separate from application dependencies. Do not link a local CLI or target a hosted database as a side effect of running isolated tests.
- The same **110 SQL assertions were also exercised on hosted PostgreSQL** with Supabase Auth functions/roles and explicitly simulated claims. Fixtures were inside a rolled-back transaction. This is database-level evidence, not a live authentication or deployment configuration claim.
- The foundation defines eight enabled-and-forced RLS tables and eight SELECT policies. Private validators use SECURITY INVOKER. Verify target migration history and privileges independently before launch.
- Run current security, health and performance advisors on the intended target before launch. Review index and connection allocation advice against actual workload rather than treating an empty database as production evidence. References: [unused-index notice](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), [production configuration guidance](https://supabase.com/docs/guides/deployment/going-into-prod).
- **Real sign-in, issued JWTs, authenticated PostgREST HTTP access, session lifecycle and application end-to-end behavior remain untested.** Hosted SQL role/claim simulation verifies database behavior, not authentication or production readiness.

## Repeatable tests

From the repository root:

```sh
node supabase/tests/check-schema.mjs
# One-time optional isolated tooling install, not an application dependency:
npm install --prefix validation/tenant-database-tooling --no-save --package-lock=false @electric-sql/pglite@0.5.16
node supabase/tests/run-isolated.mjs
```

The runner creates a fresh in-memory database every run, applies the test-only Auth bootstrap and migration, executes both policy/default-privilege suites (124 assertions), rolls fixture changes back and closes the instance. It accepts an optional local PGlite entry path; it accepts no database URL or credentials and cannot target a hosted project.

For a **new, empty, disposable native PostgreSQL database** already created by an authorized operator:

```sh
psql -X -v ON_ERROR_STOP=1 -d picshaw_disposable_test -f supabase/tests/bootstrap.sql -f supabase/migrations/20261110210013_tenant_foundation.sql -f supabase/migrations/20261110211020_public_table_sequence_defaults.sql -f supabase/tests/tenant-policy.test.sql -f supabase/tests/default-privileges.test.sql
```

Run as a local test administrator able to create mock roles/schemas. That command is provided, not executed here. Bootstrap intentionally fails if roles already exist, and it must never be used on Supabase or a shared database. Test fixtures roll back; the test schema bootstrap and migration remain only in the disposable database for inspection. Recreate an empty test database for another native run. Do not use a production connection string.

## Hosted verification scope

Hosted verification used tenant-policy.test.sql and default-privileges.test.sql after the reviewed migrations, never bootstrap.sql. The tenant suite rejects nonempty Auth/application tables, clears legacy per-session claim settings inside the test transaction, checks exactly 110 assertions, and returns an explicit success row only after ROLLBACK. Repeat it only with authorization for an empty dedicated test/pilot database; never against customer data. A separate read must still verify zero fixtures and no test-support schema afterward.

Migration SHA-256 (unchanged before/after hosted application): 4c283667d7fa2e29cb932a72ccb4ceb5238a3b0fc6e4f29668b866efbc52cded.

## Before any pilot activation

1. Confirm the target project and migration history. Agree backup/retention policy before retaining client data; do not reuse another product's schema or reapply an existing migration.
2. Run actual Supabase Auth/PostgREST session tests, including anonymous users, revoked memberships, two independent tenants, owner/member management and exact report URLs. SQL simulation and clean advisors do not replace these end-to-end checks. Recheck advisors after future changes.
3. Implement invitation redemption and tenant bootstrap as tightly authorized server operations, with idempotency and last-owner protections. These management operations are not included.
4. The local atomic persistence contract and 22 isolated SQL tests are implemented. Still supply a production pinned-session driver, real current-session authority, durable operation/retry recovery and native/hosted concurrency tests. Implement distributed abuse controls, Google consent/encrypted token lifecycle and exact property verification. See `lib/platform/README.md`.
5. Approve retention and implement a separately authorized maintenance/deletion path. Restrictive foreign keys and immutability intentionally block ordinary deletion, including automatic deletion on `auth.users` removal. Disabling triggers or using a database administrator can bypass this foundation; privileged access must be restricted and audited.
6. Add production monitoring, tested backup recovery and performance/size limits for real workloads. This version has no ingestion job queue, public shares, arbitrary HTML report store, or live write UI.

References checked: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Data API security](https://supabase.com/docs/guides/api/securing-your-api), [Supabase changelog](https://supabase.com/changelog). Verify CLI local/remote target semantics before use; isolated tests never require a hosted link.






