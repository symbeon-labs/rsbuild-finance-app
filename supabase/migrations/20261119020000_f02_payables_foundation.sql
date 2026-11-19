-- F02: first-class accounts payable foundation.
-- Titles are obligations; payments are immutable allocations that may be partial
-- and may connect one bank movement to multiple payable titles.
-- No authenticated write policy is added in this foundation migration:
-- writes must be introduced through validated, tenant-scoped server actions.

create table public.payable_titles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_batch_id uuid,
  supplier_name text not null check (length(btrim(supplier_name)) between 1 and 200),
  supplier_document text,
  document_number text not null check (length(btrim(document_number)) between 1 and 100),
  issue_date date,
  due_date date not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'BRL' check (currency = 'BRL'),
  category text,
  cost_center text,
  bank_account text,
  payment_method text,
  recurrence_group_id uuid,
  recurrence_rule text,
  installment_number integer,
  installment_count integer,
  source_system text,
  source_reference text,
  deduplication_key text,
  status text not null default 'open' check (status in ('open', 'cancelled')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, import_batch_id)
    references public.import_batches(organization_id, id),
  check (
    (installment_number is null and installment_count is null)
    or (
      installment_number is not null and installment_count is not null
      and installment_number > 0 and installment_count > 0
      and installment_number <= installment_count
    )
  ),
  check (
    (recurrence_group_id is null and recurrence_rule is null)
    or (recurrence_group_id is not null and recurrence_rule is not null
        and length(btrim(recurrence_rule)) between 1 and 120)
  )
);

create index payable_titles_org_due_status_idx
  on public.payable_titles (organization_id, status, due_date);
create index payable_titles_org_supplier_idx
  on public.payable_titles (organization_id, supplier_name);
create unique index payable_titles_org_dedup_uidx
  on public.payable_titles (organization_id, deduplication_key)
  where deduplication_key is not null;
create unique index payable_titles_org_source_ref_uidx
  on public.payable_titles (organization_id, source_system, source_reference)
  where source_system is not null and source_reference is not null;

create table public.payable_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payable_title_id uuid not null,
  financial_record_id uuid,
  payment_date date not null,
  amount_minor bigint not null check (amount_minor > 0),
  payment_reference text,
  payment_method text,
  observation text,
  idempotency_key text,
  status text not null default 'confirmed' check (status in ('confirmed', 'reversed')),
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, payable_title_id)
    references public.payable_titles(organization_id, id),
  foreign key (organization_id, financial_record_id)
    references public.financial_records(organization_id, id),
  check (
    (status = 'confirmed' and reversed_at is null and reversed_by is null)
    or (status = 'reversed' and reversed_at is not null and reversed_by is not null)
  )
);

create index payable_allocations_org_title_date_idx
  on public.payable_payment_allocations (organization_id, payable_title_id, payment_date desc);
create index payable_allocations_org_record_idx
  on public.payable_payment_allocations (organization_id, financial_record_id)
  where financial_record_id is not null;
create unique index payable_allocations_org_idempotency_uidx
  on public.payable_payment_allocations (organization_id, idempotency_key)
  where idempotency_key is not null;
create unique index payable_allocations_org_record_title_uidx
  on public.payable_payment_allocations (organization_id, financial_record_id, payable_title_id)
  where financial_record_id is not null;

alter table public.payable_titles enable row level security;
alter table public.payable_payment_allocations enable row level security;

create policy "members read payable titles"
  on public.payable_titles for select to authenticated
  using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = payable_titles.organization_id
      and m.user_id = (select auth.uid())
  ));

create policy "members read payable allocations"
  on public.payable_payment_allocations for select to authenticated
  using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = payable_payment_allocations.organization_id
      and m.user_id = (select auth.uid())
  ));

comment on table public.payable_titles is
  'Supplier obligations. Paid/open balance is derived from confirmed payment allocations; due status is derived from due_date.';
comment on table public.payable_payment_allocations is
  'Immutable-in-intent payment allocations; supports partial payments and one bank movement allocated across multiple payable titles. Reversals retain history.';


-- Operational governance aligned with receivable_titles and settlements.
create trigger payable_titles_touch_updated_at before update on public.payable_titles for each row execute function private.touch_updated_at();
create trigger payable_titles_actor_guard before insert or update of created_by on public.payable_titles for each row execute function private.enforce_actor_attribution('created_by');
create trigger audit_payable_titles_insert after insert on public.payable_titles for each row execute function private.capture_operational_audit_event('payable_title');
create trigger audit_payable_titles_update after update on public.payable_titles for each row execute function private.capture_operational_audit_event('payable_title');
create trigger payable_allocations_actor_guard before insert or update of created_by on public.payable_payment_allocations for each row execute function private.enforce_actor_attribution('created_by');
create trigger payable_allocations_reversed_by_guard before insert or update of reversed_by on public.payable_payment_allocations for each row execute function private.enforce_actor_attribution('reversed_by');
create trigger audit_payable_allocations_insert after insert on public.payable_payment_allocations for each row execute function private.capture_operational_audit_event('payable_payment_allocation');
create trigger audit_payable_allocations_update after update on public.payable_payment_allocations for each row execute function private.capture_operational_audit_event('payable_payment_allocation');
