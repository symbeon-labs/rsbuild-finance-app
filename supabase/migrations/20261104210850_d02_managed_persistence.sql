-- RSBUILD Finance — D02 managed persistence baseline
-- Apply only to the dedicated RSBUILD Supabase project after it is provisioned.
create extension if not exists pgcrypto;

create type public.rsbuild_member_role as enum ('owner', 'admin', 'operator', 'viewer');
create type public.rsbuild_record_direction as enum ('entrada', 'saída');
create type public.rsbuild_import_status as enum ('received', 'parsed', 'validated', 'rejected', 'committed');
create type public.rsbuild_attestation_status as enum ('pending', 'attested', 'failed');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  display_name text not null,
  tax_identifier text,
  status text not null default 'active' check (status in ('active','suspended','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.rsbuild_member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_memberships_user_idx on public.organization_memberships(user_id);

create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  institution text,
  account_type text,
  currency char(3) not null default 'BRL',
  external_reference text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, external_reference)
);

create table public.data_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_type text not null check (source_type in ('csv','ofx','erp','bank','manual','other')),
  provider text,
  display_name text not null,
  configuration jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','active','disabled','error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data_source_id uuid,
  status public.rsbuild_import_status not null default 'received',
  original_filename text not null,
  file_sha256 text check (file_sha256 is null or file_sha256 ~ '^[a-f0-9]{64}$'),
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  record_count integer not null default 0 check (record_count >= 0),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  rejected_count integer not null default 0 check (rejected_count >= 0),
  received_by uuid references auth.users(id),
  received_at timestamptz not null default now(),
  committed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (organization_id, id),
  foreign key (organization_id, data_source_id) references public.data_sources(organization_id, id)
);

create table public.source_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_batch_id uuid,
  storage_bucket text not null default 'rsbuild-source-artifacts',
  storage_path text not null,
  media_type text,
  file_sha256 text not null check (file_sha256 ~ '^[a-f0-9]{64}$'),
  file_size_bytes bigint not null check (file_size_bytes >= 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (storage_bucket, storage_path),
  foreign key (organization_id, import_batch_id) references public.import_batches(organization_id, id)
);

create table public.financial_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid,
  data_source_id uuid,
  import_batch_id uuid,
  source_record_id text,
  transaction_date date not null,
  description text not null,
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null default 'BRL',
  direction public.rsbuild_record_direction not null,
  category text not null default 'Não classificado',
  status text not null default 'pendente' check (status in ('pendente','conciliado','ignorado')),
  deduplication_key text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, account_id) references public.financial_accounts(organization_id, id),
  foreign key (organization_id, data_source_id) references public.data_sources(organization_id, id),
  foreign key (organization_id, import_batch_id) references public.import_batches(organization_id, id)
);
create index financial_records_org_date_idx on public.financial_records(organization_id, transaction_date desc);
create index financial_records_batch_idx on public.financial_records(organization_id, import_batch_id);
create unique index financial_records_dedupe_idx on public.financial_records(organization_id, deduplication_key) where deduplication_key is not null;

create table public.validation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_batch_id uuid,
  validator_name text not null,
  validator_version text not null,
  outcome text not null check (outcome in ('passed','passed_with_warnings','failed')),
  summary jsonb not null default '{}'::jsonb,
  executed_by uuid references auth.users(id),
  executed_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, import_batch_id) references public.import_batches(organization_id, id)
);

create table public.evidence_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_artifact_id uuid,
  financial_record_id uuid,
  evidence_type text not null,
  content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[a-f0-9]{64}$'),
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, source_artifact_id) references public.source_artifacts(organization_id, id),
  foreign key (organization_id, financial_record_id) references public.financial_records(organization_id, id)
);

create table public.attestations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  evidence_record_id uuid not null,
  protocol text not null default 'UEAP-GATEWAY',
  contract_version text not null,
  event_hash text not null check (event_hash ~ '^[a-f0-9]{64}$'),
  issuer text,
  signature_reference text,
  registry_reference text,
  status public.rsbuild_attestation_status not null default 'pending',
  attested_at timestamptz,
  response_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, evidence_record_id) references public.evidence_records(organization_id, id)
);

create table public.integration_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data_source_id uuid,
  target_system text not null,
  adapter_version text not null,
  mode text not null default 'read_only' check (mode in ('read_only','dry_run','write_authorized')),
  status text not null default 'pending' check (status in ('pending','running','succeeded','partial','failed','cancelled')),
  started_at timestamptz,
  finished_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, data_source_id) references public.data_sources(organization_id, id)
);

create table public.integration_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_run_id uuid not null,
  financial_record_id uuid,
  external_record_id text,
  outcome text not null check (outcome in ('matched','unmatched','rejected','error')),
  payload_hash text check (payload_hash is null or payload_hash ~ '^[a-f0-9]{64}$'),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (organization_id, integration_run_id) references public.integration_runs(organization_id, id),
  foreign key (organization_id, financial_record_id) references public.financial_records(organization_id, id)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id),
  event_type text not null,
  entity_type text not null,
  entity_id text,
  occurred_at timestamptz not null default now(),
  correlation_id uuid,
  metadata jsonb not null default '{}'::jsonb
);
create index audit_events_org_time_idx on public.audit_events(organization_id, occurred_at desc);

-- RLS: membership is the tenant boundary. No user_metadata claims are trusted.
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.data_sources enable row level security;
alter table public.import_batches enable row level security;
alter table public.source_artifacts enable row level security;
alter table public.financial_records enable row level security;
alter table public.validation_runs enable row level security;
alter table public.evidence_records enable row level security;
alter table public.attestations enable row level security;
alter table public.integration_runs enable row level security;
alter table public.integration_records enable row level security;
alter table public.audit_events enable row level security;

create policy "members can read their organizations" on public.organizations for select to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = id and m.user_id = (select auth.uid())));
create policy "members can read their own memberships" on public.organization_memberships for select to authenticated
using (user_id = (select auth.uid()));

-- Membership role gates write access. Organization and membership provisioning stays server-controlled.
create policy "operators manage financial accounts" on public.financial_accounts for all to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = financial_accounts.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')))
with check (exists (select 1 from public.organization_memberships m where m.organization_id = financial_accounts.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));
create policy "members read financial accounts" on public.financial_accounts for select to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = financial_accounts.organization_id and m.user_id = (select auth.uid())));

create policy "operators manage data sources" on public.data_sources for all to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = data_sources.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')))
with check (exists (select 1 from public.organization_memberships m where m.organization_id = data_sources.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));
create policy "members read data sources" on public.data_sources for select to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = data_sources.organization_id and m.user_id = (select auth.uid())));

create policy "operators manage import batches" on public.import_batches for all to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = import_batches.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')))
with check (exists (select 1 from public.organization_memberships m where m.organization_id = import_batches.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));
create policy "members read import batches" on public.import_batches for select to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = import_batches.organization_id and m.user_id = (select auth.uid())));

create policy "operators manage source artifacts" on public.source_artifacts for all to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = source_artifacts.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')))
with check (exists (select 1 from public.organization_memberships m where m.organization_id = source_artifacts.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));
create policy "members read source artifacts" on public.source_artifacts for select to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = source_artifacts.organization_id and m.user_id = (select auth.uid())));

create policy "operators manage financial records" on public.financial_records for all to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = financial_records.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')))
with check (exists (select 1 from public.organization_memberships m where m.organization_id = financial_records.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));
create policy "members read financial records" on public.financial_records for select to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = financial_records.organization_id and m.user_id = (select auth.uid())));

create policy "members read validation runs" on public.validation_runs for select to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = validation_runs.organization_id and m.user_id = (select auth.uid())));
create policy "operators create validation runs" on public.validation_runs for insert to authenticated
with check (exists (select 1 from public.organization_memberships m where m.organization_id = validation_runs.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));

create policy "members read evidence" on public.evidence_records for select to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = evidence_records.organization_id and m.user_id = (select auth.uid())));
create policy "operators create evidence" on public.evidence_records for insert to authenticated
with check (exists (select 1 from public.organization_memberships m where m.organization_id = evidence_records.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));

create policy "members read attestations" on public.attestations for select to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = attestations.organization_id and m.user_id = (select auth.uid())));
create policy "operators request attestations" on public.attestations for insert to authenticated
with check (exists (select 1 from public.organization_memberships m where m.organization_id = attestations.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));

create policy "members read integration runs" on public.integration_runs for select to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = integration_runs.organization_id and m.user_id = (select auth.uid())));
create policy "operators create integration runs" on public.integration_runs for insert to authenticated
with check (exists (select 1 from public.organization_memberships m where m.organization_id = integration_runs.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));
create policy "members read integration records" on public.integration_records for select to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = integration_records.organization_id and m.user_id = (select auth.uid())));
create policy "operators create integration records" on public.integration_records for insert to authenticated
with check (exists (select 1 from public.organization_memberships m where m.organization_id = integration_records.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));

create policy "members read audit events" on public.audit_events for select to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = audit_events.organization_id and m.user_id = (select auth.uid())));
create policy "operators append audit events" on public.audit_events for insert to authenticated
with check (actor_id = (select auth.uid()) and exists (select 1 from public.organization_memberships m where m.organization_id = audit_events.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));

-- Private bucket. Object paths must start with the tenant UUID.
insert into storage.buckets (id, name, public, file_size_limit)
values ('rsbuild-source-artifacts', 'rsbuild-source-artifacts', false, 10485760)
on conflict (id) do nothing;

create policy "tenant members read source files" on storage.objects for select to authenticated
using (bucket_id = 'rsbuild-source-artifacts' and exists (
  select 1 from public.organization_memberships m
  where m.user_id = (select auth.uid())
    and m.organization_id::text = (storage.foldername(name))[1]
));
create policy "tenant operators upload source files" on storage.objects for insert to authenticated
with check (bucket_id = 'rsbuild-source-artifacts' and exists (
  select 1 from public.organization_memberships m
  where m.user_id = (select auth.uid())
    and m.organization_id::text = (storage.foldername(name))[1]
    and m.role in ('owner','admin','operator')
));
create policy "tenant operators update source files" on storage.objects for update to authenticated
using (bucket_id = 'rsbuild-source-artifacts' and exists (
  select 1 from public.organization_memberships m
  where m.user_id = (select auth.uid())
    and m.organization_id::text = (storage.foldername(name))[1]
    and m.role in ('owner','admin','operator')
))
with check (bucket_id = 'rsbuild-source-artifacts' and exists (
  select 1 from public.organization_memberships m
  where m.user_id = (select auth.uid())
    and m.organization_id::text = (storage.foldername(name))[1]
    and m.role in ('owner','admin','operator')
));

-- Explicit grants: new public tables are not automatically exposed by default.
grant usage on schema public to authenticated;
grant select on public.organizations, public.organization_memberships to authenticated;
grant select, insert, update, delete on
  public.financial_accounts, public.data_sources, public.import_batches,
  public.source_artifacts, public.financial_records to authenticated;
grant select, insert on
  public.validation_runs, public.evidence_records, public.attestations,
  public.integration_runs, public.integration_records, public.audit_events to authenticated;
grant usage, select on sequence public.audit_events_id_seq to authenticated;
