-- RSBUILD DATA INTAKE V1
-- Private, tenant-scoped document vault. Files are uploaded only by trusted server routes.
create table if not exists public.organization_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  origin_module text not null default 'finance' check (origin_module in ('finance','fiscal','logistics','contracts','general')),
  document_type text not null check (document_type in ('financial_support','invoice','boleto','receipt','contract','spreadsheet','other')),
  status text not null default 'received' check (status in ('received','under_review','accepted','rejected')),
  original_filename text not null check (length(original_filename) between 1 and 255),
  storage_bucket text not null default 'rsbuild-data-intake' check (storage_bucket = 'rsbuild-data-intake'),
  storage_path text not null unique,
  media_type text not null,
  file_size_bytes bigint not null check (file_size_bytes between 1 and 20971520),
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  description text,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  unique (organization_id, file_sha256)
);

create index if not exists organization_documents_org_uploaded_idx
  on public.organization_documents (organization_id, uploaded_at desc);
create index if not exists organization_documents_org_type_status_idx
  on public.organization_documents (organization_id, document_type, status);

create table if not exists public.organization_document_events (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.organization_documents(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('uploaded','review_started','accepted','rejected','downloaded')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists organization_document_events_doc_time_idx
  on public.organization_document_events (organization_id, document_id, occurred_at desc);

alter table public.organization_documents enable row level security;
alter table public.organization_document_events enable row level security;

revoke all on public.organization_documents, public.organization_document_events from public, anon, authenticated;
grant select on public.organization_documents, public.organization_document_events to authenticated;
grant all on public.organization_documents, public.organization_document_events to service_role;
grant usage, select on sequence public.organization_document_events_id_seq to service_role;

drop policy if exists "Organization members read documents" on public.organization_documents;
create policy "Organization members read documents"
  on public.organization_documents for select to authenticated
  using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = organization_documents.organization_id
      and m.user_id = (select auth.uid())
  ));

drop policy if exists "Organization members read document events" on public.organization_document_events;
create policy "Organization members read document events"
  on public.organization_document_events for select to authenticated
  using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = organization_document_events.organization_id
      and m.user_id = (select auth.uid())
  ));

-- The bucket is private. Service-role API routes perform uploads and signed downloads
-- only after validating the caller's organization membership and capability.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rsbuild-data-intake',
  'rsbuild-data-intake',
  false,
  20971520,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'text/csv',
    'application/json',
    'application/xml',
    'text/xml',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.organization_documents is
  'Private tenant-scoped document intake registry. Original files remain immutable; parsing and business posting require separate review workflows.';
comment on table public.organization_document_events is
  'Append-only event history for document intake and review lifecycle.';
