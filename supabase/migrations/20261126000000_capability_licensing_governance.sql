-- RSBUILD OS — Capability licensing and entitlement governance
-- No tenant receives a capability by default. Only an owner of the RSBUILD
-- institutional organization can grant, suspend, or revoke an entitlement.

create table if not exists public.capability_catalog (
  capability_key text primary key,
  display_name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  constraint capability_catalog_key_format check (capability_key ~ '^[a-z][a-z0-9_]{1,62}$')
);

create table if not exists public.organization_capability_licenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  capability_key text not null references public.capability_catalog(capability_key) on delete restrict,
  license_status text not null default 'blocked'
    check (license_status in ('blocked', 'granted', 'suspended', 'revoked')),
  operational_status text not null default 'not_implemented'
    check (operational_status in ('not_implemented', 'in_development', 'available', 'active')),
  notes text,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, capability_key),
  constraint capability_grant_metadata_consistent check (
    (license_status = 'granted' and granted_at is not null)
    or license_status <> 'granted'
  )
);

create index if not exists organization_capability_licenses_org_idx
  on public.organization_capability_licenses(organization_id);

create table if not exists public.capability_license_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  capability_key text not null references public.capability_catalog(capability_key) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('created', 'granted', 'suspended', 'revoked', 'status_changed', 'updated')),
  previous_state jsonb,
  new_state jsonb not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists capability_license_events_org_created_idx
  on public.capability_license_events(organization_id, created_at desc);

insert into public.capability_catalog (capability_key, display_name, description)
values
  ('finance', 'Finanças & Caixa', 'Gestão financeira, movimentações, extratos e DRE.'),
  ('reconciliation', 'Reconciliação & Baixas', 'Conferência bancária, títulos, ERP e baixas.'),
  ('logistics', 'Logística & Expedição', 'Pedidos, expedição, entregas e comprovantes.'),
  ('audit', 'Auditoria & Governança', 'Auditoria institucional, acessos, evidências e governança.')
on conflict (capability_key) do update
set display_name = excluded.display_name, description = excluded.description;

alter table public.capability_catalog enable row level security;
alter table public.organization_capability_licenses enable row level security;
alter table public.capability_license_events enable row level security;

drop policy if exists "Authenticated users read capability catalog" on public.capability_catalog;
create policy "Authenticated users read capability catalog"
  on public.capability_catalog for select to authenticated
  using (true);

drop policy if exists "Organization members read capability licenses" on public.organization_capability_licenses;
create policy "Organization members read capability licenses"
  on public.organization_capability_licenses for select to authenticated
  using (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = organization_capability_licenses.organization_id
        and m.user_id = (select auth.uid())
    )
  );

drop policy if exists "RSBUILD owners manage capability licenses" on public.organization_capability_licenses;
create policy "RSBUILD owners manage capability licenses"
  on public.organization_capability_licenses for all to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      join public.organizations o on o.id = m.organization_id
      where o.slug = 'rsbuild'
        and m.user_id = (select auth.uid())
        and m.role = 'owner'::public.rsbuild_member_role
    )
  )
  with check (
    exists (
      select 1
      from public.organization_memberships m
      join public.organizations o on o.id = m.organization_id
      where o.slug = 'rsbuild'
        and m.user_id = (select auth.uid())
        and m.role = 'owner'::public.rsbuild_member_role
    )
  );

drop policy if exists "RSBUILD owners read capability license events" on public.capability_license_events;
create policy "RSBUILD owners read capability license events"
  on public.capability_license_events for select to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      join public.organizations o on o.id = m.organization_id
      where o.slug = 'rsbuild'
        and m.user_id = (select auth.uid())
        and m.role = 'owner'::public.rsbuild_member_role
    )
  );

drop policy if exists "RSBUILD owners append capability license events" on public.capability_license_events;
create policy "RSBUILD owners append capability license events"
  on public.capability_license_events for insert to authenticated
  with check (
    actor_id = (select auth.uid())
    and exists (
      select 1
      from public.organization_memberships m
      join public.organizations o on o.id = m.organization_id
      where o.slug = 'rsbuild'
        and m.user_id = (select auth.uid())
        and m.role = 'owner'::public.rsbuild_member_role
    )
  );

-- Event history is append-only: no UPDATE or DELETE policy is intentionally provided.
