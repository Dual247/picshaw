import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync,readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const {PGlite}=await import(pathToFileURL(resolve('validation/tenant-database-tooling/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db=new PGlite();let checks=0
const user=randomUUID(),session=randomUUID(),org=randomUUID(),connection=randomUUID(),exp=Math.floor(Date.now()/1000)+3600
const targets=[['workspace','picshaw_workspace_private.bootstraps'],['gsc','picshaw_gsc_private.attempts'],['reports','picshaw_reports_private.operations']]
async function call(kind){
 if(kind==='workspace')return db.query("select picshaw_workspace_private.workspace($1,$2,$3,true,'Session test','example.com')",[user,session,exp])
 const p=kind==='gsc'?{state:'a'.repeat(64),browser:'b'.repeat(64),connection:randomUUID(),verifier:'c'.repeat(48)}:{connection,property:'sc-domain:example.com',windowEnd:(await db.query("select ((clock_timestamp() at time zone 'America/Los_Angeles')::date-3)::text d")).rows[0].d}
 return db.query(`select picshaw_${kind}_private.operation($1,$2,$3,$4,$5,$6)`,[user,session,exp,org,kind==='gsc'?'start':'claim',JSON.stringify(p)])
}
try{
 await db.exec(readFileSync('supabase/tests/bootstrap.sql','utf8'))
 for(const n of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort())await db.exec(readFileSync('supabase/migrations/'+n,'utf8'))
 await db.query('insert into auth.users(id,email_confirmed_at) values($1,now())',[user])
 await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,user])
 await db.query("insert into public.organizations(id,name) values($1,'Session tests')",[org])
 await db.query("insert into public.organization_memberships(organization_id,user_id,role) values($1,$2,'owner')",[org,user])
 for(const [kind,table] of targets){
  // Each test trigger is disposable test-only instrumentation, never a migration.
  // It simulates an authority change between entry and final validation in one
  // transaction, not cross-session visibility or real logout race verification.
  assert.equal((await db.query("select has_column_privilege($1,'auth.sessions','id','UPDATE') yes",[`picshaw_${kind}_owner`])).rows[0].yes,false)
  checks++;console.log(`PASS ${kind} owner has no session UPDATE privilege`)
  await db.exec(`begin isolation level repeatable read;set local role picshaw_${kind}`)
  await assert.rejects(call(kind),e=>e.code==='25001');await db.exec('rollback');checks++
  console.log(`PASS ${kind} rejects repeatable-read snapshots`)
  if(kind==='reports'){
   await db.query("insert into public.google_connections(organization_id,id,label,created_by) values($1,$2,'GSC',$3)",[org,connection,user])
   await db.query("insert into picshaw_gsc_private.connections(organization_id,connection_id,token_actor,token_generation,selected_property) values($1,$2,$3,1,'sc-domain:example.com')",[org,connection,user])
  }
  for(const [name,action] of [['removed-session',`delete from auth.sessions where id='${session}';`],['expired-session',`update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id='${session}';`],['disabled-account',`update auth.users set deleted_at=clock_timestamp() where id='${user}';`],['deadline',`perform pg_sleep(${kind==='workspace'?3.1:5.1});`]]){
   await db.exec(`create or replace function public.test_session_change() returns trigger language plpgsql security definer set search_path='' as $$ begin ${action} return new; end $$;create trigger test_session_change after insert on ${table} for each row execute function public.test_session_change();`)
   await db.exec(`set role picshaw_${kind}`)
   await assert.rejects(call(kind),e=>e.code==='28000',`${kind} ${name} must fail final check`)
   await db.exec('reset role')
   assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n,0)
   assert.equal((await db.query('select count(*)::int n from auth.sessions where id=$1',[session])).rows[0].n,1)
   await db.exec(`drop trigger test_session_change on ${table};drop function public.test_session_change()`)
   checks++;console.log(`PASS ${kind} final ${name} check rolls back all writes`)
  }
 }
 console.log(`${checks} bounded session checks passed. Synthetic same-transaction mutations only; real READ COMMITTED multi-session revocation and pooler behavior remain launch gates.`)
}finally{await db.close()}
