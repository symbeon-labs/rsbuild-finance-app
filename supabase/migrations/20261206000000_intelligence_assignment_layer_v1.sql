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

-- The Intelligence Registry is the canonical catalog. Existing executable
-- agents are linked as legacy runtime projections, not a second catalog.
alter table public.intelligence_registry
  add column if not exists legacy_agent_id uuid
  references public.agents(id) on delete set null;

create unique index if not exists intelligence_registry_legacy_agent_uidx
  on public.intelligence_registry(legacy_agent_id)
  where legacy_agent_id is not null;

insert into public.intelligence_registry (
  name, description, intelligence_type, provider, runtime, config,
  status, legacy_agent_id, created_at, updated_at
)
select
  a.display_name,
  a.description,
  'agent',
  'internal',
  a.protocol,
  jsonb_build_object('legacy', true, 'capabilities', coalesce(a.capabilities, '[]'::jsonb)),
  case when a.status = 'active' then 'registered' else 'disabled' end,
  a.id,
  coalesce(a.created_at, now()),
  now()
from public.agents a
where not exists (
  select 1 from public.intelligence_registry ir where ir.legacy_agent_id = a.id
);

comment on column public.intelligence_registry.legacy_agent_id is
  'Optional one-to-one link to the legacy execution record. Registry owns catalog identity; legacy agents remain a runtime compatibility projection during migration.';

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
    'intelligence_assignment', v_assignment_id::text,
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
    'intelligence_assignment', v_row.id::text,
    jsonb_build_object('intelligenceId',v_row.intelligence_id,'organizationId',v_row.organization_id)
  );
end;
$$;

revoke all on function public.create_intelligence_assignment(uuid,uuid,text,text[],timestamptz) from public, anon;
revoke all on function public.revoke_intelligence_assignment(uuid) from public, anon;
grant execute on function public.create_intelligence_assignment(uuid,uuid,text,text[],timestamptz) to authenticated;
grant execute on function public.revoke_intelligence_assignment(uuid) to authenticated;


-- Registry and connection writes are audited atomically. The API never writes
-- these protected tables directly, avoiding best-effort audit gaps.
create or replace function public.register_intelligence(
  p_name text, p_description text, p_type text, p_provider text,
  p_model text, p_source_uri text, p_runtime text, p_config jsonb,
  p_credential_encrypted text, p_credential_hint text
) returns uuid
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_audit_org uuid;
begin
  if v_actor is null or not public.is_platform_administrator() then
    raise exception 'platform_admin_required' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name,''))) < 2 or length(p_name) > 120
     or p_type not in ('agent','llm','decision_engine')
     or p_provider not in ('openai','anthropic','google','xai','local','custom','internal','mcp')
     or coalesce(p_config,'{}'::jsonb) = 'null'::jsonb
     or jsonb_typeof(coalesce(p_config,'{}'::jsonb)) <> 'object'
     or (p_source_uri is not null and p_source_uri !~ '^https://')
     or p_credential_encrypted is not null or p_credential_hint is not null then
    raise exception 'invalid_registry_payload' using errcode = '22023';
  end if;
  insert into public.intelligence_registry (
    name, description, intelligence_type, provider, model, source_uri,
    runtime, config, credential_encrypted, credential_hint, status,
    created_by, updated_by, updated_at
  ) values (
    trim(p_name), nullif(trim(coalesce(p_description,'')),''), p_type, p_provider,
    nullif(trim(coalesce(p_model,'')),''), p_source_uri,
    nullif(trim(coalesce(p_runtime,'')),''), coalesce(p_config,'{}'::jsonb),
    p_credential_encrypted, p_credential_hint, 'registered',
    v_actor, v_actor, now()
  ) returning id into v_id;

  select id into v_audit_org from public.organizations where slug='rsbuild' limit 1;
  if v_audit_org is null then raise exception 'audit_organization_missing' using errcode='23502'; end if;
  insert into public.audit_events(organization_id,actor_id,event_type,entity_type,entity_id,metadata)
  values(v_audit_org,v_actor,'intelligence.registered','intelligence_registry',v_id::text,
    jsonb_build_object('type',p_type,'provider',p_provider,'name',trim(p_name),'hasCredential',p_credential_encrypted is not null));
  return v_id;
end;
$$;

create or replace function public.disable_intelligence(p_intelligence_id uuid)
returns void
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_item public.intelligence_registry%rowtype;
  v_audit_org uuid;
begin
  if v_actor is null or not public.is_platform_administrator() then
    raise exception 'platform_admin_required' using errcode='42501';
  end if;
  update public.intelligence_registry set status='disabled',updated_by=v_actor,updated_at=now()
   where id=p_intelligence_id and status <> 'disabled' returning * into v_item;
  if not found then raise exception 'registry_item_not_found' using errcode='P0002'; end if;
  update public.intelligence_assignments
    set status='revoked',updated_by=v_actor,updated_at=now()
    where intelligence_id=v_item.id and status<>'revoked';
  update public.intelligence_connections
    set status='disabled',updated_by=v_actor,updated_at=now()
    where intelligence_id=v_item.id and status<>'disabled';
  select id into v_audit_org from public.organizations where slug='rsbuild' limit 1;
  if v_audit_org is null then raise exception 'audit_organization_missing' using errcode='23502'; end if;
  insert into public.audit_events(organization_id,actor_id,event_type,entity_type,entity_id,metadata)
  values(v_audit_org,v_actor,'intelligence.disabled','intelligence_registry',v_item.id::text,
    jsonb_build_object('name',v_item.name,'type',v_item.intelligence_type,'provider',v_item.provider));
end;
$$;

create or replace function public.save_agent_integration(
  p_agent_id uuid, p_organization_id uuid, p_provider text,
  p_display_name text, p_endpoint_url text, p_model text,
  p_credential_encrypted text, p_credential_hint text
) returns uuid
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_audit_org uuid;
begin
  if v_actor is null or not public.is_platform_administrator() then
    raise exception 'platform_admin_required' using errcode='42501';
  end if;
  if p_provider not in ('openai','anthropic','google','xai','custom_api','mcp')
     or length(trim(coalesce(p_display_name,''))) < 2
     or length(p_display_name) > 100
     or p_credential_encrypted is null
     or length(p_credential_encrypted) < 16
     or p_endpoint_url is not null and p_endpoint_url !~ '^https://'
     or length(coalesce(p_model,'')) > 120 then
    raise exception 'invalid_integration_payload' using errcode='22023';
  end if;
  if not exists (
    select 1
    from public.agents a
    join public.agent_organization_grants g on g.agent_id=a.id
    join public.intelligence_registry ir on ir.legacy_agent_id=a.id and ir.status='registered'
    join public.intelligence_assignments ia on ia.intelligence_id=ir.id
      and ia.organization_id=p_organization_id
      and ia.status='active'
      and (ia.expires_at is null or ia.expires_at > now())
      and ('qa'=any(ia.environments) or 'sandbox'=any(ia.environments))
    where a.id=p_agent_id and a.status='active'
  ) then
    raise exception 'active_intelligence_assignment_required' using errcode='42501';
  end if;

  insert into public.agent_integrations(
    agent_id,organization_id,provider,display_name,endpoint_url,model,
    credential_encrypted,credential_hint,status,last_error,created_by,updated_by,updated_at
  ) values (
    p_agent_id,p_organization_id,p_provider,trim(p_display_name),p_endpoint_url,
    nullif(trim(coalesce(p_model,'')),''),p_credential_encrypted,p_credential_hint,
    'configured',null,v_actor,v_actor,now()
  )
  on conflict(agent_id,organization_id,provider) do update set
    display_name=excluded.display_name,endpoint_url=excluded.endpoint_url,
    model=excluded.model,credential_encrypted=excluded.credential_encrypted,
    credential_hint=excluded.credential_hint,status='configured',last_error=null,
    updated_by=v_actor,updated_at=now()
  returning id into v_id;

  select id into v_audit_org from public.organizations where slug='rsbuild' limit 1;
  if v_audit_org is null then raise exception 'audit_organization_missing' using errcode='23502'; end if;
  insert into public.audit_events(organization_id,actor_id,event_type,entity_type,entity_id,metadata)
  values(v_audit_org,v_actor,'agent.integration.configured','agent_integration',v_id::text,
    jsonb_build_object('agentId',p_agent_id,'organizationId',p_organization_id,'provider',p_provider,'credentialHint',p_credential_hint));
  return v_id;
end;
$$;

create or replace function public.disable_agent_integration(p_integration_id uuid)
returns void
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_item public.agent_integrations%rowtype;
  v_audit_org uuid;
begin
  if v_actor is null or not public.is_platform_administrator() then
    raise exception 'platform_admin_required' using errcode='42501';
  end if;
  update public.agent_integrations set status='disabled',updated_by=v_actor,updated_at=now()
   where id=p_integration_id and status <> 'disabled' returning * into v_item;
  if not found then raise exception 'integration_not_found' using errcode='P0002'; end if;
  select id into v_audit_org from public.organizations where slug='rsbuild' limit 1;
  if v_audit_org is null then raise exception 'audit_organization_missing' using errcode='23502'; end if;
  insert into public.audit_events(organization_id,actor_id,event_type,entity_type,entity_id,metadata)
  values(v_audit_org,v_actor,'agent.integration.disabled','agent_integration',v_item.id::text,
    jsonb_build_object('agentId',v_item.agent_id,'organizationId',v_item.organization_id,'provider',v_item.provider));
end;
$$;

revoke all on function public.register_intelligence(text,text,text,text,text,text,text,jsonb,text,text) from public,anon;
revoke all on function public.disable_intelligence(uuid) from public,anon;
revoke all on function public.save_agent_integration(uuid,uuid,text,text,text,text,text,text) from public,anon;
revoke all on function public.disable_agent_integration(uuid) from public,anon;
grant execute on function public.register_intelligence(text,text,text,text,text,text,text,jsonb,text,text) to authenticated;
grant execute on function public.disable_intelligence(uuid) to authenticated;
grant execute on function public.save_agent_integration(uuid,uuid,text,text,text,text,text,text) to authenticated;
grant execute on function public.disable_agent_integration(uuid) to authenticated;


-- First-class connections are keyed to the canonical intelligence identity,
-- not to a legacy agent row. This supports LLMs, decision engines and agents.
create table if not exists public.intelligence_connections (
  id uuid primary key default gen_random_uuid(),
  intelligence_id uuid not null references public.intelligence_registry(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  provider text not null check (provider in ('openai','anthropic','google','xai','local','custom','internal','mcp')),
  display_name text not null,
  endpoint_url text,
  model text,
  credential_encrypted text not null,
  credential_hint text not null,
  status text not null default 'configured' check (status in ('configured','disabled','error')),
  last_verified_at timestamptz,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intelligence_connections_unique unique(intelligence_id,organization_id,provider),
  constraint intelligence_connections_name_nonempty check(length(trim(display_name))>0),
  constraint intelligence_connections_endpoint_https check(endpoint_url is null or endpoint_url ~ '^https://')
);
create index if not exists intelligence_connections_org_status_idx
  on public.intelligence_connections(organization_id,status,updated_at desc);
alter table public.intelligence_connections enable row level security;
revoke all on public.intelligence_connections from public,anon,authenticated;
comment on table public.intelligence_connections is
  'Tenant-scoped encrypted provider connections attached to canonical intelligence identities. Requires an active approved assignment; no execution capability.';

create or replace function public.save_intelligence_connection(
  p_intelligence_id uuid,p_organization_id uuid,p_provider text,
  p_display_name text,p_endpoint_url text,p_model text,
  p_credential_encrypted text,p_credential_hint text
) returns uuid
language plpgsql security definer
set search_path = public,auth
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_audit_org uuid;
begin
  if v_actor is null or not public.is_platform_administrator() then
    raise exception 'platform_admin_required' using errcode='42501';
  end if;
  if p_provider not in ('openai','anthropic','google','xai','local','custom','internal','mcp')
     or length(trim(coalesce(p_display_name,'')))<2 or length(p_display_name)>100
     or p_credential_encrypted is null or length(p_credential_encrypted)<16
     or (p_endpoint_url is not null and p_endpoint_url !~ '^https://')
     or length(coalesce(p_model,''))>160 then
    raise exception 'invalid_connection_payload' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.intelligence_registry ir
    where ir.id=p_intelligence_id and ir.status='registered' and ir.provider=p_provider
  ) then
    raise exception 'connection_provider_mismatch' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.intelligence_registry ir
    join public.intelligence_assignments ia on ia.intelligence_id=ir.id
    where ir.id=p_intelligence_id and ir.status='registered'
      and ia.organization_id=p_organization_id and ia.status='active'
      and (ia.expires_at is null or ia.expires_at>now())
      and ('qa'=any(ia.environments) or 'sandbox'=any(ia.environments))
  ) then
    raise exception 'active_intelligence_assignment_required' using errcode='42501';
  end if;
  insert into public.intelligence_connections(
    intelligence_id,organization_id,provider,display_name,endpoint_url,model,
    credential_encrypted,credential_hint,status,last_error,created_by,updated_by,updated_at
  ) values (
    p_intelligence_id,p_organization_id,p_provider,trim(p_display_name),p_endpoint_url,
    nullif(trim(coalesce(p_model,'')),''),p_credential_encrypted,p_credential_hint,
    'configured',null,v_actor,v_actor,now()
  )
  on conflict(intelligence_id,organization_id,provider) do update set
    display_name=excluded.display_name,endpoint_url=excluded.endpoint_url,model=excluded.model,
    credential_encrypted=excluded.credential_encrypted,credential_hint=excluded.credential_hint,
    status='configured',last_error=null,updated_by=v_actor,updated_at=now()
  returning id into v_id;
  select id into v_audit_org from public.organizations where slug='rsbuild' limit 1;
  if v_audit_org is null then raise exception 'audit_organization_missing' using errcode='23502'; end if;
  insert into public.audit_events(organization_id,actor_id,event_type,entity_type,entity_id,metadata)
  values(v_audit_org,v_actor,'intelligence.connection.configured','intelligence_connection',v_id::text,
    jsonb_build_object('intelligenceId',p_intelligence_id,'organizationId',p_organization_id,
      'provider',p_provider,'credentialHint',p_credential_hint));
  return v_id;
end;
$$;

create or replace function public.disable_intelligence_connection(p_connection_id uuid)
returns void
language plpgsql security definer
set search_path = public,auth
as $$
declare
  v_actor uuid := auth.uid();
  v_item public.intelligence_connections%rowtype;
  v_audit_org uuid;
begin
  if v_actor is null or not public.is_platform_administrator() then
    raise exception 'platform_admin_required' using errcode='42501';
  end if;
  update public.intelligence_connections set status='disabled',updated_by=v_actor,updated_at=now()
    where id=p_connection_id and status<>'disabled' returning * into v_item;
  if not found then raise exception 'connection_not_found' using errcode='P0002'; end if;
  select id into v_audit_org from public.organizations where slug='rsbuild' limit 1;
  if v_audit_org is null then raise exception 'audit_organization_missing' using errcode='23502'; end if;
  insert into public.audit_events(organization_id,actor_id,event_type,entity_type,entity_id,metadata)
  values(v_audit_org,v_actor,'intelligence.connection.disabled','intelligence_connection',v_item.id::text,
    jsonb_build_object('intelligenceId',v_item.intelligence_id,'organizationId',v_item.organization_id,'provider',v_item.provider));
end;
$$;

revoke all on function public.save_intelligence_connection(uuid,uuid,text,text,text,text,text,text) from public,anon;
revoke all on function public.disable_intelligence_connection(uuid) from public,anon;
grant execute on function public.save_intelligence_connection(uuid,uuid,text,text,text,text,text,text) to authenticated;
grant execute on function public.disable_intelligence_connection(uuid) to authenticated;
