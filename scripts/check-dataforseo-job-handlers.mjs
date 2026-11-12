import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
import {NextRequest,NextResponse} from 'next/server.js'
const exports={};let paid=0,reads=0,auth=true,revoked=false,permission=null
const actor={id:'actor',sessionId:'session',expiresAt:9999999999}
const jobId='11111111-1111-4111-8111-111111111111'
const makeJob=()=>({jobId,domain:'example.com',platform:'google',rowLimit:20,state:'completed',createdAt:'2026-11-12'})
const modules={
 'server-only':{},'next/server':{NextRequest,NextResponse},
 '../supabase/server':{AUTH_RESPONSE_HEADERS:{'Cache-Control':'private, no-store'},createRequestSupabaseClient:()=>({})},
 '../supabase/portal-config':{readPortalConfig:()=>({origin:'https://app.picshaw.com',url:'https://example.supabase.co',sessionEnabled:true,accessMode:'pilot'})},
 '../supabase/workspace-runtime':{requireWorkspaceActor:async()=>{if(!auth)throw Error('PRIVATE');return actor},deploymentWorkspaceStore:()=>async()=>{if(permission){const e=new Error(permission);e.code='42501';throw e}return {id:'org',site:'example.com'}}},
 '../supabase/auth-admission':{checkDeploymentAuthAdmission:async()=>({status:'allow'})},
 './dataforseo-job-runtime':{createDataForSeoGateway:(a,w)=>{assert.equal(a,actor);assert.equal(w.id,'org');return {submit:async input=>{assert.deepEqual(Object.keys(input).sort(),['jobId','platform']);paid++;if(revoked)auth=false;return makeJob()},read:async id=>{assert.equal(id,jobId);reads++;return makeJob()},latest:async platform=>{assert.equal(platform,'google');reads++;return null}}}},
}
vm.runInNewContext(ts.transpileModule(readFileSync('lib/platform/dataforseo-job-handlers.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,module:{exports},Error,URL,Headers,TextDecoder,setTimeout,clearTimeout,process:{env:{}},require:name=>{assert.ok(name in modules,name);return modules[name]}})
const deps={env:{PIC_SHAW_DATAFORSEO_ENABLED:'true'}},submit={platform:'google',jobId,consent:'dataforseo-domain-v1'}
function req(body,headers={}){return new NextRequest('https://app.picshaw.com/api/platform/ai-visibility/submit',{method:'POST',headers:{host:'app.picshaw.com',origin:'https://app.picshaw.com','content-type':'application/json',...headers},body:JSON.stringify(body)})}
assert.equal((await exports.handleDataForSeoJob(req(submit),'submit')).status,503)
for(const headers of [{host:'evil.example'},{origin:'https://evil.example'},{'sec-fetch-site':'cross-site'}])assert.equal((await exports.handleDataForSeoJob(req(submit,headers),'submit',deps)).status,403)
for(const body of [{...submit,domain:'attacker.com'},{...submit,consent:false},{...submit,workspaceId:'other'},{...submit,platform:'other'}])assert.equal((await exports.handleDataForSeoJob(req(body),'submit',deps)).status,400)
assert.equal(paid,0)
auth=false;assert.equal((await exports.handleDataForSeoJob(req(submit),'submit',deps)).status,401);auth=true
const response=await exports.handleDataForSeoJob(req(submit),'submit',deps);assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(paid,1)
for(const [action,body] of [['read',{jobId}],['latest',{platform:'google'}]]){const r=await exports.handleDataForSeoJob(req(body),action,deps);assert.equal(r.status,200)}
assert.equal(reads,2);assert.equal(paid,1)
assert.equal((await exports.handleDataForSeoJob(req(submit),'read',deps)).status,400)
assert.equal((await exports.handleDataForSeoJob(req({platform:'google',domain:'other.com'}),'latest',deps)).status,400)
permission='Workspace access denied';assert.equal((await exports.handleDataForSeoJob(req({jobId}),'read',deps)).status,403)
permission='permission denied for schema private';const misconfigured=await exports.handleDataForSeoJob(req({jobId}),'read',deps);assert.equal(misconfigured.status,503);assert.doesNotMatch(await misconfigured.text(),/schema private/);permission=null
revoked=true;const lost=await exports.handleDataForSeoJob(req(submit),'submit',deps);assert.equal(lost.status,503);assert.doesNotMatch(await lost.text(),/example.com|PRIVATE/)
console.log('PASS durable job handler: disabled/origin/auth gates, explicit consent, server-owned workspace/domain, read/latest have no paid side effects, precise permission mapping and revoked evidence suppression. Mock-only.')
