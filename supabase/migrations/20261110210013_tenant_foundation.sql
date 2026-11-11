-- Local reviewable foundation. Do not apply to an existing/shared project.
-- No tokens, OAuth secrets, raw provider responses, public reports or write RPCs.
begin;

create schema picshaw_private;
revoke all on schema picshaw_private from public, anon, authenticated;
grant usage on schema picshaw_private to service_role;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 160),
  created_at timestamptz not null default now()
);

create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (organization_id, user_id),
  check (revoked_at is null or revoked_at >= created_at)
);
create index memberships_user_active_idx
  on public.organization_memberships(user_id, organization_id) where revoked_at is null;

create table public.google_connections (
  organization_id uuid not null references public.organizations(id),
  id uuid not null default gen_random_uuid(),
  label text not null check (length(btrim(label)) between 1 and 160),
  provider text not null default 'google' check (provider = 'google'),
  scopes text[] not null default array['https://www.googleapis.com/auth/webmasters.readonly']
    check (scopes = array['https://www.googleapis.com/auth/webmasters.readonly']),
  status text not null default 'active' check (status in ('active', 'reconnect_required', 'disconnected')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, id),
  foreign key (organization_id, created_by) references public.organization_memberships(organization_id, user_id)
);
create index connections_creator_idx on public.google_connections(organization_id, created_by);

-- A run is a committed import cohort, not a queue/job record. Insert all source
-- artifacts in one transaction after collection/validation; roll back on failure.
create table public.source_runs (
  organization_id uuid not null references public.organizations(id),
  id uuid not null default gen_random_uuid(),
  connection_id uuid not null,
  property_id text not null check (length(property_id) between 1 and 2048),
  current_start date not null,
  current_end date not null,
  prior_start date not null,
  prior_end date not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, id),
  unique (organization_id, id, property_id),
  foreign key (organization_id, connection_id) references public.google_connections(organization_id, id),
  foreign key (organization_id, created_by) references public.organization_memberships(organization_id, user_id),
  check (current_end - current_start between 0 and 89),
  check (prior_end - prior_start = current_end - current_start),
  check (prior_end + 1 = current_start)
);
create index runs_connection_idx on public.source_runs(organization_id, connection_id);
create index runs_creator_idx on public.source_runs(organization_id, created_by);

-- Strict observation shape, finite JSON numbers, unique grain keys, derived CTR.
-- Provider-independent TypeScript validation remains necessary at the boundary.
create function picshaw_private.valid_observations(value jsonb, grain text[])
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare item jsonb; clicks numeric; impressions numeric; ctr numeric;
begin
  if jsonb_typeof(value) is distinct from 'array' then return false; end if;
  if jsonb_array_length(value) > 10000 then return false; end if;
  for item in select jsonb_array_elements(value) loop
    if jsonb_typeof(item) is distinct from 'object'
      or not (item ?& array['keys','clicks','impressions','ctr','position'])
      or (select count(*) from jsonb_object_keys(item)) <> 5 then return false; end if;
    if jsonb_typeof(item->'keys') is distinct from 'array' then return false; end if;
    if jsonb_array_length(item->'keys') <> cardinality(grain)
      or exists (select 1 from jsonb_array_elements(item->'keys') k where jsonb_typeof(k) <> 'string')
      or jsonb_typeof(item->'clicks') is distinct from 'number'
      or jsonb_typeof(item->'impressions') is distinct from 'number'
      or jsonb_typeof(item->'ctr') is distinct from 'number' then return false; end if;
    clicks := (item->>'clicks')::numeric;
    impressions := (item->>'impressions')::numeric;
    ctr := (item->>'ctr')::numeric;
    if clicks < 0 or impressions < clicks or clicks <> trunc(clicks) or impressions <> trunc(impressions)
      or clicks > 9007199254740991 or impressions > 9007199254740991
      or abs(ctr - case when impressions = 0 then 0 else clicks / impressions end) > 0.000000000001
      or ctr not between 0 and 1 then return false; end if;
    if impressions = 0 then
      if item->'position' <> 'null'::jsonb then return false; end if;
    elsif item->'position' <> 'null'::jsonb then
      if jsonb_typeof(item->'position') is distinct from 'number' then return false; end if;
      if (item->>'position')::numeric < 0 then return false; end if;
    end if;
  end loop;
  return (select count(*) = count(distinct r->'keys') from jsonb_array_elements(value) r);
end;
$$;

create table public.source_snapshots (
  organization_id uuid not null,
  id uuid not null default gen_random_uuid(),
  run_id uuid not null,
  property_id text not null,
  source text not null default 'google-search-console' check (source = 'google-search-console'),
  retrieved_at timestamptz not null,
  timezone text not null default 'America/Los_Angeles' check (timezone = 'America/Los_Angeles'),
  window_start date not null,
  window_end date not null,
  search_type text not null default 'web' check (search_type = 'web'),
  filters jsonb not null default '[]'::jsonb check (filters = '[]'::jsonb),
  dimensions text[] not null check (
    dimensions = array[]::text[] or dimensions = array['date'] or dimensions = array['page'] or dimensions = array['query']
  ),
  data_state text not null default 'final' check (data_state = 'final'),
  coverage text not null check (coverage in ('available-rows', 'bounded')),
  warnings text[] not null default '{}',
  rows jsonb not null check (picshaw_private.valid_observations(rows, dimensions)),
  primary key (organization_id, id),
  unique (organization_id, run_id, property_id, id),
  unique (organization_id, run_id, window_start, window_end, dimensions),
  foreign key (organization_id, run_id, property_id) references public.source_runs(organization_id, id, property_id),
  check (window_end - window_start between 0 and 89)
);

create table public.recommended_actions (
  organization_id uuid not null,
  id text not null check (length(id) between 1 and 8192),
  run_id uuid not null,
  property_id text not null,
  snapshot_id uuid not null,
  prior_snapshot_id uuid not null,
  rule text not null check (rule in ('click-decline','ranking-opportunity','ctr-decline')),
  rule_version text not null default '1' check (rule_version = '1'),
  title text not null check (length(btrim(title)) between 1 and 300),
  reason text not null check (length(btrim(reason)) between 1 and 4000),
  page text not null check (length(page) between 1 and 4096),
  current_row jsonb not null,
  prior_row jsonb,
  created_at timestamptz not null default now(),
  primary key (organization_id, id),
  foreign key (organization_id, run_id, property_id, snapshot_id)
    references public.source_snapshots(organization_id, run_id, property_id, id),
  foreign key (organization_id, run_id, property_id, prior_snapshot_id)
    references public.source_snapshots(organization_id, run_id, property_id, id),
  check (snapshot_id <> prior_snapshot_id),
  check (id = snapshot_id::text || ':' || rule || ':' || page)
);
create index actions_current_idx on public.recommended_actions(organization_id, run_id, property_id, snapshot_id);
create index actions_prior_idx on public.recommended_actions(organization_id, run_id, property_id, prior_snapshot_id);

-- Append-only human work events. Recommendations never become proof of outcomes.
create table public.work_events (
  organization_id uuid not null,
  id uuid not null default gen_random_uuid(),
  action_id text not null,
  actor_id uuid not null,
  owner_id uuid not null,
  status text not null check (status in ('open','in_progress','completed','dismissed')),
  note text not null check (length(btrim(note)) between 1 and 4000),
  deliverable text,
  evidence_url text check (evidence_url is null or evidence_url ~ '^https://[^[:space:]]+$'),
  recheck_on date not null,
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  primary key (organization_id, id),
  foreign key (organization_id, action_id) references public.recommended_actions(organization_id, id),
  foreign key (organization_id, actor_id) references public.organization_memberships(organization_id, user_id),
  foreign key (organization_id, owner_id) references public.organization_memberships(organization_id, user_id),
  check (status <> 'completed' or (length(btrim(deliverable)) > 0 and deliverable is not null and evidence_url is not null)),
  check (recheck_on >= (occurred_at at time zone 'UTC')::date)
);
create index work_action_idx on public.work_events(organization_id, action_id, recorded_at);
create index work_actor_idx on public.work_events(organization_id, actor_id);
create index work_owner_idx on public.work_events(organization_id, owner_id);

-- Private saved selection. Render from retained snapshots/actions, not arbitrary HTML.
create table public.reports (
  organization_id uuid not null,
  id uuid not null default gen_random_uuid(),
  run_id uuid not null,
  property_id text not null,
  snapshot_id uuid not null,
  prior_snapshot_id uuid not null,
  version integer not null default 1 check (version = 1),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, id),
  foreign key (organization_id, run_id, property_id, snapshot_id)
    references public.source_snapshots(organization_id, run_id, property_id, id),
  foreign key (organization_id, run_id, property_id, prior_snapshot_id)
    references public.source_snapshots(organization_id, run_id, property_id, id),
  foreign key (organization_id, created_by) references public.organization_memberships(organization_id, user_id),
  check (snapshot_id <> prior_snapshot_id)
);
create index reports_current_idx on public.reports(organization_id, run_id, property_id, snapshot_id);
create index reports_prior_idx on public.reports(organization_id, run_id, property_id, prior_snapshot_id);
create index reports_creator_idx on public.reports(organization_id, created_by);

create function picshaw_private.reject_artifact_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin raise exception using errcode = '55000', message = 'Retained artifacts are append-only.'; end;
$$;

create function picshaw_private.validate_source_window()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare run public.source_runs;
begin
  select * into run from public.source_runs
    where organization_id = new.organization_id and id = new.run_id and property_id = new.property_id;
  if not found then raise foreign_key_violation using message = 'Unknown source run.'; end if;
  if not ((new.window_start = run.current_start and new.window_end = run.current_end)
    or (new.window_start = run.prior_start and new.window_end = run.prior_end)) then
    raise check_violation using message = 'Snapshot window is outside the source run.';
  end if;
  return new;
end;
$$;
create trigger snapshots_check_window before insert on public.source_snapshots
  for each row execute function picshaw_private.validate_source_window();

create function picshaw_private.validate_evidence_pair()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare current_source public.source_snapshots; prior_source public.source_snapshots; evidence jsonb;
begin
  select * into current_source from public.source_snapshots where organization_id = new.organization_id
    and run_id = new.run_id and property_id = new.property_id and id = new.snapshot_id;
  select * into prior_source from public.source_snapshots where organization_id = new.organization_id
    and run_id = new.run_id and property_id = new.property_id and id = new.prior_snapshot_id;
  if current_source.id is null or prior_source.id is null then
    raise foreign_key_violation using message = 'Unknown tenant source evidence.';
  end if;
  if current_source.dimensions <> array['page'] or prior_source.dimensions <> array['page']
    or prior_source.window_end + 1 <> current_source.window_start
    or current_source.window_end - current_source.window_start <> prior_source.window_end - prior_source.window_start then
    raise check_violation using message = 'Evidence requires comparable adjacent page snapshots.';
  end if;
  if tg_table_name = 'recommended_actions' then
    if current_source.coverage <> 'available-rows' or prior_source.coverage <> 'available-rows' then
      raise check_violation using message = 'Bounded evidence cannot produce recommendations.';
    end if;
    select r into evidence from jsonb_array_elements(current_source.rows) r where r->'keys' = jsonb_build_array(new.page);
    if evidence is null or evidence is distinct from new.current_row then
      raise check_violation using message = 'Current row does not match retained evidence.';
    end if;
    select r into evidence from jsonb_array_elements(prior_source.rows) r where r->'keys' = jsonb_build_array(new.page);
    if evidence is distinct from new.prior_row then
      raise check_violation using message = 'Prior row does not match retained evidence.';
    end if;
  end if;
  return new;
end;
$$;
create trigger actions_check_evidence before insert on public.recommended_actions
  for each row execute function picshaw_private.validate_evidence_pair();
create trigger reports_check_evidence before insert on public.reports
  for each row execute function picshaw_private.validate_evidence_pair();

-- Accidental service writes still need an active actor and same-tenant ownership.
-- This does NOT authenticate a request: the trusted server must do that first.
create function picshaw_private.validate_active_actor()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare actor uuid;
begin
  actor := coalesce((to_jsonb(new)->>'created_by')::uuid, (to_jsonb(new)->>'actor_id')::uuid);
  if not exists (select 1 from public.organization_memberships m
    where m.organization_id = new.organization_id and m.user_id = actor and m.revoked_at is null) then
    raise check_violation using message = 'Active tenant actor required.';
  end if;
  if tg_table_name = 'work_events' and not exists (select 1 from public.organization_memberships m
    where m.organization_id = new.organization_id and m.user_id = (to_jsonb(new)->>'owner_id')::uuid and m.revoked_at is null) then
    raise check_violation using message = 'Active tenant work owner required.';
  end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['organizations','organization_memberships','google_connections','source_runs','source_snapshots','recommended_actions','work_events','reports'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    -- Neutralize Supabase's possible default privileges, including TRUNCATE.
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', table_name);
    execute format('grant select on table public.%I to authenticated', table_name);
    execute format('grant select, insert on table public.%I to service_role', table_name);
  end loop;
  foreach table_name in array array['source_runs','source_snapshots','recommended_actions','work_events','reports'] loop
    execute format('create trigger %I before update or delete on public.%I for each row execute function picshaw_private.reject_artifact_change()', table_name || '_immutable', table_name);
  end loop;
  foreach table_name in array array['google_connections','source_runs','work_events','reports'] loop
    execute format('create trigger %I before insert on public.%I for each row execute function picshaw_private.validate_active_actor()', table_name || '_actor', table_name);
  end loop;
end;
$$;
grant update, delete on public.organizations, public.organization_memberships, public.google_connections to service_role;

-- Membership changes are privileged server operations only, including "owner".
-- Members see only their own active memberships; no recursive membership policy.
create policy membership_self_read on public.organization_memberships for select to authenticated using (
  user_id = (select auth.uid()) and revoked_at is null
  and coalesce((select auth.jwt())->>'is_anonymous', 'false') = 'false'
);
create policy organization_member_read on public.organizations for select to authenticated using (
  id in (select m.organization_id from public.organization_memberships m where m.user_id = (select auth.uid()) and m.revoked_at is null)
);
do $$
declare table_name text;
begin
  foreach table_name in array array['google_connections','source_runs','source_snapshots','recommended_actions','work_events','reports'] loop
    execute format('create policy tenant_member_read on public.%I for select to authenticated using (organization_id in (select m.organization_id from public.organization_memberships m where m.user_id = (select auth.uid()) and m.revoked_at is null))', table_name);
  end loop;
end;
$$;

revoke all on all functions in schema picshaw_private from public, anon, authenticated;
grant execute on all functions in schema picshaw_private to service_role;
comment on schema picshaw_private is 'Internal validators only. Never add this schema to Data API exposed schemas.';
comment on table public.google_connections is 'Metadata only. No access tokens, refresh tokens, secrets, or browser-readable secret references.';
comment on table public.reports is 'Tenant-private source selection. No bearer/share token or public access policy.';
commit;

