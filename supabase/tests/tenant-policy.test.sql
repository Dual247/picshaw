-- Run after reviewed migrations in a disposable DB or explicitly authorized empty pilot.
-- Disposable DB only: bootstrap.sql first. NEVER run bootstrap.sql on hosted Supabase.
-- Every fixture/assertion is synthetic and rolled back. No extensions required.
begin;
-- Run only against an explicitly authorized EMPTY dedicated pilot/test database.
-- Never run bootstrap.sql on hosted Supabase. This suite uses existing Auth roles.
set local request.jwt.claim.sub = '';
set local request.jwt.claim = '';
do $$
declare name text; total bigint;
begin
  if exists (select 1 from auth.users) or exists (select 1 from auth.sessions) then
    raise exception 'Test requires an empty Auth user/session store.';
  end if;
  foreach name in array array['organizations','organization_memberships','google_connections','source_runs','source_snapshots','recommended_actions','work_events','reports'] loop
    execute format('select count(*) from public.%I',name) into total;
    if total <> 0 then raise exception 'Test requires empty application tables: %', name; end if;
  end loop;
end;
$$;

create schema test_support;
grant usage on schema test_support to anon, authenticated, service_role;
create table test_support.results (result text not null);
grant insert, select on test_support.results to anon, authenticated, service_role;
create function test_support.assert(ok boolean, label text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  insert into test_support.results values ('PASS ' || label);
end;
$$;
create function test_support.expect_error(statement text, expected_state text, label text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_state then
      insert into test_support.results values ('PASS ' || label);
      return;
    end if;
    raise exception 'FAIL: % expected %, got %: %', label, expected_state, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL: % did not fail', label;
end;
$$;

insert into auth.users(id) values
 ('10000000-0000-4000-8000-000000000001'), ('20000000-0000-4000-8000-000000000001'),
 ('30000000-0000-4000-8000-000000000001'), ('40000000-0000-4000-8000-000000000001');
insert into public.organizations(id,name) values
 ('10000000-0000-4000-8000-000000000010','Synthetic A'), ('20000000-0000-4000-8000-000000000010','Synthetic B');
insert into public.organization_memberships(organization_id,user_id,role) values
 ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001','viewer'),
 ('20000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000001','owner');
insert into public.organization_memberships(organization_id,user_id,role,revoked_at) values
 ('10000000-0000-4000-8000-000000000010','40000000-0000-4000-8000-000000000001','owner',now());
set local role service_role;
insert into public.google_connections(organization_id,id,label,created_by) values
 ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000020','Synthetic Google A','10000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000020','Synthetic Google B','20000000-0000-4000-8000-000000000001');
insert into public.source_runs(organization_id,id,connection_id,property_id,current_start,current_end,prior_start,prior_end,created_by)
select organization_id, replace(id::text,'000000000020','000000000030')::uuid,id,'sc-domain:example.test',
 '2026-10-02','2026-10-02','2026-10-01','2026-10-01',created_by from public.google_connections;
insert into public.source_snapshots(organization_id,id,run_id,property_id,retrieved_at,window_start,window_end,dimensions,coverage,rows)
select organization_id,replace(id::text,'000000000030','000000000040')::uuid,id,property_id,
 '2026-10-10T12:00:00Z',current_start,current_end,array['page'],'available-rows',
 '[{"keys":["https://example.test/a"],"clicks":20,"impressions":1000,"ctr":0.02,"position":10}]'::jsonb
 from public.source_runs;
insert into public.source_snapshots(organization_id,id,run_id,property_id,retrieved_at,window_start,window_end,dimensions,coverage,rows)
select organization_id,replace(id::text,'000000000030','000000000041')::uuid,id,property_id,
 '2026-10-10T12:00:00Z',prior_start,prior_end,array['page'],'available-rows',
 '[{"keys":["https://example.test/a"],"clicks":100,"impressions":1000,"ctr":0.1,"position":10}]'::jsonb
 from public.source_runs;
insert into public.recommended_actions(organization_id,id,run_id,property_id,snapshot_id,prior_snapshot_id,rule,title,reason,page,current_row,prior_row)
select c.organization_id,c.id::text || ':click-decline:https://example.test/a',c.run_id,c.property_id,c.id,p.id,
 'click-decline','Review declining clicks','Synthetic evidence only.','https://example.test/a',c.rows->0,p.rows->0
 from public.source_snapshots c join public.source_snapshots p
 on c.organization_id=p.organization_id and c.run_id=p.run_id and p.window_end+1=c.window_start;
insert into public.work_events(organization_id,action_id,actor_id,owner_id,status,note,deliverable,evidence_url,recheck_on,occurred_at)
select a.organization_id,a.id,m.user_id,m.user_id,'completed','Synthetic work only.','Synthetic title review',
 'https://example.test/deliverable','2026-10-20','2026-10-10T12:00:00Z'
 from public.recommended_actions a join public.organization_memberships m on a.organization_id=m.organization_id and m.revoked_at is null;
insert into public.reports(organization_id,run_id,property_id,snapshot_id,prior_snapshot_id,created_by)
select a.organization_id,a.run_id,a.property_id,a.snapshot_id,a.prior_snapshot_id,m.user_id
 from public.recommended_actions a join public.organization_memberships m on a.organization_id=m.organization_id and m.revoked_at is null;
reset role;

select test_support.assert((select count(*)=8 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity),'all eight tables enable and force RLS');
select test_support.assert(not exists (select 1 from pg_policies where schemaname='public' and cmd<>'SELECT' and roles && array['public','anon','authenticated']::name[]),'no browser write policies');
select test_support.assert(not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='picshaw_private' and p.prosecdef),'no SECURITY DEFINER functions');
select test_support.assert(not has_schema_privilege('authenticated','picshaw_private','USAGE'),'private validator schema unavailable to browsers');

-- All eight tables are read-isolated for a valid tenant A viewer.
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","is_anonymous":false,"user_metadata":{"role":"owner"}}';
do $$
declare name text; total bigint;
begin
 foreach name in array array['organizations','organization_memberships','google_connections','source_runs','source_snapshots','recommended_actions','work_events','reports'] loop
   execute format('select count(*) from public.%I',name) into total;
   perform test_support.assert(total=case when name='source_snapshots' then 2 else 1 end,'A reads own '||name);
 end loop;
end;
$$;
select test_support.expect_error($q$update public.organization_memberships set role='owner'$q$,'42501','viewer cannot escalate role');
select test_support.expect_error($q$insert into public.organization_memberships values ('20000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001','owner',now(),null)$q$,'42501','cannot self-enroll in another tenant');
select test_support.expect_error($q$update public.reports set organization_id='20000000-0000-4000-8000-000000000010'$q$,'42501','cannot move report ownership');
select test_support.expect_error($q$delete from public.source_snapshots$q$,'42501','browser cannot delete source evidence');
select test_support.expect_error($q$insert into public.work_events select * from public.work_events$q$,'42501','browser cannot fabricate completed work');
select test_support.expect_error($q$select picshaw_private.valid_observations('[]','{}')$q$,'42501','private helpers are not browser RPCs');

-- Tenant B has an owner role but cannot change membership through the browser.
set local request.jwt.claims = '{"sub":"20000000-0000-4000-8000-000000000001","is_anonymous":false}';
select test_support.assert((select count(*)=0 from public.source_snapshots where organization_id='10000000-0000-4000-8000-000000000010'),'B cannot read A even with known IDs');
select test_support.expect_error($q$update public.organization_memberships set role='admin'$q$,'42501','owner role does not grant direct membership writes');

-- Authenticated identity alone, missing uid, revoked identity and anonymous Auth.
do $$
declare claims text; name text; total bigint;
begin
 foreach claims in array array[
 '{"sub":"30000000-0000-4000-8000-000000000001","is_anonymous":false,"user_metadata":{"organization_id":"10000000-0000-4000-8000-000000000010","role":"owner"}}',
 '{}',
 '{"sub":"40000000-0000-4000-8000-000000000001","is_anonymous":false}',
 '{"sub":"10000000-0000-4000-8000-000000000001","is_anonymous":true}'
 ] loop
   perform set_config('request.jwt.claims',claims,true);
   foreach name in array array['organizations','organization_memberships','google_connections','source_runs','source_snapshots','recommended_actions','work_events','reports'] loop
     execute format('select count(*) from public.%I',name) into total;
     perform test_support.assert(total=0,'denied identity '||claims||' on '||name);
   end loop;
 end loop;
end;
$$;
reset role;
set local role anon;
do $$
declare name text;
begin
 foreach name in array array['organizations','organization_memberships','google_connections','source_runs','source_snapshots','recommended_actions','work_events','reports'] loop
   perform test_support.expect_error(format('select * from public.%I',name),'42501','anon cannot read '||name);
 end loop;
end;
$$;
reset role;

-- Current membership is checked on every query, even with the same old claims.
set local role service_role;
update public.organization_memberships set revoked_at=now() where user_id='10000000-0000-4000-8000-000000000001';
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","is_anonymous":false}';
select test_support.assert((select count(*)=0 from public.reports),'revocation invalidates report access without JWT refresh');
reset role;
set local role service_role;
update public.organization_memberships set revoked_at=null where user_id='10000000-0000-4000-8000-000000000001';

select test_support.expect_error($q$insert into public.google_connections(organization_id,label,created_by) values ('10000000-0000-4000-8000-000000000010','bad','20000000-0000-4000-8000-000000000001')$q$,'23514','cross-tenant connection actor rejected');
select test_support.expect_error($q$insert into public.google_connections(organization_id,label,created_by) values ('10000000-0000-4000-8000-000000000010','bad','40000000-0000-4000-8000-000000000001')$q$,'23514','revoked actor rejected for trusted writes');
select test_support.expect_error($q$insert into public.google_connections(organization_id,label,created_by,scopes) values ('10000000-0000-4000-8000-000000000010','bad','10000000-0000-4000-8000-000000000001',array['https://www.googleapis.com/auth/webmasters'])$q$,'23514','write-capable Google scope rejected');
select test_support.expect_error($q$insert into public.source_runs(organization_id,connection_id,property_id,current_start,current_end,prior_start,prior_end,created_by) values ('10000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000020','sc-domain:example.test','2026-10-02','2026-10-02','2026-10-01','2026-10-01','10000000-0000-4000-8000-000000000001')$q$,'23503','cross-tenant connection reference rejected');
select test_support.expect_error($q$insert into public.source_snapshots(organization_id,run_id,property_id,retrieved_at,window_start,window_end,dimensions,coverage,rows) values ('10000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000030','sc-domain:example.test',now(),'2026-10-02','2026-10-02','{}','available-rows','[]')$q$,'23503','cross-tenant snapshot run rejected');
select test_support.expect_error($q$insert into public.source_snapshots(organization_id,run_id,property_id,retrieved_at,window_start,window_end,dimensions,coverage,rows) values ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000030','sc-domain:other.test',now(),'2026-10-02','2026-10-02','{}','available-rows','[]')$q$,'23503','snapshot property substitution rejected');
select test_support.expect_error($q$insert into public.source_snapshots(organization_id,run_id,property_id,retrieved_at,window_start,window_end,dimensions,coverage,rows) values ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000030','sc-domain:example.test',now(),'2026-10-03','2026-10-03','{}','available-rows','[]')$q$,'23514','snapshot outside run window rejected');
select test_support.expect_error($q$insert into public.source_snapshots(organization_id,run_id,property_id,retrieved_at,window_start,window_end,dimensions,coverage,rows) values ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000030','sc-domain:example.test',now(),'2026-10-02','2026-10-02','{page}','available-rows','[]')$q$,'23505','duplicate run/window/grain rejected');

select test_support.expect_error($q$insert into public.reports(organization_id,run_id,property_id,snapshot_id,prior_snapshot_id,created_by) values ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000030','sc-domain:example.test','20000000-0000-4000-8000-000000000040','10000000-0000-4000-8000-000000000041','10000000-0000-4000-8000-000000000001')$q$,'23503','cross-tenant report evidence rejected');
select test_support.expect_error($q$insert into public.reports(organization_id,run_id,property_id,snapshot_id,prior_snapshot_id,created_by) values ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000030','sc-domain:example.test','10000000-0000-4000-8000-000000000041','10000000-0000-4000-8000-000000000040','10000000-0000-4000-8000-000000000001')$q$,'23514','reversed report windows rejected');
select test_support.expect_error($q$insert into public.recommended_actions(organization_id,id,run_id,property_id,snapshot_id,prior_snapshot_id,rule,title,reason,page,current_row,prior_row) select organization_id,replace(id,'click-decline','ctr-decline'),run_id,property_id,snapshot_id,prior_snapshot_id,'ctr-decline',title,reason,page,jsonb_set(current_row,'{clicks}','999'),prior_row from public.recommended_actions limit 1$q$,'23514','fabricated action evidence rejected');
select test_support.expect_error($q$insert into public.work_events(organization_id,action_id,actor_id,owner_id,status,note,recheck_on) select organization_id,action_id,actor_id,'20000000-0000-4000-8000-000000000001','open','bad',current_date from public.work_events where organization_id='10000000-0000-4000-8000-000000000010'$q$,'23514','cross-tenant work owner rejected');
select test_support.expect_error($q$insert into public.work_events(organization_id,action_id,actor_id,owner_id,status,note,recheck_on) select organization_id,replace(action_id,'10000000-','20000000-'),actor_id,owner_id,'open','bad',current_date from public.work_events where organization_id='10000000-0000-4000-8000-000000000010'$q$,'23503','cross-tenant work action rejected');
select test_support.expect_error($q$insert into public.work_events(organization_id,action_id,actor_id,owner_id,status,note,recheck_on) select organization_id,action_id,actor_id,owner_id,'completed','bad',current_date from public.work_events limit 1$q$,'23514','completion without deliverable/evidence rejected');
select test_support.expect_error($q$insert into public.work_events(organization_id,action_id,actor_id,owner_id,status,note,recheck_on,evidence_url) select organization_id,action_id,actor_id,owner_id,'open','bad',current_date,'javascript:alert(1)' from public.work_events limit 1$q$,'23514','executable work evidence URL rejected');
select test_support.expect_error('update public.source_snapshots set coverage=''bounded''','42501','service role cannot overwrite snapshots');
select test_support.expect_error('truncate public.source_snapshots cascade','42501','service role cannot truncate artifacts');
reset role;

-- Even the fixture administrator cannot accidentally rewrite/delete retained rows.
do $$
declare name text;
begin
 foreach name in array array['source_runs','source_snapshots','recommended_actions','work_events','reports'] loop
   perform test_support.expect_error(format('delete from public.%I',name),'55000','delete trigger protects '||name);
 end loop;
end;
$$;
select test_support.expect_error('update public.source_snapshots set coverage=''bounded''','55000','snapshot update trigger applies to privileged owner');

-- Strict observation validator protects immutable source shape.
select test_support.assert(picshaw_private.valid_observations('[]','{}'),'empty data is retained as empty');
select test_support.assert(picshaw_private.valid_observations('[{"keys":[],"clicks":0,"impressions":0,"ctr":0,"position":null}]','{}'),'zero impressions retain unknown position');
select test_support.assert(not picshaw_private.valid_observations('[{"keys":[],"clicks":1,"impressions":0,"ctr":0,"position":null}]','{}'),'clicks cannot exceed impressions');
select test_support.assert(not picshaw_private.valid_observations('[{"keys":[],"clicks":1,"impressions":10,"ctr":0.5,"position":1}]','{}'),'CTR must derive from counts');
select test_support.assert(not picshaw_private.valid_observations('[{"keys":[],"clicks":0,"impressions":0,"ctr":0,"position":null,"accessToken":"synthetic"}]','{}'),'unknown fields cannot enter source rows');
select test_support.assert(not picshaw_private.valid_observations('[{"keys":["a"],"clicks":0,"impressions":0,"ctr":0,"position":null},{"keys":["a"],"clicks":0,"impressions":0,"ctr":0,"position":null}]','{page}'),'duplicate grain keys rejected');
select test_support.assert(not picshaw_private.valid_observations('[{"keys":[],"clicks":0,"impressions":0,"ctr":0,"position":null}]','{page}'),'grain length must match dimensions');

-- Each browser privilege is denied, not merely hidden by a SELECT policy.
do $$
declare name text; role_name text;
begin
 foreach role_name in array array['anon','authenticated'] loop
   foreach name in array array['organizations','organization_memberships','google_connections','source_runs','source_snapshots','recommended_actions','work_events','reports'] loop
     perform test_support.assert(
       not has_table_privilege(role_name,'public.'||name,'INSERT')
       and not has_table_privilege(role_name,'public.'||name,'UPDATE')
       and not has_table_privilege(role_name,'public.'||name,'DELETE')
       and not has_table_privilege(role_name,'public.'||name,'TRUNCATE')
       and not has_table_privilege(role_name,'public.'||name,'REFERENCES')
       and not has_table_privilege(role_name,'public.'||name,'TRIGGER'),
       role_name||' has no mutation privileges on '||name);
   end loop;
 end loop;
end;
$$;
set local role service_role;
insert into public.source_runs(organization_id,id,connection_id,property_id,current_start,current_end,prior_start,prior_end,created_by)
select organization_id,'10000000-0000-4000-8000-000000000050',connection_id,property_id,current_start,current_end,prior_start,prior_end,created_by
 from public.source_runs where organization_id='10000000-0000-4000-8000-000000000010';
insert into public.source_snapshots(organization_id,id,run_id,property_id,retrieved_at,window_start,window_end,dimensions,coverage,rows)
select organization_id,replace(id::text,'00000000004','00000000006')::uuid,'10000000-0000-4000-8000-000000000050',
 property_id,retrieved_at,window_start,window_end,dimensions,'bounded',rows
 from public.source_snapshots where organization_id='10000000-0000-4000-8000-000000000010';
select test_support.expect_error($q$insert into public.recommended_actions(organization_id,id,run_id,property_id,snapshot_id,prior_snapshot_id,rule,title,reason,page,current_row,prior_row)
 select organization_id,replace(id,'000000000040','000000000060'),'10000000-0000-4000-8000-000000000050',property_id,
 '10000000-0000-4000-8000-000000000060','10000000-0000-4000-8000-000000000061',rule,title,reason,page,current_row,prior_row
 from public.recommended_actions where organization_id='10000000-0000-4000-8000-000000000010'$q$,'23514','bounded source suppresses action persistence');
select test_support.expect_error($q$insert into public.recommended_actions(organization_id,id,run_id,property_id,snapshot_id,prior_snapshot_id,rule,title,reason,page,current_row,prior_row)
 select organization_id,replace(id,'click-decline','ctr-decline'),run_id,property_id,
 '20000000-0000-4000-8000-000000000040',prior_snapshot_id,'ctr-decline',title,reason,page,current_row,prior_row
 from public.recommended_actions where organization_id='10000000-0000-4000-8000-000000000010'$q$,'23503','cross-tenant action evidence rejected');
select test_support.expect_error($q$insert into public.reports(organization_id,run_id,property_id,snapshot_id,prior_snapshot_id,created_by)
 values ('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000030','sc-domain:example.test',
 '10000000-0000-4000-8000-000000000040','10000000-0000-4000-8000-000000000061','10000000-0000-4000-8000-000000000001')$q$,'23503','mixed-run report evidence rejected');
reset role;

do $$ begin if (select count(*) from test_support.results) <> 110 then raise exception 'Expected 110 assertions.'; end if; end; $$;
select result from test_support.results order by result;
select count(*)::text || ' assertions passed' as result from test_support.results;
rollback;
select '110 SQL assertions completed; transaction rolled back.' as result;


