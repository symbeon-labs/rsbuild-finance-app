-- F01 security refinements:
--  1. enforce_actor_attribution preserva valor fornecido pelo service_role
--     (auth.uid() é NULL fora de contexto de usuário; antes zerava actor_id
--     dos eventos de auditoria escritos pelas rotas de API).
--  2. settlements perde DELETE: correção de baixa é via status 'estornada'.
--  3. updated_at automático nas tabelas mutáveis F01.
--  4. Actor guards nas tabelas F01 (created_by/actor_id não falsificáveis
--     via PostgREST direto com JWT de operador).

-- =====================================================================
-- 1. Actor attribution: coalesce preserva valor server-side confiável
-- =====================================================================
create or replace function private.enforce_actor_attribution()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    case tg_argv[0]
      when 'received_by' then new.received_by := coalesce(auth.uid(), new.received_by);
      when 'created_by' then new.created_by := coalesce(auth.uid(), new.created_by);
      when 'executed_by' then new.executed_by := coalesce(auth.uid(), new.executed_by);
      when 'actor_id' then new.actor_id := coalesce(auth.uid(), new.actor_id);
      else raise exception 'Unsupported attribution column: %', tg_argv[0];
    end case;
  else
    case tg_argv[0]
      when 'received_by' then new.received_by := old.received_by;
      when 'created_by' then new.created_by := old.created_by;
      when 'executed_by' then new.executed_by := old.executed_by;
      when 'actor_id' then new.actor_id := old.actor_id;
      else raise exception 'Unsupported attribution column: %', tg_argv[0];
    end case;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_actor_attribution() from public, anon, authenticated;

-- =====================================================================
-- 2. settlements: updated_at + split de policies (sem DELETE)
-- =====================================================================
alter table public.settlements
  add column if not exists updated_at timestamptz not null default now();

drop policy if exists "executives manage settlements" on public.settlements;

create policy "executives insert settlements" on public.settlements
for insert to authenticated
with check (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = settlements.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
);

create policy "executives update settlements" on public.settlements
for update to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = settlements.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
)
with check (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = settlements.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
);

-- =====================================================================
-- 3. Trigger genérico de updated_at
-- =====================================================================
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  -- clock_timestamp: horário real da modificação, não o início da transação
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

revoke all on function private.touch_updated_at() from public, anon, authenticated;

drop trigger if exists receivable_titles_touch_updated_at on public.receivable_titles;
create trigger receivable_titles_touch_updated_at
before update on public.receivable_titles
for each row execute function private.touch_updated_at();

drop trigger if exists delivery_proofs_touch_updated_at on public.delivery_proofs;
create trigger delivery_proofs_touch_updated_at
before update on public.delivery_proofs
for each row execute function private.touch_updated_at();

drop trigger if exists whatsapp_orders_touch_updated_at on public.whatsapp_orders;
create trigger whatsapp_orders_touch_updated_at
before update on public.whatsapp_orders
for each row execute function private.touch_updated_at();

drop trigger if exists settlements_touch_updated_at on public.settlements;
create trigger settlements_touch_updated_at
before update on public.settlements
for each row execute function private.touch_updated_at();

-- =====================================================================
-- 4. Actor guards nas tabelas F01 (padrão D02)
-- =====================================================================
drop trigger if exists receivable_titles_actor_guard on public.receivable_titles;
create trigger receivable_titles_actor_guard
before insert or update of created_by on public.receivable_titles
for each row execute function private.enforce_actor_attribution('created_by');

drop trigger if exists delivery_proofs_actor_guard on public.delivery_proofs;
create trigger delivery_proofs_actor_guard
before insert or update of created_by on public.delivery_proofs
for each row execute function private.enforce_actor_attribution('created_by');

drop trigger if exists whatsapp_orders_actor_guard on public.whatsapp_orders;
create trigger whatsapp_orders_actor_guard
before insert or update of created_by on public.whatsapp_orders
for each row execute function private.enforce_actor_attribution('created_by');

drop trigger if exists erp_snapshots_actor_guard on public.erp_snapshots;
create trigger erp_snapshots_actor_guard
before insert or update of created_by on public.erp_snapshots
for each row execute function private.enforce_actor_attribution('created_by');

drop trigger if exists settlements_actor_guard on public.settlements;
create trigger settlements_actor_guard
before insert or update of created_by on public.settlements
for each row execute function private.enforce_actor_attribution('created_by');

drop trigger if exists reconciliation_decisions_actor_guard on public.reconciliation_decisions;
create trigger reconciliation_decisions_actor_guard
before insert or update of actor_id on public.reconciliation_decisions
for each row execute function private.enforce_actor_attribution('actor_id');
