-- RSBUILD Intelligence Governance Boundaries V1
-- Assignment is separate from credentials and from legacy execution grants.

alter table public.intelligence_registry
  add column if not exists config_schema_version integer not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.intelligence_registry'::regclass and conname='intelligence_registry_config_object') then
    alter table public.intelligence_registry
      add constraint intelligence_registry_config_object
      check (
        jsonb_typeof(config) = 'object'
        and (not (config ? 'input') or jsonb_typeof(config->'input') = 'object')
        and (not (config ? 'output') or jsonb_typeof(config->'output') = 'object')
      );
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.intelligence_registry'::regclass and conname='intelligence_registry_config_schema_version') then
    alter table public.intelligence_registry
      add constraint intelligence_registry_config_schema_version
      check (config_schema_version > 0);
  end if;
end;
$$;

create table if not exists public.intelligence_assignments (
  id uuid primary key default gen_random_uuid(),
  intelligence_id uuid not null references public.intelligence_registry(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending','active','suspended','revoked')),
  access_mode text not null default 'internal'
    check (access_mode in ('internal','beta','contractual')),
  environments text[] not null default array['qa']::text[],
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intelligence_assignments_unique unique (intelligence_id, organization_id),
  constraint intelligence_assignments_environments check (
    cardinality(environments) > 0
    and environments <@ array['qa','sandbox','production']::text[]
  ),
  constraint intelligence_assignments_production_contractual check (
    not ('production' = any(environments)) or access_mode = 'contractual'
  ),
  constraint intelligence_assignments_approval_state check (
    (status <> 'active') or (approved_by is not null and approved_at is not null)
  )
);

create index if not exists intelligence_assignments_org_status_idx
  on public.intelligence_assignments(organization_id, status, updated_at desc);
create index if not exists intelligence_assignments_intelligence_idx
  on public.intelligence_assignments(intelligence_id, status);

alter table public.intelligence_assignments enable row level security;
revoke all on public.intelligence_assignments from public, anon, authenticated;

comment on table public.intelligence_assignments is
  'Explicit tenant assignment and approval state for catalogued intelligence. It does not create credentials or execution capability.';
comment on column public.intelligence_assignments.environments is
  'Approved environment scope. Production requires contractual access mode.';
comment on column public.intelligence_registry.config_schema_version is
  'Version of the non-secret input/output contract stored in config.';

-- Assignment mutation and its audit record commit or roll back together.
create or replace function public.create_intelligence_assignment(
  p_intelligence_id uuid,
  p_organization_id uuid,
  p_access_mode text,
  p_environments text[],
  p_expires_at timestamptz default null
) returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_assignment_id uuid;
  v_audit_org uuid;
begin
  if v_actor is null or not public.is_platform_administrator() then
    raise exception 'platform_admin_required' using errcode = '42501';
  end if;
  if p_access_mode not in ('internal','beta','contractual')
     or coalesce(cardinality(p_environments),0) = 0
     or not (p_environments <@ array['qa','sandbox','production']::text[])
     or ('production' = any(p_environments) and p_access_mode <> 'contractual')
     or (p_expires_at is not null and p_expires_at <= now()) then
    raise exception 'invalid_assignment_policy' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.intelligence_registry
    where id = p_intelligence_id and status = 'registered'
  ) then
    raise exception 'registered_intelligence_required' using errcode = '23503';
  end if;
  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'organization_not_found' using errcode = '23503';
  end if;

  insert into public.intelligence_assignments (
    intelligence_id, organization_id, status, access_mode, environments,
    expires_at, created_by, approved_by, approved_at, updated_by
  ) values (
    p_intelligence_id, p_organization_id, 'active', p_access_mode, p_environments,
    p_expires_at, v_actor, v_actor, now(), v_actor
  )
  on conflict (intelligence_id, organization_id) do update set
    status = 'active',
    access_mode = excluded.access_mode,
    environments = excluded.environments,
    expires_at = excluded.expires_at,
    approved_by = v_actor,
    approved_at = now(),
    updated_by = v_actor,
    updated_at = now()
  returning id into v_assignment_id;

  select id into v_audit_org from public.organizations where slug = 'rsbuild' limit 1;
  if v_audit_org is null then
    raise exception 'audit_organization_missing' using errcode = '23502';
  end if;
  insert into public.audit_events (
    organization_id, actor_id, event_type, entity_type, entity_id, metadata
  ) values (
    v_audit_org, v_actor, 'intelligence.assignment.approved',
    'intelligence_assignment', v_assignment_id,
    jsonb_build_object(
      'intelligenceId', p_intelligence_id,
      'organizationId', p_organization_id,
      'accessMode', p_access_mode,
      'environments', p_environments,
      'expiresAt', p_expires_at
    )
  );
  return v_assignment_id;
end;
$$;

create or replace function public.revoke_intelligence_assignment(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.intelligence_assignments%rowtype;
  v_audit_org uuid;
begin
  if v_actor is null or not public.is_platform_administrator() then
    raise exception 'platform_admin_required' using errcode = '42501';
  end if;
  update public.intelligence_assignments
    set status = 'revoked', updated_by = v_actor, updated_at = now()
    where id = p_assignment_id and status <> 'revoked'
    returning * into v_row;
  if not found then
    raise exception 'assignment_not_found' using errcode = 'P0002';
  end if;
  select id into v_audit_org from public.organizations where slug = 'rsbuild' limit 1;
  if v_audit_org is null then
    raise exception 'audit_organization_missing' using errcode = '23502';
  end if;
  insert into public.audit_events (
    organization_id, actor_id, event_type, entity_type, entity_id, metadata
  ) values (
    v_audit_org, v_actor, 'intelligence.assignment.revoked',
    'intelligence_assignment', v_row.id,
    jsonb_build_object('intelligenceId',v_row.intelligence_id,'organizationId',v_row.organization_id)
  );
end;
$$;

revoke all on function public.create_intelligence_assignment(uuid,uuid,text,text[],timestamptz) from public, anon;
revoke all on function public.revoke_intelligence_assignment(uuid) from public, anon;
grant execute on function public.create_intelligence_assignment(uuid,uuid,text,text[],timestamptz) to authenticated;
grant execute on function public.revoke_intelligence_assignment(uuid) to authenticated;
