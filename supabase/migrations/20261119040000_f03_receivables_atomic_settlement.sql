-- F03 — Atomic receivables settlement confirmation.
-- The settlement row and receivable title state transition must commit or roll back together.

create unique index if not exists settlements_org_source_record_id_uidx
  on public.settlements (organization_id, source_record_id)
  where source_record_id is not null and btrim(source_record_id) <> '';

create or replace function public.confirm_receivable_settlements(
  p_organization_id uuid,
  p_settlements jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_item jsonb;
  v_title public.receivable_titles%rowtype;
  v_title_id uuid;
  v_amount_minor bigint;
  v_settlement_date date;
  v_source_record_id text;
  v_observation text;
  v_inserted integer := 0;
begin
  if v_actor_id is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  if p_organization_id is null
     or jsonb_typeof(p_settlements) <> 'array'
     or jsonb_array_length(p_settlements) = 0
     or jsonb_array_length(p_settlements) > 500 then
    raise exception 'invalid_settlements_payload' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = v_actor_id
      and m.role in ('owner', 'admin')
  ) then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  for v_item in select value from jsonb_array_elements(p_settlements)
  loop
    begin
      v_title_id := (v_item ->> 'receivableTitleId')::uuid;
      v_amount_minor := (v_item ->> 'amountMinor')::bigint;
      v_settlement_date := (v_item ->> 'settlementDate')::date;
    exception when others then
      raise exception 'invalid_settlement_item' using errcode = '22023';
    end;

    if v_amount_minor <= 0 then
      raise exception 'invalid_settlement_amount' using errcode = '22023';
    end if;

    select *
      into v_title
    from public.receivable_titles
    where id = v_title_id
      and organization_id = p_organization_id
    for update;

    if not found then
      raise exception 'receivable_title_not_found' using errcode = 'P0002';
    end if;

    if v_title.status <> 'pendente' then
      raise exception 'receivable_title_not_pending' using errcode = '55000';
    end if;

    v_source_record_id := nullif(left(btrim(coalesce(v_item ->> 'sourceRecordId', '')), 120), '');
    v_observation := nullif(left(coalesce(v_item ->> 'observation', ''), 2000), '');

    insert into public.settlements (
      organization_id, receivable_title_id, document_number, customer_name,
      amount_minor, settlement_date, source_record_id, observation, status, created_by
    ) values (
      p_organization_id, v_title.id, v_title.document_number, v_title.customer_name,
      v_amount_minor, v_settlement_date, v_source_record_id, v_observation, 'confirmada', v_actor_id
    );

    update public.receivable_titles
       set status = 'baixado', updated_at = now()
     where id = v_title.id
       and organization_id = p_organization_id;

    v_inserted := v_inserted + 1;
  end loop;

  return jsonb_build_object('insertedCount', v_inserted);
end;
$function$;

revoke all on function public.confirm_receivable_settlements(uuid, jsonb) from public, anon;
grant execute on function public.confirm_receivable_settlements(uuid, jsonb) to authenticated;
