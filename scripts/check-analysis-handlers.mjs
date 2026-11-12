import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { NextRequest, NextResponse } from 'next/server.js'
let fetches = 0, auth = true, membership = true, revoke = false
const actor = {id:'user',sessionId:'session',expiresAt:9999999999}
const exports = {}
const dependencies = {
  'server-only': {}, 'next/server': {NextRequest,NextResponse},
  '../supabase/server': {AUTH_RESPONSE_HEADERS:{'Cache-Control':'private, no-store'},createRequestSupabaseClient:()=>({})},
  '../supabase/portal-config': {readPortalConfig:()=>({origin:'https://app.picshaw.com',url:'https://example.supabase.co',sessionEnabled:true})},
  '../supabase/workspace-runtime': {deploymentWorkspaceStore:()=>async()=>membership?{id:'org'}:null,requireWorkspaceActor:async()=>{if(!auth)throw Error('PRIVATE');return actor}},
  '../supabase/auth-admission': {checkDeploymentAuthAdmission:async()=>({status:'allow'})},
  './website-analysis': {analyzeWebsite:async()=>{fetches++;if(revoke)auth=false;return {title:'Evidence'}}},
}
vm.runInNewContext(ts.transpileModule(readFileSync('lib/platform/analysis-handlers.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,module:{exports},URL,Headers,TextDecoder,setTimeout,clearTimeout,process:{env:{}},require:name=>{assert.ok(name in dependencies,name);return dependencies[name]}})
const deps={env:{PIC_SHAW_ANALYSIS_ENABLED:'true'}}
const body={url:'https://example.com/',consent:true}
function request(value=body,headers={}) {return new NextRequest('https://app.picshaw.com/api/platform/analysis',{method:'POST',headers:{host:'app.picshaw.com',origin:'https://app.picshaw.com','content-type':'application/json',...headers},body:JSON.stringify(value)})}
assert.equal((await exports.handleAnalysis(request())).status,503)
for(const headers of [{host:'evil.example'},{origin:'https://evil.example'},{'sec-fetch-site':'cross-site'}]) assert.equal((await exports.handleAnalysis(request(body,headers),deps)).status,403)
for(const value of [{...body,consent:false},{...body,actorId:'spoof'},{url:1,consent:true},null,[],{...body,url:'a'.repeat(5000)}]) assert.equal((await exports.handleAnalysis(request(value),deps)).status,400)
assert.equal(fetches,0)
auth=false; assert.equal((await exports.handleAnalysis(request(),deps)).status,401);auth=true
membership=false;assert.equal((await exports.handleAnalysis(request(),deps)).status,409);membership=true
assert.equal((await exports.handleAnalysis(request(),{...deps,admit:async()=>({status:'limited'})})).status,429)
assert.equal(fetches,0)
const success=await exports.handleAnalysis(request(),deps);assert.equal(success.status,200);assert.match(success.headers.get('cache-control'),/no-store/);assert.equal(success.headers.get('referrer-policy'),'no-referrer');assert.equal(fetches,1)
revoke=true;const revoked=await exports.handleAnalysis(request(),deps);assert.equal(revoked.status,503);assert.doesNotMatch(await revoked.text(),/Evidence|PRIVATE/)
console.log('Analysis handler checks passed: gates, consent, bounds, origin, auth, workspace, rate limits, revocation and private headers. No network.')
let cancelled=false
const stalled=request()
Object.defineProperty(stalled,'body',{value:new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled=true}})})
const before=Date.now(), priorFetches=fetches
assert.equal((await exports.handleAnalysis(stalled,deps)).status,400)
assert.ok(Date.now()-before<5000,'Stalled body must end within its bounded deadline')
assert.equal(cancelled,true)
assert.equal(fetches,priorFetches,'Stalled request must never fetch a site')
console.log('PASS stalled request body is canceled after its bounded deadline')
 auth=true;revoke=false;cancelled=false
const unterminated=request()
Object.defineProperty(unterminated,'body',{value:new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(JSON.stringify(body)))},pull(){return new Promise(()=>{})},cancel(){cancelled=true}})})
assert.equal((await exports.handleAnalysis(unterminated,deps)).status,400,'Valid JSON without stream completion must still time out')
assert.equal(cancelled,true)
assert.equal(fetches,priorFetches)
console.log('PASS complete JSON on an unfinished stream is not accepted after timeout')

const oversized=request()
Object.defineProperty(oversized,'body',{value:new ReadableStream({start(controller){controller.enqueue(new Uint8Array(5000))},cancel(){return new Promise(()=>{})}})})
const oversizedStart=Date.now()
assert.equal((await exports.handleAnalysis(oversized,deps)).status,400)
assert.ok(Date.now()-oversizedStart<1000,'Oversized request must not await stalled cancellation')
assert.equal(fetches,priorFetches)
console.log('PASS oversized request does not await never-settling cancellation')
