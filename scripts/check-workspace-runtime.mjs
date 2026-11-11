import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { NextRequest, NextResponse } from 'next/server.js'
function load(name, dependencies = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(`lib/supabase/${name}.ts`,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, module: { exports }, URL, Headers, TextDecoder, Uint8Array, AbortSignal, Date, process: { env: {} },
      require: name => { if (name === 'server-only') return {}; if (name in dependencies) return dependencies[name]; throw Error(`Unexpected import ${name}`) } })
  return exports
}
const input = load('workspace-input'), auth = load('auth')
let options, parameters, rows = [{ workspace: { id: '10000000-0000-4000-8000-000000000010', name:'Workspace',site:'example.com' } }]
const runtime = load('workspace-runtime', { './workspace-input':input, './auth':auth, postgres: { default: opts => {
  options = opts
  return (_strings,...args) => { parameters=args; return { signal: async signal => { assert.ok(signal); return rows } } }
} } })
const env = { VERCEL:'1', VERCEL_ENV:'production', PIC_SHAW_AUTH_ORIGIN:'https://app.picshaw.com', PIC_SHAW_AUTH_SESSION_ENABLED:'true',
  PIC_SHAW_WORKSPACE_ENABLED:'true', NEXT_PUBLIC_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',
  PIC_SHAW_WORKSPACE_DB_HOST:'aws-0-us-west-1.pooler.supabase.com', PIC_SHAW_WORKSPACE_DB_PASSWORD:'x'.repeat(40) }
const uid='10000000-0000-4000-8000-000000000001', sid='10000000-0000-4000-8000-000000000002'
const claims = { sub:uid,session_id:sid,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated',is_anonymous:false,iss:`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`,aud:'authenticated' }
const client = { auth: { getClaims: async()=>({data:{claims},error:null}),getUser:async()=>({data:{user:{id:uid,is_anonymous:false}},error:null}) } }
const actor = await runtime.requireWorkspaceActor(client,env.NEXT_PUBLIC_SUPABASE_URL)
assert.equal(actor.sessionId,sid)
for (const patch of [{session_id:'not-a-uuid'},{sub:'not-a-uuid'},{exp:0},{is_anonymous:true},{iss:'https://attacker.invalid/auth/v1'},{aud:'service_role'},{role:'service_role'}]) {
  await assert.rejects(()=>runtime.requireWorkspaceActor({auth:{...client.auth,getClaims:async()=>({data:{claims:{...claims,...patch}},error:null})}},env.NEXT_PUBLIC_SUPABASE_URL))
}
await assert.rejects(()=>runtime.requireWorkspaceActor({auth:{...client.auth,getClaims:async()=>({data:{claims},error:Error('signature')})}},env.NEXT_PUBLIC_SUPABASE_URL))
await assert.rejects(()=>runtime.requireWorkspaceActor({auth:{...client.auth,getUser:async()=>({data:{user:{id:sid,is_anonymous:false}},error:null})}},env.NEXT_PUBLIC_SUPABASE_URL))
assert.equal(runtime.createWorkspaceStore({}),null)
for (const patch of [{VERCEL_ENV:'preview'},{VERCEL:'0'},{PIC_SHAW_WORKSPACE_ENABLED:'false'},{PIC_SHAW_WORKSPACE_DB_HOST:'attacker.invalid'},{PIC_SHAW_WORKSPACE_DB_PASSWORD:'short'}]) assert.equal(runtime.createWorkspaceStore({...env,...patch}),null)
const store = runtime.createWorkspaceStore(env)
assert.equal(options.username,'picshaw_workspace.abcdefghijklmnopqrst')
assert.equal(options.ssl.rejectUnauthorized,true)
assert.equal(options.prepare,false)
assert.equal(options.max_pipeline,1)
assert.equal((await store(actor,{name:'Workspace',site:'example.com'})).id,rows[0].workspace.id)
assert.deepEqual(parameters,[uid,sid,claims.exp,true,'Workspace','example.com'])
rows=[{workspace:null}];assert.equal(await store(actor,null),null)
await assert.rejects(()=>store(actor,{name:'Workspace',site:'https://example.com'}))
rows=[{workspace:{id:'bad'}}];await assert.rejects(()=>store(actor,null))
for (const value of [{name:'X',site:'example.com',organizationId:uid},{name:'X',site:'user@example.com'},{name:'X',site:'127.0.0.1'},{name:'X',site:'example.com/path'},{name:'X\n',site:'example.com'}]) assert.equal(input.parseWorkspaceInput(value),null)

const portal = { readPortalConfig:()=>({origin:env.PIC_SHAW_AUTH_ORIGIN,url:env.NEXT_PUBLIC_SUPABASE_URL,sessionEnabled:true}) }
const server = { AUTH_RESPONSE_HEADERS:{'Cache-Control':'private, no-store'},createRequestSupabaseClient:()=>{throw Error('Live SDK forbidden')} }
const handlers=load('workspace-handlers',{'./server':server,'./portal-config':portal,'./auth-admission':{},'./workspace-runtime':runtime,'./workspace-input':input,'next/server':{NextRequest,NextResponse}})
let stores=0,auths=0
const dependencies={store:async(a,i)=>{stores++;assert.equal(a.sessionId,sid);return i?{...i,id:uid}:null},admit:async()=>({status:'allow'}),createClient:adapter=>{
  auths++;adapter.setAll([{name:'__Host-picshaw-auth',value:'rotated',options:{secure:true,httpOnly:true,path:'/'}}],{})
  return client
}}
const request=(body={},headers={},raw)=>new NextRequest('https://app.picshaw.com/api/platform/workspaces/bootstrap',{method:'POST',headers:{host:'app.picshaw.com',origin:'https://app.picshaw.com','content-type':'application/json',...headers},body:raw??JSON.stringify(body)})
let response=await handlers.handleWorkspacePost(request({name:'Workspace',site:'example.com'}),true,dependencies)
assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/HttpOnly/);assert.match(response.headers.get('cache-control'),/no-store/)
assert.equal(stores,1)
for (const headers of [{origin:'https://picshaw.com'},{host:'picshaw.com'},{'sec-fetch-site':'cross-site'}]) assert.equal((await handlers.handleWorkspacePost(request({},headers),false,dependencies)).status,403)
assert.equal((await handlers.handleWorkspacePost(request({organizationId:uid}),false,dependencies)).status,400)
assert.equal((await handlers.handleWorkspacePost(request({}, {},'x'.repeat(2049)),true,dependencies)).status,400)
assert.equal((await handlers.handleWorkspacePost(request(),false,{...dependencies,admit:async()=>({status:'limited'})})).status,429)
assert.equal(auths,1,'CSRF, invalid body and admission denial precede auth')
response=await handlers.handleWorkspacePost(request(),false,{...dependencies,store:async()=>{throw Error('PRIVATE_DATABASE_SECRET')}})
assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/PRIVATE_DATABASE_SECRET/)
assert.equal((await handlers.handleWorkspacePost(request(),false,{...dependencies,store:null})).status,503)
console.log('PASS workspace verified claims, concrete Postgres adapter, configuration, strict CSRF, body bounds, admission, cookie propagation and safe failures (mocked SDK/driver).')
