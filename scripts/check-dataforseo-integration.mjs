import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'
const {PGlite}=await import(pathToFileURL(resolve(process.argv[2]??'validation/tenant-database-tooling/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db=new PGlite(),A='10000000-0000-4000-8000-000000000001',S='10000000-0000-4000-8000-000000000002',O='10000000-0000-4000-8000-000000000003'
const J='30000000-0000-4000-8000-000000000001',J2='30000000-0000-4000-8000-000000000002',J3='30000000-0000-4000-8000-000000000003'
const exp=Math.floor(Date.now()/1000)+3600
let paid=0,revoke=false
const sql=(strings,...values)=>({signal:()=>db.query(strings.reduce((out,part,index)=>out+(index?'$'+index:'')+part,''),values).then(r=>r.rows)})
async function provider(url,init){paid++;assert.equal(url,'https://api.dataforseo.com/v3/ai_optimization/llm_mentions/search_mentions/live');const data=JSON.parse(init.body)[0];assert.equal(data.limit,20);assert.equal(data.target[0].domain,'example.com');if(revoke){await db.exec('set role postgres');await db.query('update public.organization_memberships set revoked_at=clock_timestamp() where user_id=$1',[A]);await db.exec('set role picshaw_dataforseo')}
 return new Response(JSON.stringify({status_code:20000,tasks_error:0,tasks_count:1,cost:.1,tasks:[{status_code:20000,id:'synthetic-provider-task',cost:.1,data,result:[{items_count:0,total_count:0,items:[]}]}]}),{headers:{'content-type':'application/json'}})
}
const cache={}
function load(name){
 if(name==='server-only')return {}
 if(name==='postgres')return {default:config=>{assert.equal(config.username,'picshaw_dataforseo.abcdefghijklmnopqrst');return sql}}
 if(name==='../supabase/database-tls')return {createSupabasePoolerTls:()=>({rejectUnauthorized:true})}
 assert.ok(/^\.\/dataforseo-[a-z-]+$/.test(name),name)
 if(cache[name])return cache[name]
 const exports={};cache[name]=exports
 const source=readFileSync('lib/platform/'+name.slice(2)+'.ts','utf8')
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,module:{exports},Error,URL,Buffer,AbortSignal,Date,process:{env:{}},fetch:provider,require:load})
 return exports
}
const env={VERCEL:'1',VERCEL_ENV:'production',PIC_SHAW_AUTH_ORIGIN:'https://app.picshaw.com',PIC_SHAW_PORTAL_ACCESS_MODE:'pilot',PIC_SHAW_DATAFORSEO_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',PIC_SHAW_DATAFORSEO_DB_HOST:'aws-0-us-east-1.pooler.supabase.com',PIC_SHAW_DATAFORSEO_DB_PASSWORD:'x'.repeat(40),DATAFORSEO_LOGIN:'synthetic',DATAFORSEO_PASSWORD:'synthetic',PIC_SHAW_DATAFORSEO_APPROVED_DOMAINS:'example.com'}
try{
 await db.exec(readFileSync('supabase/tests/bootstrap.sql','utf8'))
 for(const name of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort())await db.exec(readFileSync('supabase/migrations/'+name,'utf8'))
 await db.query('insert into auth.users(id,email_confirmed_at) values($1,now())',[A]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[S,A]);await db.query('insert into public.organizations(id,name) values($1,\'Synthetic\')',[O]);await db.query('insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,\'owner\')',[O,A]);await db.exec('update picshaw_dataforseo_private.account_budget set enabled=true,cap_micros=240000');await db.query('insert into picshaw_dataforseo_private.workspace_budgets(organization_id,enabled,cap_micros) values($1,true,240000)',[O]);await db.exec('set role picshaw_dataforseo')
 const {createDataForSeoGateway}=load('./dataforseo-job-runtime')
 const gateway=createDataForSeoGateway({id:A,sessionId:S,expiresAt:exp},{id:O,site:'example.com'},env)
 assert.ok(gateway);assert.equal(await gateway.latest('google'),null);assert.equal(paid,0)
 const first=await gateway.submit({platform:'google',jobId:J});assert.equal(first.state,'completed');assert.equal(first.result.sampledRows,0);assert.equal(first.result.actualCostUsd,.1);assert.equal(paid,1)
 const duplicate=await gateway.submit({platform:'google',jobId:J2});assert.equal(duplicate.jobId,J);assert.equal(paid,1)
 assert.equal((await gateway.read(J)).jobId,J);assert.equal((await gateway.latest('google')).jobId,J);assert.equal(paid,1)
 const S2='10000000-0000-4000-8000-000000000004'
 await db.exec('set role postgres');await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[S2,A]);await db.exec('set role picshaw_dataforseo')
 const relogged=createDataForSeoGateway({id:A,sessionId:S2,expiresAt:exp},{id:O,site:'example.com'},env)
 const recovered=await relogged.submit({platform:'google',jobId:J2});assert.equal(recovered.jobId,J);assert.equal(recovered.state,'completed');assert.equal(paid,1)
 console.log('PASS new-session completed submit returns original saved result with no dispatch or paid call')
 console.log('PASS real adapter/orchestration/runtime + actual isolated SQL: enqueue, reserve, fetch fixture, exact cost settle, complete, dedupe and read-only recovery')
 revoke=true;await assert.rejects(gateway.submit({platform:'chat_gpt',jobId:J3}));assert.equal(paid,2)
 await db.exec('set role postgres');const claims=await db.query('select outcome,reported_micros from picshaw_dataforseo_private.claims order by created_at');assert.equal(claims.rows.length,2);for(const c of claims.rows){assert.equal(c.outcome,'confirmed');assert.equal(Number(c.reported_micros),100000)}
 const jobs=await db.query('select state from picshaw_dataforseo_private.jobs');assert.equal(jobs.rows.length,2);for(const j of jobs.rows)assert.equal(j.state,'completed')
 await db.exec('set role picshaw_dataforseo');await assert.rejects(gateway.read(J3),{code:'42501'});assert.equal(paid,2)
 console.log('PASS in-flight membership revocation retains accounting/result but blocks evidence access; no duplicate paid call')
 console.log('No network or real credentials used. PostgreSQL WASM is not a multi-connection concurrency proof.')
}finally{await db.close()}
