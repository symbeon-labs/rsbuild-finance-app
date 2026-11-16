-- Sandbox validation foundation: sprint-linked, synthetic-only financial checks.
create table if not exists sandbox.validation_cases (
  id uuid primary key default gen_random_uuid(),
  case_code text not null unique,
  project_key text not null,
  sprint_number integer not null,
  task_code text not null,
  title text not null,
  acceptance_criteria text not null,
  test_kind text not null check (test_kind in ('automated','manual','blocked')),
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists sandbox.validation_runs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references sandbox.validation_cases(id),
  case_code text not null,
  status text not null check (status in ('passed','failed','blocked')),
  summary text not null,
  result jsonb not null default '{}'::jsonb,
  actor_id uuid not null,
  actor_email text,
  environment text not null default 'sandbox' check (environment = 'sandbox'),
  executed_at timestamptz not null default now()
);
create index if not exists sandbox_validation_runs_case_idx
  on sandbox.validation_runs(case_code, executed_at desc);

alter table sandbox.validation_cases enable row level security;
alter table sandbox.validation_runs enable row level security;

create policy "RSBUILD team reads validation cases" on sandbox.validation_cases
for select to authenticated using (
  exists (select 1 from public.organization_memberships m
    join public.organizations o on o.id=m.organization_id
    where o.slug='rsbuild' and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))
);
create policy "RSBUILD team reads validation runs" on sandbox.validation_runs
for select to authenticated using (
  exists (select 1 from public.organization_memberships m
    join public.organizations o on o.id=m.organization_id
    where o.slug='rsbuild' and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))
);
grant select on sandbox.validation_cases, sandbox.validation_runs to authenticated;

create or replace view public.sandbox_validation_cases
with (security_invoker=on) as select * from sandbox.validation_cases;
create or replace view public.sandbox_validation_runs
with (security_invoker=on) as select * from sandbox.validation_runs;
grant select on public.sandbox_validation_cases, public.sandbox_validation_runs to authenticated;

insert into sandbox.validation_cases
(case_code, project_key, sprint_number, task_code, title, acceptance_criteria, test_kind, sort_order)
values
('A1.4-OFX-PARSER','mundo-do-sabor',1,'A1.4','Parser e normalizador OFX','Extrai lançamentos com datas, FITID e valores exatos.','automated',4),
('A1.5-MATCHING-V1','mundo-do-sabor',1,'A1.5','Motor de correspondência v1','Associa títulos e extratos sem perda de lançamentos; respeita direção, valor e tolerância de data.','automated',5),
('A1.6-RECONCILIATION-SUMMARY','mundo-do-sabor',1,'A1.6','Resumo de conciliação','Totais conferem com o extrato; nenhum lançamento se perde entre importação e visualização.','automated',6),
('A1.7-AUDIT-MANUAL','mundo-do-sabor',1,'A1.7','Auditoria de ações manuais','Histórico identifica autor, horário e justificativa; desconciliação retorna o item ao estado pendente.','blocked',7),
('A2.1-BNB-LAYOUT','mundo-do-sabor',2,'A2.1','Leiaute bancário BNB','Aguardando fixture sintético baseado no leiaute BNB autorizado; não presumir equivalência com OFX genérico.','blocked',1),
('A2.2-INTER-LAYOUT','mundo-do-sabor',2,'A2.2','Leiaute bancário Inter','Aguardando fixture sintético baseado no leiaute Inter autorizado; não presumir equivalência com OFX genérico.','blocked',2),
('A2.3-EXCEPTION-QUEUE','mundo-do-sabor',2,'A2.3','Fila de exceções','Registros sem correspondência permanecem visíveis e contabilizados como exceções.','automated',3),
('A2.4-MANUAL-AUDIT-VIEW','mundo-do-sabor',2,'A2.4','Auditoria de conciliação manual','Decisões manuais registram autoria, horário, contraparte e justificativa consultável.','manual',4),
('A2.5-MANUAL-MATCH-JUSTIFICATION','mundo-do-sabor',2,'A2.5','Casamento manual com justificativa','Correspondência manual exige justificativa e preserva trilha de auditoria.','automated',5),
('A2.W02-PERSISTENCE','mundo-do-sabor',2,'W02','Persistência de dados financeiros','Importações, correspondências e decisões persistem no banco e permanecem após nova sessão.','blocked',6)
on conflict (case_code) do update set
  title=excluded.title, acceptance_criteria=excluded.acceptance_criteria,
  test_kind=excluded.test_kind, sort_order=excluded.sort_order, enabled=true;

create or replace function public.sandbox_record_validation_run(
  p_case_code text, p_status text, p_summary text, p_result jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer
set search_path=public,sandbox
as $$
declare v_uid uuid := auth.uid(); v_email text; v_case sandbox.validation_cases%rowtype; v_run_id uuid;
begin
  if v_uid is null or p_status not in ('passed','failed','blocked') then
    raise exception 'invalid_validation_request';
  end if;
  if not exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id=m.organization_id
    where o.slug='rsbuild' and m.user_id=v_uid and m.role in ('owner','admin')
  ) then raise exception 'sandbox_validation_forbidden'; end if;
  select * into v_case from sandbox.validation_cases where case_code=p_case_code and enabled;
  if not found then raise exception 'validation_case_not_found'; end if;
  select email into v_email from auth.users where id=v_uid;
  insert into sandbox.validation_runs(case_id,case_code,status,summary,result,actor_id,actor_email)
  values(v_case.id,v_case.case_code,p_status,left(coalesce(p_summary,''),1000),coalesce(p_result,'{}'::jsonb),v_uid,v_email)
  returning id into v_run_id;
  insert into sandbox.audit_events(organization_id,actor_id,actor_email,event_type,entity_type,entity_id,metadata)
  select id,v_uid,v_email,'sandbox.validation.executed','validation_run',v_run_id,
    jsonb_build_object('case_code',p_case_code,'status',p_status)
  from sandbox.organizations where slug='rsbuild-sandbox';
  return jsonb_build_object('success',true,'run_id',v_run_id);
end;
$$;
revoke all on function public.sandbox_record_validation_run(text,text,text,jsonb) from public, anon;
grant execute on function public.sandbox_record_validation_run(text,text,text,jsonb) to authenticated;
