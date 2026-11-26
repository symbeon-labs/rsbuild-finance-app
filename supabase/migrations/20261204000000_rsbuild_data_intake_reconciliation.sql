-- RSBUILD DATA INTAKE V1.1: track signed upload intents for orphan reconciliation.
create table if not exists public.organization_document_upload_intents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  storage_path text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  expected_file_size bigint not null check (expected_file_size between 1 and 20971520),
  expected_media_type text not null,
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists organization_document_upload_intents_expiry_idx
  on public.organization_document_upload_intents (expires_at)
  where completed_at is null;

alter table public.organization_document_upload_intents enable row level security;
revoke all on public.organization_document_upload_intents from public, anon, authenticated;
grant all on public.organization_document_upload_intents to service_role;

comment on table public.organization_document_upload_intents is
  'Server-managed signed upload intents. Expired incomplete intents are reconciled against private Storage by the scheduled cleanup route.';
