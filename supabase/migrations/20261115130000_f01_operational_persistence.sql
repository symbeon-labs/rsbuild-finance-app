-- F01-lite: persistência operacional por organização.
--
-- Transforma os dados hoje restritos à sessão do navegador em registros
-- compartilhados e auditáveis: títulos a receber, comprovantes de entrega,
-- pedidos WhatsApp, movimentos ERP (snapshot), baixas confirmadas e decisões
-- de conciliação. Isolamento por tenant via RLS; valores monetários em
-- centavos inteiros (amount_minor), consistente com financial_records.

-- =====================================================================
-- 1. Títulos a Receber (contas a receber / previsão de liquidação)
-- =====================================================================
create table public.receivable_titles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_number text not null,
  customer_name text not null,
  customer_doc text,
  amount_minor bigint not null check (amount_minor >= 0),
  due_date date not null,
  issue_date date,
  bank_account text,
  category text,
  our_number text,
  status text not null default 'pendente' check (status in ('pendente','baixado','cancelado')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
-- Chave natural para deduplicação de reimportação do mesmo título.
create unique index receivable_titles_natural_key
  on public.receivable_titles(organization_id, document_number, due_date, amount_minor);
create index receivable_titles_org_status_idx on public.receivable_titles(organization_id, status, due_date);

-- =====================================================================
-- 2. Comprovantes de Entrega / Canhotos (evidência operacional)
-- =====================================================================
create table public.delivery_proofs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nfe_number text not null,
  nfe_key text,
  customer_name text not null,
  customer_document text,
  nfe_amount_minor bigint not null default 0 check (nfe_amount_minor >= 0),
  issue_date date,
  delivery_date date,
  status text not null default 'pendente_entrega'
    check (status in ('pendente_entrega','comprovado','recusa_devolucao','extraviado')),
  driver_name text,
  receiver_name text,
  receiver_document text,
  proof_file_url text,
  notes text,
  synced_to_omie boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create unique index delivery_proofs_nfe_idx on public.delivery_proofs(organization_id, nfe_number);
create index delivery_proofs_org_status_idx on public.delivery_proofs(organization_id, status);

-- =====================================================================
-- 3. Pedidos WhatsApp (entrada comercial estruturada)
-- =====================================================================
create table public.whatsapp_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  raw_message text not null,
  customer_name text not null,
  delivery_date date,
  payment_method text not null default 'a_combinar'
    check (payment_method in ('boleto_7d','boleto_14d','pix','a_vista','a_combinar')),
  notes text,
  items jsonb not null default '[]'::jsonb,
  total_boxes integer not null default 0 check (total_boxes >= 0),
  total_amount_minor bigint not null default 0 check (total_amount_minor >= 0),
  confidence text not null default 'media' check (confidence in ('alta','media','baixa')),
  unrecognized_lines jsonb not null default '[]'::jsonb,
  status text not null default 'confirmado' check (status in ('rascunho','confirmado','enviado_omie')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create index whatsapp_orders_org_created_idx on public.whatsapp_orders(organization_id, created_at desc);
create index whatsapp_orders_org_status_idx on public.whatsapp_orders(organization_id, status);

-- =====================================================================
-- 4. Movimentos ERP (snapshot de lançamentos Omie)
--    Cada importação gera um snapshot imutável; a leitura usa o mais recente.
-- =====================================================================
create table public.erp_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_label text,
  record_count integer not null default 0 check (record_count >= 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.erp_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  snapshot_id uuid not null,
  movement_date date not null,
  description text not null,
  amount_minor bigint not null check (amount_minor >= 0),
  direction public.rsbuild_record_direction not null,
  document_number text,
  category text,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, snapshot_id) references public.erp_snapshots(organization_id, id) on delete cascade
);
create index erp_movements_snapshot_idx on public.erp_movements(organization_id, snapshot_id, movement_date);

-- =====================================================================
-- 5. Baixas confirmadas (liquidações de títulos)
-- =====================================================================
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  receivable_title_id uuid,
  document_number text not null,
  customer_name text not null,
  amount_minor bigint not null check (amount_minor >= 0),
  settlement_date date not null,
  source_record_id text,
  observation text,
  status text not null default 'confirmada' check (status in ('confirmada','exportada','estornada')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, receivable_title_id) references public.receivable_titles(organization_id, id)
);
create index settlements_org_date_idx on public.settlements(organization_id, settlement_date desc);

-- =====================================================================
-- 6. Decisões de conciliação (match/unmatch auditável)
-- =====================================================================
create table public.reconciliation_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  financial_record_id uuid,
  decision_type text not null check (decision_type in ('manual_match','unmatch','erp_match')),
  counterpart_label text,
  justification text,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, financial_record_id) references public.financial_records(organization_id, id)
);
create index reconciliation_decisions_org_idx on public.reconciliation_decisions(organization_id, created_at desc);

-- =====================================================================
-- RLS — mesmo padrão D02: membros leem; owner/admin/operator escrevem.
-- Baixas (settlements) exigem owner/admin, alinhado à alçada executiva.
-- =====================================================================
alter table public.receivable_titles enable row level security;
alter table public.delivery_proofs enable row level security;
alter table public.whatsapp_orders enable row level security;
alter table public.erp_snapshots enable row level security;
alter table public.erp_movements enable row level security;
alter table public.settlements enable row level security;
alter table public.reconciliation_decisions enable row level security;

-- receivable_titles
create policy "members read receivable titles" on public.receivable_titles for select to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = receivable_titles.organization_id and m.user_id = (select auth.uid())));
create policy "operators manage receivable titles" on public.receivable_titles for all to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = receivable_titles.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')))
with check (exists (select 1 from public.organization_memberships m where m.organization_id = receivable_titles.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));

-- delivery_proofs
create policy "members read delivery proofs" on public.delivery_proofs for select to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = delivery_proofs.organization_id and m.user_id = (select auth.uid())));
create policy "operators manage delivery proofs" on public.delivery_proofs for all to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = delivery_proofs.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')))
with check (exists (select 1 from public.organization_memberships m where m.organization_id = delivery_proofs.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));

-- whatsapp_orders
create policy "members read whatsapp orders" on public.whatsapp_orders for select to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = whatsapp_orders.organization_id and m.user_id = (select auth.uid())));
create policy "operators manage whatsapp orders" on public.whatsapp_orders for all to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = whatsapp_orders.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')))
with check (exists (select 1 from public.organization_memberships m where m.organization_id = whatsapp_orders.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));

-- erp_snapshots
create policy "members read erp snapshots" on public.erp_snapshots for select to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = erp_snapshots.organization_id and m.user_id = (select auth.uid())));
create policy "operators create erp snapshots" on public.erp_snapshots for insert to authenticated
with check (exists (select 1 from public.organization_memberships m where m.organization_id = erp_snapshots.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));

-- erp_movements (somente inserção via snapshot; leitura para membros)
create policy "members read erp movements" on public.erp_movements for select to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = erp_movements.organization_id and m.user_id = (select auth.uid())));
create policy "operators create erp movements" on public.erp_movements for insert to authenticated
with check (exists (select 1 from public.organization_memberships m where m.organization_id = erp_movements.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));

-- settlements — leitura para membros; escrita restrita à alçada executiva
create policy "members read settlements" on public.settlements for select to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = settlements.organization_id and m.user_id = (select auth.uid())));
create policy "executives manage settlements" on public.settlements for all to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = settlements.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin')))
with check (exists (select 1 from public.organization_memberships m where m.organization_id = settlements.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin')));

-- reconciliation_decisions
create policy "members read reconciliation decisions" on public.reconciliation_decisions for select to authenticated
using (exists (select 1 from public.organization_memberships m where m.organization_id = reconciliation_decisions.organization_id and m.user_id = (select auth.uid())));
create policy "operators append reconciliation decisions" on public.reconciliation_decisions for insert to authenticated
with check (exists (select 1 from public.organization_memberships m where m.organization_id = reconciliation_decisions.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','operator')));
