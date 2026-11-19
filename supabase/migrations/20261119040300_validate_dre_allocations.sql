-- Validate that allocations are bounded to known units and exactly conserve source value.
create or replace function public.save_dre_classification(
  p_organization_id uuid,
  p_financial_record_id uuid,
  p_account_code text,
  p_treatment text,
  p_confidence numeric,
  p_status text,
  p_reason text,
  p_source text,
  p_rule_version text,
  p_allocations jsonb
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.rsbuild_member_role;
  v_existing public.dre_classifications%rowtype;
  v_saved public.dre_classifications%rowtype;
  v_previous jsonb;
  v_new jsonb;
  v_event text;
  v_record_amount bigint;
  v_allocation_sum bigint;
  v_invalid_allocation boolean;
begin
  if v_actor is null then raise exception 'unauthenticated' using errcode = '42501'; end if;
  select role into v_role from public.organization_memberships
    where organization_id = p_organization_id and user_id = v_actor;
  if v_role is null then raise exception 'organization_access_denied' using errcode = '42501'; end if;
  if v_role not in ('owner','admin','operator') then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;
  if p_account_code !~ '^[A-Z][A-Z0-9_]{1,63}$'
    or p_status not in ('suggested','review','excluded','overridden')
    or p_treatment not in ('pnl','balance_sheet','financing','equity','receivable','ignore')
    or p_source not in ('rule','manual')
    or p_confidence < 0 or p_confidence > 1
    or p_reason is null or char_length(btrim(p_reason)) not between 1 and 2000
    or p_rule_version is null or char_length(p_rule_version) > 80
    or jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations) > 3 then
    raise exception 'invalid_classification_payload' using errcode = '22023';
  end if;

  select amount_minor into v_record_amount from public.financial_records
    where organization_id = p_organization_id and id = p_financial_record_id;
  if not found then raise exception 'financial_record_not_found' using errcode = 'P0002'; end if;

  select
    coalesce(sum(case when (value->>'amountMinor') ~ '^[0-9]+$' then (value->>'amountMinor')::bigint else 0 end),0),
    coalesce(bool_or(
      jsonb_typeof(value) <> 'object'
      or (value->>'unit') not in ('ALS/CSN','P&L','RRT')
      or coalesce(value->>'amountMinor','') !~ '^[0-9]+$'
    ),false)
  into v_allocation_sum, v_invalid_allocation
  from jsonb_array_elements(p_allocations) as item(value);

  if p_treatment = 'pnl' and (v_invalid_allocation or v_allocation_sum <> v_record_amount) then
    raise exception 'invalid_dre_allocation_total' using errcode = '22023';
  end if;
  if p_treatment <> 'pnl' and jsonb_array_length(p_allocations) <> 0 then
    raise exception 'non_pnl_classification_cannot_have_allocations' using errcode = '22023';
  end if;

  select * into v_existing from public.dre_classifications
    where organization_id = p_organization_id and financial_record_id = p_financial_record_id
    for update;
  if found then v_previous := to_jsonb(v_existing); end if;

  insert into public.dre_classifications (
    organization_id, financial_record_id, account_code, treatment, confidence,
    status, reason, source, rule_version, allocations, reviewed_by, reviewed_at, updated_at
  ) values (
    p_organization_id, p_financial_record_id, p_account_code, p_treatment, p_confidence,
    p_status, btrim(p_reason), p_source, p_rule_version, p_allocations,
    case when p_source = 'manual' then v_actor else null end,
    case when p_source = 'manual' then now() else null end,
    now()
  )
  on conflict (organization_id, financial_record_id) do update set
    account_code = excluded.account_code,
    treatment = excluded.treatment,
    confidence = excluded.confidence,
    status = excluded.status,
    reason = excluded.reason,
    source = excluded.source,
    rule_version = excluded.rule_version,
    allocations = excluded.allocations,
    reviewed_by = excluded.reviewed_by,
    reviewed_at = excluded.reviewed_at,
    updated_at = now()
  returning * into v_saved;

  v_new := to_jsonb(v_saved);
  v_event := case
    when p_status = 'excluded' then 'excluded'
    when p_source = 'manual' and v_previous is null then 'approved'
    when p_source = 'manual' then 'reclassified'
    else 'suggested'
  end;
  insert into public.dre_classification_events (
    organization_id, financial_record_id, classification_id, actor_id,
    event_type, previous_state, new_state, reason
  ) values (
    p_organization_id, p_financial_record_id, v_saved.id, v_actor,
    v_event, v_previous, v_new, btrim(p_reason)
  );
  return v_saved.id;
end;
$$;

revoke all on function public.save_dre_classification(uuid,uuid,text,text,numeric,text,text,text,text,jsonb) from public, anon;
grant execute on function public.save_dre_classification(uuid,uuid,text,text,numeric,text,text,text,text,jsonb) to authenticated;
