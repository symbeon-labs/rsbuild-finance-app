-- D02 security hardening.
-- This migration is intentionally additive and must run after the D02 baseline.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Client-submitted actor IDs are never trusted. On INSERT they are derived
-- from auth.uid(); on UPDATE their original value is immutable.
create or replace function private.enforce_actor_attribution()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    case tg_argv[0]
      when 'received_by' then new.received_by := auth.uid();
      when 'created_by' then new.created_by := auth.uid();
      when 'executed_by' then new.executed_by := auth.uid();
      when 'actor_id' then new.actor_id := auth.uid();
      else raise exception 'Unsupported attribution column: %', tg_argv[0];
    end case;
  else
    case tg_argv[0]
      when 'received_by' then new.received_by := old.received_by;
      when 'created_by' then new.created_by := old.created_by;
      when 'executed_by' then new.executed_by := old.executed_by;
      when 'actor_id' then new.actor_id := old.actor_id;
      else raise exception 'Unsupported attribution column: %', tg_argv[0];
    end case;
  end if;
  return new;
end;
$$;

create trigger import_batches_actor_guard
before insert or update of received_by on public.import_batches
for each row execute function private.enforce_actor_attribution('received_by');

create trigger source_artifacts_actor_guard
before insert or update of created_by on public.source_artifacts
for each row execute function private.enforce_actor_attribution('created_by');

create trigger financial_records_actor_guard
before insert or update of created_by on public.financial_records
for each row execute function private.enforce_actor_attribution('created_by');

create trigger validation_runs_actor_guard
before insert or update of executed_by on public.validation_runs
for each row execute function private.enforce_actor_attribution('executed_by');

create trigger evidence_records_actor_guard
before insert or update of created_by on public.evidence_records
for each row execute function private.enforce_actor_attribution('created_by');

create trigger integration_runs_actor_guard
before insert or update of created_by on public.integration_runs
for each row execute function private.enforce_actor_attribution('created_by');

create trigger audit_events_actor_guard
before insert or update of actor_id on public.audit_events
for each row execute function private.enforce_actor_attribution('actor_id');

-- A stored artifact must always point into its own tenant folder and the
-- dedicated private bucket. This protects DB references independently of
-- Storage object policies.
alter table public.source_artifacts
  add constraint source_artifacts_bucket_check
  check (storage_bucket = 'rsbuild-source-artifacts'),
  add constraint source_artifacts_tenant_path_check
  check (
    storage_path <> ''
    and left(storage_path, length(organization_id::text) + 1)
      = organization_id::text || '/'
    and length(storage_path) > length(organization_id::text) + 1
  );

-- Remove broad policies from the first refinement. Rebuild explicit actions.
drop policy if exists "operators manage financial accounts" on public.financial_accounts;
drop policy if exists "operators insert financial accounts" on public.financial_accounts;
drop policy if exists "operators update financial accounts" on public.financial_accounts;
drop policy if exists "operators delete financial accounts" on public.financial_accounts;
drop policy if exists "operators manage data sources" on public.data_sources;
drop policy if exists "operators insert data sources" on public.data_sources;
drop policy if exists "operators update data sources" on public.data_sources;
drop policy if exists "operators delete data sources" on public.data_sources;
drop policy if exists "operators manage import batches" on public.import_batches;
drop policy if exists "operators insert import batches" on public.import_batches;
drop policy if exists "operators update import batches" on public.import_batches;
drop policy if exists "operators delete import batches" on public.import_batches;
drop policy if exists "operators manage source artifacts" on public.source_artifacts;
drop policy if exists "operators insert source artifacts" on public.source_artifacts;
drop policy if exists "operators update source artifacts" on public.source_artifacts;
drop policy if exists "operators delete source artifacts" on public.source_artifacts;
drop policy if exists "operators manage financial records" on public.financial_records;
drop policy if exists "operators insert financial records" on public.financial_records;
drop policy if exists "operators update financial records" on public.financial_records;
drop policy if exists "operators delete financial records" on public.financial_records;

create policy "operators insert financial accounts" on public.financial_accounts
for insert to authenticated
with check (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = financial_accounts.organization_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin','operator')
));
create policy "operators update financial accounts" on public.financial_accounts
for update to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = financial_accounts.organization_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin','operator')
))
with check (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = financial_accounts.organization_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin','operator')
));

create policy "operators insert data sources" on public.data_sources
for insert to authenticated
with check (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = data_sources.organization_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin','operator')
));
create policy "operators update data sources" on public.data_sources
for update to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = data_sources.organization_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin','operator')
))
with check (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = data_sources.organization_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin','operator')
));

create policy "operators insert import batches" on public.import_batches
for insert to authenticated
with check (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = import_batches.organization_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin','operator')
));

create policy "operators insert source artifacts" on public.source_artifacts
for insert to authenticated
with check (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = source_artifacts.organization_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin','operator')
));

create policy "operators insert financial records" on public.financial_records
for insert to authenticated
with check (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = financial_records.organization_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin','operator')
));
create policy "operators update financial records" on public.financial_records
for update to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = financial_records.organization_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin','operator')
))
with check (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = financial_records.organization_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin','operator')
));

-- No client-side deletion of source, batch, account, or financial history.
revoke delete on public.financial_accounts, public.data_sources,
  public.import_batches, public.source_artifacts, public.financial_records
from authenticated;

-- Batch state, source artifact metadata, and validation/integration outcomes
-- are server-managed. Operators may create records, not forge workflow state.
revoke update on public.import_batches, public.source_artifacts,
  public.validation_runs, public.evidence_records, public.attestations,
  public.integration_runs, public.integration_records
from authenticated;

-- Financial operators can edit only classification/reconciliation fields.
revoke update on public.financial_records from authenticated;
grant update (category, status) on public.financial_records to authenticated;

-- Audit events are append-only and written by the trusted server, never by
-- browser clients. service_role bypasses RLS and retains its platform grants.
drop policy if exists "operators append audit events" on public.audit_events;
revoke insert, update, delete on public.audit_events from authenticated;

-- Objects are immutable through the client after upload. No update/delete
-- policy is granted; a replacement must be a new artifact/version.
drop policy if exists "tenant operators update source files" on storage.objects;

-- Ensure the authenticated role cannot alter the workflow or delete history.
