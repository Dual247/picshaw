-- LOCAL ONLY. No credentials, hosted migrations, schedules, or live provider calls.
begin;
grant create on schema picshaw_dataforseo_private to picshaw_dataforseo_owner;
create table picshaw_dataforseo_private.jobs (
 job_id text primary key check(job_id ~ '^[a-zA-Z0-9_-]{1,100}$'),
 organization_id uuid not null references public.organizations(id), user_id uuid not null references auth.users(id), session_id uuid not null,
 domain text not null check(length(domain) between 3 and 63), platform text not null check(platform in('google','chat_gpt')),
 row_limit integer not null check(row_limit between 1 and 100),
 state text not null default 'queued' check(state in('queued','running','completed','failed','uncertain')),
 lease uuid, result jsonb, created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 check((state='queued')=(lease is null)), check((state='completed')=(result is not null))
);
create index dataforseo_jobs_recent on picshaw_dataforseo_private.jobs(organization_id,created_at desc);
alter table picshaw_dataforseo_private.jobs owner to picshaw_dataforseo_owner;
alter table picshaw_dataforseo_private.jobs enable row level security;
alter table picshaw_dataforseo_private.jobs force row level security;
create policy private_owner on picshaw_dataforseo_private.jobs to picshaw_dataforseo_owner using(true) with check(true);
revoke all on picshaw_dataforseo_private.jobs from public,anon,authenticated,service_role,picshaw_dataforseo;

create function picshaw_dataforseo_private.job_metadata(j picshaw_dataforseo_private.jobs)
returns jsonb language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('jobId',j.job_id,'domain',j.domain,'platform',j.platform,'rowLimit',j.row_limit,'state',j.state,'createdAt',j.created_at,'updatedAt',j.updated_at)
$$;
revoke all on function picshaw_dataforseo_private.job_metadata(picshaw_dataforseo_private.jobs) from public,anon,authenticated,service_role,picshaw_dataforseo;
alter function picshaw_dataforseo_private.job_metadata(picshaw_dataforseo_private.jobs) owner to picshaw_dataforseo_owner;

create function picshaw_dataforseo_private.enqueue(p_user uuid,p_session uuid,p_exp bigint,p_org uuid,p_job text,p_domain text,p_platform text,p_limit integer)
returns jsonb language plpgsql volatile security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
declare j picshaw_dataforseo_private.jobs%rowtype; deadline timestamptz:=clock_timestamp()+interval '4 seconds';
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'Read committed required' using errcode='25001'; end if;
 perform picshaw_dataforseo_private.authorize(p_user,p_session,p_exp,p_org);
 if p_job is null or p_job !~ '^[a-zA-Z0-9_-]{1,100}$' or p_domain is null or length(p_domain) not between 3 and 63
 or p_domain !~ '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$' or p_domain ~ '(^|\.)(localhost|local|internal|test|invalid|onion|home|lan)$'
 or p_domain ~ '^www\.' or p_platform is null or p_platform not in('google','chat_gpt') or p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid job' using errcode='22023'; end if;
 -- The existing global budget row also serializes job creation across instances.
 perform 1 from picshaw_dataforseo_private.account_budget where singleton for update;
 select * into j from picshaw_dataforseo_private.jobs where job_id=p_job;
 if found then
  if j.organization_id<>p_org or j.user_id<>p_user then raise exception 'Job unavailable' using errcode='42501'; end if;
  if j.domain<>p_domain or j.platform<>p_platform or j.row_limit<>p_limit then raise exception 'Job conflict' using errcode='23505'; end if;
 else
  select * into j from picshaw_dataforseo_private.jobs where organization_id=p_org and domain=p_domain and platform=p_platform and row_limit=p_limit and created_at>clock_timestamp()-interval '24 hours' order by created_at desc limit 1;
  if found then
   if j.user_id<>p_user then raise exception 'Job unavailable' using errcode='42501'; end if;
  else
   if (select count(*) from picshaw_dataforseo_private.jobs where organization_id=p_org and created_at>clock_timestamp()-interval '24 hours')>=100
    or exists(select 1 from picshaw_dataforseo_private.jobs where organization_id=p_org and state in('queued','running','uncertain')) then raise exception 'Job unavailable' using errcode='55000'; end if;
   insert into picshaw_dataforseo_private.jobs(job_id,organization_id,user_id,session_id,domain,platform,row_limit)
    values(p_job,p_org,p_user,p_session,p_domain,p_platform,p_limit) returning * into j;
  end if;
 end if;
 perform picshaw_dataforseo_private.authorize(p_user,p_session,p_exp,p_org);
 if clock_timestamp()>=deadline then raise exception 'Job operation timed out' using errcode='57014'; end if;
 return picshaw_dataforseo_private.job_metadata(j);
end $$;

create function picshaw_dataforseo_private.start_job(p_user uuid,p_session uuid,p_exp bigint,p_org uuid,p_job text)
returns jsonb language plpgsql volatile security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
declare j picshaw_dataforseo_private.jobs%rowtype; value jsonb; deadline timestamptz:=clock_timestamp()+interval '4 seconds';
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'Read committed required' using errcode='25001'; end if;
 perform picshaw_dataforseo_private.authorize(p_user,p_session,p_exp,p_org);
 select * into j from picshaw_dataforseo_private.jobs where job_id=p_job and organization_id=p_org and user_id=p_user and session_id=p_session for update;
 if not found then raise exception 'Job unavailable' using errcode='42501'; end if;
 if j.state='queued' then
  update picshaw_dataforseo_private.jobs set state='running',lease=gen_random_uuid(),updated_at=clock_timestamp() where job_id=p_job returning * into j;
  value:=jsonb_build_object('lease',j.lease,'domain',j.domain,'platform',j.platform,'rowLimit',j.row_limit);
 else value:=null; end if;
 perform picshaw_dataforseo_private.authorize(p_user,p_session,p_exp,p_org);
 if clock_timestamp()>=deadline then raise exception 'Job operation timed out' using errcode='57014'; end if;
 return value;
end $$;

-- Restrict retained results to normalized evidence fields, never raw answers or request metadata.
create function picshaw_dataforseo_private.valid_job_evidence(r jsonb,j picshaw_dataforseo_private.jobs)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare i jsonb; c jsonb; t text;
begin
 if r is null or jsonb_typeof(r) is distinct from 'object' or octet_length(r::text)>2097152
 or not(r?&array['source','domain','platform','locationCode','languageCode','retrievedAt','providerTaskId','actualCostUsd','totalMatches','sampledRows','items','limitations'])
 or r-array['source','domain','platform','locationCode','languageCode','retrievedAt','providerTaskId','actualCostUsd','totalMatches','sampledRows','items','limitations']<>'{}'::jsonb
 or r->>'source' is distinct from 'dataforseo-llm-mentions' or r->>'domain' is distinct from j.domain or r->>'platform' is distinct from j.platform
 or r->'locationCode' is distinct from '2840'::jsonb or r->>'languageCode' is distinct from 'en'
 or jsonb_typeof(r->'retrievedAt') is distinct from 'string' or length(r->>'retrievedAt')>100
 or (r->>'retrievedAt') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$'
 or jsonb_typeof(r->'providerTaskId') is distinct from 'string' or length(r->>'providerTaskId') not between 1 and 100
 or jsonb_typeof(r->'actualCostUsd') is distinct from 'number' or (r->>'actualCostUsd')::numeric<0 or (r->>'actualCostUsd')::numeric>1000000
 or jsonb_typeof(r->'totalMatches') is distinct from 'number' or (r->>'totalMatches') !~ '^[0-9]{1,15}$'
 or jsonb_typeof(r->'sampledRows') is distinct from 'number' or (r->>'sampledRows') !~ '^[0-9]{1,3}$'
 or jsonb_typeof(r->'items') is distinct from 'array' or jsonb_array_length(r->'items')>j.row_limit
 or (r->>'sampledRows')::integer<>jsonb_array_length(r->'items') or (r->>'totalMatches')::bigint<(r->>'sampledRows')::integer
 or r->'limitations' is distinct from '["Database sample for United States / English; not a live test of every answer or every customer location.","No matching records does not establish zero AI visibility. Retrieved time is not the time the model produced its answer.","Source citations are evidence, not a ranking or guaranteed recommendation. No score or traffic forecast has been inferred."]'::jsonb then return false; end if;
 for i in select jsonb_array_elements(r->'items') loop
  if jsonb_typeof(i) is distinct from 'object' or not(i?&array['question','model','observedAt','citations']) or i-array['question','model','observedAt','citations']<>'{}'::jsonb
   or jsonb_typeof(i->'question') is distinct from 'string' or length(i->>'question')>1000
   or jsonb_typeof(i->'citations') is distinct from 'array' or jsonb_array_length(i->'citations')>100 then return false; end if;
  foreach t in array array['model','observedAt'] loop
   if i->t<>'null'::jsonb and (jsonb_typeof(i->t) is distinct from 'string' or length(i->>t)>100) then return false; end if;
  end loop;
  for c in select jsonb_array_elements(i->'citations') loop
   if jsonb_typeof(c) is distinct from 'object' or not(c?&array['url','title']) or c-array['url','title']<>'{}'::jsonb
    or jsonb_typeof(c->'url') is distinct from 'string' or length(c->>'url')>2048 or (c->>'url') !~ '^https://[a-z0-9.-]+(:[0-9]{1,5})?(/|$)' or (c->>'url') ~ '[[:cntrl:][:space:]]'
    or substring(c->>'url' from '^https://([^/:]+)') !~ '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$'
    or substring(c->>'url' from '^https://([^/:]+)') ~ '(^|\.)(localhost|local|internal|test|invalid|onion|home|lan)$'
    or (c->'title'<>'null'::jsonb and (jsonb_typeof(c->'title') is distinct from 'string' or length(c->>'title')>300)) then return false; end if;
  end loop;
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function picshaw_dataforseo_private.valid_job_evidence(jsonb,picshaw_dataforseo_private.jobs) from public,anon,authenticated,service_role,picshaw_dataforseo;
alter function picshaw_dataforseo_private.valid_job_evidence(jsonb,picshaw_dataforseo_private.jobs) owner to picshaw_dataforseo_owner;

-- Completion is storage-only, not an authorization to read evidence after logout.
create function picshaw_dataforseo_private.complete_job(p_user uuid,p_session uuid,p_org uuid,p_job text,p_lease uuid,p_evidence jsonb)
returns void language plpgsql volatile security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
declare j picshaw_dataforseo_private.jobs%rowtype; c picshaw_dataforseo_private.claims%rowtype; expected jsonb;
begin
 select * into j from picshaw_dataforseo_private.jobs where job_id=p_job and organization_id=p_org and user_id=p_user and session_id=p_session and lease=p_lease for update;
 if not found then raise exception 'Job unavailable' using errcode='42501'; end if;
 if j.state='completed' then
  if j.result is distinct from p_evidence then raise exception 'Completion conflict' using errcode='23505'; end if;
  return;
 end if;
 if not picshaw_dataforseo_private.valid_job_evidence(p_evidence,j) then raise exception 'Invalid evidence' using errcode='22023'; end if;
 select * into c from picshaw_dataforseo_private.claims where job_id=p_job and organization_id=p_org and user_id=p_user and session_id=p_session and outcome='confirmed';
 expected:=jsonb_build_object('target',jsonb_build_array(jsonb_build_object('domain',j.domain,'search_filter','include','search_scope',jsonb_build_array('sources'),'include_subdomains',true)),'platform',j.platform,'location_code',2840,'language_code','en','limit',j.row_limit);
 if c.job_id is null or c.fingerprint::jsonb<>expected or c.reported_micros<>ceil((p_evidence->>'actualCostUsd')::numeric*1000000)::bigint then raise exception 'Accounting unavailable' using errcode='55000'; end if;
 update picshaw_dataforseo_private.jobs set state='completed',result=p_evidence,updated_at=clock_timestamp() where job_id=p_job;
end $$;

create function picshaw_dataforseo_private.fail_job(p_user uuid,p_session uuid,p_org uuid,p_job text,p_lease uuid,p_reason text)
returns void language plpgsql volatile security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
declare j picshaw_dataforseo_private.jobs%rowtype;
begin
 if p_reason is distinct from 'unavailable' then raise exception 'Invalid failure' using errcode='22023'; end if;
 select * into j from picshaw_dataforseo_private.jobs where job_id=p_job and organization_id=p_org and user_id=p_user and session_id=p_session and lease=p_lease for update;
 if not found then raise exception 'Job unavailable' using errcode='42501'; end if;
 if j.state='completed' then raise exception 'Completion conflict' using errcode='23505'; end if;
 update picshaw_dataforseo_private.jobs set state=case when exists(select 1 from picshaw_dataforseo_private.claims where job_id=p_job and outcome in('reserved','uncertain')) then 'uncertain' else 'failed' end,updated_at=clock_timestamp() where job_id=p_job;
end $$;

create function picshaw_dataforseo_private.read_job(p_user uuid,p_session uuid,p_exp bigint,p_org uuid,p_job text)
returns jsonb language plpgsql volatile security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
declare j picshaw_dataforseo_private.jobs%rowtype; deadline timestamptz:=clock_timestamp()+interval '4 seconds';
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'Read committed required' using errcode='25001'; end if;
 perform picshaw_dataforseo_private.authorize(p_user,p_session,p_exp,p_org);
 select * into j from picshaw_dataforseo_private.jobs where job_id=p_job and organization_id=p_org and user_id=p_user;
 if not found then raise exception 'Job unavailable' using errcode='42501'; end if;
 perform picshaw_dataforseo_private.authorize(p_user,p_session,p_exp,p_org);
 if clock_timestamp()>=deadline then raise exception 'Job operation timed out' using errcode='57014'; end if;
 return picshaw_dataforseo_private.job_metadata(j)||jsonb_build_object('result',j.result);
end $$;

-- Read-only lookup for refresh/re-login recovery. Never enqueue or dispatch here.
create function picshaw_dataforseo_private.latest_job(p_user uuid,p_session uuid,p_exp bigint,p_org uuid,p_platform text)
returns jsonb language plpgsql volatile security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
declare j picshaw_dataforseo_private.jobs%rowtype; deadline timestamptz:=clock_timestamp()+interval '4 seconds';
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'Read committed required' using errcode='25001'; end if;
 perform picshaw_dataforseo_private.authorize(p_user,p_session,p_exp,p_org);
 if p_platform is null or p_platform not in('google','chat_gpt') then raise exception 'Invalid platform' using errcode='22023'; end if;
 select * into j from picshaw_dataforseo_private.jobs where organization_id=p_org and user_id=p_user and platform=p_platform order by created_at desc,job_id desc limit 1;
 perform picshaw_dataforseo_private.authorize(p_user,p_session,p_exp,p_org);
 if clock_timestamp()>=deadline then raise exception 'Job operation timed out' using errcode='57014'; end if;
 if j.job_id is null then return null; end if;
 return picshaw_dataforseo_private.job_metadata(j)||jsonb_build_object('result',j.result);
end $$;

do $$ declare signature text; begin
 foreach signature in array array['enqueue(uuid,uuid,bigint,uuid,text,text,text,integer)','start_job(uuid,uuid,bigint,uuid,text)','complete_job(uuid,uuid,uuid,text,uuid,jsonb)','fail_job(uuid,uuid,uuid,text,uuid,text)','read_job(uuid,uuid,bigint,uuid,text)','latest_job(uuid,uuid,bigint,uuid,text)'] loop
  execute 'revoke all on function picshaw_dataforseo_private.'||signature||' from public,anon,authenticated,service_role';
  execute 'alter function picshaw_dataforseo_private.'||signature||' owner to picshaw_dataforseo_owner';
  execute 'grant execute on function picshaw_dataforseo_private.'||signature||' to picshaw_dataforseo';
 end loop;
end $$;
revoke create on schema picshaw_dataforseo_private from picshaw_dataforseo_owner;
commit;

