-- Centralized QA evaluation registry. Additive and tenant-scoped.
create table if not exists public.qa_evaluations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  workspace_slug text not null default 'mundo_sabor_qa'
    check (workspace_slug = 'mundo_sabor_qa'),
  environment text not null default 'qa' check (environment = 'qa'),
  module_key text not null check (module_key in ('finance')),
  feature_key text not null check (feature_key in (
    'visao-geral','movimentacoes','importacoes','conciliacao','baixas','relatorios'
  )),
  assessment text not null check (assessment in (
    'Atendeu ao esperado','Atendeu parcialmente','Não atendeu',
    'Não foi possível verificar','Não se aplica'
  )),
  scenario_summary text not null default '' check (char_length(scenario_summary) <= 1000),
  observation text not null default '' check (char_length(observation) <= 4000),
  operational_impact text not null default '' check (char_length(operational_impact) <= 2000),
  evidence_refs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidence_refs) = 'array' and jsonb_array_length(evidence_refs) <= 20),
  rubric_version text not null default 'finance-guide-v0.2'
    check (rubric_version = 'finance-guide-v0.2'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint qa_evaluations_org_id_id_unique unique (organization_id, id)
);

create index if not exists qa_evaluations_org_created_idx
  on public.qa_evaluations (organization_id, created_at desc, id desc);
create index if not exists qa_evaluations_creator_idx
  on public.qa_evaluations (organization_id, created_by, created_at desc);

alter table public.qa_evaluations enable row level security;
revoke all on public.qa_evaluations from anon, authenticated;
grant select, insert on public.qa_evaluations to authenticated;

drop policy if exists "QA evaluators can submit in Mundo do Sabor QA" on public.qa_evaluations;
create policy "QA evaluators can submit in Mundo do Sabor QA"
on public.qa_evaluations for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = qa_evaluations.organization_id
      and m.user_id = (select auth.uid())
      and o.slug = 'mundo_sabor_qa'
      and o.status = 'active'
  )
);

drop policy if exists "Evaluators read their own QA evaluations" on public.qa_evaluations;
create policy "Evaluators read their own QA evaluations"
on public.qa_evaluations for select to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.organization_memberships m
    where m.organization_id = qa_evaluations.organization_id
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists "Organization admins read QA evaluations" on public.qa_evaluations;
create policy "Organization admins read QA evaluations"
on public.qa_evaluations for select to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = qa_evaluations.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
);

comment on table public.qa_evaluations is
  'Append-only evaluator feedback for the Mundo do Sabor QA workspace. Not a technical homologation decision.';
comment on column public.qa_evaluations.evidence_refs is
  'Allowlisted references only; do not store financial payloads, credentials, personal documents or raw files.';
