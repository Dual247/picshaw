import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { NextRequest, NextResponse } from 'next/server.js'
function load(name, deps) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(`lib/platform/${name}.ts`, 'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {exports,module:{exports},URL,Headers,TextDecoder,AbortSignal,process:{env:{}},require:n=>n==='server-only'?{}:n in deps?deps[n]:(()=>{throw Error(n)})()})
  return exports
}
let calls=0,authenticated=true,fail=false,workspace=true,state='completed',lastIdentity
const actor={id:'server-user',sessionId:'server-session',expiresAt:9999999999}, reportId='10000000-0000-4000-8000-000000000001'
const {handleReports}=load('report-handlers',{
 'next/server':{NextRequest,NextResponse},
 '../supabase/server':{AUTH_RESPONSE_HEADERS:{'Cache-Control':'private, no-store'},createRequestSupabaseClient:adapter=>{calls++;adapter.setAll([{name:'__Host-picshaw-auth',value:'refreshed',options:{httpOnly:true,secure:true,sameSite:'lax',path:'/'}}],{'Cache-Control':'private, no-store'});return {}}},
 '../supabase/portal-config':{readPortalConfig:()=>({origin:'https://app.picshaw.com',url:'https://auth.example.com',sessionEnabled:true})},
 '../supabase/workspace-runtime':{requireWorkspaceActor:async()=>{if(!authenticated)throw Error('SECRET_AUTH');return actor},deploymentWorkspaceStore:()=>async()=>workspace?{id:'server-org'}:null},
 '../supabase/auth-admission':{checkDeploymentAuthAdmission:async()=>({status:'allow'})},'./report-runtime':{deploymentReports:()=>null},
})
const reports={read:async id=>{lastIdentity=id;if(fail)throw Error('SECRET_SQL_TOKEN');return null},status:async()=>null,sync:async()=>({state})}, deps={reports}
function req(body={},override={}){return new NextRequest(`${override.url??'https://app.picshaw.com'}/api/platform/reports/read${override.query??''}`,{method:override.method??'POST',headers:{host:'app.picshaw.com',origin:'https://app.picshaw.com','content-type':'application/json','sec-fetch-site':'same-origin',...override.headers},...(override.method==='GET'?{}:{body:override.raw??JSON.stringify(body)})})}
let count=0
async function test(name,fn){calls=0;await fn();count++;console.log(`PASS ${name}`)}
await test('disabled configuration fails closed without Auth/DB access',async()=>{assert.equal((await handleReports(req(),'read',{reports:null})).status,503);assert.equal(calls,0)})
await test('exact host, origin, POST and no query URL required before authentication',async()=>{
 for(const override of [{headers:{host:'evil.example','x-forwarded-host':'app.picshaw.com'}},{url:'https://evil.example'},{headers:{origin:'https://evil.example'}},{headers:{origin:''}},{headers:{'sec-fetch-site':'cross-site'}},{method:'GET'},{query:'?reportId=secret'}])assert.equal((await handleReports(req({},override),'read',deps)).status,403)
 assert.equal(calls,0)
})
await test('server owns identity, operation and artifact plan; rejects extra browser authority',async()=>{
 for(const body of [{organizationId:'spoof'},{actorId:'spoof'},{lease:'spoof'},{review:{}},{operationId:'spoof'},{reportId:'bad'}])assert.equal((await handleReports(req(body),'read',deps)).status,400)
 assert.equal((await handleReports(req({reportId}),'sync',deps)).status,400);assert.equal(calls,0)
 const response=await handleReports(req({reportId}),'read',deps);assert.equal(response.status,200);assert.equal(lastIdentity.actor.id,actor.id);assert.equal(lastIdentity.organizationId,'server-org')
})
await test('body bounded and valid JSON object required before auth',async()=>{
 for(const raw of ['null','[]','1','{','{"x":"'+'x'.repeat(600)+'"}'])assert.equal((await handleReports(req({}, {raw}),'read',deps)).status,400)
 assert.equal(calls,0)
})
await test('distributed admission precedes session work and session/membership errors return no report',async()=>{
 assert.equal((await handleReports(req(),'read',{...deps,admit:async()=>({status:'limited'})})).status,429);assert.equal(calls,0)
 authenticated=false;assert.equal((await handleReports(req(),'read',deps)).status,401);authenticated=true
 workspace=false;assert.equal((await handleReports(req(),'read',deps)).status,409);workspace=true
})
await test('refresh cookie propagated with no-store no-referrer noindex on success and error',async()=>{
 for(const error of [false,true]){fail=error;const response=await handleReports(req(),'read',deps);assert.equal(response.status,error?503:200)
  assert.match(response.headers.get('cache-control'),/private.*no-store/);assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow')
  assert.match(response.headers.get('set-cookie'),/__Host-picshaw-auth=refreshed/);assert.match(response.headers.get('set-cookie'),/HttpOnly/);assert.doesNotMatch(await response.text(),/SECRET/)
 }fail=false
})
await test('concurrency busy and provider-unavailable status remain truthful',async()=>{
 state='busy';assert.equal((await handleReports(req(),'sync',deps)).status,202)
 state='unavailable';assert.equal((await handleReports(req(),'sync',deps)).status,503)
 state='completed';assert.equal((await handleReports(req(),'sync',deps)).status,200)
})
let drivers=0
const {readReportConfig,createDeploymentReports}=load('report-runtime',{'../supabase/database-tls':{createSupabasePoolerTls:()=>{throw Error('Disabled runtime must not initialize TLS')}},'postgres':()=>{drivers++;throw Error('LIVE DB FORBIDDEN')},'./report-service':{},'./gsc-runtime':{deploymentGsc:()=>null}})
const config={VERCEL:'1',VERCEL_ENV:'production',PIC_SHAW_AUTH_ORIGIN:'https://app.picshaw.com',PIC_SHAW_REPORTS_ENABLED:'true',PIC_SHAW_AUTH_SESSION_ENABLED:'true',PIC_SHAW_WORKSPACE_ENABLED:'true',PIC_SHAW_GSC_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',PIC_SHAW_REPORTS_DB_HOST:'aws-1-us-west-1.pooler.supabase.com',PIC_SHAW_REPORTS_DB_PASSWORD:'x'.repeat(32)}
await test('production runtime uses dedicated report role and disabled gates never contact DB',()=>{
 assert.equal(readReportConfig(config).user,'picshaw_reports.abcdefghijklmnopqrst')
 for(const change of [{VERCEL:undefined},{VERCEL_ENV:'preview'},{PIC_SHAW_REPORTS_ENABLED:'false'},{PIC_SHAW_AUTH_SESSION_ENABLED:'false'},{PIC_SHAW_WORKSPACE_ENABLED:'false'},{PIC_SHAW_GSC_ENABLED:'false'},{PIC_SHAW_REPORTS_DB_HOST:'attacker.example'},{PIC_SHAW_REPORTS_DB_PASSWORD:''},{PIC_SHAW_AUTH_ORIGIN:'https://picshaw.com'}])assert.equal(createDeploymentReports({...config,...change}),null)
 assert.equal(drivers,0)
})
console.log(`${count} report handler/config checks passed. No live network.`)
