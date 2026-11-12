import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
let connections=[],queries=[],providerCalls=0,allow=true
const exports={}
const sql=(strings,...values)=>{queries.push({query:strings.join('?'),values});return {signal:async()=>[{allowed:allow}]}}
const uuid='11111111-1111-4111-8111-111111111111'
const dependencies={
 'server-only':{},
 'postgres':{default:config=>{connections.push(config);return sql}},
 '../supabase/database-tls':{createSupabasePoolerTls:host=>({rejectUnauthorized:true,host})},
 './dataforseo-provider':{planMentions:({domain,platform})=>{if(!/^[a-z]+\.com$/.test(domain))throw Error();return {domain,platform}},fetchMentions:async(input,options)=>{providerCalls++;assert.equal(input.limit,20);assert.equal(options.workspaceId,uuid);const accepted=await options.ledger.reserve({workspaceId:uuid,jobId:uuid,estimatedMaxUsd:.12,fingerprint:'request-fingerprint'});if(!accepted)throw Error('Denied');await options.ledger.settle({workspaceId:uuid,jobId:uuid,chargedUsd:.101,outcome:'confirmed'});return {source:'synthetic'}}},
}
vm.runInNewContext(ts.transpileModule(readFileSync('lib/platform/dataforseo-runtime.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,module:{exports},process:{env:{}},AbortSignal,Date,require:name=>{assert.ok(name in dependencies,name);return dependencies[name]}})
const env={VERCEL:'1',VERCEL_ENV:'production',PIC_SHAW_AUTH_ORIGIN:'https://app.picshaw.com',PIC_SHAW_PORTAL_ACCESS_MODE:'pilot',PIC_SHAW_DATAFORSEO_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',PIC_SHAW_DATAFORSEO_DB_HOST:'aws-0-us-east-1.pooler.supabase.com',PIC_SHAW_DATAFORSEO_DB_PASSWORD:'x'.repeat(40),DATAFORSEO_LOGIN:'synthetic-login',DATAFORSEO_PASSWORD:'synthetic-password',PIC_SHAW_DATAFORSEO_APPROVED_DOMAINS:'example.com'}
assert.equal(exports.createDataForSeoRun(),null)
for(const change of [{VERCEL_ENV:'preview'},{PIC_SHAW_PORTAL_ACCESS_MODE:'public'},{PIC_SHAW_DATAFORSEO_ENABLED:'false'},{DATAFORSEO_PASSWORD:''},{PIC_SHAW_DATAFORSEO_DB_HOST:'attacker.com'},{PIC_SHAW_DATAFORSEO_APPROVED_DOMAINS:''}])assert.equal(exports.createDataForSeoRun({...env,...change}),null)
assert.equal(connections.length,0)
const run=exports.createDataForSeoRun(env)
assert.equal(connections.length,1)
assert.equal(connections[0].username,'picshaw_dataforseo.abcdefghijklmnopqrst')
assert.equal(connections[0].ssl.rejectUnauthorized,true)
assert.equal(connections[0].debug,false)
const input={actor:{id:uuid,sessionId:uuid,expiresAt:9999999999},workspaceId:uuid,domain:'example.com',platform:'google',jobId:uuid}
for(const change of [{domain:'other.com'},{workspaceId:'invalid'},{jobId:'invalid'},{actor:{...input.actor,expiresAt:1}}])await assert.rejects(run({...input,...change}))
assert.equal(queries.length,0);assert.equal(providerCalls,0)
await run(input)
assert.equal(queries.length,2)
assert.match(queries[0].query,/picshaw_dataforseo_private.reserve/)
assert.equal(queries[0].values[5],120000)
assert.equal(queries[0].values[6],'request-fingerprint')
assert.match(queries[1].query,/picshaw_dataforseo_private.settle/)
assert.equal(queries[1].values[5],101000)
assert.equal(queries[1].values[6],'confirmed')
allow=false;await assert.rejects(run(input));assert.equal(queries.length,3)
console.log('PASS DataForSEO runtime: deployment gates, approved domains, role/TLS, actor inputs, microdollar accounting and denial. All SQL/provider calls mocked.')

for(const [usd,micros] of [[0,0],[.12,120000],[.101,101000],[.0000001,1],[.0000011,2],[1.000001,1000001],[.007035,7035],[5e-324,1],[1000000,1000000000000]])assert.equal(exports.dataForSeoMicros(usd),micros)
for(const value of [NaN,Infinity,-1,1000001])assert.throws(()=>exports.dataForSeoMicros(value))
console.log('PASS exact JSON-decimal microdollar rounding, tiny scientific notation and limits')
