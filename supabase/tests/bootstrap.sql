-- TEST ONLY: empty disposable database. Never run against a hosted project.
-- Mock Auth contract, not an integration test of Supabase JWT validation.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, is_anonymous boolean default false,
  email_confirmed_at timestamptz, phone_confirmed_at timestamptz, banned_until timestamptz, deleted_at timestamptz);
create table auth.sessions (id uuid primary key, user_id uuid references auth.users(id), not_after timestamptz);
create function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
-- Reproduce the hosted postgres/public automatic grants for meaningful tests.
alter default privileges for role postgres in schema public grant all privileges on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all privileges on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated, service_role;
