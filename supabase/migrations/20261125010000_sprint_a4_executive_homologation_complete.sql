-- Sincronização oficial de Homologação Executiva do Ciclo 01: Mundo do Sabor
-- Registro do aceite formal de Flávio, Vitor e aprovação da Diretoria (Raquel)
-- Conclui a Sprint A4 (100%) e finaliza o Ciclo 01 de Mundo do Sabor

do $$
declare
  v_ms_id uuid;
  v_sprint_a4 uuid;
begin
  select p.id into v_ms_id
  from public.projects p
  join public.organizations client on client.id = p.client_organization_id
  where p.project_key = 'mundo-do-sabor' and client.slug in ('mundo_sabor', 'mundo-do-sabor')
  limit 1;

  if v_ms_id is null then
    select id into v_ms_id from public.projects where project_key = 'mundo-do-sabor' limit 1;
  end if;

  if v_ms_id is null then
    raise warning 'Homologação ignorada: projeto mundo-do-sabor não encontrado';
    return;
  end if;

  select id into v_sprint_a4 from public.project_sprints where project_id = v_ms_id and sprint_number = 4;

  if v_sprint_a4 is null then
    raise warning 'Sprint A4 não encontrada';
    return;
  end if;

  -- 1. REGISTRAR E CONCLUIR TAREFAS DA SPRINT A4
  insert into public.project_tasks (
    project_id, sprint_id, title, description, acceptance_criteria, status, priority, responsible_label, sort_order
  )
  select v_ms_id, v_sprint_a4, t.title, t.description, t.acceptance_criteria, 'done', t.priority, t.responsible_label, t.sort_order
  from (values
    ('A4.1 Sessão de homologação assistida de conciliação bancária e conciliação de títulos',
     'Apresentação e validação prática da conciliação bancária e de títulos com a operação',
     'Fluxo homologado em reunião executiva com Flávio e Vitor sem ressalvas impeditivas',
     'critical', 'João · Liderança Técnica', 1),
    ('A4.2 Validação de alçadas executivas e segregação de funções (Regra Raquel)',
     'Garantia de que operadores apenas conferem e apenas a Diretoria autoriza lotes e liquidações',
     'Fluxo de alçadas aprovado pela Diretoria (Raquel)',
     'critical', 'Diretoria · Raquel', 2),
    ('A4.3 Linha de base operacional com dados reais integrados',
     'Validação do conjunto de dados reais: 423 títulos Omie e 395 lançamentos bancários Itaú/Safra',
     'Triangulação com canhotos e extratos conferida com a operação',
     'high', 'Vitor · RSBUILD', 3),
    ('A4.4 Formalização do aceite executivo e conclusão do Ciclo 01',
     'Encerramento do Ciclo 01 Mundo do Sabor com aceite formal da Diretoria e Operação',
     'Termo de homologação do Ciclo 01 aceito por Flávio, Vitor e Raquel',
     'critical', 'Diretoria / Gestão', 4)
  ) as t(title, description, acceptance_criteria, priority, responsible_label, sort_order)
  where not exists (
    select 1 from public.project_tasks pt
    where pt.sprint_id = v_sprint_a4 and pt.title = t.title
  );

  update public.project_tasks
  set status = 'done', updated_at = now()
  where project_id = v_ms_id and sprint_id = v_sprint_a4;

  -- 2. REGISTRAR ENTREGÁVEL EXECUTIVO FORMAL
  insert into public.project_deliverables (
    project_id, sprint_id, title, description, acceptance_criteria, version_label, status, resource_url
  )
  select
    v_ms_id,
    v_sprint_a4,
    'Termo de Homologação Executiva · Ciclo 01 Mundo do Sabor',
    'Aprovação formal e presencial da plataforma RSBUILD OS por Flávio, Vitor e aprovação da Diretoria por Raquel.',
    'Sessão assistida concluída com sucesso e alçadas de baixa homologadas.',
    'v1.0-homologado',
    'accepted',
    'formalizacao://reuniao-executiva-homologacao-ciclo01'
  where not exists (
    select 1 from public.project_deliverables pd
    where pd.sprint_id = v_sprint_a4 and pd.version_label = 'v1.0-homologado'
  );

  -- 3. RESOLVER TODAS AS DEPENDÊNCIAS DE APROVAÇÃO E DECISÃO
  -- Status válidos em project_dependencies: 'open', 'waiting', 'blocked', 'received', 'waived'
  update public.project_dependencies
  set status = 'received', updated_at = now()
  where project_id = v_ms_id and (dependency_type in ('decision', 'client_input') or title ilike '%aprovação%' or title ilike '%diretoria%');

  -- 4. CONCLUIR SPRINT A4 (100%)
  update public.project_sprints
  set status = 'completed', updated_at = now()
  where id = v_sprint_a4;

  -- 5. ATUALIZAR STATUS DO PROJETO CICLO 01
  update public.projects
  set status = 'completed', updated_at = now()
  where id = v_ms_id;

end $$;
