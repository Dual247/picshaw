-- LOCAL ONLY: no credentials, live grants, hosted migration or paid calls.
-- Budget configuration is admin-only; defaults deny every reservation.
begin;
create role picshaw_dataforseo nologin noinherit;
create role picshaw_dataforseo_owner nologin noinherit;
grant picshaw_dataforseo_owner to postgres;
create schema picshaw_dataforseo_private;
revoke all on schema picshaw_dataforseo_private from public,anon,authenticated,service_role;
grant usage on schema picshaw_dataforseo_private to picshaw_dataforseo;
grant usage,create on schema picshaw_dataforseo_private to picshaw_dataforseo_owner;
grant usage on schema public,auth to picshaw_dataforseo_owner;
grant select(id,is_anonymous,email_confirmed_at,phone_confirmed_at,banned_until,deleted_at) on auth.users to picshaw_dataforseo_owner;
grant select(id,user_id,not_after) on auth.sessions to picshaw_dataforseo_owner;
grant select,update(user_id) on public.organization_memberships to picshaw_dataforseo_owner;
grant execute on function auth.uid() to picshaw_dataforseo_owner;
create policy dataforseo_membership on public.organization_memberships to picshaw_dataforseo_owner
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table picshaw_dataforseo_private.account_budget (
 singleton boolean primary key default true check(singleton), enabled boolean not null default false,
 cap_micros bigint not null default 0 check(cap_micros between 0 and 1000000000000),
 consumed_micros bigint not null default 0 check(consumed_micros>=0)
);
insert into picshaw_dataforseo_private.account_budget(singleton) values(true);
create table picshaw_dataforseo_private.workspace_budgets (
 organization_id uuid primary key references public.organizations(id), enabled boolean not null default false,
 cap_micros bigint not null default 0 check(cap_micros between 0 and 1000000000000),
 consumed_micros bigint not null default 0 check(consumed_micros>=0)
);
create table picshaw_dataforseo_private.claims (
 job_id text primary key check(job_id ~ '^[a-zA-Z0-9_-]{1,100}$'),
 organization_id uuid not null references public.organizations(id), user_id uuid not null references auth.users(id), session_id uuid not null,
 fingerprint text not null check(octet_length(fingerprint) between 1 and 4096),
 reserved_micros bigint not null check(reserved_micros between 101000 and 200000),
 consumed_micros bigint not null check(consumed_micros>=reserved_micros),
 outcome text not null default 'reserved' check(outcome in('reserved','uncertain','confirmed')),
 reported_micros bigint check(reported_micros between 0 and 1000000000000),
 created_at timestamptz not null default clock_timestamp(), settled_at timestamptz
);
create index dataforseo_claims_unresolved on picshaw_dataforseo_private.claims(outcome) where outcome in('reserved','uncertain');
create index dataforseo_claims_recent on picshaw_dataforseo_private.claims(organization_id,created_at desc);
do $$ declare t text; begin
 foreach t in array array['account_budget','workspace_budgets','claims'] loop
  execute format('alter table picshaw_dataforseo_private.%I owner to picshaw_dataforseo_owner',t);
  execute format('alter table picshaw_dataforseo_private.%I enable row level security',t);
  execute format('alter table picshaw_dataforseo_private.%I force row level security',t);
  execute format('create policy private_owner on picshaw_dataforseo_private.%I to picshaw_dataforseo_owner using(true) with check(true)',t);
  execute format('revoke all on picshaw_dataforseo_private.%I from public,anon,authenticated,service_role,picshaw_dataforseo',t);
 end loop;
end $$;

create function picshaw_dataforseo_private.authorize(p_user uuid,p_session uuid,p_exp bigint,p_org uuid)
returns void language plpgsql volatile security invoker set search_path='' as $$
begin
 if p_user is null or p_session is null or p_org is null or p_exp is null or p_exp<=extract(epoch from clock_timestamp()) then raise exception 'Session required' using errcode='28000'; end if;
 if not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>clock_timestamp()))
 or not exists(select 1 from auth.users where id=p_user and is_anonymous=false and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) and (email_confirmed_at is not null or phone_confirmed_at is not null)) then raise exception 'Session required' using errcode='28000'; end if;
 perform pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'session_id',p_session,'is_anonymous',false)::text,true);
 perform pg_catalog.set_config('request.jwt.claim.sub',p_user::text,true);
 perform 1 from public.organization_memberships where organization_id=p_org and user_id=p_user and revoked_at is null and role in('owner','admin') for share;
 if not found then raise exception 'Workspace access denied' using errcode='42501'; end if;
end $$;
revoke all on function picshaw_dataforseo_private.authorize(uuid,uuid,bigint,uuid) from public,anon,authenticated,service_role,picshaw_dataforseo;
alter function picshaw_dataforseo_private.authorize(uuid,uuid,bigint,uuid) owner to picshaw_dataforseo_owner;

create function picshaw_dataforseo_private.reserve(p_user uuid,p_session uuid,p_exp bigint,p_org uuid,p_job text,p_estimate_micros bigint,p_fingerprint text)
returns boolean language plpgsql volatile security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
declare a picshaw_dataforseo_private.account_budget%rowtype; w picshaw_dataforseo_private.workspace_budgets%rowtype;
 f jsonb; v_limit integer; v_deadline timestamptz:=clock_timestamp()+interval '4 seconds'; v_ok boolean:=false;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'Read committed required' using errcode='25001'; end if;
 perform picshaw_dataforseo_private.authorize(p_user,p_session,p_exp,p_org);
 if p_job is null or p_job !~ '^[a-zA-Z0-9_-]{1,100}$' or p_estimate_micros is null or p_fingerprint is null or octet_length(p_fingerprint) not between 1 and 4096 then raise exception 'Invalid reservation' using errcode='22023'; end if;
 -- Fingerprint is the exact canonical provider task JSON, not a caller-selected hash.
 f:=p_fingerprint::jsonb;
 if jsonb_typeof(f) is distinct from 'object' or jsonb_typeof(f->'limit') is distinct from 'number' or (f->>'limit') !~ '^[0-9]{1,3}$' then raise exception 'Invalid reservation' using errcode='22023'; end if;
 v_limit:=(f->>'limit')::integer;
 if v_limit not between 1 and 100 or p_estimate_micros<>(100+v_limit)*1000 then raise exception 'Invalid estimate' using errcode='22023'; end if;
 -- Global row is the shared mutex for all instances/workspaces and both operations.
 select * into a from picshaw_dataforseo_private.account_budget where singleton for update;
 select * into w from picshaw_dataforseo_private.workspace_budgets where organization_id=p_org for update;
 if a.enabled and w.enabled and a.consumed_micros+p_estimate_micros<=a.cap_micros and w.consumed_micros+p_estimate_micros<=w.cap_micros
 and not exists(select 1 from picshaw_dataforseo_private.claims where outcome in('reserved','uncertain'))
 and not exists(select 1 from picshaw_dataforseo_private.claims where job_id=p_job)
 and not exists(select 1 from picshaw_dataforseo_private.claims where organization_id=p_org and fingerprint=f::text and created_at>clock_timestamp()-interval '24 hours') then
  insert into picshaw_dataforseo_private.claims(job_id,organization_id,user_id,session_id,fingerprint,reserved_micros,consumed_micros)
   values(p_job,p_org,p_user,p_session,f::text,p_estimate_micros,p_estimate_micros);
  update picshaw_dataforseo_private.account_budget set consumed_micros=consumed_micros+p_estimate_micros where singleton;
  update picshaw_dataforseo_private.workspace_budgets set consumed_micros=consumed_micros+p_estimate_micros where organization_id=p_org;
  v_ok:=true;
 end if;
 perform picshaw_dataforseo_private.authorize(p_user,p_session,p_exp,p_org);
 if clock_timestamp()>=v_deadline then raise exception 'Reservation timed out' using errcode='57014'; end if;
 return v_ok;
end $$;
revoke all on function picshaw_dataforseo_private.reserve(uuid,uuid,bigint,uuid,text,bigint,text) from public,anon,authenticated,service_role;
alter function picshaw_dataforseo_private.reserve(uuid,uuid,bigint,uuid,text,bigint,text) owner to picshaw_dataforseo_owner;
grant execute on function picshaw_dataforseo_private.reserve(uuid,uuid,bigint,uuid,text,bigint,text) to picshaw_dataforseo;

-- p_exp is intentionally ignored during settlement; it is retained for call compatibility.
-- This dedicated-role accounting operation returns no tenant data or provider evidence.
create function picshaw_dataforseo_private.settle(p_user uuid,p_session uuid,p_exp bigint,p_org uuid,p_job text,p_charged_micros bigint,p_outcome text)
returns void language plpgsql volatile security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
declare c picshaw_dataforseo_private.claims%rowtype; v_delta bigint; v_deadline timestamptz:=clock_timestamp()+interval '4 seconds';
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'Read committed required' using errcode='25001'; end if;
 -- Accounting-only: original immutable claim IDs are bound below. No live auth recheck; costs survive logout/revocation.
 if p_job is null or p_job !~ '^[a-zA-Z0-9_-]{1,100}$' or p_charged_micros is null or p_charged_micros not between 0 and 1000000000000 or p_outcome is null or p_outcome not in('confirmed','uncertain') then raise exception 'Invalid settlement' using errcode='22023'; end if;
 perform 1 from picshaw_dataforseo_private.account_budget where singleton for update;
 perform 1 from picshaw_dataforseo_private.workspace_budgets where organization_id=p_org for update;
 select * into c from picshaw_dataforseo_private.claims where job_id=p_job and organization_id=p_org and user_id=p_user and session_id=p_session for update;
 if not found then raise exception 'Claim unavailable' using errcode='42501'; end if;
 if p_outcome='uncertain' and p_charged_micros<>c.reserved_micros then raise exception 'Invalid uncertain estimate' using errcode='22023'; end if;
 if c.outcome='confirmed' and (p_outcome<>'confirmed' or p_charged_micros is distinct from c.reported_micros) then raise exception 'Settlement conflict' using errcode='23505'; end if;
 -- Never refund an unknown or cheaper result; actual overage consumes more and blocks later work.
 v_delta:=greatest(c.consumed_micros,p_charged_micros)-c.consumed_micros;
 update picshaw_dataforseo_private.account_budget set consumed_micros=consumed_micros+v_delta where singleton;
 update picshaw_dataforseo_private.workspace_budgets set consumed_micros=consumed_micros+v_delta where organization_id=p_org;
 update picshaw_dataforseo_private.claims set consumed_micros=consumed_micros+v_delta,outcome=p_outcome,reported_micros=p_charged_micros,settled_at=clock_timestamp() where job_id=p_job;
 -- Do not re-check live authority here: this operation only records already-incurred cost.
 if clock_timestamp()>=v_deadline then raise exception 'Settlement timed out' using errcode='57014'; end if;
end $$;
revoke all on function picshaw_dataforseo_private.settle(uuid,uuid,bigint,uuid,text,bigint,text) from public,anon,authenticated,service_role;
alter function picshaw_dataforseo_private.settle(uuid,uuid,bigint,uuid,text,bigint,text) owner to picshaw_dataforseo_owner;
grant execute on function picshaw_dataforseo_private.settle(uuid,uuid,bigint,uuid,text,bigint,text) to picshaw_dataforseo;
revoke create on schema picshaw_dataforseo_private from picshaw_dataforseo_owner;
commit;



