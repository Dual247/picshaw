import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { NextRequest, NextResponse } from 'next/server.js'
function load(name,deps){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(`lib/platform/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,module:{exports},URL,Headers,TextDecoder,AbortSignal,process:{env:{}},require:n=>n==='server-only'?{}:n in deps?deps[n]:(()=>{throw Error(n)})()});return exports}
let calls=0,authenticated=true,fail=false
const actor={id:'a',sessionId:'s',expiresAt:9999999999}
const {handleGsc}=load('gsc-handlers',{
 'next/server':{NextRequest,NextResponse},'../supabase/server':{AUTH_RESPONSE_HEADERS:{'Cache-Control':'private, no-store'},createRequestSupabaseClient:()=>{calls++;return {}}},
 '../supabase/portal-config':{readPortalConfig:()=>({origin:'https://app.picshaw.com',url:'https://auth.example.com',sessionEnabled:true})},
 '../supabase/workspace-runtime':{requireWorkspaceActor:async()=>{if(!authenticated)throw Error('PRIVATE_AUTH');return actor},deploymentWorkspaceStore:()=>async()=>({id:'org'})},
 '../supabase/auth-admission':{checkDeploymentAuthAdmission:async()=>({status:'allow'})},
 './gsc-runtime':{deploymentGsc:()=>null},
})
const lifecycle={status:async()=>({status:'not_connected'}),start:async()=>({url:'https://accounts.google.com/o/oauth2/v2/auth?state=mock',browser:'b'.repeat(43)}),callback:async()=>{if(fail)throw Error('SECRET_CODE_TOKEN')},properties:async()=>[],disconnect:async()=>({revocationPending:false})}
const deps={lifecycle}
function req(operation,body={},override={}){return new NextRequest(`${override.origin??'https://app.picshaw.com'}/api/platform/gsc/${operation}${override.query??''}`,{method:operation==='callback'?'GET':'POST',headers:{host:'app.picshaw.com',...(operation==='callback'?{}:{origin:'https://app.picshaw.com','content-type':'application/json','sec-fetch-site':'same-origin'}),...override.headers},...(operation==='callback'?{}:{body:override.raw??JSON.stringify(body)})})}
let count=0
async function test(name,fn){calls=0;await fn();count++;console.log(`PASS ${name}`)}
await test('disabled binding rejects without SDK call',async()=>{assert.equal((await handleGsc(req('status'),'status',{lifecycle:null})).status,503);assert.equal(calls,0)})
await test('wrong Host, actual origin, cross-site and missing Origin denied',async()=>{for(const override of [{headers:{host:'evil.example','x-forwarded-host':'app.picshaw.com'}},{origin:'https://evil.example'},{headers:{origin:'https://evil.example'}},{headers:{origin:''}},{headers:{'sec-fetch-site':'cross-site'}}])assert.equal((await handleGsc(req('status',{},override),'status',deps)).status,403);assert.equal(calls,0)})
await test('admission fails closed before SDK',async()=>{assert.equal((await handleGsc(req('status'),'status',{...deps,admit:async()=>({status:'limited'})})).status,429);assert.equal(calls,0)})
await test('unverified session rejected',async()=>{authenticated=false;assert.equal((await handleGsc(req('status'),'status',deps)).status,401);authenticated=true})
await test('consent must be explicit and browser tenant IDs rejected',async()=>{for(const body of [{},{consent:false},{consent:true,organizationId:'bad'}])assert.equal((await handleGsc(req('connect',body),'connect',deps)).status,400);assert.equal(calls,0)})
await test('oversized body rejected before auth',async()=>{assert.equal((await handleGsc(req('connect',{}, {raw:JSON.stringify({consent:true,padding:'x'.repeat(5000)})}),'connect',deps)).status,400);assert.equal(calls,0)})
await test('consent start sets host-only secure nonce cookie and private headers',async()=>{const response=await handleGsc(req('connect',{consent:true}),'connect',deps);assert.equal(response.status,200);const cookie=response.headers.get('set-cookie');assert.match(cookie,/__Host-picshaw-gsc-state/);assert.match(cookie,/Secure/);assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=lax/);assert.doesNotMatch(cookie,/Domain=/);assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.match(response.headers.get('cache-control'),/no-store/)})
await test('callback accepts top-level provider navigation without Origin',async()=>{const response=await handleGsc(req('callback',{}, {query:'?state=s&code=private-code'}),'callback',deps);assert.equal(response.status,303);assert.equal(response.headers.get('location'),'https://app.picshaw.com/platform/connect?result=connected');assert.ok(!response.headers.get('location').includes('private-code'))})
await test('duplicate query and provider errors cannot leak on callback',async()=>{for(const query of ['?state=x&state=y&code=secret','?code=secret&error=denied']){const response=await handleGsc(req('callback',{}, {query}),'callback',deps);assert.equal(response.headers.get('location'),'https://app.picshaw.com/platform/connect?result=unconfirmed')}fail=true;const response=await handleGsc(req('callback',{}, {query:'?state=x&code=secret'}),'callback',deps);assert.ok(!JSON.stringify([...response.headers]).includes('SECRET'));fail=false})
let driverCalls=0
const {readGscConfig,createDeploymentGsc}=load('gsc-runtime',{'../supabase/database-tls':{createSupabasePoolerTls:()=>{throw Error('Disabled runtime must not initialize TLS')}},'postgres':()=>{driverCalls++;throw Error('LIVE DB FORBIDDEN')},'./gsc-lifecycle':{},'./gsc-crypto':{},'./gsc-provider':{}})
const config={VERCEL:'1',VERCEL_ENV:'production',PIC_SHAW_AUTH_ORIGIN:'https://app.picshaw.com',PIC_SHAW_GSC_ENABLED:'true',PIC_SHAW_AUTH_SESSION_ENABLED:'true',PIC_SHAW_WORKSPACE_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',PIC_SHAW_GSC_DB_HOST:'aws-0-us-east-1.pooler.supabase.com',PIC_SHAW_GSC_DB_PASSWORD:'x'.repeat(32),PIC_SHAW_GSC_CLIENT_ID:'test.apps.googleusercontent.com',PIC_SHAW_GSC_CLIENT_SECRET:'x'.repeat(32),PIC_SHAW_GSC_TOKEN_KEY_V1:Buffer.alloc(32,4).toString('base64')}
await test('complete production configuration binds dedicated role',()=>{assert.equal(readGscConfig(config).user,'picshaw_gsc.abcdefghijklmnopqrst');for(const change of [{VERCEL:undefined},{VERCEL_ENV:'preview'},{PIC_SHAW_GSC_ENABLED:'false'},{PIC_SHAW_GSC_TOKEN_KEY_V1:''},{PIC_SHAW_GSC_CLIENT_SECRET:''},{PIC_SHAW_GSC_DB_HOST:'evil.example'},{PIC_SHAW_AUTH_ORIGIN:'https://picshaw.com'}])assert.equal(createDeploymentGsc({...config,...change}),null);assert.equal(driverCalls,0)})
console.log(`${count} GSC handler/config checks passed. No live network.`)
