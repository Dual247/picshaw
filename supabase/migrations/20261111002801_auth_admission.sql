-- Local migration, not applied to any hosted project.
-- No credential, login role, authenticator membership, or hosted change here.
begin;
create role picshaw_admission nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role picshaw_admission_owner nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
alter role picshaw_admission set statement_timeout = '1s';
alter role picshaw_admission set lock_timeout = '500ms';
grant picshaw_admission_owner to postgres;
create schema picshaw_admission_private;
revoke all on schema picshaw_admission_private from public, anon, authenticated, service_role;
create table picshaw_admission_private.buckets (
  bucket text primary key,
  used integer not null check (used >= 0),
  expires_at timestamptz not null
);
alter table picshaw_admission_private.buckets enable row level security;
create index admission_expiry on picshaw_admission_private.buckets(expires_at);
revoke all on picshaw_admission_private.buckets from public, anon, authenticated, service_role, picshaw_admission;

-- Fixed budgets, never caller-supplied limits/time. Security definer is required
-- to expose only this operation, not table access, to the dedicated server role.
create function picshaw_admission_private.consume(p_action text, p_principal text)
returns boolean language plpgsql security definer set search_path = '' set lock_timeout = '500ms' as $$
declare
  t timestamptz;
  k text;
  n integer;
  cap integer;
  keys text[];
  caps integer[] := array[300, 3000, 20, 100, 8];
  seconds integer[] := array[60, 3600, 60, 3600, 60];
  i integer;
begin
  if p_action is null or p_action not in ('google','apple','sign-in','sign-up','recover','reset-password','callback','workspace-bootstrap','workspace-read')
    or p_principal is null or p_principal !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid admission input';
  end if;
  -- One short critical section serializes all budgets across every replica.
  -- Global limits intentionally cap throughput and retained principal rows.
  perform pg_catalog.pg_advisory_xact_lock(724190118233::bigint);
  t := pg_catalog.clock_timestamp();
  delete from picshaw_admission_private.buckets where expires_at <= t;
  keys := array['global:minute','global:hour','principal:minute:' || p_principal,
    'principal:hour:' || p_principal, 'action:' || p_action || ':' || p_principal];
  -- Check all budgets before updating any: denied calls cannot allocate rows.
  for i in 1..5 loop
    select used into n from picshaw_admission_private.buckets where bucket = keys[i];
    cap := caps[i];
    if coalesce(n, 0) >= cap then return false; end if;
  end loop;
  for i in 1..5 loop
    k := keys[i];
    insert into picshaw_admission_private.buckets(bucket, used, expires_at)
      values (k, 1, t + pg_catalog.make_interval(secs => seconds[i]))
      on conflict (bucket) do update set used = picshaw_admission_private.buckets.used + 1;
  end loop;
  return true;
end;
$$;
revoke all on function picshaw_admission_private.consume(text,text) from public, anon, authenticated, service_role;
alter schema picshaw_admission_private owner to picshaw_admission_owner;
alter table picshaw_admission_private.buckets owner to picshaw_admission_owner;
alter function picshaw_admission_private.consume(text,text) owner to picshaw_admission_owner;
grant usage on schema picshaw_admission_private to picshaw_admission;
grant execute on function picshaw_admission_private.consume(text,text) to picshaw_admission;
commit;
