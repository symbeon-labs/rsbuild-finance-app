-- Organization-scoped ERP integrations (Omie and future providers).
-- Credentials are encrypted at rest by the server and never exposed directly to anon/authenticated clients.

create table if not exists public.organization_erp_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('omie')),
  app_key text not null,
  app_secret_encrypted text not null,
  app_key_hint text not null,
  status text not null default 'configured' check (status in ('configured', 'verified', 'error', 'disabled')),
  last_verified_at timestamptz,
  last_error text,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

alter table public.organization_erp_credentials enable row level security;

-- Zero direct client access: all reads and writes go through server-side API routes using service role + org-guard.
revoke all on public.organization_erp_credentials from anon, authenticated;
