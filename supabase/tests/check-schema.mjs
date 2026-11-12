import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const directory = new URL('../migrations/', import.meta.url)
const migrations = readdirSync(directory).filter(name => name.endsWith('.sql'))
assert.equal(migrations.length, 6)
const foundation = migrations.find(name => name.endsWith('_tenant_foundation.sql'))
assert.match(foundation, /^\d{14}_tenant_foundation\.sql$/)
const sql = readFileSync(new URL(foundation, directory), 'utf8')
const tables = ['organizations', 'organization_memberships', 'google_connections', 'source_runs', 'source_snapshots', 'recommended_actions', 'work_events', 'reports']
assert.deepEqual([...sql.matchAll(/create table public\.([a-z_]+)/g)].map(match => match[1]), tables)
assert.doesNotMatch(sql, /security\s+definer/i)
assert.doesNotMatch(sql, /create\s+(?:or\s+replace\s+)?function\s+public\./i)
assert.doesNotMatch(sql, /create\s+view|on\s+delete\s+cascade/i)
assert.match(sql, /revoke all on table public\.%I from public, anon, authenticated, service_role/)
assert.match(sql, /enable row level security/)
assert.match(sql, /force row level security/)
assert.match(sql, /grant select on table public\.%I to authenticated/)
assert.doesNotMatch(sql, /grant\s+(?:all|insert|update|delete|truncate)[^;]*to\s+(?:public|anon|authenticated)/i)
assert.match(sql, /user_id = \(select auth.uid\(\)\) and revoked_at is null/)
assert.match(sql, /is_anonymous/)
assert.doesNotMatch(sql, /user_metadata|app_metadata/)
assert.match(sql, /foreign key \(organization_id, run_id, property_id, snapshot_id\)/)
assert.match(sql, /foreign key \(organization_id, run_id, property_id, prior_snapshot_id\)/)
assert.match(sql, /source_runs','source_snapshots','recommended_actions','work_events','reports'/)
assert.match(sql, /before update or delete/)
assert.doesNotMatch(sql, /^\s*(?:access_token|refresh_token|client_secret|secret_key|password)\s+/im)
const defaults = readFileSync(new URL(migrations.find(name => name.endsWith('_public_table_sequence_defaults.sql')), directory), 'utf8')
const statements = defaults.replace(/\r\n/g, '\n').replace(/^--.*$/gm, '').split(';').map(statement => statement.trim()).filter(Boolean)
assert.deepEqual(statements, [
  'begin',
  'alter default privileges for role postgres in schema public\n  revoke all privileges on tables from public, anon, authenticated',
  'alter default privileges for role postgres in schema public\n  revoke all privileges on sequences from public, anon, authenticated',
  'commit',
])
console.log('PASS static tenant/default-privilege migration guardrails (not a SQL execution or RLS test).')


