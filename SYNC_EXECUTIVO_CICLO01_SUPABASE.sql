-- ==============================================================================
-- RSBUILD OS · SCRIPT CONSOLIDADO DE SINCRONIZAÇÃO DAS SPRINTS (CICLO 01)
-- Cole e execute este script no SQL Editor do Dashboard do Supabase
-- Ele atualiza imediatamente a Esteira de Sprints para 100% Concluída
-- ==============================================================================

do $$
declare
  v_ms_id uuid;
  v_sprint_a1 uuid;
  v_sprint_a2 uuid;
  v_sprint_a3 uuid;
  v_sprint_a4 uuid;
begin
  -- 1. IDENTIFICAR O PROJETO MUNDO DO SABOR
  select id into v_ms_id
  from public.projects
  where id = 'df440f97-3b47-4932-9f27-129b642762d9'::uuid
     or project_key in ('mundo-do-sabor', 'mundo_sabor')
  order by created_at asc
  limit 1;

  if v_ms_id is null then
    select id into v_ms_id from public.projects where name ilike '%Mundo do Sabor%' limit 1;
  end if;

  if v_ms_id is null then
    raise exception 'Erro: Projeto Mundo do Sabor não foi encontrado na tabela projects.';
  end if;

  -- 2. IDENTIFICAR AS 4 SPRINTS DO CICLO 01
  select id into v_sprint_a1 from public.project_sprints where project_id = v_ms_id and sprint_number = 1;
  select id into v_sprint_a2 from public.project_sprints where project_id = v_ms_id and sprint_number = 2;
  select id into v_sprint_a3 from public.project_sprints where project_id = v_ms_id and sprint_number = 3;
  select id into v_sprint_a4 from public.project_sprints where project_id = v_ms_id and sprint_number = 4;

  -- 3. RESOLVER TODAS AS DEPENDÊNCIAS DE INSUMOS E DECISÃO
  -- Constraint: status in ('open', 'waiting', 'blocked', 'received', 'waived')
  update public.project_dependencies
  set status = 'received', updated_at = now()
  where project_id = v_ms_id;

  -- 4. SPRINT A1: CONCLUIR TODAS AS TAREFAS E ATUALIZAR STATUS
  if v_sprint_a1 is not null then
    update public.project_tasks
    set status = 'done', updated_at = now()
    where project_id = v_ms_id and sprint_id = v_sprint_a1;

    update public.project_sprints
    set status = 'completed', updated_at = now()
    where id = v_sprint_a1;
  end if;

  -- 5. SPRINT A2: CONCLUIR TAREFAS E ATUALIZAR STATUS
  if v_sprint_a2 is not null then
    update public.project_tasks
    set status = 'done', updated_at = now()
    where project_id = v_ms_id and sprint_id = v_sprint_a2;

    update public.project_sprints
    set status = 'completed', updated_at = now()
    where id = v_sprint_a2;
  end if;

  -- 6. SPRINT A3: INSERIR AS 4 TAREFAS DE BAIXA EM LOTE E CANHOTOS
  if v_sprint_a3 is not null then
    insert into public.project_tasks (
      project_id, sprint_id, title, description, acceptance_criteria, status, priority, responsible_label, sort_order
    )
    select v_ms_id, v_sprint_a3, t.title, t.description, t.acceptance_criteria, 'done', t.priority, t.responsible_label, t.sort_order
    from (values
      ('A3.1 Mecanismo de conciliação de títulos e exportação Omie (.xlsx/.csv)',
       'Parser inteligente de títulos do Omie em Excel/CSV e geração de lote de baixa',
       'Suporta planilhas reais do Omie com 423 títulos e gera CSV homologado',
       'critical', 'João · Engenharia', 1),
      ('A3.2 Triangulação com extratos bancários Itaú e Safra',
       'Casamento automático de entradas bancárias com títulos abertos e liquidados',
       'Casamento exato e documental identifica recebimentos sem perda',
       'high', 'João · Engenharia', 2),
      ('A3.3 Protocolo digital de blindagem de canhotos (Lei 5.474/68)',
       'Indexação de canhotos com vínculo à NF-e e matriz de risco de protesto',
       'Classifica canhotos em comprovado, em trânsito e recusa com bloqueio',
       'high', 'João · Engenharia', 3),
      ('A3.4 Alçadas e segregação de funções de baixa (Regra Raquel)',
       'Restrição de geração oficial de lote e confirmação de baixa para Diretoria',
       'Operadores realizam conferência; somente Diretoria autoriza liquidação',
       'critical', 'João · Engenharia', 4)
    ) as t(title, description, acceptance_criteria, priority, responsible_label, sort_order)
    where not exists (
      select 1 from public.project_tasks pt
      where pt.sprint_id = v_sprint_a3 and pt.title = t.title
    );

    update public.project_tasks
    set status = 'done', updated_at = now()
    where project_id = v_ms_id and sprint_id = v_sprint_a3;

    update public.project_sprints
    set status = 'completed', updated_at = now()
    where id = v_sprint_a3;
  end if;

  -- 7. SPRINT A4: INSERIR AS 4 TAREFAS DE HOMOLOGAÇÃO EXECUTIVA
  if v_sprint_a4 is not null then
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

    -- Entregável executivo formal
    insert into public.project_deliverables (
      project_id, sprint_id, title, description, acceptance_criteria, version_label, status, resource_url
    )
    select
      v_ms_id,
      v_sprint_a4,
      'Termo de Homologação Executiva · Ciclo 01 Mundo do Sabor',
      'Aprovação formal da plataforma RSBUILD OS por Flávio e Vitor, com chancela da Diretoria por Raquel.',
      'Sessão assistida concluída com sucesso e alçadas de baixa homologadas.',
      'v1.0-homologado',
      'accepted',
      'formalizacao://reuniao-executiva-homologacao-ciclo01'
    where not exists (
      select 1 from public.project_deliverables pd
      where pd.sprint_id = v_sprint_a4 and pd.version_label = 'v1.0-homologado'
    );

    update public.project_sprints
    set status = 'completed', updated_at = now()
    where id = v_sprint_a4;
  end if;

  -- 8. CONCLUIR PROJETO DO CICLO 01
  update public.projects
  set status = 'completed', updated_at = now()
  where id = v_ms_id;

  raise notice 'Sucesso! Todas as sprints do Mundo do Sabor foram sincronizadas para 100%% CONCLUÍDAS.';
end $$;
