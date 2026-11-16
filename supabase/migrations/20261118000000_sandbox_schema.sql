-- RSBUILD OS — Sandbox Schema for Safe Testing
-- Isolated schema for testing client components without affecting production data.
-- Only RSBUILD owner/admin can access sandbox data.

-- Create sandbox schema
create schema if not exists sandbox;

-- Sandbox organizations (synthetic test organizations)
create table if not exists sandbox.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  description text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sandbox organization members (synthetic users)
create table if not exists sandbox.organization_memberships (
  organization_id uuid not null references sandbox.organizations(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner','admin','operator','viewer')),
  custom_title text,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- Sandbox financial accounts (synthetic bank accounts)
create table if not exists sandbox.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references sandbox.organizations(id) on delete cascade,
  name text not null,
  institution text,
  account_type text,
  currency char(3) not null default 'BRL',
  external_reference text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sandbox financial records (synthetic transactions)
create table if not exists sandbox.financial_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references sandbox.organizations(id) on delete cascade,
  account_id uuid not null references sandbox.financial_accounts(id) on delete cascade,
  direction text not null check (direction in ('entrada','saída')),
  amount_cents bigint not null,
  currency char(3) not null default 'BRL',
  description text,
  transaction_date date not null,
  external_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sandbox receivable titles (synthetic accounts receivable)
create table if not exists sandbox.receivable_titles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references sandbox.organizations(id) on delete cascade,
  title_number text not null,
  customer_name text,
  amount_cents bigint not null,
  due_date date not null,
  status text not null default 'pending' check (status in ('pending','paid','overdue','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sandbox delivery proofs (synthetic delivery records)
create table if not exists sandbox.delivery_proofs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references sandbox.organizations(id) on delete cascade,
  order_number text,
  customer_name text,
  delivery_date date,
  status text not null default 'pending' check (status in ('pending','delivered','failed','returned')),
  proof_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sandbox audit events (for testing audit trails)
create table if not exists sandbox.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references sandbox.organizations(id) on delete cascade,
  actor_id uuid,
  actor_email text,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Create indexes for performance
create index if not exists sandbox_org_members_org_idx on sandbox.organization_memberships(organization_id);
create index if not exists sandbox_financial_records_org_idx on sandbox.financial_records(organization_id, transaction_date desc);
create index if not exists sandbox_receivable_titles_org_idx on sandbox.receivable_titles(organization_id, due_date);
create index if not exists sandbox_delivery_proofs_org_idx on sandbox.delivery_proofs(organization_id, delivery_date desc);
create index if not exists sandbox_audit_events_org_idx on sandbox.audit_events(organization_id, created_at desc);

-- Enable RLS on all sandbox tables
alter table sandbox.organizations enable row level security;
alter table sandbox.organization_memberships enable row level security;
alter table sandbox.financial_accounts enable row level security;
alter table sandbox.financial_records enable row level security;
alter table sandbox.receivable_titles enable row level security;
alter table sandbox.delivery_proofs enable row level security;
alter table sandbox.audit_events enable row level security;

-- RLS Policies: Only RSBUILD owner/admin can access sandbox
-- This ensures complete isolation from production data

-- Organizations: Only RSBUILD team can see sandbox orgs
create policy "RSBUILD team reads sandbox organizations" on sandbox.organizations
for select to authenticated
using (
  exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
);

-- Organization memberships: Only RSBUILD team can see sandbox members
create policy "RSBUILD team reads sandbox memberships" on sandbox.organization_memberships
for select to authenticated
using (
  exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
);

-- Financial accounts: Only RSBUILD team can access sandbox accounts
create policy "RSBUILD team reads sandbox accounts" on sandbox.financial_accounts
for select to authenticated
using (
  exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
);

-- Financial records: Only RSBUILD team can access sandbox records
create policy "RSBUILD team reads sandbox records" on sandbox.financial_records
for select to authenticated
using (
  exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
);

-- Receivable titles: Only RSBUILD team can access sandbox titles
create policy "RSBUILD team reads sandbox titles" on sandbox.receivable_titles
for select to authenticated
using (
  exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
);

-- Delivery proofs: Only RSBUILD team can access sandbox proofs
create policy "RSBUILD team reads sandbox proofs" on sandbox.delivery_proofs
for select to authenticated
using (
  exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
);

-- Audit events: Only RSBUILD team can access sandbox audit
create policy "RSBUILD team reads sandbox audit" on sandbox.audit_events
for select to authenticated
using (
  exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
);

-- Grant permissions to authenticated users (RLS will filter)
grant usage on schema sandbox to authenticated;
grant select on all tables in schema sandbox to authenticated;

-- Grant permissions to service role (for admin operations)
grant all on all tables in schema sandbox to service_role;
grant all on schema sandbox to service_role;

comment on schema sandbox is 'Isolated schema for safe testing of client components. Only RSBUILD owner/admin can access.';
