-- Complete the composite FK index for tenant-scoped integration record references.
create index integration_records_org_financial_record_idx
  on public.integration_records(organization_id, financial_record_id);
