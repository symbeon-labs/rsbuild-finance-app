-- Reconciled from remote migration history (applied out-of-band on 2026-11-19).
-- Read-only cash-basis DRE source views; security_invoker keeps financial_records RLS enforced.

create or replace view public.dre_cash_movements_v1
with (security_invoker = true)
as
select
  fr.id as financial_record_id,
  fr.organization_id,
  fr.account_id,
  coalesce(fa.name, nullif(fa.institution, ''), ib.original_filename, 'Conta não identificada') as account_label,
  fr.import_batch_id,
  fr.transaction_date,
  fr.description,
  fr.direction::text as direction,
  fr.amount_minor,
  (fr.amount_minor::numeric / 100) as amount_brl,
  fr.currency,
  fr.category,
  fr.status,
  fr.source_record_id,
  fr.created_at
from public.financial_records fr
left join public.financial_accounts fa
  on fa.organization_id = fr.organization_id
 and fa.id = fr.account_id
left join public.import_batches ib
  on ib.organization_id = fr.organization_id
 and ib.id = fr.import_batch_id
where
  upper(coalesce(fr.description, '')) !~ 'SALDO (TOTAL )?DISPON[IÍ]VEL DIA'
  and upper(coalesce(fr.description, '')) !~ 'SALDO (ANTERIOR|INICIAL|DE ABERTURA)';

create or replace view public.dre_cash_daily_summary_v1
with (security_invoker = true)
as
select
  organization_id,
  account_id,
  account_label,
  transaction_date,
  count(*)::integer as movement_count,
  count(*) filter (where direction = 'entrada')::integer as incoming_count,
  count(*) filter (where direction = 'saída')::integer as outgoing_count,
  coalesce(sum(amount_minor) filter (where direction = 'entrada'), 0)::bigint as incoming_amount_minor,
  coalesce(sum(amount_minor) filter (where direction = 'saída'), 0)::bigint as outgoing_amount_minor,
  (
    coalesce(sum(amount_minor) filter (where direction = 'entrada'), 0)
    - coalesce(sum(amount_minor) filter (where direction = 'saída'), 0)
  )::bigint as net_amount_minor
from public.dre_cash_movements_v1
group by organization_id, account_id, account_label, transaction_date;

grant select on public.dre_cash_movements_v1 to authenticated;
grant select on public.dre_cash_daily_summary_v1 to authenticated;

comment on view public.dre_cash_movements_v1 is
'Read-only preliminary cash-basis DRE source. Excludes OFX daily balance snapshots and opening-balance pseudo-transactions. Uses invoker security so underlying financial_records RLS remains enforced.';
comment on view public.dre_cash_daily_summary_v1 is
'Read-only daily cash movement aggregates derived from dre_cash_movements_v1; not an accounting/tax P&L.';
