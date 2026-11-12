-- LOCAL ONLY. No login credentials, hosted changes, provider access or token grants.
-- Session authority is checked freshly at entry and every successful return.
-- Revocation after the final check may let a bounded in-flight call finish.
begin;
create role picshaw_reports nologin noinherit;
create role picshaw_reports_owner nologin noinherit;
-- Managed postgres is not necessarily superuser; ownership transfer needs SET ROLE.
grant picshaw_reports_owner to postgres;
create schema picshaw_reports_private;
revoke all on schema picshaw_reports_private from public, anon, authenticated, service_role;
grant usage on schema picshaw_reports_private to picshaw_reports;
grant usage,create on schema picshaw_reports_private to picshaw_reports_owner;
grant usage on schema auth,public,picshaw_private,picshaw_gsc_private to picshaw_reports_owner;
grant execute on function auth.uid(),picshaw_private.valid_observations(jsonb,text[]),picshaw_private.validate_source_window(),picshaw_private.validate_evidence_pair(),picshaw_private.validate_active_actor() to picshaw_reports_owner;
grant select(id,is_anonymous,email_confirmed_at,phone_confirmed_at,banned_until,deleted_at) on auth.users to picshaw_reports_owner;
grant select(id,user_id,not_after) on auth.sessions to picshaw_reports_owner;
grant select,update(user_id) on public.organization_memberships to picshaw_reports_owner;
grant select(organization_id,connection_id,selected_property,generation,revoke_pending),update(organization_id) on picshaw_gsc_private.connections to picshaw_reports_owner;
grant select(organization_id,id,status),update(id) on public.google_connections to picshaw_reports_owner;
create policy reports_membership on public.organization_memberships to picshaw_reports_owner
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy reports_connection on picshaw_gsc_private.connections to picshaw_reports_owner
 using(organization_id in(select organization_id from public.organization_memberships where user_id=(select auth.uid()) and revoked_at is null and role in('owner','admin')))
 with check(organization_id in(select organization_id from public.organization_memberships where user_id=(select auth.uid()) and revoked_at is null and role in('owner','admin')));
create policy reports_connection_metadata on public.google_connections to picshaw_reports_owner
 using(organization_id in(select organization_id from public.organization_memberships where user_id=(select auth.uid()) and revoked_at is null and role in('owner','admin')))
 with check(organization_id in(select organization_id from public.organization_memberships where user_id=(select auth.uid()) and revoked_at is null and role in('owner','admin')));
do $$ declare t text; begin
 foreach t in array array['source_runs','source_snapshots','recommended_actions','reports'] loop
  execute format('grant select,insert on public.%I to picshaw_reports_owner',t);
  execute format('create policy reports_artifacts on public.%I to picshaw_reports_owner using(organization_id in(select organization_id from public.organization_memberships where user_id=(select auth.uid()) and revoked_at is null and role in(''owner'',''admin''))) with check(organization_id in(select organization_id from public.organization_memberships where user_id=(select auth.uid()) and revoked_at is null and role in(''owner'',''admin'')))',t);
 end loop;
end $$;

-- Selecting away and back must not resurrect an earlier authorization generation.
-- Refresh-token encryption stays bound to token_generation, not this selection epoch.
create function picshaw_reports_private.selection_epoch() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.selected_property is distinct from old.selected_property and new.generation=old.generation then
  new.generation:=old.generation+1; new.lease:=null; new.lease_until:=null;
 end if;
 return new;
end $$;
create trigger reports_selection_epoch before update of selected_property on picshaw_gsc_private.connections
 for each row execute function picshaw_reports_private.selection_epoch();
revoke all on function picshaw_reports_private.selection_epoch() from public,anon,authenticated,service_role;

create table picshaw_reports_private.operations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 user_id uuid not null references auth.users(id), session_id uuid not null,
 connection_id uuid not null, generation bigint not null, property_id text not null,
 window_end date not null, started_at timestamptz not null default date_trunc('milliseconds',clock_timestamp()),
 run_id uuid not null unique default gen_random_uuid(), report_id uuid not null unique default gen_random_uuid(),
 snapshot_ids uuid[] not null default array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()] check(cardinality(snapshot_ids)=6),
 state text not null check(state in('running','failed','completed')), lease uuid not null default gen_random_uuid(),
 lease_until timestamptz not null default clock_timestamp()+interval '5 minutes', review jsonb,
 foreign key(organization_id,connection_id) references public.google_connections(organization_id,id),
 unique(organization_id,user_id,session_id,connection_id,generation,property_id,window_end),
 check((state='completed')=(review is not null))
);
create index reports_operation_latest on picshaw_reports_private.operations(organization_id,connection_id,generation,property_id,started_at desc);
alter table picshaw_reports_private.operations owner to picshaw_reports_owner;
alter table picshaw_reports_private.operations enable row level security;
alter table picshaw_reports_private.operations force row level security;
create policy reports_operations on picshaw_reports_private.operations to picshaw_reports_owner
 using(organization_id in(select organization_id from public.organization_memberships where user_id=(select auth.uid()) and revoked_at is null and role in('owner','admin')))
 with check(user_id=(select auth.uid()) and organization_id in(select organization_id from public.organization_memberships where user_id=(select auth.uid()) and revoked_at is null and role in('owner','admin')));
revoke all on picshaw_reports_private.operations from public,anon,authenticated,service_role,picshaw_reports;

-- Caller is a dedicated trusted server role, never browser-supplied actor or artifacts.
-- Authentication JWT verification precedes this second, locked authorization check.
create function picshaw_reports_private.operation(p_user uuid,p_session uuid,p_exp bigint,p_org uuid,p_op text,p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
declare c record; s text; o picshaw_reports_private.operations%rowtype; r jsonb; snap jsonb; a jsonb; v_deadline timestamptz:=clock_timestamp()+interval '5 seconds';
 period text; grain text; dims text[]; idx integer:=0; ws date; we date; busy boolean:=false; summary jsonb;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'Read committed required' using errcode='25001'; end if;
 if p_user is null or p_session is null or p_org is null or p_exp is null or p_exp<=extract(epoch from clock_timestamp())+10
  or p_op is null or p_op not in('claim','complete','read','status','fail')
  or p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>8000000 then raise exception 'Unauthorized'; end if;
 -- Lock order: membership, GSC advisory, private/public connection; session is read-only.
 perform 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>clock_timestamp()+interval '10 seconds');
 if not found then raise exception 'Unauthorized'; end if;
 perform 1 from auth.users where id=p_user and is_anonymous=false and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) and (email_confirmed_at is not null or phone_confirmed_at is not null);
 if not found then raise exception 'Unauthorized'; end if;
 perform pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'session_id',p_session,'is_anonymous',false)::text,true);
 perform pg_catalog.set_config('request.jwt.claim.sub',p_user::text,true);
 perform 1 from public.organization_memberships where organization_id=p_org and user_id=p_user and revoked_at is null and role in('owner','admin') for share;
 if not found then raise exception 'Unauthorized'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('gsc:'||p_org::text,0));
 select organization_id,connection_id,selected_property,generation,revoke_pending into c from picshaw_gsc_private.connections where organization_id=p_org for share;
 if not found then raise exception 'Connection unavailable'; end if;
 select status into s from public.google_connections where organization_id=p_org and id=c.connection_id for share;
 if s is distinct from 'active' or c.revoke_pending or c.selected_property is null then raise exception 'Connection unavailable'; end if;

 if p_op='read' then
  if p-array['report']<>'{}'::jsonb then raise exception 'Invalid request'; end if;
  select * into o from picshaw_reports_private.operations where organization_id=p_org and connection_id=c.connection_id and generation=c.generation and property_id=c.selected_property
   and state='completed' and (not(p?'report') or report_id=(p->>'report')::uuid) order by started_at desc,id desc limit 1;
  if o.id is null then
    if clock_timestamp()>=v_deadline or p_exp<=extract(epoch from clock_timestamp())
    or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>clock_timestamp()))
    or not exists(select 1 from auth.users where id=p_user and is_anonymous=false and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) and (email_confirmed_at is not null or phone_confirmed_at is not null))
    then raise exception 'Session required' using errcode='28000'; end if;
    return 'null'::jsonb;
  end if;
  if clock_timestamp()>=v_deadline or p_exp<=extract(epoch from clock_timestamp())
    or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>clock_timestamp()))
    or not exists(select 1 from auth.users where id=p_user and is_anonymous=false and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) and (email_confirmed_at is not null or phone_confirmed_at is not null))
    then raise exception 'Session required' using errcode='28000'; end if;
  return jsonb_build_object('reportId',o.report_id,'runId',o.run_id,'review',o.review);
 elsif p_op='status' then
  if p<>'{}'::jsonb then raise exception 'Invalid request'; end if;
  select * into o from picshaw_reports_private.operations where organization_id=p_org and user_id=p_user and session_id=p_session
   and connection_id=c.connection_id and generation=c.generation and property_id=c.selected_property order by started_at desc,id desc limit 1;
  if o.id is null then
    if clock_timestamp()>=v_deadline or p_exp<=extract(epoch from clock_timestamp())
    or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>clock_timestamp()))
    or not exists(select 1 from auth.users where id=p_user and is_anonymous=false and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) and (email_confirmed_at is not null or phone_confirmed_at is not null))
    then raise exception 'Session required' using errcode='28000'; end if;
    return 'null'::jsonb;
  end if;
 elsif p_op='claim' then
  if p-array['connection','property','windowEnd']<>'{}'::jsonb or not(p?&array['connection','property','windowEnd'])
   or p->>'connection' is distinct from c.connection_id::text or p->>'property' is distinct from c.selected_property
   or p->>'windowEnd' is distinct from ((clock_timestamp() at time zone 'America/Los_Angeles')::date-3)::text then raise exception 'Selection unavailable'; end if;
  select * into o from picshaw_reports_private.operations where organization_id=p_org and user_id=p_user and session_id=p_session
   and connection_id=c.connection_id and generation=c.generation and property_id=c.selected_property and window_end=(p->>'windowEnd')::date for update;
  if o.id is null then
   insert into picshaw_reports_private.operations(organization_id,user_id,session_id,connection_id,generation,property_id,window_end,state)
    values(p_org,p_user,p_session,c.connection_id,c.generation,c.selected_property,(p->>'windowEnd')::date,'running') returning * into o;
  elsif o.state='running' and o.lease_until>clock_timestamp() then busy:=true;
  elsif o.state<>'completed' then
   update picshaw_reports_private.operations set state='running',lease=gen_random_uuid(),lease_until=clock_timestamp()+interval '5 minutes' where id=o.id returning * into o;
  end if;
 else
  if p-array['operation','lease','review']<>'{}'::jsonb then raise exception 'Invalid request'; end if;
  select * into o from picshaw_reports_private.operations where id=(p->>'operation')::uuid and organization_id=p_org and user_id=p_user and session_id=p_session
   and connection_id=c.connection_id and generation=c.generation and property_id=c.selected_property for update;
  if o.id is null or o.lease::text is distinct from p->>'lease' then raise exception 'Stale operation'; end if;
  if o.state='completed' then
   if p_op<>'complete' or o.review is distinct from p->'review' then raise exception 'Replay conflict'; end if;
  if clock_timestamp()>=v_deadline or p_exp<=extract(epoch from clock_timestamp())
    or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>clock_timestamp()))
    or not exists(select 1 from auth.users where id=p_user and is_anonymous=false and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) and (email_confirmed_at is not null or phone_confirmed_at is not null))
    then raise exception 'Session required' using errcode='28000'; end if;
   return jsonb_build_object('reportId',o.report_id,'runId',o.run_id,'state','completed');
  end if;
  if o.state<>'running' or o.lease_until<=clock_timestamp() then raise exception 'Stale operation'; end if;
  if p_op='fail' then
   if p?'review' then raise exception 'Invalid request'; end if;
   update picshaw_reports_private.operations set state='failed',lease_until=clock_timestamp() where id=o.id;
  if clock_timestamp()>=v_deadline or p_exp<=extract(epoch from clock_timestamp())
    or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>clock_timestamp()))
    or not exists(select 1 from auth.users where id=p_user and is_anonymous=false and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) and (email_confirmed_at is not null or phone_confirmed_at is not null))
    then raise exception 'Session required' using errcode='28000'; end if;
   return jsonb_build_object('state','failed');
  end if;
  r:=p->'review';
  if jsonb_typeof(r) is distinct from 'object' or not(r?&array['version','selection','runId','windows','snapshots','totals','coverage','status','comparison','actions','disclaimer'])
   or r-array['version','selection','runId','windows','snapshots','totals','coverage','status','comparison','actions','disclaimer']<>'{}'::jsonb
   or r->'version' is distinct from '1'::jsonb or r->>'runId' is distinct from o.run_id::text
   or r->'selection' is distinct from jsonb_build_object('organizationId',p_org,'connectionId',c.connection_id,'propertyId',c.selected_property)
   or coalesce(r->>'status','') not in('ready','empty','incomplete','inconsistent') or jsonb_typeof(r->'actions') is distinct from 'array'
   or jsonb_typeof(r->'disclaimer') is distinct from 'string'
   or r->'windows' is distinct from jsonb_build_object('current',jsonb_build_object('start',o.window_end-27,'end',o.window_end),'prior',jsonb_build_object('start',o.window_end-55,'end',o.window_end-28))
   or jsonb_typeof(r->'snapshots') is distinct from 'object' or (r->'snapshots')-array['current','prior']<>'{}'::jsonb then raise exception 'Invalid review'; end if;
  -- Derived summaries are rebuilt by the validated server journey. Reject extra
  -- keys at every retained summary level so tokens cannot hitchhike in JSON.
  foreach grain in array array['totals','coverage'] loop
   summary:=r->grain;
   if jsonb_typeof(summary) is distinct from 'object' or not(summary?&array['current','prior']) or summary-array['current','prior']<>'{}'::jsonb then raise exception 'Invalid summary'; end if;
  end loop;
  foreach period in array array['current','prior'] loop
   summary:=r#>array['totals',period];
   if jsonb_typeof(summary) is distinct from 'object' or not(summary?&array['snapshotId','status','metrics']) or summary-array['snapshotId','status','metrics']<>'{}'::jsonb
    or summary->>'snapshotId' is distinct from o.snapshot_ids[case when period='current' then 1 else 4 end]::text
    or coalesce(summary->>'status','') not in('available','missing','bounded') then raise exception 'Invalid totals'; end if;
   summary:=summary->'metrics';
   if summary<>'null'::jsonb and (jsonb_typeof(summary) is distinct from 'object' or not(summary?&array['clicks','impressions','ctr','position']) or summary-array['clicks','impressions','ctr','position']<>'{}'::jsonb
    or jsonb_typeof(summary->'clicks') is distinct from 'number' or jsonb_typeof(summary->'impressions') is distinct from 'number' or jsonb_typeof(summary->'ctr') is distinct from 'number'
    or jsonb_typeof(summary->'position') not in('number','null')) then raise exception 'Invalid metrics'; end if;
   summary:=r#>array['coverage',period];
   if jsonb_typeof(summary) is distinct from 'object' or not(summary?&array['status','missingDates','reasons']) or summary-array['status','missingDates','reasons']<>'{}'::jsonb
    or coalesce(summary->>'status','') not in('complete','unknown','bounded','inconsistent') or jsonb_typeof(summary->'missingDates') is distinct from 'array' or jsonb_typeof(summary->'reasons') is distinct from 'array'
    or exists(select 1 from jsonb_array_elements(summary->'missingDates') x where jsonb_typeof(x)<>'string')
    or exists(select 1 from jsonb_array_elements_text(summary->'reasons') x where x not in('MISSING_DATES','MISSING_TOTALS','BOUNDED_SOURCE','TOTALS_MISMATCH','CONFLICTING_ACTIVITY')) then raise exception 'Invalid coverage'; end if;
  end loop;
  summary:=r->'comparison';
  if summary<>'null'::jsonb then
   if jsonb_typeof(summary) is distinct from 'object' or not(summary?&array['clicks','impressions','ctrPercentagePoints','positionChange']) or summary-array['clicks','impressions','ctrPercentagePoints','positionChange']<>'{}'::jsonb
    or jsonb_typeof(summary->'ctrPercentagePoints') is distinct from 'number' or jsonb_typeof(summary->'positionChange') not in('number','null') then raise exception 'Invalid comparison'; end if;
   foreach grain in array array['clicks','impressions'] loop
    a:=summary->grain;
    if jsonb_typeof(a) is distinct from 'object' or not(a?&array['absolute','relative']) or a-array['absolute','relative']<>'{}'::jsonb
     or jsonb_typeof(a->'absolute') is distinct from 'number' or jsonb_typeof(a->'relative') not in('number','null') then raise exception 'Invalid comparison'; end if;
   end loop;
  end if;
  insert into public.source_runs(organization_id,id,connection_id,property_id,current_start,current_end,prior_start,prior_end,created_by,created_at)
   values(p_org,o.run_id,c.connection_id,c.selected_property,o.window_end-27,o.window_end,o.window_end-55,o.window_end-28,p_user,o.started_at);
  foreach period in array array['current','prior'] loop
   if jsonb_typeof(r#>array['snapshots',period]) is distinct from 'object' or (r#>array['snapshots',period])-array['aggregate','daily','page']<>'{}'::jsonb then raise exception 'Invalid snapshots'; end if;
   ws:=case when period='current' then o.window_end-27 else o.window_end-55 end;
   we:=case when period='current' then o.window_end else o.window_end-28 end;
   foreach grain in array array['aggregate','daily','page'] loop
    idx:=idx+1; snap:=r#>array['snapshots',period,grain];
    dims:=case grain when 'aggregate' then array[]::text[] when 'daily' then array['date'] else array['page'] end;
    if jsonb_typeof(snap) is distinct from 'object' or not(snap?&array['id','organizationId','propertyId','runId','source','retrievedAt','timezone','window','searchType','filters','dimensions','dataState','coverage','warnings','rows'])
     or snap-array['id','organizationId','propertyId','runId','source','retrievedAt','timezone','window','searchType','filters','dimensions','dataState','coverage','warnings','rows']<>'{}'::jsonb
     or snap->>'id' is distinct from o.snapshot_ids[idx]::text or snap->>'organizationId' is distinct from p_org::text or snap->>'propertyId' is distinct from c.selected_property or snap->>'runId' is distinct from o.run_id::text
     or snap->>'source' is distinct from 'google-search-console' or snap->>'timezone' is distinct from 'America/Los_Angeles' or snap->>'searchType' is distinct from 'web' or snap->>'dataState' is distinct from 'final'
     or snap->'filters' is distinct from '[]'::jsonb or snap->'dimensions' is distinct from to_jsonb(dims)
     or snap->'window' is distinct from jsonb_build_object('start',ws,'end',we) or jsonb_typeof(snap->'warnings') is distinct from 'array'
     or exists(select 1 from jsonb_array_elements(snap->'warnings') w where jsonb_typeof(w)<>'string') then raise exception 'Invalid snapshot'; end if;
    insert into public.source_snapshots(organization_id,id,run_id,property_id,retrieved_at,window_start,window_end,dimensions,coverage,warnings,rows)
     values(p_org,o.snapshot_ids[idx],o.run_id,c.selected_property,(snap->>'retrievedAt')::timestamptz,ws,we,dims,snap->>'coverage',array(select jsonb_array_elements_text(snap->'warnings')),snap->'rows');
   end loop;
  end loop;
  if r->>'status' in('incomplete','inconsistent','empty') and r->'actions'<>'[]'::jsonb then raise exception 'Invalid actions'; end if;
  for a in select jsonb_array_elements(r->'actions') loop
   if jsonb_typeof(a) is distinct from 'object' or not(a?&array['id','rule','title','reason','page','current','prior','snapshotId','priorSnapshotId','ruleVersion','status'])
    or a-array['id','rule','title','reason','page','current','prior','snapshotId','priorSnapshotId','ruleVersion','status']<>'{}'::jsonb
    or a->>'snapshotId' is distinct from o.snapshot_ids[3]::text or a->>'priorSnapshotId' is distinct from o.snapshot_ids[6]::text or a->>'status' is distinct from 'open' then raise exception 'Invalid action'; end if;
   insert into public.recommended_actions(organization_id,id,run_id,property_id,snapshot_id,prior_snapshot_id,rule,rule_version,title,reason,page,current_row,prior_row,created_at)
    values(p_org,a->>'id',o.run_id,c.selected_property,o.snapshot_ids[3],o.snapshot_ids[6],a->>'rule',a->>'ruleVersion',a->>'title',a->>'reason',a->>'page',a->'current',nullif(a->'prior','null'::jsonb),o.started_at);
  end loop;
  insert into public.reports(organization_id,id,run_id,property_id,snapshot_id,prior_snapshot_id,created_by,created_at)
   values(p_org,o.report_id,o.run_id,c.selected_property,o.snapshot_ids[3],o.snapshot_ids[6],p_user,o.started_at);
  update picshaw_reports_private.operations set state='completed',review=r where id=o.id;
  if clock_timestamp()>=v_deadline or p_exp<=extract(epoch from clock_timestamp())
    or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>clock_timestamp()))
    or not exists(select 1 from auth.users where id=p_user and is_anonymous=false and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) and (email_confirmed_at is not null or phone_confirmed_at is not null))
    then raise exception 'Session required' using errcode='28000'; end if;
  return jsonb_build_object('reportId',o.report_id,'runId',o.run_id,'state','completed');
 end if;
  if clock_timestamp()>=v_deadline or p_exp<=extract(epoch from clock_timestamp())
    or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>clock_timestamp()))
    or not exists(select 1 from auth.users where id=p_user and is_anonymous=false and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) and (email_confirmed_at is not null or phone_confirmed_at is not null))
    then raise exception 'Session required' using errcode='28000'; end if;
 return jsonb_build_object('operationId',o.id,'runId',o.run_id,'reportId',o.report_id,'snapshotIds',o.snapshot_ids,
  'lease',case when p_op='claim' and not busy and o.state='running' then o.lease else null end,
  'state',case when busy then 'busy' else o.state end,'selection',jsonb_build_object('organizationId',p_org,'connectionId',c.connection_id,'propertyId',c.selected_property),
  'startedAt',to_char(o.started_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'generation',o.generation,'windowEnd',o.window_end,'leaseUntil',o.lease_until);
end $$;
revoke all on function picshaw_reports_private.operation(uuid,uuid,bigint,uuid,text,jsonb) from public,anon,authenticated,service_role;
alter function picshaw_reports_private.operation(uuid,uuid,bigint,uuid,text,jsonb) owner to picshaw_reports_owner;
grant execute on function picshaw_reports_private.operation(uuid,uuid,bigint,uuid,text,jsonb) to picshaw_reports;
revoke create on schema picshaw_reports_private from picshaw_reports_owner;
comment on schema picshaw_reports_private is 'Never expose via Data API. Verified server actors only; durable fenced sync and retained private reviews.';
commit;
