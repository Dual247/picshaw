import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import postgres from 'postgres'
import {isBuiltinRole,isBuiltinSchema} from './dataforseo-contention-guards.mjs'

// REAL PostgreSQL contention proof, never hosted. This initializes cluster-wide test roles.
// Use a dedicated EMPTY disposable cluster, not an empty database on a shared server.
// No database/cluster is created or deleted by this harness. Synthetic fixtures remain.
const HELP=`Usage: node supabase/tests/run-dataforseo-contention.mjs --port=55432 --database=picshaw_dfs_contention_local --confirm-isolated-cluster
Requires an already-running dedicated local disposable PostgreSQL cluster and empty named database.
Connection is pinned to 127.0.0.1, role postgres. Optional PIC_SHAW_DISPOSABLE_PG_PASSWORD is read only for this local connection.
Never uses DATABASE_URL, PGPASSWORD, service credentials, hosted projects, or a provider API.
The cluster must have no custom roles and no other non-template databases except postgres.
The test initializes all migrations and leaves synthetic objects for you to discard with the disposable cluster.`
if(process.argv.includes('--help')){console.log(HELP);process.exit(0)}
const args=process.argv.slice(2)
assert(args.every(a=>a==='--confirm-isolated-cluster'||a.startsWith('--port=')||a.startsWith('--database=')),'Unknown argument; use --help')
assert.equal(args.filter(a=>a==='--confirm-isolated-cluster').length,1,'Explicit --confirm-isolated-cluster is required')
assert.equal(args.filter(a=>a.startsWith('--port=')).length,1,'Explicit local --port is required')
assert.equal(args.filter(a=>a.startsWith('--database=')).length,1,'Explicit disposable --database is required')
const portText=args.find(a=>a.startsWith('--port=')).slice(7), database=args.find(a=>a.startsWith('--database=')).slice(11)
assert(/^\d{4,5}$/.test(portText)&&Number(portText)>=1024&&Number(portText)<=65535,'Invalid local port')
assert(/^picshaw_dfs_contention_[a-z0-9_]{1,32}$/.test(database),'Database must have the exact disposable-test prefix')
// A password callback suppresses postgres.js fallback to ambient PGPASSWORD/pgpass files, even when empty.
const options={host:'127.0.0.1',port:Number(portText),database,username:'postgres',password:()=>process.env.PIC_SHAW_DISPOSABLE_PG_PASSWORD??'',ssl:false,prepare:false,max:1,max_pipeline:1,connect_timeout:3,query_timeout:10,queue_timeout:3,cancel_timeout:1,idle_timeout:5,max_lifetime:60,fetch_types:false,onnotice:()=>{},debug:false}
const admin=postgres({...options,connection:{application_name:'picshaw-dfs-contention-admin'}})
const control=postgres({...options,database:'postgres',connection:{application_name:'picshaw-dfs-contention-pristine-check'}})
const a=postgres({...options,connection:{application_name:'picshaw-dfs-contention-a'}})
const b=postgres({...options,connection:{application_name:'picshaw-dfs-contention-b'}})
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8')
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}}
const A='10000000-0000-4000-8000-000000000001',B='20000000-0000-4000-8000-000000000001',SA='10000000-0000-4000-8000-000000000002',SB='20000000-0000-4000-8000-000000000002',OA='10000000-0000-4000-8000-000000000003',OB='20000000-0000-4000-8000-000000000003'
const exp=Math.floor(Date.now()/1000)+3600
const task=domain=>JSON.stringify({target:[{domain,search_filter:'include',search_scope:['sources'],include_subdomains:true}],platform:'google',location_code:2840,language_code:'en',limit:20})
async function reserve(sql,job,domain,user=A,session=SA,org=OA){return (await sql`select picshaw_dataforseo_private.reserve(${user}::uuid,${session}::uuid,${exp}::bigint,${org}::uuid,${job}::text,120000::bigint,${task(domain)}::text) as value`)[0].value}
async function settle(sql,job,outcome='confirmed'){await sql`select picshaw_dataforseo_private.settle(${A}::uuid,${SA}::uuid,${exp}::bigint,${OA}::uuid,${job}::text,120000::bigint,${outcome}::text)`}
async function enqueue(sql,job,domain){return (await sql`select picshaw_dataforseo_private.enqueue(${A}::uuid,${SA}::uuid,${exp}::bigint,${OA}::uuid,${job}::text,${domain}::text,'google'::text,20::integer) as value`)[0].value}
async function start(sql,job){return (await sql`select picshaw_dataforseo_private.start_job(${A}::uuid,${SA}::uuid,${exp}::bigint,${OA}::uuid,${job}::text) as value`)[0].value}
let passed=0,bpid
async function contend(label,first,second,check){
 const ready=deferred(),release=deferred()
 const firstPromise=a.begin(async tx=>{const result=await first(tx);ready.resolve(result);await release.promise;return result})
 let secondPromise
 try{
  await Promise.race([ready.promise,firstPromise])
  secondPromise=Promise.resolve().then(()=>second(b)).then(value=>({ok:true,value}),error=>({ok:false,error}))
  let blocked=false
  const deadline=Date.now()+1200
  while(Date.now()<deadline){
   const rows=await admin`select wait_event_type from pg_stat_activity where pid=${bpid}`
   if(rows[0]?.wait_event_type==='Lock'){blocked=true;break}
   await wait(15)
  }
  assert.equal(blocked,true,`${label}: second independent backend did not visibly block on the lock`)
  release.resolve()
  const [one,two]=await Promise.all([firstPromise,secondPromise])
  if(!two.ok)throw two.error
  check(one,two.value)
  console.log(`PASS ${label} (two independent backend PIDs; Lock wait observed)`);passed++
 }finally{
  release.resolve();await firstPromise.catch(()=>{});if(secondPromise)await secondPromise
 }
}
try{
 const identity=await admin`select current_database() as database,current_user as user,host(inet_server_addr()) as host,pg_is_in_recovery() as standby`
 assert.equal(identity[0].database,database);assert.equal(identity[0].user,'postgres');assert.equal(identity[0].host,'127.0.0.1');assert.equal(identity[0].standby,false)
 assert.equal((await admin`select datname from pg_database where not datistemplate and datname not in(${database},'postgres')`).length,0,'Cluster has other databases; refusing shared cluster')
 assert.equal((await admin`select rolname from pg_roles`).filter(row=>!isBuiltinRole(row.rolname)).length,0,'Cluster has custom roles; refusing non-pristine/shared cluster')
 assert.equal((await admin`select nspname from pg_namespace`).filter(row=>!isBuiltinSchema(row.nspname)).length,0,'Database has nonstandard schemas')
 assert.equal((await admin`select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'`).length,0,'Database is not empty')
 assert.equal((await admin`select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`).length,0,'Database has public functions')
 // The default postgres database must also be empty: roles are cluster-wide.
 assert.equal((await control`select nspname from pg_namespace`).filter(row=>!isBuiltinSchema(row.nspname)).length,0,'Default postgres database has application schemas')
 assert.equal((await control`select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'`).length,0,'Default postgres database has application objects')
 assert.equal((await control`select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`).length,0,'Default postgres database has application functions')
 await admin.unsafe(read('./bootstrap.sql')).simple()
 for(const name of readdirSync(new URL('../migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())await admin.unsafe(read('../migrations/'+name)).simple()
 await admin`insert into auth.users(id,email_confirmed_at) values(${A}::uuid,now()),(${B}::uuid,now())`
 await admin`insert into auth.sessions(id,user_id) values(${SA}::uuid,${A}::uuid),(${SB}::uuid,${B}::uuid)`
 await admin`insert into public.organizations(id,name) values(${OA}::uuid,'Synthetic A'),(${OB}::uuid,'Synthetic B')`
 await admin`insert into public.organization_memberships(organization_id,user_id,role) values(${OA}::uuid,${A}::uuid,'owner'),(${OB}::uuid,${B}::uuid,'owner')`
 await admin`update picshaw_dataforseo_private.account_budget set enabled=true,cap_micros=200000`
 await admin`insert into picshaw_dataforseo_private.workspace_budgets(organization_id,enabled,cap_micros) values(${OA}::uuid,true,10000000),(${OB}::uuid,true,10000000)`
 const apid=(await a`select pg_backend_pid() as pid`)[0].pid;bpid=(await b`select pg_backend_pid() as pid`)[0].pid
 assert.notEqual(apid,bpid,'Must use physically separate PostgreSQL backends')
 await a`set role picshaw_dataforseo`;await b`set role picshaw_dataforseo`
 await contend('distinct workspace reservations serialize at shared account cap',async tx=>{const v=await reserve(tx,'cap-a','cap-a.example.com');await settle(tx,'cap-a');return v},sql=>reserve(sql,'cap-b','cap-b.example.com',B,SB,OB),(x,y)=>{assert.equal(x,true);assert.equal(y,false)})
 assert.equal(Number((await admin`select consumed_micros from picshaw_dataforseo_private.account_budget`)[0].consumed_micros),120000)
 await admin`update picshaw_dataforseo_private.account_budget set cap_micros=10000000`
 await contend('duplicate permanent ledger job cannot reserve twice',async tx=>{const v=await reserve(tx,'duplicate-job','job-a.example.com');await settle(tx,'duplicate-job');return v},sql=>reserve(sql,'duplicate-job','job-b.example.com'),(x,y)=>{assert.equal(x,true);assert.equal(y,false)})
 await contend('same provider plan with different job IDs deduplicates',async tx=>{const v=await reserve(tx,'plan-a','plan.example.com');await settle(tx,'plan-a');return v},sql=>reserve(sql,'plan-b','plan.example.com'),(x,y)=>{assert.equal(x,true);assert.equal(y,false)})
 await contend('concurrent durable enqueue returns one canonical job',tx=>enqueue(tx,'enqueue-a','enqueue.example.com'),sql=>enqueue(sql,'enqueue-b','enqueue.example.com'),(x,y)=>{assert.equal(x.jobId,'enqueue-a');assert.equal(y.jobId,'enqueue-a')})
 await contend('durable job dispatch grants exactly one lease',tx=>start(tx,'enqueue-a'),sql=>start(sql,'enqueue-a'),(x,y)=>{assert.match(x.lease,/^[0-9a-f-]{36}$/);assert.equal(y,null)})
 await contend('uncertain result freezes reservations across all workspaces',async tx=>{const v=await reserve(tx,'unknown-a','unknown-a.example.com');await settle(tx,'unknown-a','uncertain');return v},sql=>reserve(sql,'unknown-b','unknown-b.example.com',B,SB,OB),(x,y)=>{assert.equal(x,true);assert.equal(y,false)})
 assert.equal(await reserve(b,'unknown-after','after.example.com',B,SB,OB),false)
 assert.equal((await admin`select job_id from picshaw_dataforseo_private.claims where job_id in('cap-b','plan-b','unknown-b','unknown-after')`).length,0)
 assert.equal(Number((await admin`select consumed_micros from picshaw_dataforseo_private.account_budget`)[0].consumed_micros),480000)
 console.log(`${passed} real multi-connection contention scenarios passed. Synthetic local cluster only; no hosted, provider, or deployment validation.`)
 console.log('Synthetic schemas and cluster-wide test roles remain. Discard the dedicated disposable cluster outside this harness.')
}catch(error){
 // Avoid dumping connection options, password, or SQL parameter values.
 console.error(`Contention harness failed (${error?.code??error?.name??'error'}): ${error instanceof assert.AssertionError?error.message:'Local PostgreSQL setup or scenario failed; inspect only local server diagnostics.'}`)
 process.exitCode=1
}finally{await Promise.allSettled([admin.end({timeout:2}),control.end({timeout:2}),a.end({timeout:2}),b.end({timeout:2})])}



