-- D02 post-deployment refinement: FK indexes and command-specific RLS policies.

create index attestations_org_evidence_idx on public.attestations(organization_id, evidence_record_id);
create index audit_events_actor_idx on public.audit_events(actor_id);
create index evidence_records_created_by_idx on public.evidence_records(created_by);
create index evidence_records_org_financial_idx on public.evidence_records(organization_id, financial_record_id);
create index evidence_records_org_artifact_idx on public.evidence_records(organization_id, source_artifact_id);
create index financial_records_created_by_idx on public.financial_records(created_by);
create index financial_records_org_account_idx on public.financial_records(organization_id, account_id);
create index financial_records_org_source_idx on public.financial_records(organization_id, data_source_id);
create index import_batches_org_source_idx on public.import_batches(organization_id, data_source_id);
create index import_batches_received_by_idx on public.import_batches(received_by);
create index integration_records_financial_record_idx on public.integration_records(financial_record_id);
create index integration_records_org_idx on public.integration_records(organization_id);
create index integration_records_org_run_idx on public.integration_records(organization_id, integration_run_id);
create index integration_records_org_financial_record_idx on public.integration_records(organization_id, financial_record_id);
create index integration_runs_created_by_idx on public.integration_runs(created_by);
create index integration_runs_org_source_idx on public.integration_runs(organization_id, data_source_id);
create index source_artifacts_created_by_idx on public.source_artifacts(created_by);
create index source_artifacts_org_batch_idx on public.source_artifacts(organization_id, import_batch_id);
create index validation_runs_executed_by_idx on public.validation_runs(executed_by);
create index validation_runs_org_batch_idx on public.validation_runs(organization_id, import_batch_id);

drop policy "operators manage financial accounts" on public.financial_accounts;
create policy "operators insert financial accounts" on public.financial_accounts for insert to authenticated
with check (exists (select 1 from public.organization_memberships m where m.organization_id = financial_accounts.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));
create policy "operators update financial accounts" on public.financial_accounts for update to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = financial_accounts.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')))
with check (exists (select 1 from public.organization_memberships m where m.organization_id = financial_accounts.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));
create policy "operators delete financial accounts" on public.financial_accounts for delete to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = financial_accounts.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));

drop policy "operators manage data sources" on public.data_sources;
create policy "operators insert data sources" on public.data_sources for insert to authenticated
with check (exists (select 1 from public.organization_memberships m where m.organization_id = data_sources.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));
create policy "operators update data sources" on public.data_sources for update to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = data_sources.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')))
with check (exists (select 1 from public.organization_memberships m where m.organization_id = data_sources.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));
create policy "operators delete data sources" on public.data_sources for delete to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = data_sources.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));

drop policy "operators manage import batches" on public.import_batches;
create policy "operators insert import batches" on public.import_batches for insert to authenticated
with check (exists (select 1 from public.organization_memberships m where m.organization_id = import_batches.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));
create policy "operators update import batches" on public.import_batches for update to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = import_batches.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')))
with check (exists (select 1 from public.organization_memberships m where m.organization_id = import_batches.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));
create policy "operators delete import batches" on public.import_batches for delete to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = import_batches.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));

drop policy "operators manage source artifacts" on public.source_artifacts;
create policy "operators insert source artifacts" on public.source_artifacts for insert to authenticated
with check (exists (select 1 from public.organization_memberships m where m.organization_id = source_artifacts.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));
create policy "operators update source artifacts" on public.source_artifacts for update to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = source_artifacts.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')))
with check (exists (select 1 from public.organization_memberships m where m.organization_id = source_artifacts.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));
create policy "operators delete source artifacts" on public.source_artifacts for delete to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = source_artifacts.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));

drop policy "operators manage financial records" on public.financial_records;
create policy "operators insert financial records" on public.financial_records for insert to authenticated
with check (exists (select 1 from public.organization_memberships m where m.organization_id = financial_records.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));
create policy "operators update financial records" on public.financial_records for update to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = financial_records.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')))
with check (exists (select 1 from public.organization_memberships m where m.organization_id = financial_records.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));
create policy "operators delete financial records" on public.financial_records for delete to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = financial_records.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));
