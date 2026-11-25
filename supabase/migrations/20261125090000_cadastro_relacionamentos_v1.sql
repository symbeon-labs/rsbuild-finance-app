-- Cadastro de Relacionamentos V1
-- Tenant-scoped records. No global directory or cross-tenant sharing in V1.

create table if not exists public.organization_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document text,
  legal_name text not null,
  trade_name text,
  relationship_types text[] not null default '{}'::text[],
  state_registration text,
  email text,
  phone text,
  street_address text,
  city text,
  state text,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  notes text,
  source text not null default 'manual',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_relationships_name_check check (length(trim(legal_name)) between 2 and 180),
  constraint organization_relationships_types_check check (
    cardinality(relationship_types) > 0
    and relationship_types <@ array[
      'cliente','fornecedor','transportadora','parceiro_comercial',
      'prestador_servico','distribuidor','outros'
    ]::text[]
  ),
  constraint organization_relationships_state_check check (state is null or state ~ '^[A-Z]{2}$'),
  constraint organization_relationships_email_check check (email is null or length(email) <= 254),
  constraint organization_relationships_phone_check check (phone is null or length(phone) <= 40),
  constraint organization_relationships_document_check check (
    document is null or document ~ '^[0-9A-Z]{11}$' or document ~ '^[0-9A-Z]{14}$'
  )
);

create unique index if not exists organization_relationships_document_unique
  on public.organization_relationships (organization_id, document)
  where document is not null;

create index if not exists organization_relationships_org_status_idx
  on public.organization_relationships (organization_id, status, legal_name);

create table if not exists public.organization_relationship_events (
  id bigint generated always as identity primary key,
  relationship_id uuid not null references public.organization_relationships(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('created','updated','status_changed')),
  changed_fields text[] not null default '{}'::text[],
  occurred_at timestamptz not null default now()
);

create index if not exists organization_relationship_events_org_time_idx
  on public.organization_relationship_events (organization_id, occurred_at desc);

alter table public.organization_relationships enable row level security;
alter table public.organization_relationship_events enable row level security;

revoke all on public.organization_relationships, public.organization_relationship_events from anon;
revoke all on public.organization_relationships, public.organization_relationship_events from public;
grant select, insert, update on public.organization_relationships to authenticated;
grant select on public.organization_relationship_events to authenticated;
grant usage, select on sequence public.organization_relationship_events_id_seq to authenticated;

drop policy if exists "Organization members read relationships" on public.organization_relationships;
create policy "Organization members read relationships"
  on public.organization_relationships for select to authenticated
  using (organization_id in (
    select m.organization_id from public.organization_memberships m
    where m.user_id = (select auth.uid())
  ));

drop policy if exists "Organization operators create relationships" on public.organization_relationships;
create policy "Organization operators create relationships"
  on public.organization_relationships for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and organization_id in (
      select m.organization_id from public.organization_memberships m
      where m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')
    )
  );

drop policy if exists "Organization operators update relationships" on public.organization_relationships;
create policy "Organization operators update relationships"
  on public.organization_relationships for update to authenticated
  using (organization_id in (
    select m.organization_id from public.organization_memberships m
    where m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')
  ))
  with check (
    updated_by = (select auth.uid())
    and organization_id in (
      select m.organization_id from public.organization_memberships m
      where m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')
    )
  );

drop policy if exists "Organization members read relationship events" on public.organization_relationship_events;
create policy "Organization members read relationship events"
  on public.organization_relationship_events for select to authenticated
  using (organization_id in (
    select m.organization_id from public.organization_memberships m
    where m.user_id = (select auth.uid())
  ));

create or replace function public.record_organization_relationship_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed text[] := '{}'::text[];
  v_event text := 'created';
begin
  if tg_op = 'UPDATE' then
    v_event := case when old.status is distinct from new.status then 'status_changed' else 'updated' end;
    if old.document is distinct from new.document then v_changed := array_append(v_changed, 'document'); end if;
    if old.legal_name is distinct from new.legal_name then v_changed := array_append(v_changed, 'legal_name'); end if;
    if old.trade_name is distinct from new.trade_name then v_changed := array_append(v_changed, 'trade_name'); end if;
    if old.relationship_types is distinct from new.relationship_types then v_changed := array_append(v_changed, 'relationship_types'); end if;
    if old.state_registration is distinct from new.state_registration then v_changed := array_append(v_changed, 'state_registration'); end if;
    if old.email is distinct from new.email then v_changed := array_append(v_changed, 'email'); end if;
    if old.phone is distinct from new.phone then v_changed := array_append(v_changed, 'phone'); end if;
    if old.street_address is distinct from new.street_address then v_changed := array_append(v_changed, 'street_address'); end if;
    if old.city is distinct from new.city then v_changed := array_append(v_changed, 'city'); end if;
    if old.state is distinct from new.state then v_changed := array_append(v_changed, 'state'); end if;
    if old.status is distinct from new.status then v_changed := array_append(v_changed, 'status'); end if;
    if old.notes is distinct from new.notes then v_changed := array_append(v_changed, 'notes'); end if;
    if old.source is distinct from new.source then v_changed := array_append(v_changed, 'source'); end if;
    if cardinality(v_changed) = 0 then return new; end if;
  else
    v_changed := array['record'];
  end if;

  insert into public.organization_relationship_events
    (relationship_id, organization_id, actor_id, event_type, changed_fields)
  values
    (new.id, new.organization_id, coalesce(new.updated_by, new.created_by), v_event, v_changed);
  return new;
end;
$$;

drop trigger if exists organization_relationships_audit on public.organization_relationships;
create trigger organization_relationships_audit
  after insert or update on public.organization_relationships
  for each row execute function public.record_organization_relationship_event();

comment on table public.organization_relationships is
  'V1 relationship registry, strictly scoped to one organization. Cross-tenant sharing is not implemented.';
comment on table public.organization_relationship_events is
  'Append-only field-level audit trail; values are intentionally not duplicated here.';

revoke all on function public.record_organization_relationship_event() from public, anon, authenticated;
