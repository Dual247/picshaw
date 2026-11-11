import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import vm from 'node:vm'
import * as crypto from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
const { PGlite } = await import(pathToFileURL(resolve('validation/tenant-database-tooling/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db = new PGlite(), loaded = new Map()
function load(name) {
  if (loaded.has(name)) return loaded.get(name)
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(`lib/platform/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {exports,module:{exports},Buffer,Date,URL,URLSearchParams,Response,AbortSignal,fetch:()=>{throw Error('REAL NETWORK FORBIDDEN')},require:name=>name==='server-only'?{}:name==='node:crypto'?crypto:load(name.replace('./',''))})
  loaded.set(name,exports); return exports
}
const { tokenCipher,digest } = load('gsc-crypto'), { googleProvider } = load('gsc-provider'), { createGscLifecycle } = load('gsc-lifecycle'), { GSC_SCOPE }=load('gsc')
let count=0
async function test(name,fn){await fn(); console.log(`PASS ${name}`);count++}
const user=crypto.randomUUID(),session=crypto.randomUUID(),org=crypto.randomUUID(),other=crypto.randomUUID()
const identity={actor:{id:user,sessionId:session,expiresAt:Math.floor(Date.now()/1000)+3600},organizationId:org}
const sqlStore=async(actor,org,operation,payload)=> (await db.query('select picshaw_gsc_private.operation($1::uuid,$2::uuid,$3::bigint,$4::uuid,$5::text,$6::jsonb) as value',[actor.id,actor.sessionId,actor.expiresAt,org,operation,JSON.stringify(payload)])).rows[0].value
let providerCalls=[],failRevoke=false,refreshScope=undefined,failComplete=false
const transport=async(url,options)=>{
  providerCalls.push({url,options})
  assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store')
  if(url==='https://oauth2.googleapis.com/revoke') return new Response('',{status:failRevoke?503:200})
  if(url==='https://www.googleapis.com/webmasters/v3/sites')return Response.json({siteEntry:[{siteUrl:'sc-domain:example.com',permissionLevel:'siteOwner'},{siteUrl:'https://example.com/',permissionLevel:'siteFullUser'},{siteUrl:'sc-domain:denied.com',permissionLevel:'siteUnverifiedUser'}]})
  assert.equal(url,'https://oauth2.googleapis.com/token')
  const body=new URLSearchParams(options.body),refresh=body.get('grant_type')==='refresh_token'
  return Response.json({access_token:'mock-access',token_type:'Bearer',expires_in:3600,...(refresh?{...(refreshScope?{scope:refreshScope}:{})}:{refresh_token:'mock-refresh',scope:GSC_SCOPE})})
}
const cipher=tokenCipher(Buffer.alloc(32,4).toString('base64'))
const service=createGscLifecycle({store:async(...args)=>{if(failComplete&&args[2]==='complete')throw Error('Lost result');return sqlStore(...args)},cipher,provider:googleProvider({clientId:'fake.apps.googleusercontent.com',clientSecret:'mock-secret-only'},transport),transport})
try{
  await db.exec(readFileSync('supabase/tests/bootstrap.sql','utf8'))
  for(const name of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort())await db.exec(readFileSync(`supabase/migrations/${name}`,'utf8'))
  await db.query('insert into auth.users(id,email_confirmed_at) values($1,now()),($2,now())',[user,other])
  await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,user])
  await db.query('insert into public.organizations(id,name) values($1,$2)',[org,'Test workspace'])
  await db.query("insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'owner')",[org,user])
  await test('private schema rejects browser and service role',async()=>{for(const role of ['anon','authenticated','service_role']){await db.exec(`set role ${role}`);await assert.rejects(service.status(identity),/permission denied/);await db.exec('reset role')}})
  await db.exec('set role picshaw_gsc')
  await test('server role has no direct token-table access',()=>assert.rejects(db.query('select * from picshaw_gsc_private.connections'),/permission denied/))
  await test('authenticated disconnected status',async()=>assert.equal((await service.status(identity)).status,'not_connected'))
  await test('wrong tenant and signed-out session denied',async()=>{await assert.rejects(service.status({...identity,organizationId:crypto.randomUUID()}));await assert.rejects(service.status({...identity,actor:{...identity.actor,sessionId:crypto.randomUUID()}}))})
  await test('AES-GCM context and tamper binding',()=>{const sealed=cipher.seal('secret','tenant:a');assert.equal(cipher.open(sealed,'tenant:a'),'secret');assert.throws(()=>cipher.open(sealed,'tenant:b'));assert.throws(()=>cipher.open(sealed+'x','tenant:a'))})
  let start,state
  await test('separate exact-scope OAuth with PKCE',async()=>{start=await service.start(identity);const url=new URL(start.url);state=url.searchParams.get('state');assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('scope'),GSC_SCOPE);assert.equal(url.searchParams.get('include_granted_scopes'),'false');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('redirect_uri'),'https://app.picshaw.com/api/platform/gsc/callback');assert.ok(!start.url.includes('mock-secret'))})
  await test('wrong browser binding does not exchange',async()=>{const before=providerCalls.length;await assert.rejects(service.callback(identity,state,'x'.repeat(43),'mock-code',false));assert.equal(providerCalls.length,before)})
  await test('callback creates metadata and encrypted token atomically',async()=>{await service.callback(identity,state,start.browser,'mock-code',false);assert.equal((await service.status(identity)).status,'active');await db.exec('reset role');const row=(await db.query('select * from picshaw_gsc_private.connections')).rows[0];assert.ok(!row.encrypted_refresh.includes('mock-refresh'));assert.equal(row.token_actor,user);await db.exec('set role picshaw_gsc')})
  await test('callback replay cannot reexchange code',async()=>{const before=providerCalls.length;await assert.rejects(service.callback(identity,state,start.browser,'mock-code',false));assert.equal(providerCalls.length,before)})
  await test('active connection prevents overlapping consent',()=>assert.rejects(service.start(identity)))
  const connection=(await service.status(identity)).connectionId
  await test('exact domain/prefix IDs preserved and unverified excluded',async()=>{const p=await service.properties(identity,connection);assert.equal(p.length,2);assert.equal(p[0].siteUrl,'sc-domain:example.com');assert.equal(p[1].siteUrl,'https://example.com/')})
  await test('selection rechecks provider and rejects normalized impostor',async()=>{await assert.rejects(service.properties(identity,connection,'example.com'));await service.properties(identity,connection,'sc-domain:example.com');assert.equal((await service.status(identity)).selectedProperty,'sc-domain:example.com')})
  await test('journey resolver binds persisted selection and current actor',async()=>{const resolver=service.journeyResolver(identity);assert.ok(await resolver.resolve({organizationId:org,connectionId:connection,propertyId:'sc-domain:example.com'}));assert.equal(await resolver.resolve({organizationId:org,connectionId:connection,propertyId:'https://example.com/'}),null)})
  await test('reader resolver never accepts caller actor substitution',async()=>assert.equal(await service.resolver(identity).resolve(other,org,connection),null))
  await test('refresh accepts omitted scope but rejects expanded grant',async()=>{refreshScope=GSC_SCOPE+' email';await assert.rejects(service.properties(identity,connection));assert.equal((await service.status(identity)).status,'reconnect_required');refreshScope=undefined})
  await test('disconnect fails closed before failed remote revocation',async()=>{failRevoke=true;assert.equal((await service.disconnect(identity,connection)).revocationPending,true);assert.equal((await service.status(identity)).status,'disconnected');await assert.rejects(service.properties(identity,connection));await assert.rejects(service.start(identity))})
  await test('revocation retry retains same encrypted grant then erases',async()=>{failRevoke=false;assert.equal((await service.disconnect(identity,connection)).revocationPending,false);await db.exec('reset role');assert.equal((await db.query('select encrypted_refresh from picshaw_gsc_private.connections')).rows[0].encrypted_refresh,null);await db.exec('set role picshaw_gsc')})
  await test('ambiguous callback cannot be silently re-exchanged',async()=>{const s=await service.start(identity),st=new URL(s.url).searchParams.get('state');failComplete=true;await assert.rejects(service.callback(identity,st,s.browser,'code',false));failComplete=false;const before=providerCalls.length;await assert.rejects(service.callback(identity,st,s.browser,'code',false));assert.equal(providerCalls.length,before)})
  await test('revoked membership denies all operations',async()=>{await db.exec('reset role');await db.query('update public.organization_memberships set revoked_at=now() where user_id=$1',[user]);await db.exec('set role picshaw_gsc');await assert.rejects(service.status(identity))})
  await test('tokens never appear in request URLs',()=>{for(const request of providerCalls)assert.ok(!/mock-access|mock-refresh|mock-secret/.test(request.url))})
  console.log(`${count} GSC lifecycle checks passed. Fresh local PGlite and mocked Google only; no hosted calls.`)
}finally{await db.close()}
