-- Universal bank identity and account traceability for CSV/OFX imports.
-- Raw bank identifiers are retained even when the institution is not in the registry.
alter table public.financial_accounts
  add column if not exists bank_code text,
  add column if not exists branch_id text;

create index if not exists financial_accounts_org_bank_identity_idx
  on public.financial_accounts (organization_id, bank_code, external_reference);

create index if not exists data_sources_org_bank_provider_idx
  on public.data_sources (organization_id, source_type, provider);

comment on column public.financial_accounts.bank_code is
  'Original institution identifier supplied by the source file (e.g. OFX BANKID); may be unknown to the registry.';
comment on column public.financial_accounts.branch_id is
  'Original branch identifier supplied by the source file; null when absent.';
