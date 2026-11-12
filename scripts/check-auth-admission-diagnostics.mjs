import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
const require = createRequire(import.meta.url)
let logs = [], brokenLogging = false
function load(name, dependencies = {}, overrides = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(`lib/supabase/${name}.ts`, 'utf8'), { compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022} }).outputText,
    {exports,module:{exports},Buffer,URL,AbortController,setTimeout,clearTimeout,process:{env:{}},
      console:{warn:(...args)=>{if(brokenLogging)throw Error('PRIVATE_LOGGER_ERROR');logs.push(args)}},
      require:n=>n==='server-only'?{}:n in dependencies?dependencies[n]:n.startsWith('node:')?require(n):(()=>{throw Error(n)})(),...overrides})
  return exports
}
const diagnostics=load('auth-admission-diagnostics')
const backend=load('auth-admission-backend',{'./auth-admission-diagnostics':diagnostics})
let driverError=null,result=[{allowed:true}],queries=0,driverOptions
const runtime=load('auth-admission-runtime',{'./auth-admission-backend':backend,'./auth-admission-diagnostics':diagnostics,
 '@vercel/functions':{ipAddress:r=>r.headers.get('x-real-ip')},postgres:{default:options=>{driverOptions=options;return()=>({signal:async()=>{queries++;if(driverError)throw driverError;return result}})}}})
const env={VERCEL:'1',VERCEL_ENV:'production',PIC_SHAW_AUTH_ORIGIN:'https://app.picshaw.com',NEXT_PUBLIC_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',PIC_SHAW_ADMISSION_DB_HOST:'aws-0-us-east-1.pooler.supabase.com',PIC_SHAW_ADMISSION_DB_PASSWORD:'PRIVATE_PASSWORD_'+'p'.repeat(32),PIC_SHAW_ADMISSION_HMAC_KEY:'ab'.repeat(32)}
const request=(headers={},origin='https://app.picshaw.com')=>({nextUrl:new URL(origin+'/api/platform/auth/sign-in'),headers:new Headers({host:'app.picshaw.com','x-real-ip':'203.0.113.7','x-vercel-forwarded-for':'203.0.113.7',authorization:'PRIVATE_TOKEN',...headers})})
const admit=runtime.createRuntimeAdmission(env)
const allowed=new Set(['limited','configuration_unavailable','runtime_unavailable','action_rejected','ingress_origin_rejected','ingress_principal_unavailable','ingress_identity_mismatch','backend_deadline','backend_tls_rejected','backend_login_rejected','backend_access_denied','backend_dns_unavailable','backend_connection_unavailable','backend_contract_unavailable','backend_result_invalid','backend_unavailable'].map(x=>'picshaw_auth_admission:'+x))
function expect(code){assert.deepEqual(logs,[[`picshaw_auth_admission:${code}`]]);assert.ok(allowed.has(logs[0][0]));assert.doesNotMatch(JSON.stringify(logs),/PRIVATE|203\.0\.113|abcdefghijklmnopqrst|aws-0|ab{10}|SELECT|headers|password|token|digest/i)}
async function run(code,fn){logs=[];await fn();expect(code)}
assert.equal(driverOptions.connect_timeout,1);assert.equal(driverOptions.queue_timeout,1);assert.equal(driverOptions.query_timeout,1);assert.equal(driverOptions.ssl.rejectUnauthorized,true)
logs=[];assert.equal((await admit({action:'sign-in',request:request()})).status,'allow');assert.deepEqual(logs,[])
await run('action_rejected',async()=>assert.equal((await admit({action:'PRIVATE_ACTION',request:request()})).status,'unavailable'))
for(const req of [request({host:'PRIVATE_HOST'}),request({},'https://foreign.example')])await run('ingress_origin_rejected',async()=>assert.equal((await admit({action:'sign-in',request:req})).status,'unavailable'))
for(const headers of [{'x-real-ip':''},{'x-vercel-forwarded-for':''},{'x-real-ip':'PRIVATE_RAW_HEADER'}])await run('ingress_principal_unavailable',async()=>assert.equal((await admit({action:'sign-in',request:request(headers)})).status,'unavailable'))
await run('ingress_identity_mismatch',async()=>assert.equal((await admit({action:'sign-in',request:request({'x-vercel-forwarded-for':'198.51.100.9'})})).status,'unavailable'))
assert.equal(queries,1,'Ingress failures never reach database')
for(const [raw,expected] of [['CONNECT_TIMEOUT','backend_deadline'],['QUERY_TIMEOUT','backend_deadline'],['QUEUE_TIMEOUT','backend_deadline'],['UNABLE_TO_VERIFY_LEAF_SIGNATURE','backend_tls_rejected'],['SELF_SIGNED_CERT_IN_CHAIN','backend_tls_rejected'],['ERR_TLS_CERT_ALTNAME_INVALID','backend_tls_rejected'],['28P01','backend_login_rejected'],['28000','backend_login_rejected'],['42501','backend_access_denied'],['ENOTFOUND','backend_dns_unavailable'],['ECONNREFUSED','backend_connection_unavailable'],['42883','backend_contract_unavailable'],['PRIVATE_UNKNOWN_CODE','backend_unavailable'],['__proto__','backend_unavailable'],['constructor','backend_unavailable'],['toString','backend_unavailable']]){
 driverError=Object.assign(Error('PRIVATE_ERROR_MESSAGE'),{code:raw,detail:'PRIVATE_DETAIL',query:'SELECT PRIVATE_SQL',parameters:['PRIVATE_PARAMETER'],cause:Error('PRIVATE_NESTED_ERROR')})
 await run(expected,async()=>assert.equal((await admit({action:'sign-in',request:request()})).status,'unavailable'))
}
driverError={get code(){throw Error('PRIVATE_GETTER')}}
await run('backend_unavailable',async()=>assert.equal((await admit({action:'sign-in',request:request()})).status,'unavailable'))
driverError=null
for(const invalid of [undefined,null,'PRIVATE_RESULT',{},[],1]){result=[{allowed:invalid}];await run('backend_result_invalid',async()=>assert.equal((await admit({action:'sign-in',request:request()})).status,'unavailable'))}
result=[{allowed:false}];await run('limited',async()=>assert.equal((await admit({action:'sign-in',request:request()})).status,'limited'))
let aborted=false
const fast=load('auth-admission-backend',{'./auth-admission-diagnostics':diagnostics},{setTimeout:fn=>setTimeout(fn,1)})
const timeout=fast.createDistributedAuthAdmission({hmacKey:Buffer.alloc(32,1),resolvePrincipal:()=> 'PRIVATE_PRINCIPAL',consume:(_a,_p,signal)=>new Promise((_,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(Error('PRIVATE_ABORT'))}))})
await run('backend_deadline',async()=>assert.equal((await timeout({action:'sign-in',request:request()})).status,'unavailable'));assert.equal(aborted,true)
for(const [factory,expected] of [()=>null,()=>{throw Error('PRIVATE_CONSTRUCTOR')}].map((factory,index)=>[factory,index?'runtime_unavailable':'configuration_unavailable'])){
 const wrapper=load('auth-admission',{'./auth-admission-diagnostics':diagnostics,'./auth-admission-runtime':{readAdmissionConfig:()=>null,createRuntimeAdmission:factory}})
 await run(expected,async()=>assert.equal((await wrapper.checkDeploymentAuthAdmission({action:'sign-in',request:request()})).status,'unavailable'))
}
logs=[];diagnostics.reportAdmissionDiagnostic('PRIVATE_UNEXPECTED_ENUM');assert.deepEqual(logs,[])
brokenLogging=true
for(const [allowed,status] of [[true,'allow'],[false,'limited'],[null,'unavailable']]){result=[{allowed}];assert.equal((await admit({action:'sign-in',request:request()})).status,status)}
driverError=Object.assign(Error('PRIVATE_ERROR'),{code:'42501'});assert.equal((await admit({action:'sign-in',request:request()})).status,'unavailable')
console.log('PASS fixed-enum failure diagnostics, silent success, one event per failure, no raw/derived data, preserved guards/deadlines/no retries, and logging-outage isolation. No network.')
