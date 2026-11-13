begin;
create function picshaw_dataforseo_private.session_valid(p_user uuid,p_session uuid,p_exp bigint)
returns boolean language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' or p_user is null or p_session is null or p_exp is null or p_exp<=extract(epoch from clock_timestamp()) then return false; end if;
 return exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id where s.id=p_session and s.user_id=p_user and (s.not_after is null or s.not_after>clock_timestamp()+interval '10 seconds') and u.is_anonymous=false and u.deleted_at is null and (u.banned_until is null or u.banned_until<=clock_timestamp()) and (u.email_confirmed_at is not null or u.phone_confirmed_at is not null));
end $$;
alter function picshaw_dataforseo_private.session_valid(uuid,uuid,bigint) owner to postgres;
revoke all on function picshaw_dataforseo_private.session_valid(uuid,uuid,bigint) from public,anon,authenticated,service_role,picshaw_dataforseo;
grant execute on function picshaw_dataforseo_private.session_valid(uuid,uuid,bigint) to picshaw_dataforseo_owner;
create or replace function picshaw_dataforseo_private.authorize(p_user uuid,p_session uuid,p_exp bigint,p_org uuid)
returns void language plpgsql volatile security invoker set search_path='' as $$
begin
 if p_user is null or p_session is null or p_org is null or p_exp is null or p_exp<=extract(epoch from clock_timestamp()) then raise exception 'Session required' using errcode='28000'; end if;
 if not picshaw_dataforseo_private.session_valid(p_user,p_session,p_exp) then raise exception 'Session required' using errcode='28000'; end if;
 perform pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'session_id',p_session,'is_anonymous',false)::text,true);
 perform pg_catalog.set_config('request.jwt.claim.sub',p_user::text,true);
 perform 1 from public.organization_memberships where organization_id=p_org and user_id=p_user and revoked_at is null and role in('owner','admin') for share;
 if not found then raise exception 'Workspace access denied' using errcode='42501'; end if;
end $$;
revoke select(id,is_anonymous,email_confirmed_at,phone_confirmed_at,banned_until,deleted_at) on auth.users from picshaw_dataforseo_owner;
revoke select(id,user_id,not_after) on auth.sessions from picshaw_dataforseo_owner;
commit;
