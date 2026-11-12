import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
const require = createRequire(import.meta.url)
function load(name, dependencies = {}, overrides = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(`lib/supabase/${name}.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, module: { exports }, Buffer, URL, AbortController, setTimeout, clearTimeout,
    process: { env: {} }, console: new Proxy({}, {get: () => () => { throw Error('Logging forbidden') }}),
    require: name => name === 'server-only' ? {} : name in dependencies ? dependencies[name] :
      name.startsWith('node:') ? require(name) : (() => { throw Error(`Unexpected dependency ${name}`) })(),
    ...overrides,
  })
  return exports
}
const diagnostics = load('auth-admission-diagnostics')
const backend = load('auth-admission-backend', { './auth-admission-diagnostics': diagnostics })
let options, calls = [], response = [{allowed: true}], error
const runtime = load('auth-admission-runtime', {
  './auth-admission-backend': backend,
  './auth-admission-diagnostics': diagnostics,
  '@vercel/functions': { ipAddress: request => request.headers.get('x-real-ip') },
  postgres: {default: config => {
    options = config
    return (strings, ...params) => {
      calls.push({strings: [...strings], params})
      return {signal: async signal => { assert.ok(signal instanceof AbortSignal); if(error) throw error; return response }}
    }
  }},
})
const env = {
  VERCEL:'1', VERCEL_ENV:'production', PIC_SHAW_AUTH_ORIGIN:'https://app.picshaw.com',
  NEXT_PUBLIC_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',
  PIC_SHAW_ADMISSION_DB_HOST:'aws-0-us-east-1.pooler.supabase.com',
  PIC_SHAW_ADMISSION_DB_PASSWORD:'not-a-real-password-for-isolated-tests',
  PIC_SHAW_ADMISSION_HMAC_KEY:'11'.repeat(32),
}
for (const field of Object.keys(env)) {
  assert.equal(runtime.readAdmissionConfig({...env, [field]:undefined}), null, field)
}
for (const host of ['evil.example.com','supabase.com.evil.test','aws-0-us-east-1.pooler.supabase.com:6543','user@aws-0-us-east-1.pooler.supabase.com']) {
  assert.equal(runtime.readAdmissionConfig({...env,PIC_SHAW_ADMISSION_DB_HOST:host}), null)
}
assert.equal(runtime.createRuntimeAdmission({...env,VERCEL_ENV:'preview'}), null)
assert.equal(runtime.createRuntimeAdmission({...env,VERCEL:'0'}), null)
const admit = runtime.createRuntimeAdmission(env)
assert.equal(options.username, 'picshaw_admission.abcdefghijklmnopqrst')
assert.equal(options.ssl.rejectUnauthorized, true)
assert.equal(options.max_pipeline, 1)
assert.equal(options.prepare, false)
assert.equal(options.port, 6543)
const request = (ip = '203.0.113.1', extra = {}) => ({nextUrl: new URL('https://app.picshaw.com/platform/auth/google'), headers: new Headers({host:'app.picshaw.com','x-real-ip':ip,'x-vercel-forwarded-for':ip,...extra})})
const run = req => admit({action:'google',request:req})
assert.equal((await run(request())).status, 'allow')
assert.equal(calls.length, 1)
assert.match(calls[0].params[1], /^[0-9a-f]{64}$/)
assert.ok(!JSON.stringify(calls).includes('203.0.113.1'))
assert.ok(!JSON.stringify(calls).includes(env.PIC_SHAW_ADMISSION_DB_PASSWORD))
const firstDigest = calls[0].params[1]
await run(request('::ffff:203.0.113.1'))
assert.equal(calls.at(-1).params[1],firstDigest)
await run(request('2001:db8:abcd:12::1'))
const ipv6Digest = calls.at(-1).params[1]
await run(request('2001:0DB8:abcd:0012:ffff::abcd'))
assert.equal(calls.at(-1).params[1],ipv6Digest)
const before = calls.length
assert.equal((await admit({action:'untrusted-action',request:request()})).status, 'unavailable')
for (const ip of ['', '203.0.113.1, 1.1.1.1', '1.2.3.4:123', 'fe80::1%eth0', 'nonsense']) assert.equal((await run(request(ip))).status, 'unavailable')
assert.equal((await run(request('1.1.1.1', {'x-vercel-forwarded-for':'2.2.2.2'}))).status, 'unavailable')
assert.equal((await run(request('1.1.1.1', {host:'picshaw.com'}))).status, 'unavailable')
assert.equal(calls.length,before)
assert.equal((await admit({action:'callback',request:request()})).status, 'allow')
assert.equal(calls.at(-1).params[0], 'callback')
for (const value of [undefined,null,1,'true',{},[]]) {
  response=[{allowed:value}]
  assert.equal((await run(request())).status,'unavailable')
}
response=[{allowed:false}]
assert.equal((await run(request())).status,'limited')
response=[{allowed:true},{allowed:true}]
assert.equal((await run(request())).status,'unavailable')
error = Error('Sensitive diagnostic must not be logged')
const beforeOutage = calls.length
assert.equal((await run(request())).status,'unavailable')
assert.equal(calls.length, beforeOutage + 1, 'An outage must not trigger retries')
const fast = load('auth-admission-backend',{'./auth-admission-diagnostics':diagnostics}, {setTimeout: callback => setTimeout(callback, 1)})
let aborted = false
const hanging = fast.createDistributedAuthAdmission({hmacKey:Buffer.alloc(32,1),resolvePrincipal:()=> 'v4:203.0.113.1',consume:(_a,_d,signal)=>{
  signal.addEventListener('abort',()=>{aborted=true})
  return new Promise(()=>{})
}})
assert.equal((await hanging({action:'google',request:request()})).status,'unavailable')
assert.equal(aborted,true)
const disabled = load('auth-admission', {'./auth-admission-runtime':runtime, './auth-admission-diagnostics':diagnostics})
assert.equal(disabled.authAdmissionConfigured,false)
assert.equal((await disabled.checkDeploymentAuthAdmission({action:'google',request:request()})).status,'unavailable')
console.log('PASS admission config, disabled deployment, header validation, IPv6 grouping, HMAC privacy, strict results, database/logging outage and timeout; no network.')
