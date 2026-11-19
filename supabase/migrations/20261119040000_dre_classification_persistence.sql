-- DRE classification persistence with tenant isolation and append-only decision history.
create table if not exists public.dre_classifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  financial_record_id uuid not null,
  account_code text not null check (account_code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  treatment text not null check (treatment in ('pnl','balance_sheet','financing','equity','receivable','ignore')),
  confidence numeric(5,4) not null check (confidence >= 0 and confidence <= 1),
  status text not null check (status in ('suggested','review','excluded','overridden')),
  reason text not null check (char_length(btrim(reason)) between 1 and 2000),
  source text not null check (source in ('rule','manual')),
  rule_version text not null default 'dre-rules-v1',
  allocations jsonb not null default '[]'::jsonb
    check (jsonb_typeof(allocations) = 'array' and jsonb_array_length(allocations) <= 3),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, financial_record_id),
  foreign key (organization_id, financial_record_id)
    references public.financial_records(organization_id, id) on delete cascade
);
create index if not exists dre_classifications_org_status_idx
  on public.dre_classifications(organization_id, status, updated_at desc);

create table if not exists public.dre_classification_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  financial_record_id uuid not null,
  classification_id uuid not null references public.dre_classifications(id) on delete cascade,
  actor_id uuid references auth.users(id),
  event_type text not null check (event_type in ('suggested','approved','reclassified','excluded')),
  previous_state jsonb,
  new_state jsonb not null,
  reason text not null check (char_length(btrim(reason)) between 1 and 2000),
  created_at timestamptz not null default now(),
  foreign key (organization_id, financial_record_id)
    references public.financial_records(organization_id, id) on delete cascade
);
create index if not exists dre_classification_events_org_record_idx
  on public.dre_classification_events(organization_id, financial_record_id, created_at desc);

alter table public.dre_classifications enable row level security;
alter table public.dre_classification_events enable row level security;

drop policy if exists "members read DRE classifications" on public.dre_classifications;
create policy "members read DRE classifications" on public.dre_classifications
for select to authenticated using (
  exists (select 1 from public.organization_memberships m
    where m.organization_id = dre_classifications.organization_id
      and m.user_id = (select auth.uid()))
);

drop policy if exists "members read DRE classification events" on public.dre_classification_events;
create policy "members read DRE classification events" on public.dre_classification_events
for select to authenticated using (
  exists (select 1 from public.organization_memberships m
    where m.organization_id = dre_classification_events.organization_id
      and m.user_id = (select auth.uid()))
);

revoke all on public.dre_classifications from anon, authenticated;
grant select on public.dre_classifications to authenticated;
revoke all on public.dre_classification_events from anon, authenticated;
grant select on public.dre_classification_events to authenticated;

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
security invoker
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.rsbuild_member_role;
  v_existing public.dre_classifications%rowtype;
  v_saved public.dre_classifications%rowtype;
  v_previous jsonb;
  v_new jsonb;
  v_event text;
begin
  if v_actor is null then raise exception 'unauthenticated' using errcode = '42501'; end if;
  select role into v_role from public.organization_memberships
    where organization_id = p_organization_id and user_id = v_actor;
  if v_role is null then raise exception 'organization_access_denied' using errcode = '42501'; end if;
  if v_role not in ('owner','admin','operator') then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;
  if p_status not in ('suggested','review','excluded','overridden')
    or p_treatment not in ('pnl','balance_sheet','financing','equity','receivable','ignore')
    or p_source not in ('rule','manual')
    or p_confidence < 0 or p_confidence > 1
    or p_reason is null or char_length(btrim(p_reason)) not between 1 and 2000
    or p_rule_version is null or char_length(p_rule_version) > 80
    or jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations) > 3 then
    raise exception 'invalid_classification_payload' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.financial_records
    where organization_id = p_organization_id and id = p_financial_record_id
  ) then raise exception 'financial_record_not_found' using errcode = 'P0002'; end if;

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
    when p_source = 'manual' and v_previous is null then 'approved'
    when p_source = 'manual' then 'reclassified'
    when p_status = 'excluded' then 'excluded'
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
