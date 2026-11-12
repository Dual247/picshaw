# Local PostgreSQL contention harness

Status: implemented and syntax/guard checked, not executed against PostgreSQL. No local PostgreSQL, psql, or Docker binary was found. PGlite tests are separate and do not prove multi-connection locking.

## Prerequisites

- A separately selected, already-running dedicated disposable PostgreSQL cluster on 127.0.0.1. Do not use a shared development, staging, or production cluster: the migrations create cluster-wide synthetic roles.
- An empty database named `picshaw_dfs_contention_<suffix>`, with suffix restricted to lowercase letters, numbers, and underscores.
- The cluster must have only the `postgres` role plus built-in `pg_*` roles, and only this database plus the default `postgres` database (apart from templates). Both the target database and the default postgres database must have no application tables, functions, or custom schemas.
- Existing local `postgres` access. For password authentication the operator may explicitly provide `PIC_SHAW_DISPOSABLE_PG_PASSWORD` for this local disposable cluster. Never put secrets in the command, repository, or chat. The runner uses no ambient DATABASE_URL, PGPASSWORD, or pgpass file.
- Installed repository Node dependency `postgres`, already present. No installation or server setup is performed by the runner.

## Command (operator must choose the actual isolated port/database)

`node supabase/tests/run-dataforseo-contention.mjs --port=55432 --database=picshaw_dfs_contention_local --confirm-isolated-cluster`

`--help` displays prerequisites without connecting. Missing confirmation, invalid ports, unknown arguments, or a non-test database name fail before connection. The host cannot be overridden. Before mutation, the runner verifies loopback server identity and pristine cluster/database properties. This cannot detect every local forwarding arrangement, so the operator must ensure the selected local port is the disposable local server, not a tunnel.

## What the test proves when run successfully

The harness creates two independently pooled, single-connection workers and a separate observer connection. It asserts distinct backend PIDs and observes the second backend in a PostgreSQL Lock wait while the first transaction is deliberately held open, then commits the first and checks the second result.

1. Distinct workspace reservations at the shared account cap admit only one.
2. A permanent ledger job ID cannot reserve twice, even with different plans.
3. Identical plans with different job IDs deduplicate.
4. Concurrent durable job enqueue returns the single canonical job.
5. Concurrent dispatch grants exactly one lease.
6. An uncertain outcome blocks subsequent reservations across workspaces.

The final ledger totals and absence of rejected claims are also checked. There are no provider API requests, application deployments, hosted migrations, or real customer data.

## Cleanup and limits

The runner never creates or drops a cluster/database and never deletes existing data. It initializes the empty database and leaves synthetic schemas, fixtures, and cluster-wide roles behind. Discard the dedicated disposable cluster separately; do not rerun on the now-nonempty cluster. Connections and open held transactions are released on failure.

A successful run establishes these contention scenarios only for that local PostgreSQL build/configuration. It does not establish hosted pooler/session behavior, production JWT verification, credential provisioning, provider billing, or deployment safety. Activation remains blocked until the actual execution evidence and other rollout requirements are reviewed.

