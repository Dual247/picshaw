-- LOCAL ONLY until separately reviewed/provisioned. No login password is created.
begin;
create role picshaw_workspace nologin noinherit;
create role picshaw_workspace_owner nologin noinherit;
create schema picshaw_workspace_private;
revoke all on schema picshaw_workspace_private from public, anon, authenticated, service_role;
grant usage on schema picshaw_workspace_private to picshaw_workspace;
grant usage, create on schema picshaw_workspace_private to picshaw_workspace_owner;
grant usage on schema auth, public to picshaw_workspace_owner;
grant select (id, is_anonymous, email_confirmed_at, phone_confirmed_at, banned_until, deleted_at) on auth.users to picshaw_workspace_owner;
grant select (id, user_id, not_after), update (id) on auth.sessions to picshaw_workspace_owner;
-- UPDATE(id) exists solely because PostgreSQL requires it for a session row lock.
-- This NOLOGIN role is never granted to the application login or browser roles.
grant execute on function auth.uid() to picshaw_workspace_owner;

create table picshaw_workspace_private.bootstraps (
  user_id uuid primary key references auth.users(id),
  organization_id uuid not null unique references public.organizations(id),
  name text not null,
  site text not null,
  created_at timestamptz not null default now()
);
alter table picshaw_workspace_private.bootstraps owner to picshaw_workspace_owner;
alter table picshaw_workspace_private.bootstraps enable row level security;
alter table picshaw_workspace_private.bootstraps force row level security;
create policy bootstrap_self on picshaw_workspace_private.bootstraps to picshaw_workspace_owner
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on picshaw_workspace_private.bootstraps from public, anon, authenticated, service_role, picshaw_workspace;
grant select, insert on public.organizations, public.organization_memberships to picshaw_workspace_owner;
create policy workspace_create on public.organizations for insert to picshaw_workspace_owner with check (true);
create policy workspace_read on public.organizations for select to picshaw_workspace_owner using (
  exists (select 1 from public.organization_memberships m where m.organization_id = id and m.user_id = (select auth.uid()) and m.revoked_at is null)
);
create policy workspace_membership_create on public.organization_memberships for insert to picshaw_workspace_owner
  with check (user_id = (select auth.uid()) and role = 'owner' and revoked_at is null);
create policy workspace_membership_read on public.organization_memberships for select to picshaw_workspace_owner
  using (user_id = (select auth.uid()));

create function picshaw_workspace_private.workspace(p_user uuid, p_session uuid, p_exp bigint, p_create boolean, p_name text, p_site text)
returns jsonb language plpgsql security definer set search_path = '' set statement_timeout = '3s' as $$
declare v_record picshaw_workspace_private.bootstraps%rowtype; v_org uuid;
begin
  if p_user is null or p_session is null or p_exp is null or p_create is null or p_exp <= extract(epoch from clock_timestamp()) then
    raise exception 'Session required' using errcode = '28000';
  end if;
  -- Only the server's cryptographically verified token supplies these identities.
  -- Lock conflicts with DELETE on logout: an earlier revocation denies this call;
  -- an operation already holding the lock completes before that revocation.
  perform 1 from auth.sessions s where s.id = p_session and s.user_id = p_user
    and (s.not_after is null or s.not_after > clock_timestamp()) for share;
  if not found then raise exception 'Session required' using errcode = '28000'; end if;
  if p_exp <= extract(epoch from clock_timestamp()) then raise exception 'Session required' using errcode = '28000'; end if;
  perform 1 from auth.users u where u.id = p_user and u.is_anonymous = false and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= clock_timestamp())
    and (u.email_confirmed_at is not null or u.phone_confirmed_at is not null);
  if not found then raise exception 'Session required' using errcode = '28000'; end if;
  perform pg_catalog.set_config('request.jwt.claims', jsonb_build_object('sub',p_user,'session_id',p_session,'is_anonymous',false)::text, true);
  -- Hosted auth.uid() may prefer the legacy per-claim GUC. Bind both forms;
  -- do not inherit stale transaction/session claims from a pooled connection.
  perform pg_catalog.set_config('request.jwt.claim.sub', p_user::text, true);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('picshaw-workspace:' || p_user::text, 0));
  if p_exp <= extract(epoch from clock_timestamp()) or exists (
    select 1 from auth.sessions s where s.id = p_session and s.not_after <= clock_timestamp()
  ) then raise exception 'Session required' using errcode = '28000'; end if;
  select * into v_record from picshaw_workspace_private.bootstraps where user_id = p_user;
  if found then
    if not exists (select 1 from public.organization_memberships m where m.organization_id = v_record.organization_id
      and m.user_id = p_user and m.revoked_at is null and m.role = 'owner') then
      raise exception 'Workspace access denied' using errcode = '42501';
    end if;
    if p_create and (p_name is distinct from v_record.name or p_site is distinct from v_record.site) then
      raise exception 'Workspace already created' using errcode = '23505';
    end if;
    return jsonb_build_object('id',v_record.organization_id,'name',v_record.name,'site',v_record.site);
  end if;
  if not p_create then return null; end if;
  if p_name is null or length(p_name) not between 1 and 160 or p_name <> btrim(p_name) or p_name ~ '[[:cntrl:]]'
    or p_site is null or length(p_site) > 253 or p_site !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$' then
    raise exception 'Invalid workspace' using errcode = '22023';
  end if;
  -- Never accept an organization ID, infer membership, or reactivate old access.
  v_org := gen_random_uuid();
  insert into public.organizations(id,name) values (v_org,p_name);
  insert into public.organization_memberships(organization_id,user_id,role) values (v_org,p_user,'owner');
  insert into picshaw_workspace_private.bootstraps(user_id,organization_id,name,site) values (p_user,v_org,p_name,p_site);
  return jsonb_build_object('id',v_org,'name',p_name,'site',p_site);
end $$;
revoke all on function picshaw_workspace_private.workspace(uuid,uuid,bigint,boolean,text,text) from public,anon,authenticated,service_role;
alter function picshaw_workspace_private.workspace(uuid,uuid,bigint,boolean,text,text) owner to picshaw_workspace_owner;
grant execute on function picshaw_workspace_private.workspace(uuid,uuid,bigint,boolean,text,text) to picshaw_workspace;
revoke create on schema picshaw_workspace_private from picshaw_workspace_owner;
commit;
