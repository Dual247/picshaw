import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { NextRequest, NextResponse } from 'next/server.js'
let fetches = 0, auth = true, membership = true, revoke = false, accessMode = 'pilot'
const actor = {id:'user',sessionId:'session',expiresAt:9999999999}
const exports = {}
const dependencies = {
  'server-only': {}, 'next/server': {NextRequest,NextResponse},
  '../supabase/server': {AUTH_RESPONSE_HEADERS:{'Cache-Control':'private, no-store'},createRequestSupabaseClient:()=>({})},
  '../supabase/portal-config': {readPortalConfig:()=>({origin:'https://app.picshaw.com',url:'https://example.supabase.co',sessionEnabled:true,accessMode})},
  '../supabase/workspace-runtime': {deploymentWorkspaceStore:()=>async()=>membership?{id:'org',site:'example.com'}:null,requireWorkspaceActor:async()=>{if(!auth)throw Error('PRIVATE');return actor}},
  '../supabase/auth-admission': {checkDeploymentAuthAdmission:async()=>({status:'allow'})},
  './dataforseo-runtime': {createDataForSeoRun:()=>async(input)=>{assert.equal(input.domain,'example.com');assert.equal(input.workspaceId,'org');fetches++;if(revoke)auth=false;return {title:'Evidence'}}},
}
vm.runInNewContext(ts.transpileModule(readFileSync('lib/platform/dataforseo-handlers.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,module:{exports},Error,URL,Headers,TextDecoder,setTimeout,clearTimeout,process:{env:{}},require:name=>{assert.ok(name in dependencies,name);return dependencies[name]}})
const deps={env:{PIC_SHAW_DATAFORSEO_ENABLED:'true'}}
const body={platform:'google',jobId:'11111111-1111-4111-8111-111111111111',consent:'dataforseo-domain-v1'}
function request(value=body,headers={}) {return new NextRequest('https://app.picshaw.com/api/platform/analysis',{method:'POST',headers:{host:'app.picshaw.com',origin:'https://app.picshaw.com','content-type':'application/json',...headers},body:JSON.stringify(value)})}
assert.equal((await exports.handleDataForSeoAnalysis(request())).status,503)
for(const headers of [{host:'evil.example'},{origin:'https://evil.example'},{'sec-fetch-site':'cross-site'}]) assert.equal((await exports.handleDataForSeoAnalysis(request(body,headers),deps)).status,403)
for(const value of [{...body,consent:false},{...body,actorId:'spoof'},{...body,platform:'other'},null,[],{...body,jobId:'a'.repeat(5000)}]) assert.equal((await exports.handleDataForSeoAnalysis(request(value),deps)).status,400)
for(const mode of ['closed','public']){accessMode=mode;assert.equal((await exports.handleDataForSeoAnalysis(request(),deps)).status,503)}accessMode='pilot'
assert.equal(fetches,0)
auth=false; assert.equal((await exports.handleDataForSeoAnalysis(request(),deps)).status,401);auth=true
membership=false;assert.equal((await exports.handleDataForSeoAnalysis(request(),deps)).status,409);membership=true
assert.equal((await exports.handleDataForSeoAnalysis(request(),{...deps,admit:async()=>({status:'limited'})})).status,429)
for(const mode of ['closed','public']){accessMode=mode;assert.equal((await exports.handleDataForSeoAnalysis(request(),deps)).status,503)}accessMode='pilot'
assert.equal(fetches,0)
assert.equal((await exports.handleDataForSeoAnalysis(request(),{...deps,run:null})).status,503);assert.equal(fetches,0)
const success=await exports.handleDataForSeoAnalysis(request(),deps);assert.equal(success.status,200);assert.match(success.headers.get('cache-control'),/no-store/);assert.equal(success.headers.get('referrer-policy'),'no-referrer');assert.equal(fetches,1)
revoke=true;const revoked=await exports.handleDataForSeoAnalysis(request(),deps);assert.equal(revoked.status,503);assert.doesNotMatch(await revoked.text(),/Evidence|PRIVATE/)
console.log('DataForSEO authenticated handler checks passed: gates, consent, bounds, origin, auth, workspace, rate limits, revocation and private headers. No network.')
let cancelled=false
const stalled=request()
Object.defineProperty(stalled,'body',{value:new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled=true}})})
const before=Date.now(), priorFetches=fetches
assert.equal((await exports.handleDataForSeoAnalysis(stalled,deps)).status,400)
assert.ok(Date.now()-before<5000,'Stalled body must end within its bounded deadline')
assert.equal(cancelled,true)
assert.equal(fetches,priorFetches,'Stalled request must never fetch a site')
console.log('PASS stalled request body is canceled after its bounded deadline')
 auth=true;revoke=false;cancelled=false
const unterminated=request()
Object.defineProperty(unterminated,'body',{value:new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(JSON.stringify(body)))},pull(){return new Promise(()=>{})},cancel(){cancelled=true}})})
assert.equal((await exports.handleDataForSeoAnalysis(unterminated,deps)).status,400,'Valid JSON without stream completion must still time out')
assert.equal(cancelled,true)
assert.equal(fetches,priorFetches)
console.log('PASS complete JSON on an unfinished stream is not accepted after timeout')

const oversized=request()
Object.defineProperty(oversized,'body',{value:new ReadableStream({start(controller){controller.enqueue(new Uint8Array(5000))},cancel(){return new Promise(()=>{})}})})
const oversizedStart=Date.now()
assert.equal((await exports.handleDataForSeoAnalysis(oversized,deps)).status,400)
assert.ok(Date.now()-oversizedStart<1000,'Oversized request must not await stalled cancellation')
assert.equal(fetches,priorFetches)
console.log('PASS oversized request does not await never-settling cancellation')
auth=true;revoke=false
for(const [code,status] of [['42501',403],['AUTHENTICATION_REQUIRED',401]]){
 const prior=fetches
 const response=await exports.handleDataForSeoAnalysis(request(),{...deps,workspace:async()=>{const error=new Error(code==='42501'?'Workspace access denied':'PRIVATE');error.code=code;throw error}})
 assert.equal(response.status,status);assert.doesNotMatch(await response.text(),/PRIVATE/);assert.equal(fetches,prior)
}
console.log('PASS workspace permission and session failures have sanitized 403/401 status')

const unknownPermission=await exports.handleDataForSeoAnalysis(request(),{...deps,workspace:async()=>{const error=new Error('permission denied for schema private');error.code='42501';throw error}})
assert.equal(unknownPermission.status,503);assert.doesNotMatch(await unknownPermission.text(),/schema private/)
console.log('PASS unknown SQL permission errors remain sanitized503')
