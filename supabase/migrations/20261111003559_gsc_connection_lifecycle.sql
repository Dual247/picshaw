-- LOCAL ONLY. Provision a separate login credential only after security review.
begin;
create role picshaw_gsc nologin noinherit;
create role picshaw_gsc_owner nologin noinherit;
-- Managed postgres is not necessarily superuser; ownership transfer needs SET ROLE.
grant picshaw_gsc_owner to postgres;
create schema picshaw_gsc_private;
revoke all on schema picshaw_gsc_private from public, anon, authenticated, service_role;
grant usage on schema picshaw_gsc_private to picshaw_gsc;
grant usage, create on schema picshaw_gsc_private to picshaw_gsc_owner;
grant usage on schema public, auth to picshaw_gsc_owner;
grant execute on function auth.uid() to picshaw_gsc_owner;
grant select(id,is_anonymous,email_confirmed_at,phone_confirmed_at,banned_until,deleted_at) on auth.users to picshaw_gsc_owner;
grant select(id,user_id,not_after) on auth.sessions to picshaw_gsc_owner;
grant select, update(user_id) on public.organization_memberships to picshaw_gsc_owner;
grant select, insert, update on public.google_connections to picshaw_gsc_owner;
create policy gsc_membership_self on public.organization_memberships for select to picshaw_gsc_owner
  using(user_id = (select auth.uid()));
-- Required for FOR SHARE visibility; owner is NOLOGIN and its only callable RPC
-- never updates membership. Application login has no table grant.
create policy gsc_membership_lock on public.organization_memberships for update to picshaw_gsc_owner
  using(user_id = (select auth.uid())) with check(user_id = (select auth.uid()));
create policy gsc_metadata on public.google_connections to picshaw_gsc_owner
  using(organization_id in (select organization_id from public.organization_memberships where user_id=(select auth.uid()) and revoked_at is null and role in ('owner','admin')))
  with check(organization_id in (select organization_id from public.organization_memberships where user_id=(select auth.uid()) and revoked_at is null and role in ('owner','admin')));

create table picshaw_gsc_private.connections (
  organization_id uuid primary key references public.organizations(id),
  connection_id uuid not null,
  encrypted_refresh text check(length(encrypted_refresh) between 32 and 24000),
  token_actor uuid not null,
  token_generation bigint not null,
  selected_property text check(length(selected_property) between 1 and 2048),
  generation bigint not null default 1,
  revoke_pending boolean not null default false,
  lease uuid,
  lease_until timestamptz,
  foreign key(organization_id,connection_id) references public.google_connections(organization_id,id)
);
create table picshaw_gsc_private.attempts (
  state_hash text primary key check(state_hash ~ '^[0-9a-f]{64}$'),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  session_id uuid not null,
  browser_hash text not null check(browser_hash ~ '^[0-9a-f]{64}$'),
  connection_id uuid not null,
  verifier text not null check(length(verifier) between 32 and 24000),
  phase text not null check(phase in ('pending','exchanging','completed','cancelled')),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp() + interval '10 minutes'
);
create index gsc_attempt_workspace on picshaw_gsc_private.attempts(organization_id,created_at);
alter table picshaw_gsc_private.connections owner to picshaw_gsc_owner;
alter table picshaw_gsc_private.attempts owner to picshaw_gsc_owner;
alter table picshaw_gsc_private.connections enable row level security;
alter table picshaw_gsc_private.connections force row level security;
alter table picshaw_gsc_private.attempts enable row level security;
alter table picshaw_gsc_private.attempts force row level security;
create policy private_connections on picshaw_gsc_private.connections to picshaw_gsc_owner
  using(organization_id in(select organization_id from public.organization_memberships where user_id=(select auth.uid()) and revoked_at is null and role in('owner','admin')))
  with check(organization_id in(select organization_id from public.organization_memberships where user_id=(select auth.uid()) and revoked_at is null and role in('owner','admin')));
create policy private_attempts on picshaw_gsc_private.attempts to picshaw_gsc_owner
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on all tables in schema picshaw_gsc_private from public,anon,authenticated,service_role,picshaw_gsc;

-- Only this bounded RPC is granted to the server role. No browser/API access,
-- arbitrary SQL, caller-chosen roles, auth-table writes or tenant-table deletes.
create function picshaw_gsc_private.operation(p_user uuid,p_session uuid,p_exp bigint,p_org uuid,p_op text,p jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
declare c picshaw_gsc_private.connections%rowtype; a picshaw_gsc_private.attempts%rowtype; s text; result jsonb; v_deadline timestamptz:=clock_timestamp()+interval '5 seconds';
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'Read committed required' using errcode='25001'; end if;
  -- Leave expiry headroom beyond the external driver query timeout.
  if p_user is null or p_session is null or p_org is null or p_exp is null or p_exp<=extract(epoch from clock_timestamp())+10
    or p_op is null or p_op not in('status','start','consume','complete','cancel','claim','refreshed','invalid','check','select','disconnect','revoked')
    or p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>50000 then raise exception 'Unauthorized'; end if;
  perform 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>clock_timestamp());
  if not found then raise exception 'Unauthorized'; end if;
  perform 1 from auth.users where id=p_user and is_anonymous=false and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) and (email_confirmed_at is not null or phone_confirmed_at is not null);
  if not found then raise exception 'Unauthorized'; end if;
  perform pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'session_id',p_session,'is_anonymous',false)::text,true);
  perform pg_catalog.set_config('request.jwt.claim.sub',p_user::text,true);
  perform 1 from public.organization_memberships where organization_id=p_org and user_id=p_user and revoked_at is null and role in('owner','admin') for share;
  if not found then raise exception 'Unauthorized'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('gsc:'||p_org::text,0));
  select * into c from picshaw_gsc_private.connections where organization_id=p_org for update;
  if c.connection_id is not null then
    select status into s from public.google_connections where organization_id=p_org and id=c.connection_id for update;
  end if;
  if p_op='status' then
  if clock_timestamp()>=v_deadline or p_exp<=extract(epoch from clock_timestamp())
    or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>clock_timestamp()))
    or not exists(select 1 from auth.users where id=p_user and is_anonymous=false and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) and (email_confirmed_at is not null or phone_confirmed_at is not null))
    then raise exception 'Session required' using errcode='28000'; end if;
    return jsonb_build_object('connectionId',c.connection_id,'status',coalesce(s,'not_connected'),'selectedProperty',c.selected_property,'revocationPending',coalesce(c.revoke_pending,false));
  elsif p_op='start' then
    if c.encrypted_refresh is not null or (s is not null and s<>'disconnected') then raise exception 'Disconnect existing connection first'; end if;
    if (select count(*) from picshaw_gsc_private.attempts where organization_id=p_org and created_at>clock_timestamp()-interval '1 minute')>=3 then raise exception 'Try later'; end if;
    delete from picshaw_gsc_private.attempts where organization_id=p_org and expires_at<clock_timestamp()-interval '1 day';
    update picshaw_gsc_private.attempts set phase='cancelled' where organization_id=p_org and phase in('pending','exchanging');
    insert into picshaw_gsc_private.attempts(state_hash,organization_id,user_id,session_id,browser_hash,connection_id,verifier,phase)
      values(p->>'state',p_org,p_user,p_session,p->>'browser',(p->>'connection')::uuid,p->>'verifier','pending');
  if clock_timestamp()>=v_deadline or p_exp<=extract(epoch from clock_timestamp())
    or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>clock_timestamp()))
    or not exists(select 1 from auth.users where id=p_user and is_anonymous=false and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) and (email_confirmed_at is not null or phone_confirmed_at is not null))
    then raise exception 'Session required' using errcode='28000'; end if;
    return '{}'::jsonb;
  elsif p_op in('consume','complete','cancel') then
    select * into a from picshaw_gsc_private.attempts where state_hash=p->>'state' and organization_id=p_org and user_id=p_user and session_id=p_session and browser_hash=p->>'browser' and expires_at>clock_timestamp() for update;
    if a.state_hash is null then raise exception 'Invalid authorization attempt'; end if;
    if p_op='consume' then
      if a.phase<>'pending' then raise exception 'Authorization already consumed'; end if;
      update picshaw_gsc_private.attempts set phase='exchanging' where state_hash=a.state_hash;
  if clock_timestamp()>=v_deadline or p_exp<=extract(epoch from clock_timestamp())
    or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>clock_timestamp()))
    or not exists(select 1 from auth.users where id=p_user and is_anonymous=false and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) and (email_confirmed_at is not null or phone_confirmed_at is not null))
    then raise exception 'Session required' using errcode='28000'; end if;
      return jsonb_build_object('connectionId',a.connection_id,'verifier',a.verifier,'generation',coalesce(c.generation+1,1));
    elsif p_op='cancel' then
      update picshaw_gsc_private.attempts set phase='cancelled' where state_hash=a.state_hash;
  if clock_timestamp()>=v_deadline or p_exp<=extract(epoch from clock_timestamp())
    or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>clock_timestamp()))
    or not exists(select 1 from auth.users where id=p_user and is_anonymous=false and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) and (email_confirmed_at is not null or phone_confirmed_at is not null))
    then raise exception 'Session required' using errcode='28000'; end if;
      return '{}'::jsonb;
    end if;
    if a.phase<>'exchanging' or p->>'token' is null or c.encrypted_refresh is not null or (s is not null and s<>'disconnected') then raise exception 'Authorization no longer current'; end if;
    insert into public.google_connections(organization_id,id,label,created_by) values(p_org,a.connection_id,'Google Search Console',p_user);
    insert into picshaw_gsc_private.connections(organization_id,connection_id,encrypted_refresh,token_actor,token_generation,generation) values(p_org,a.connection_id,p->>'token',p_user,coalesce(c.generation+1,1),coalesce(c.generation+1,1))
      on conflict(organization_id) do update set connection_id=excluded.connection_id,encrypted_refresh=excluded.encrypted_refresh,token_actor=excluded.token_actor,token_generation=excluded.token_generation,selected_property=null,generation=excluded.generation,revoke_pending=false,lease=null,lease_until=null;
    update picshaw_gsc_private.attempts set phase='completed',verifier='erased-after-consumption-000000000000' where state_hash=a.state_hash;
  if clock_timestamp()>=v_deadline or p_exp<=extract(epoch from clock_timestamp())
    or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>clock_timestamp()))
    or not exists(select 1 from auth.users where id=p_user and is_anonymous=false and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) and (email_confirmed_at is not null or phone_confirmed_at is not null))
    then raise exception 'Session required' using errcode='28000'; end if;
    return '{}'::jsonb;
  end if;
  if c.connection_id is null or c.connection_id::text is distinct from p->>'connection' then raise exception 'Connection unavailable'; end if;
  if p_op='disconnect' then
    update public.google_connections set status='disconnected' where organization_id=p_org and id=c.connection_id;
    update picshaw_gsc_private.attempts set phase='cancelled' where organization_id=p_org and phase in('pending','exchanging');
    if not c.revoke_pending then
      update picshaw_gsc_private.connections set generation=generation+1,revoke_pending=(encrypted_refresh is not null),selected_property=null,lease=null,lease_until=null where organization_id=p_org returning * into c;
    end if;
  if clock_timestamp()>=v_deadline or p_exp<=extract(epoch from clock_timestamp())
    or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>clock_timestamp()))
    or not exists(select 1 from auth.users where id=p_user and is_anonymous=false and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) and (email_confirmed_at is not null or phone_confirmed_at is not null))
    then raise exception 'Session required' using errcode='28000'; end if;
    return jsonb_build_object('token',c.encrypted_refresh,'generation',c.generation,'tokenActor',c.token_actor,'tokenGeneration',c.token_generation);
  elsif p_op='revoked' then
    if c.generation is distinct from (p->>'generation')::bigint or not c.revoke_pending or s is distinct from 'disconnected' then raise exception 'Stale operation'; end if;
    update picshaw_gsc_private.connections set encrypted_refresh=null,revoke_pending=false where organization_id=p_org;
  if clock_timestamp()>=v_deadline or p_exp<=extract(epoch from clock_timestamp())
    or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>clock_timestamp()))
    or not exists(select 1 from auth.users where id=p_user and is_anonymous=false and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) and (email_confirmed_at is not null or phone_confirmed_at is not null))
    then raise exception 'Session required' using errcode='28000'; end if;
    return '{}'::jsonb;
  end if;
  if s is distinct from 'active' or c.encrypted_refresh is null or c.revoke_pending then raise exception 'Reconnect required'; end if;
  if p_op='claim' then
    if p->>'lease' is null or c.lease_until>clock_timestamp() then raise exception 'Connection busy'; end if;
    update picshaw_gsc_private.connections set lease=(p->>'lease')::uuid,lease_until=clock_timestamp()+interval '30 seconds' where organization_id=p_org;
  if clock_timestamp()>=v_deadline or p_exp<=extract(epoch from clock_timestamp())
    or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>clock_timestamp()))
    or not exists(select 1 from auth.users where id=p_user and is_anonymous=false and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) and (email_confirmed_at is not null or phone_confirmed_at is not null))
    then raise exception 'Session required' using errcode='28000'; end if;
    return jsonb_build_object('token',c.encrypted_refresh,'generation',c.generation,'tokenActor',c.token_actor,'tokenGeneration',c.token_generation,'selectedProperty',c.selected_property);
  end if;
  if c.generation is distinct from (p->>'generation')::bigint then raise exception 'Stale operation'; end if;
  if p_op in('refreshed','invalid') then
    if c.lease is null or c.lease::text is distinct from p->>'lease' or c.lease_until is null or c.lease_until<=clock_timestamp() then raise exception 'Stale operation'; end if;
    if p_op='invalid' then
      update public.google_connections set status='reconnect_required' where organization_id=p_org and id=c.connection_id;
    end if;
    update picshaw_gsc_private.connections set encrypted_refresh=coalesce(p->>'token',encrypted_refresh),lease=null,lease_until=null where organization_id=p_org;
  elsif p_op='select' then
    if p->>'property' is null then raise exception 'Property required'; end if;
    update picshaw_gsc_private.connections set selected_property=p->>'property' where organization_id=p_org;
  elsif p_op<>'check' then raise exception 'Unknown operation';
  end if;
  if p_exp<=extract(epoch from clock_timestamp()) then raise exception 'Unauthorized'; end if;
  if clock_timestamp()>=v_deadline or p_exp<=extract(epoch from clock_timestamp())
    or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>clock_timestamp()))
    or not exists(select 1 from auth.users where id=p_user and is_anonymous=false and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) and (email_confirmed_at is not null or phone_confirmed_at is not null))
    then raise exception 'Session required' using errcode='28000'; end if;
  return jsonb_build_object('selectedProperty',c.selected_property);
end $$;
revoke all on function picshaw_gsc_private.operation(uuid,uuid,bigint,uuid,text,jsonb) from public,anon,authenticated,service_role;
alter function picshaw_gsc_private.operation(uuid,uuid,bigint,uuid,text,jsonb) owner to picshaw_gsc_owner;
grant execute on function picshaw_gsc_private.operation(uuid,uuid,bigint,uuid,text,jsonb) to picshaw_gsc;
revoke create on schema picshaw_gsc_private from picshaw_gsc_owner;
comment on schema picshaw_gsc_private is 'Never expose via Data API. Encrypted tokens, one-use attempts and refresh leases; only scoped server RPC.';
commit;
