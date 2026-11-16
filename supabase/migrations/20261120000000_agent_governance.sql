-- RSBUILD OS — Agent Governance Layer
-- RSBUILD is the control plane between AI agents and tenant workspaces.
-- Agents never get tenant membership; they act through explicit,
-- auditable, human-approved proposals (HITL).

-- 1) Agent registry ---------------------------------------------------------
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  description text,
  kind text not null default 'cognitive' check (kind in ('cognitive','automation','integration','monitoring')),
  status text not null default 'active' check (status in ('active','suspended','retired')),
  version text not null default '0.1.0',
  capabilities jsonb not null default '[]'::jsonb,
  protocol text not null default 'mcp' check (protocol in ('mcp','api','internal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Agent ↔ organization grants -------------------------------------------
-- Which tenants each agent may observe/propose for, and with which
-- capability subset. Revoking a grant does not delete history.
create table public.agent_organization_grants (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  capabilities jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active','suspended','revoked')),
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, organization_id)
);

-- 3) Agent action proposals (HITL queue) ------------------------------------
-- Agents propose; humans decide. Nothing executes on proposal alone.
create table public.agent_action_proposals (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  action_type text not null,
  title text not null,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','expired','executed')),
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  decision_reason text,
  executed_at timestamptz,
  correlation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agent_proposals_org_status_idx
  on public.agent_action_proposals(organization_id, status, requested_at desc);
create index agent_proposals_agent_idx
  on public.agent_action_proposals(agent_id, requested_at desc);

-- 4) Audit trail: distinguish actor kind ------------------------------------
alter table public.audit_events
  add column if not exists actor_kind text not null default 'user'
    check (actor_kind in ('user','agent','system')),
  add column if not exists agent_id uuid references public.agents(id) on delete set null;
create index if not exists audit_events_org_actor_kind_idx
  on public.audit_events(organization_id, actor_kind, occurred_at desc);

-- 5) RLS ---------------------------------------------------------------------
alter table public.agents enable row level security;
alter table public.agent_organization_grants enable row level security;
alter table public.agent_action_proposals enable row level security;

-- RSBUILD team members read the registry and grants.
create policy "RSBUILD members read agents" on public.agents for select to authenticated
using (exists (
  select 1 from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  where o.slug = 'rsbuild' and m.user_id = (select auth.uid())
));

create policy "RSBUILD members read agent grants" on public.agent_organization_grants for select to authenticated
using (exists (
  select 1 from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  where o.slug = 'rsbuild' and m.user_id = (select auth.uid())
));

-- Proposals: RSBUILD governance sees all; the target tenant sees only its own.
create policy "governance and tenant read proposals" on public.agent_action_proposals for select to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild' and m.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.organization_memberships tm
    where tm.organization_id = agent_action_proposals.organization_id
      and tm.user_id = (select auth.uid())
  )
);

-- Registry/grants writes: RSBUILD owner/admin only.
create policy "RSBUILD admins manage agents" on public.agents for all to authenticated
using (exists (
  select 1 from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  where o.slug = 'rsbuild' and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
))
with check (exists (
  select 1 from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  where o.slug = 'rsbuild' and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
));

create policy "RSBUILD admins manage agent grants" on public.agent_organization_grants for all to authenticated
using (exists (
  select 1 from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  where o.slug = 'rsbuild' and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
))
with check (exists (
  select 1 from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  where o.slug = 'rsbuild' and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
));

-- Proposal decisions: RSBUILD owner/admin OR owner/admin of the target tenant.
create policy "governance decides proposals" on public.agent_action_proposals for update to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild' and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  )
  or exists (
    select 1 from public.organization_memberships tm
    where tm.organization_id = agent_action_proposals.organization_id
      and tm.user_id = (select auth.uid())
      and tm.role in ('owner','admin')
  )
)
with check (
  exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild' and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  )
  or exists (
    select 1 from public.organization_memberships tm
    where tm.organization_id = agent_action_proposals.organization_id
      and tm.user_id = (select auth.uid())
      and tm.role in ('owner','admin')
  )
);

-- Inserts are service-role only (agent bridge writes via trusted server path).
-- No authenticated insert policy: humans never impersonate agent proposals.

-- 6) Seed: RS Guardião as first registered agent -----------------------------
insert into public.agents (slug, display_name, description, kind, status, version, capabilities, protocol)
values (
  'rs-guardiao',
  'RS Guardião',
  'Agente de governança cognitiva: audita fluxos operacionais, avalia risco de protesto, reconcilia extratos e prepara lotes de sincronização ERP sob aprovação humana (HITL).',
  'cognitive',
  'active',
  '1.0.0',
  '["parse_whatsapp_order","compute_fleet_cubage","audit_sefaz_nfe_key","evaluate_protest_risk","reconcile_bank_statement","build_batch_settlement","generate_executive_memo"]'::jsonb,
  'mcp'
) on conflict (slug) do nothing;

-- Grants: RS Guardião scoped per tenant capabilities (subset of registry).
insert into public.agent_organization_grants (agent_id, organization_id, capabilities, granted_by)
select a.id, o.id,
  '["parse_whatsapp_order","compute_fleet_cubage"]'::jsonb,
  null
from public.agents a, public.organizations o
where a.slug = 'rs-guardiao' and o.slug = 'hub_acai'
on conflict (agent_id, organization_id) do nothing;

insert into public.agent_organization_grants (agent_id, organization_id, capabilities, granted_by)
select a.id, o.id,
  '["audit_sefaz_nfe_key","evaluate_protest_risk","reconcile_bank_statement","build_batch_settlement"]'::jsonb,
  null
from public.agents a, public.organizations o
where a.slug = 'rs-guardiao' and o.slug = 'mundo_sabor'
on conflict (agent_id, organization_id) do nothing;

insert into public.agent_organization_grants (agent_id, organization_id, capabilities, granted_by)
select a.id, o.id,
  '["generate_executive_memo","reconcile_bank_statement"]'::jsonb,
  null
from public.agents a, public.organizations o
where a.slug = 'rs-guardiao' and o.slug = 'rsbuild'
on conflict (agent_id, organization_id) do nothing;

-- Sample pending proposals so the HITL queue is demonstrable.
insert into public.agent_action_proposals (agent_id, organization_id, action_type, title, summary, payload, status)
select a.id, o.id,
  'erp_settlement_batch',
  'Lote de baixa Omie — 3 títulos conciliados',
  'RS Guardião conciliou 3 títulos a receber do Mundo do Sabor com extratos bancários (match documental). Propõe gerar o lote de liquidação para o Omie. Nenhuma escrita no ERP ocorre sem aprovação humana.',
  '{"batchType":"settlements","titleCount":3,"totalAmountCents":735000,"currency":"BRL"}'::jsonb,
  'pending'
from public.agents a, public.organizations o
where a.slug = 'rs-guardiao' and o.slug = 'mundo_sabor'
and not exists (
  select 1 from public.agent_action_proposals p
  where p.agent_id = a.id and p.organization_id = o.id and p.action_type = 'erp_settlement_batch'
);

insert into public.agent_action_proposals (agent_id, organization_id, action_type, title, summary, payload, status)
select a.id, o.id,
  'order_parse_review',
  'Pedido WhatsApp parseado — revisão antes de confirmar',
  'RS Guardião interpretou mensagem de pedido do Hub Açaí: 15 cx tradicional + 5 cx banana (R$ 2.425,00, boleto 7d). Aguarda confirmação do operador para gerar pedido estruturado.',
  '{"customerHint":"Marcos do Açaí","totalBoxes":20,"totalAmountCents":242500,"paymentMethod":"boleto_7d"}'::jsonb,
  'pending'
from public.agents a, public.organizations o
where a.slug = 'rs-guardiao' and o.slug = 'hub_acai'
and not exists (
  select 1 from public.agent_action_proposals p
  where p.agent_id = a.id and p.organization_id = o.id and p.action_type = 'order_parse_review'
);

comment on table public.agents is 'Registry of AI agents governed by RSBUILD. Agents never hold tenant membership.';
comment on table public.agent_organization_grants is 'Per-tenant capability scope for each agent. Revocation preserves history.';
comment on table public.agent_action_proposals is 'HITL queue: agent-proposed actions awaiting human decision. Nothing executes on proposal alone.';
