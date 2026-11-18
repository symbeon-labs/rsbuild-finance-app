-- Operational audit history: record row-level state transitions without storing full entity snapshots.
-- This migration is additive. It does not alter financial values, permissions, or tenant ownership.

create schema if not exists private;

create or replace function private.capture_operational_audit_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_old jsonb := '{}'::jsonb;
  v_new jsonb := '{}'::jsonb;
  v_organization_id uuid;
  v_entity_id text;
  v_actor_id uuid;
  v_event_type text;
  v_changed_fields text[] := array[]::text[];
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_allowed_fields text[] := array[
    'status',
    'amount_minor',
    'amount',
    'due_date',
    'delivery_date',
    'settlement_date',
    'category',
    'direction',
    'bank_account',
    'synced_to_omie',
    'payment_method',
    'total_amount_minor',
    'total_boxes',
    'confidence',
    'decision_type',
    'financial_record_id'
  ];
begin
  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_organization_id := (v_new ->> 'organization_id')::uuid;
    v_entity_id := v_new ->> 'id';

    select coalesce(array_agg(n.key order by n.key), array[]::text[])
      into v_changed_fields
    from jsonb_each(v_new) as n(key, value)
    where n.value is distinct from (v_old -> n.key)
      and n.key <> 'updated_at';

    if cardinality(v_changed_fields) = 0 then
      return new;
    end if;

    select coalesce(jsonb_object_agg(o.key, o.value), '{}'::jsonb)
      into v_before
    from jsonb_each(v_old) as o(key, value)
    where o.key = any(v_allowed_fields)
      and o.value is distinct from (v_new -> o.key);

    select coalesce(jsonb_object_agg(n.key, n.value), '{}'::jsonb)
      into v_after
    from jsonb_each(v_new) as n(key, value)
    where n.key = any(v_allowed_fields)
      and n.value is distinct from (v_old -> n.key);

    v_event_type := tg_argv[0] || '.updated';
    v_actor_id := auth.uid();

  elsif tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_organization_id := (v_new ->> 'organization_id')::uuid;
    v_entity_id := v_new ->> 'id';
    v_actor_id := coalesce(auth.uid(), nullif(v_new ->> 'actor_id', '')::uuid);
    v_event_type := tg_argv[0] || '.created';

    select coalesce(array_agg(n.key order by n.key), array[]::text[])
      into v_changed_fields
    from jsonb_each(v_new) as n(key, value)
    where n.key = any(v_allowed_fields);

    select coalesce(jsonb_object_agg(n.key, n.value), '{}'::jsonb)
      into v_after
    from jsonb_each(v_new) as n(key, value)
    where n.key = any(v_allowed_fields);
  else
    raise exception 'Unsupported audit trigger operation: %', tg_op;
  end if;

  insert into public.audit_events (
    organization_id,
    actor_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_organization_id,
    v_actor_id,
    v_event_type,
    tg_argv[0],
    v_entity_id,
    jsonb_build_object(
      'schemaVersion', 1,
      'source', 'database_trigger',
      'changedFields', to_jsonb(v_changed_fields),
      'before', v_before,
      'after', v_after,
      'actorType', case when v_actor_id is null then 'system' else 'user' end
    )
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

revoke all on function private.capture_operational_audit_event() from public, anon, authenticated;

drop trigger if exists audit_financial_records_update on public.financial_records;
create trigger audit_financial_records_update
after update on public.financial_records
for each row execute function private.capture_operational_audit_event('financial_record');

drop trigger if exists audit_receivable_titles_update on public.receivable_titles;
create trigger audit_receivable_titles_update
after update on public.receivable_titles
for each row execute function private.capture_operational_audit_event('receivable_title');

drop trigger if exists audit_delivery_proofs_update on public.delivery_proofs;
create trigger audit_delivery_proofs_update
after update on public.delivery_proofs
for each row execute function private.capture_operational_audit_event('delivery_proof');

drop trigger if exists audit_whatsapp_orders_update on public.whatsapp_orders;
create trigger audit_whatsapp_orders_update
after update on public.whatsapp_orders
for each row execute function private.capture_operational_audit_event('whatsapp_order');

drop trigger if exists audit_settlements_update on public.settlements;
create trigger audit_settlements_update
after update on public.settlements
for each row execute function private.capture_operational_audit_event('settlement');

-- Decisions are append-only operational facts; capture each decision with its stable ID.
drop trigger if exists audit_reconciliation_decisions_insert on public.reconciliation_decisions;
create trigger audit_reconciliation_decisions_insert
after insert on public.reconciliation_decisions
for each row execute function private.capture_operational_audit_event('reconciliation_decision');
