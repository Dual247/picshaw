import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { X509Certificate } from 'node:crypto'
import { checkServerIdentity } from 'node:tls'
import vm from 'node:vm'
import ts from 'typescript'
const require = createRequire(import.meta.url)
function load(file, deps = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(`lib/${file}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, module: { exports }, URL, Buffer, AbortSignal, AbortController, setTimeout, clearTimeout, process: { env: {} },
    require: name => name === 'server-only' ? {} : name in deps ? deps[name] : name.startsWith('node:') ? require(name) : (() => { throw Error(`Unmocked dependency ${name}`) })(),
  })
  return exports
}
const actualTls = load('supabase/database-tls')
const common = { VERCEL: '1', VERCEL_ENV: 'production', PIC_SHAW_AUTH_ORIGIN: 'https://app.picshaw.com', NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', PIC_SHAW_AUTH_SESSION_ENABLED: 'true', PIC_SHAW_WORKSPACE_ENABLED: 'true', PIC_SHAW_GSC_ENABLED: 'true', PIC_SHAW_REPORTS_ENABLED: 'true' }
const password = 'synthetic-only-' + 'x'.repeat(32)
const cases = [
  ['supabase/auth-admission-runtime', 'createRuntimeAdmission', 'ADMISSION', './database-tls', 1, 1, 1, {
    './auth-admission-backend': { createDistributedAuthAdmission: deps => deps }, './auth-admission-diagnostics': {}, '@vercel/functions': {},
  }, { PIC_SHAW_ADMISSION_HMAC_KEY: 'ab'.repeat(32) }],
  ['supabase/workspace-runtime', 'createWorkspaceStore', 'WORKSPACE', './database-tls', 2, 2, 3, { './auth': {}, './workspace-input': {} }, {}],
  ['platform/gsc-runtime', 'createDeploymentGsc', 'GSC', '../supabase/database-tls', 2, 2, 5, {
    './gsc-lifecycle': { createGscLifecycle: deps => deps }, './gsc-crypto': { tokenCipher: () => ({}) }, './gsc-provider': { googleProvider: () => ({}) },
  }, { PIC_SHAW_GSC_CLIENT_ID: 'synthetic.apps.googleusercontent.com', PIC_SHAW_GSC_CLIENT_SECRET: 'x'.repeat(32), PIC_SHAW_GSC_TOKEN_KEY_V1: Buffer.alloc(32, 1).toString('base64') }],
  ['platform/report-runtime', 'createDeploymentReports', 'REPORTS', '../supabase/database-tls', 2, 2, 5, {
    './report-service': { createReportService: deps => deps }, './gsc-runtime': { deploymentGsc: () => ({}) },
  }, {}],
]
for (const [file, factory, prefix, tlsImport, max, connectTimeout, queryTimeout, dependencies, extra] of cases) {
  const host = `aws-1-${prefix.toLowerCase()}.pooler.supabase.com`
  const env = { ...common, ...extra, [`PIC_SHAW_${prefix}_DB_HOST`]: host, [`PIC_SHAW_${prefix}_DB_PASSWORD`]: password }
  let options, driverCalls = 0, tlsCalls = 0
  const deps = { ...dependencies, postgres: { default: opts => { options = opts; driverCalls++; return () => { throw Error('Query forbidden in configuration test') } } },
    [tlsImport]: { createSupabasePoolerTls: selected => { tlsCalls++; assert.equal(selected, host); return actualTls.createSupabasePoolerTls(selected) } } }
  const runtime = load(file, deps)
  for (const patch of [{ VERCEL: '0' }, { VERCEL_ENV: 'preview' }, { PIC_SHAW_AUTH_ORIGIN: 'https://picshaw.com' }, { NEXT_PUBLIC_SUPABASE_URL: 'https://evil.example' }, { [`PIC_SHAW_${prefix}_DB_HOST`]: 'evil.example' }, { [`PIC_SHAW_${prefix}_DB_PASSWORD`]: '' }]) assert.equal(runtime[factory]({ ...env, ...patch }), null)
  if (prefix !== 'ADMISSION') for (const flag of ['PIC_SHAW_AUTH_SESSION_ENABLED', `PIC_SHAW_${prefix}_ENABLED`]) assert.equal(runtime[factory]({ ...env, [flag]: 'false' }), null)
  assert.equal(tlsCalls, 0, 'Disabled/invalid configuration cannot initialize TLS')
  assert.equal(driverCalls, 0)
  assert.ok(runtime[factory](env))
  assert.equal(driverCalls, 1)
  assert.equal(tlsCalls, 1)
  assert.equal(options.host, host)
  assert.equal(options.username, `picshaw_${prefix.toLowerCase()}.abcdefghijklmnopqrst`)
  assert.equal(options.password, password)
  assert.equal(options.port, 6543)
  assert.equal(options.database, 'postgres')
  assert.equal(options.ssl.rejectUnauthorized, true)
  assert.equal(options.ssl.servername, host)
  assert.equal(options.ssl.checkServerIdentity, checkServerIdentity)
  assert.equal(Object.isFrozen(options.ssl), true)
  assert.equal(new X509Certificate(options.ssl.ca).fingerprint256, '80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA')
  for (const [key, value] of Object.entries({ prepare: false, max, max_pipeline: 1, connect_timeout: connectTimeout, queue_timeout: connectTimeout, query_timeout: queryTimeout, cancel_timeout: 1, idle_timeout: 10, max_lifetime: 60, fetch_types: false, debug: false })) assert.equal(options[key], value, `${prefix}.${key}`)
  assert.equal(options.onnotice('PRIVATE_PROVIDER_NOTICE'), undefined)
  const before = driverCalls
  const unavailable = load(file, { ...deps, [tlsImport]: { createSupabasePoolerTls: () => { throw Error('Database TLS configuration unavailable') } } })
  assert.throws(() => unavailable[factory](env), error => error.message === 'Database TLS configuration unavailable')
  assert.equal(driverCalls, before, 'Invalid CA must fail before driver creation, without fallback')
  console.log(`PASS ${prefix.toLowerCase()} driver uses scoped pinned CA and normal hostname verification; roles, gates, limits and no-fallback behavior preserved`)
}
console.log('All four database runtime TLS bindings passed with synthetic config and mocked driver/provider. No network, credentials, trust-store or hosted changes.')
