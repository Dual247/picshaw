-- Approved empty pilot or disposable test database only. Always rolls back.
-- Creates no durable probe objects, users, credentials or grants.
begin;
do $$
begin
  if current_user <> 'postgres' then raise exception 'Run probe as the verified postgres migration creator.'; end if;
end;
$$;
create schema test_support;
create table test_support.results (result text not null);
create function test_support.assert(ok boolean, label text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %',label; end if;
  insert into test_support.results values ('PASS '||label);
end;
$$;
create table public.picshaw_default_acl_probe (id integer);
create sequence public.picshaw_default_acl_probe_seq;
create function public.picshaw_default_acl_probe_function() returns integer
language sql security invoker set search_path = '' as $$select 1$$;
-- Observe, but never rely on, implicit function exposure. It is removed below
-- inside this same transaction, which will never commit.
select test_support.assert(
  has_function_privilege('anon','public.picshaw_default_acl_probe_function()','EXECUTE')
  and has_function_privilege('authenticated','public.picshaw_default_acl_probe_function()','EXECUTE'),
  'residual global PUBLIC EXECUTE reproduced before explicit function revoke');
revoke execute on function public.picshaw_default_acl_probe_function() from public, anon, authenticated;
grant execute on function public.picshaw_default_acl_probe_function() to service_role;

do $$
declare role_name text;
begin
 foreach role_name in array array['anon','authenticated'] loop
   perform test_support.assert(
     not has_table_privilege(role_name,'public.picshaw_default_acl_probe','SELECT')
     and not has_table_privilege(role_name,'public.picshaw_default_acl_probe','INSERT')
     and not has_table_privilege(role_name,'public.picshaw_default_acl_probe','UPDATE')
     and not has_table_privilege(role_name,'public.picshaw_default_acl_probe','DELETE')
     and not has_table_privilege(role_name,'public.picshaw_default_acl_probe','TRUNCATE')
     and not has_table_privilege(role_name,'public.picshaw_default_acl_probe','REFERENCES')
     and not has_table_privilege(role_name,'public.picshaw_default_acl_probe','TRIGGER'),
     role_name||' receives no future public table privileges');
   perform test_support.assert(
     not has_sequence_privilege(role_name,'public.picshaw_default_acl_probe_seq','USAGE')
     and not has_sequence_privilege(role_name,'public.picshaw_default_acl_probe_seq','SELECT')
     and not has_sequence_privilege(role_name,'public.picshaw_default_acl_probe_seq','UPDATE'),
     role_name||' receives no future public sequence privileges');
   perform test_support.assert(
     not has_function_privilege(role_name,'public.picshaw_default_acl_probe_function()','EXECUTE'),
     role_name||' cannot call explicitly revoked function');
 end loop;
end;
$$;
select test_support.assert(has_table_privilege('service_role','public.picshaw_default_acl_probe','INSERT'),'service table default preserved');
select test_support.assert(has_sequence_privilege('service_role','public.picshaw_default_acl_probe_seq','USAGE'),'service sequence default preserved');
select test_support.assert(has_function_privilege('service_role','public.picshaw_default_acl_probe_function()','EXECUTE'),'explicit service function access works');
select test_support.assert(public.picshaw_default_acl_probe_function()=1,'owner can still create and invoke public functions');
select test_support.assert(has_table_privilege('authenticated','public.organizations','SELECT'),'existing authenticated table grant preserved');
select test_support.assert(has_function_privilege('authenticated','auth.uid()','EXECUTE'),'existing Auth function grant preserved');
select test_support.assert(not exists (
 select 1 from pg_default_acl where defaclrole='postgres'::regrole and defaclnamespace=0
),'global postgres defaults untouched');

do $$ begin if (select count(*) from test_support.results) <> 14 then raise exception 'Expected 14 default-privilege assertions.'; end if; end; $$;
select result from test_support.results order by result;
rollback;
select '14 default-privilege assertions completed; transaction rolled back.' as result;

