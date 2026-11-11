import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const { PGlite } = await import(pathToFileURL(resolve('validation/tenant-database-tooling/node_modules/@electric-sql/pglite/dist/index.js')))
const db = new PGlite()
let count = 0
const check = (value, label) => { assert.ok(value, label); count++ }
const a = '10000000-0000-4000-8000-000000000001', b = '20000000-0000-4000-8000-000000000001'
const sa = '10000000-0000-4000-8000-000000000002', sb = '20000000-0000-4000-8000-000000000002'
const exp = Math.floor(Date.now() / 1000) + 3600
const call = async (user = a, session = sa, create = false, name = null, site = null, expiry = exp) =>
  (await db.query('select picshaw_workspace_private.workspace($1::uuid,$2::uuid,$3::bigint,$4::boolean,$5::text,$6::text) as result', [user, session, expiry, create, name, site])).rows[0].result
const denied = async (action, code, label) => { await assert.rejects(action, e => e.code === code, label); count++ }
try {
  await db.exec(readFileSync('supabase/tests/bootstrap.sql', 'utf8'))
  for (const name of readdirSync('supabase/migrations').filter(n => /tenant_foundation|public_table_sequence_defaults|workspace_bootstrap/.test(n)).sort()) await db.exec(readFileSync(`supabase/migrations/${name}`, 'utf8'))
  await db.query('insert into auth.users(id,email_confirmed_at) values ($1,now()),($2,now())', [a,b])
  await db.query('insert into auth.sessions(id,user_id) values ($1,$2),($3,$4)', [sa,a,sb,b])
  await db.exec('set role picshaw_workspace')
  check(await call() === null, 'unaffiliated account starts empty')
  await denied(() => db.exec('select * from auth.sessions'), '42501', 'login cannot inspect auth sessions')
  await denied(() => db.exec('select * from public.organizations'), '42501', 'login cannot read arbitrary tenants')
  check((await db.query("select not pg_has_role('picshaw_workspace','picshaw_workspace_owner','MEMBER') as ok")).rows[0].ok, 'login has no owner membership')
  await denied(() => call(a,sb), '28000', 'different users session denied')
  await denied(() => call(a,sa,false,null,null,1), '28000', 'expired verified token denied')
  await denied(() => call(a,sa,true,'Bad','https://example.com'), '22023', 'url not hostname denied')
  await denied(() => call(a,sa,true,'Bad','foo-.com'), '22023', 'invalid label denied')
  await denied(() => call(a,sa,true,'  Bad','example.com'), '22023', 'untrimmed name denied')
  const first = await call(a,sa,true,'Workspace A','example.com')
  check(first.name === 'Workspace A' && first.site === 'example.com', 'create returns bounded data')
  check((await call(a,sa,true,'Workspace A','example.com')).id === first.id, 'retry is durable')
  check((await call()).id === first.id, 'session resolves own workspace')
  await denied(() => call(a,sa,true,'Changed','example.com'), '23505', 'changed retry does not duplicate')
  check(await call(b,sb) === null, 'second identity not assigned existing tenant')
  const second = await call(b,sb,true,'Workspace A','example.com')
  check(second.id !== first.id, 'same name and site never join existing tenant')
  await db.exec('reset role')
  check((await db.query('select count(*)::int as n from public.organizations')).rows[0].n === 2, 'exactly two tenants')
  check((await db.query("select count(*)::int as n from public.organization_memberships where role='owner'")).rows[0].n === 2, 'atomic owner records')
  check((await db.query('select count(*)::int as n from picshaw_workspace_private.bootstraps')).rows[0].n === 2, 'durable receipts')
  for (const role of ['anon','authenticated','service_role']) {
    await db.exec(`set role ${role}`)
    await denied(() => call(), '42501', `${role} cannot invoke private bootstrap`)
    await db.exec('reset role')
  }
  await db.query('update public.organization_memberships set revoked_at=now() where user_id=$1', [a])
  await db.exec('set role picshaw_workspace')
  await denied(() => call(), '42501', 'revocation immediately denies read')
  await denied(() => call(a,sa,true,'Workspace A','example.com'), '42501', 'retry cannot reactivate membership')
  await db.exec('reset role')
  await db.query('delete from auth.sessions where id=$1', [sb])
  await db.exec('set role picshaw_workspace')
  await denied(() => call(b,sb), '28000', 'logout immediately denies cached JWT')
  await db.exec('reset role')
  await db.query('insert into auth.sessions(id,user_id) values ($1,$2)', [sb,b])
  for (const [field, value] of [['is_anonymous','true'],['banned_until',"now()+interval '1 day'"],['deleted_at','now()'],['email_confirmed_at','null']]) {
    await db.exec('begin')
    await db.exec(`update auth.users set ${field}=${value} where id='${b}'`)
    await db.exec('set local role picshaw_workspace')
    await denied(() => call(b,sb), '28000', `${field} user denied`)
    await db.exec('rollback')
  }
  await db.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1", [sb])
  await db.exec('set role picshaw_workspace')
  await denied(() => call(b,sb), '28000', 'expired session denied')
  await db.exec('reset role')
  check((await db.query("select count(*)::int as n from pg_roles where rolname in ('picshaw_workspace','picshaw_workspace_owner') and not rolcanlogin and not rolsuper and not rolbypassrls")).rows[0].n === 2, 'both roles nonlogin nonsuperuser no bypass RLS')
  const c='30000000-0000-4000-8000-000000000001', sc='30000000-0000-4000-8000-000000000002'
  await db.query('insert into auth.users(id,email_confirmed_at) values ($1,now())',[c])
  await db.query('insert into auth.sessions(id,user_id) values ($1,$2)',[sc,c])
  await db.exec("create function picshaw_workspace_private.fail_receipt_test() returns trigger language plpgsql as $$begin raise exception 'Injected failure'; end$$; create trigger fail_receipt before insert on picshaw_workspace_private.bootstraps for each row execute function picshaw_workspace_private.fail_receipt_test();")
  await db.exec('set role picshaw_workspace')
  await denied(()=>call(c,sc,true,'Workspace C','example.com'),'P0001','failed receipt rolls back whole bootstrap')
  await db.exec('reset role')
  check((await db.query('select count(*)::int as n from public.organizations')).rows[0].n===2,'failed operation leaves no orphan organization')
  check((await db.query('select count(*)::int as n from public.organization_memberships where user_id=$1',[c])).rows[0].n===0,'failed operation leaves no orphan membership')
  console.log(`PASS ${count} workspace SQL assertions in fresh isolated PGlite; not hosted Auth or concurrency verification.`)
} catch (error) { console.error(error.message, error.code, error.where); process.exitCode = 1 }
finally { await db.close() }
