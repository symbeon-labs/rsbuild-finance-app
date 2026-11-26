-- RSBUILD Controlled AI — V1 integration registry and authority hardening.
-- Provider credentials are write/read-only through trusted server routes; no client role can access them.

alter table public.agent_organization_grants
  add column if not exists access_mode text not null default 'internal',
  add column if not exists entitled_environments text[] not null default array['qa']::text[],
  add column if not exists expires_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.agent_organization_grants'::regclass and conname='agent_grants_access_mode_check') then
    alter table public.agent_organization_grants add constraint agent_grants_access_mode_check
      check (access_mode in ('internal','beta','contractual'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.agent_organization_grants'::regclass and conname='agent_grants_environment_scope_check') then
    alter table public.agent_organization_grants add constraint agent_grants_environment_scope_check
      check (entitled_environments <@ array['qa','sandbox','production']::text[] and cardinality(entitled_environments) > 0);
  end if;
end;
$$;

create table if not exists public.agent_integrations (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  organization_id uuid not null,
  provider text not null check (provider in ('openai','anthropic','google','xai','custom_api','mcp')),
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
  constraint agent_integrations_agent_org_provider_key unique (agent_id, organization_id, provider),
  constraint agent_integrations_grant_fk foreign key (agent_id, organization_id)
    references public.agent_organization_grants(agent_id, organization_id) on delete cascade,
  constraint agent_integrations_display_name_nonempty check (length(trim(display_name)) > 0),
  constraint agent_integrations_endpoint_https check (endpoint_url is null or endpoint_url ~ '^https://')
);

create index if not exists agent_integrations_org_status_idx
  on public.agent_integrations(organization_id, status, updated_at desc);

alter table public.agent_integrations enable row level security;
revoke all on public.agent_integrations from public, anon, authenticated;

-- The platform grant is the only source of global agent-administration authority.
drop policy if exists "RSBUILD owner reads agents" on public.agents;
drop policy if exists "RSBUILD owner manages agents" on public.agents;
drop policy if exists "RSBUILD owner reads agent grants" on public.agent_organization_grants;
drop policy if exists "RSBUILD owner manages agent grants" on public.agent_organization_grants;
drop policy if exists "owner governance and tenant read proposals" on public.agent_action_proposals;
drop policy if exists "owners decide agent proposals" on public.agent_action_proposals;

create policy "Platform administrators manage agents"
  on public.agents for all to authenticated
  using ((select public.is_platform_administrator()))
  with check ((select public.is_platform_administrator()));

create policy "Platform administrators manage agent grants"
  on public.agent_organization_grants for all to authenticated
  using ((select public.is_platform_administrator()))
  with check ((select public.is_platform_administrator()));

create policy "Platform administrators and tenants read proposals"
  on public.agent_action_proposals for select to authenticated
  using (
    (select public.is_platform_administrator())
    or exists (
      select 1 from public.organization_memberships m
      where m.organization_id = agent_action_proposals.organization_id
        and m.user_id = (select auth.uid())
    )
  );

create policy "Platform administrators and tenant owners decide proposals"
  on public.agent_action_proposals for update to authenticated
  using (
    (select public.is_platform_administrator())
    or exists (
      select 1 from public.organization_memberships m
      where m.organization_id = agent_action_proposals.organization_id
        and m.user_id = (select auth.uid())
        and m.role = 'owner'
    )
  )
  with check (
    (select public.is_platform_administrator())
    or exists (
      select 1 from public.organization_memberships m
      where m.organization_id = agent_action_proposals.organization_id
        and m.user_id = (select auth.uid())
        and m.role = 'owner'
    )
  );

comment on table public.agent_integrations is
  'Server-managed provider credentials for an explicitly granted agent/organization pair. No direct client access.';
comment on column public.agent_organization_grants.access_mode is
  'Commercial/governance mode: internal, beta, or contractual.';
comment on column public.agent_organization_grants.entitled_environments is
  'Explicit environments where this agent grant may be used; existing grants default to QA only.';
