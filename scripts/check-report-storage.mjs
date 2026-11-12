import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'
// Disposable single-session PostgreSQL WASM. No credentials, network, or hosted target.
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2] ?? '../platform/validation/tenant-database-tooling/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db = new PGlite()
const loaded = new Map()
function load(name) {
 if (loaded.has(name)) return loaded.get(name)
 const exports = {}
 vm.runInNewContext(ts.transpileModule(readFileSync(`lib/platform/${name}.ts`, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
 {exports,module:{exports},Date,Intl,URL,Buffer,require:n=>n==='server-only'?{}:n==='node:crypto'?{randomUUID}:load(n.replace('./',''))})
 loaded.set(name,exports);return exports
}
const core=load('core'), journey=load('journey')
const copy=x=>JSON.parse(JSON.stringify(x))
let count=0
async function test(name,fn){await fn();console.log(`PASS ${name}`);count++}
async function admin(fn){await db.exec('reset role');try{return await fn()}finally{await db.exec('set role picshaw_reports')}}
async function fixture(){
 const user=randomUUID(),session=randomUUID(),org=randomUUID(),connection=randomUUID()
 await admin(async()=>{
  await db.query('insert into auth.users(id,email_confirmed_at) values($1,now())',[user])
  await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,user])
  await db.query("insert into public.organizations(id,name) values($1,'Reports test')",[org])
  await db.query("insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'owner')",[org,user])
  await db.query("insert into public.google_connections(organization_id,id,label,created_by) values($1,$2,'GSC',$3)",[org,connection,user])
  await db.query("insert into picshaw_gsc_private.connections(organization_id,connection_id,encrypted_refresh,token_actor,token_generation,selected_property) values($1,$2,$3,$4,1,'sc-domain:example.com')",[org,connection,'fake-encrypted-value-not-real-00000000000000',user])
 })
 const invoke=async(op,p={},overrides={})=>(await db.query('select picshaw_reports_private.operation($1::uuid,$2::uuid,$3::bigint,$4::uuid,$5::text,$6::jsonb) value',[overrides.user??user,overrides.session??session,overrides.exp??Math.floor(Date.now()/1000)+3600,overrides.org??org,op,JSON.stringify(p)])).rows[0].value
 const selection={organizationId:org,connectionId:connection,propertyId:'sc-domain:example.com'}
 const claim=()=>invoke('claim',{connection,property:selection.propertyId,windowEnd:core.completedWindows().current.end})
 const readSnapshot=async r=>{
   const prior=r.window.end<core.completedWindows().current.end
   const row=(keys,clicks,impressions)=>({keys,clicks,impressions,ctr:clicks/impressions,position:10})
   let rows
   if(!r.dimensions.length)rows=[row([],prior?280:56,2800)]
   else if(r.dimensions[0]==='date')rows=Array.from({length:28},(_,i)=>row([new Date(Date.parse(r.window.start)+i*86400000).toISOString().slice(0,10)],prior?10:2,100))
   else rows=[row(['https://example.com/a'],prior?280:56,2800)]
   return {id:r.snapshotId,organizationId:r.organizationId,propertyId:r.propertyId,runId:r.runId,source:'google-search-console',retrievedAt:new Date().toISOString(),timezone:'America/Los_Angeles',window:r.window,searchType:'web',filters:[],dimensions:r.dimensions,dataState:'final',coverage:'available-rows',warnings:[],rows}
 }
 const review=async c=>{
  const ids=[c.runId,...c.snapshotIds]
  const result=await journey.createSearchJourney({resolver:{resolve:async()=>({...selection,actorId:user})},newId:()=>ids.shift(),now:()=>new Date(c.startedAt),reader:{readSnapshot}}).run(selection)
  assert.equal(result.status,'ready');assert.ok(result.actions.length);return copy(result)
 }
 return {user,session,org,connection,invoke,claim,review,readSnapshot,selection}
}
try {
 await db.exec(readFileSync('supabase/tests/bootstrap.sql','utf8'))
 for(const name of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort())await db.exec(readFileSync(`supabase/migrations/${name}`,'utf8'))
 const h=await fixture(),other=await fixture()
 await test('application role has RPC only and no token-column privilege',async()=>{
  for(const sql of ['select * from picshaw_reports_private.operations','select * from public.source_runs','select encrypted_refresh from picshaw_gsc_private.connections'])await assert.rejects(db.query(sql),/permission denied/)
  const privileges=await admin(()=>db.query("select has_column_privilege('picshaw_reports_owner','picshaw_gsc_private.connections','encrypted_refresh','select') allowed"))
  assert.equal(privileges.rows[0].allowed,false)
  for(const role of ['anon','authenticated','service_role','picshaw_gsc']){
   await db.exec(`reset role;set role ${role}`);await assert.rejects(h.invoke('status'),/permission denied/)
  }
  await db.exec('reset role;set role picshaw_reports')
 })
 await test('only migration administrator can assume private owner roles',async()=>{
  for(const app of ['picshaw_workspace','picshaw_gsc','picshaw_reports']){
   const role=(await db.query("select pg_has_role($1::name,$2::name,'MEMBER') app_member,pg_has_role('postgres',$2::name,'MEMBER') admin_member",[app,app+'_owner'])).rows[0]
   assert.equal(role.app_member,false);assert.equal(role.admin_member,true)
   // PGlite postgres is superuser: also verify the explicit membership edge.
   const edge=(await db.query("select count(*)::int n from pg_auth_members m join pg_roles r on r.oid=m.roleid join pg_roles u on u.oid=m.member where r.rolname=$1 and u.rolname='postgres'",[app+'_owner'])).rows[0]
   assert.equal(edge.n,1)
  }
 })
 await test('RPC overrides stale legacy subject on pooled connection',async()=>{
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other.user])
  assert.equal(await h.invoke('status'),null)
  await assert.rejects(h.invoke('status',{}, {org:other.org}),/Unauthorized/)
  // Keep the wrong session-level setting throughout subsequent report tests.
  // The RPC must replace it transaction-locally for every current actor.
 })
 await test('unverified session, expired JWT and tenant substitution fail',async()=>{
  await assert.rejects(h.invoke('status',{}, {session:other.session}),/Unauthorized/)
  await assert.rejects(h.invoke('status',{}, {org:other.org}),/Unauthorized/)
  await assert.rejects(h.invoke('status',{}, {exp:0}),/Unauthorized/)
 })
 let c,r,receipt
 await test('claim creates server UUID manifest, freezes time, and fences overlapping claims',async()=>{
  c=await h.claim();r=await h.review(c);assert.equal(c.state,'running');assert.ok(c.lease)
  assert.equal(new Set([c.operationId,c.runId,c.reportId,...c.snapshotIds]).size,9)
  const second=await h.claim();assert.equal(second.state,'busy');assert.equal(second.lease,null);assert.equal(second.runId,c.runId)
  assert.equal((await h.invoke('status')).lease,null)
 })
 await test('malformed and incomplete source bundles never commit partial artifacts',async()=>{
  for(const mutate of [r=>delete r.snapshots.prior.page,r=>r.snapshots.current.page.id=randomUUID(),r=>r.selection.organizationId=other.org,r=>r.snapshots.current.aggregate.token='secret',r=>r.token='secret',r=>r.totals.current.metrics.token='secret',r=>r.coverage.current.token='secret',r=>r.comparison.clicks.token='secret',r=>r.status=null,r=>r.snapshots.current.page.rows[0].clicks=999999,r=>r.actions[0].current.clicks=100]){
   const broken=copy(r);mutate(broken)
   await assert.rejects(h.invoke('complete',{operation:c.operationId,lease:c.lease,review:broken}))
  }
  await admin(async()=>{for(const t of ['source_runs','source_snapshots','recommended_actions','reports'])assert.equal((await db.query(`select count(*)::int n from public.${t} where organization_id=$1`,[h.org])).rows[0].n,0)})
 })
 await test('expired lease recovery preserves all IDs and fences stale worker',async()=>{
  await admin(()=>db.query("update picshaw_reports_private.operations set lease_until=now()-interval '1 second' where id=$1",[c.operationId]))
  const old=c;c=await h.claim();assert.equal(c.runId,old.runId);assert.equal(c.reportId,old.reportId);assert.deepEqual(c.snapshotIds,old.snapshotIds);assert.equal(c.startedAt,old.startedAt);assert.notEqual(c.lease,old.lease)
  await assert.rejects(h.invoke('complete',{operation:c.operationId,lease:old.lease,review:r}),/Stale operation/)
 })
 await test('complete atomically stores six normalized snapshots, actions and private retained review',async()=>{
  receipt=await h.invoke('complete',{operation:c.operationId,lease:c.lease,review:r});assert.equal(receipt.reportId,c.reportId)
  await admin(async()=>{
   for(const [t,n] of [['source_runs',1],['source_snapshots',6],['recommended_actions',r.actions.length],['reports',1]])assert.equal((await db.query(`select count(*)::int n from public.${t} where organization_id=$1`,[h.org])).rows[0].n,n)
  })
  assert.deepEqual((await h.invoke('read',{report:c.reportId})).review,r)
 })
 await test('same completion is exact replay, different review rejected, completed claim avoids refetch',async()=>{
  assert.deepEqual(await h.invoke('complete',{operation:c.operationId,lease:c.lease,review:r}),receipt)
  await assert.rejects(h.invoke('complete',{operation:c.operationId,lease:c.lease,review:{...r,disclaimer:'changed'}}),/Replay conflict/)
  assert.equal((await h.claim()).state,'completed');assert.equal((await h.claim()).lease,null)
 })
 await test('second tenant cannot read or complete first tenant report',async()=>{
  assert.equal(await other.invoke('read',{report:c.reportId}),null)
  await assert.rejects(other.invoke('complete',{operation:c.operationId,lease:c.lease,review:r}),/Stale operation/)
 })
 await test('revoked membership and invalidated session deny retained report reads',async()=>{
  await admin(()=>db.query('update public.organization_memberships set revoked_at=now() where user_id=$1',[h.user]))
  await assert.rejects(h.invoke('read'),/Unauthorized/)
  await admin(()=>db.query('update public.organization_memberships set revoked_at=null where user_id=$1',[h.user]))
  await admin(()=>db.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[h.session]))
  await assert.rejects(h.invoke('read'),/Unauthorized/)
  await admin(()=>db.query('update auth.sessions set not_after=null where id=$1',[h.session]))
 })
 await test('connection disconnection and selected-property generation invalidate all retained access',async()=>{
  await admin(()=>db.query("update public.google_connections set status='disconnected' where organization_id=$1",[h.org]))
  await assert.rejects(h.invoke('read'),/Connection unavailable/)
  await admin(()=>db.query("update public.google_connections set status='active' where organization_id=$1",[h.org]))
  await admin(()=>db.query("update picshaw_gsc_private.connections set selected_property='https://example.com/' where organization_id=$1",[h.org]))
  assert.equal(await h.invoke('read',{report:c.reportId}),null)
  await admin(()=>db.query("update picshaw_gsc_private.connections set selected_property='sc-domain:example.com' where organization_id=$1",[h.org]))
  assert.equal(await h.invoke('read',{report:c.reportId}),null)
  await assert.rejects(h.invoke('complete',{operation:c.operationId,lease:c.lease,review:r}),/Stale operation/)
 })
 await test('failed sync retains IDs for retry without committing artifacts',async()=>{
  const first=await other.claim();await other.invoke('fail',{operation:first.operationId,lease:first.lease})
  const again=await other.claim();assert.equal(again.runId,first.runId);assert.notEqual(again.lease,first.lease)
  assert.equal(await other.invoke('read'),null)
 })
 await test('partial pre-existing run causes conflict with no artifact completion',async()=>{
  const f=await fixture(),op=await f.claim(),review=await f.review(op)
  await admin(()=>db.query('insert into public.source_runs(organization_id,id,connection_id,property_id,current_start,current_end,prior_start,prior_end,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[f.org,op.runId,f.connection,review.selection.propertyId,review.windows.current.start,review.windows.current.end,review.windows.prior.start,review.windows.prior.end,f.user]))
  await assert.rejects(f.invoke('complete',{operation:op.operationId,lease:op.lease,review}),/duplicate key/)
  await admin(async()=>assert.equal((await db.query('select count(*)::int n from public.source_snapshots where organization_id=$1',[f.org])).rows[0].n,0))
  assert.equal(await f.invoke('read'),null)
 })
 await test('new session has independent operation identity and viewer cannot read private review',async()=>{
  const session=randomUUID()
  await admin(()=>db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,other.user]))
  assert.equal(await other.invoke('status',{}, {session}),null)
  await admin(()=>db.query("update public.organization_memberships set role='viewer' where user_id=$1",[other.user]))
  await assert.rejects(other.invoke('read'),/Unauthorized/)
 })
 await test('in-flight complete is fenced by member downgrade, deleted session and changed generation',async()=>{
  for(const cause of ['membership','session','generation']){
   const f=await fixture(),op=await f.claim(),review=await f.review(op)
   await admin(()=>cause==='membership'?db.query("update public.organization_memberships set role='viewer' where user_id=$1",[f.user]):cause==='session'?db.query('delete from auth.sessions where id=$1',[f.session]):db.query('update picshaw_gsc_private.connections set generation=generation+1 where organization_id=$1',[f.org]))
   await assert.rejects(f.invoke('complete',{operation:op.operationId,lease:op.lease,review}),/Unauthorized|Stale operation/)
   await admin(async()=>assert.equal((await db.query('select count(*)::int n from public.source_runs where organization_id=$1',[f.org])).rows[0].n,0))
  }
 })
 await test('queued parallel claims admit one worker only (single-session simulation)',async()=>{
  const f=await fixture(),claims=await Promise.all([f.claim(),f.claim(),f.claim()])
  assert.equal(claims.filter(c=>c.state==='running').length,1);assert.equal(claims.filter(c=>c.state==='busy').length,2)
  assert.equal(new Set(claims.map(c=>c.runId)).size,1)
 })
 await test('report service uses actual SQL and recovers a lost completion reply without new source reads',async()=>{
  const f=await fixture(),identity={actor:{id:f.user,sessionId:f.session,expiresAt:Math.floor(Date.now()/1000)+3600},organizationId:f.org}
  let reads=0,loseReply=true
  const service=load('report-service').createReportService({store:async(_identity,op,payload)=>{
   const result=await f.invoke(op,payload)
   if(op==='complete'&&loseReply){loseReply=false;throw Error('Simulated lost committed response')}
   return result
  },lifecycle:{status:async()=>({status:'active',connectionId:f.connection,selectedProperty:f.selection.propertyId}),
   snapshotReader:async()=>({readSnapshot:async r=>{reads++;return f.readSnapshot(r)}}),journeyResolver:()=>({resolve:async()=>({...f.selection,actorId:f.user})})}})
  await assert.rejects(service.sync(identity),error=>error.code==='REPORT_UNAVAILABLE')
  const status=await service.status(identity);assert.equal(status.state,'completed');assert.equal(reads,6)
  const recovered=await service.sync(identity);assert.equal(recovered.state,'completed');assert.equal(reads,6);assert.equal(recovered.report.reportId,status.reportId)
  const saved=await service.read(identity,recovered.report.reportId);assert.equal(saved.runId,recovered.report.runId);assert.equal(saved.review.actions.length,3)
 })
 console.log(`${count} durable report storage checks passed. PGlite is single-session: real PostgreSQL contention/deadlock tests remain a deployment gate. No hosted writes or provider calls.`)
} finally {await db.close()}
