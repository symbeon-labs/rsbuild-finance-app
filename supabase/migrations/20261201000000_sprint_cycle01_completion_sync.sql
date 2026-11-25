-- Sincronização oficial de progresso do Ciclo 01: Mundo do Sabor
-- Alinha o banco relacional de portfólio (project_sprints, project_tasks, project_dependencies)
-- com as entregas técnicas efetivamente concluídas no código-fonte e insumos recebidos no Drive.

do $$
declare
  v_ms_id uuid;
  v_sprint_a1 uuid;
  v_sprint_a2 uuid;
  v_sprint_a3 uuid;
  v_sprint_a4 uuid;
begin
  select p.id into v_ms_id
  from public.projects p
  join public.organizations client on client.id = p.client_organization_id
  where p.project_key = 'mundo-do-sabor' and client.slug in ('mundo_sabor', 'mundo-do-sabor')
  limit 1;

  if v_ms_id is null then
    -- Fallback se slug não for mundo_sabor
    select id into v_ms_id from public.projects where project_key = 'mundo-do-sabor' limit 1;
  end if;

  if v_ms_id is null then
    raise warning 'Sincronização de sprints ignorada: projeto mundo-do-sabor não encontrado';
    return;
  end if;

  select id into v_sprint_a1 from public.project_sprints where project_id = v_ms_id and sprint_number = 1;
  select id into v_sprint_a2 from public.project_sprints where project_id = v_ms_id and sprint_number = 2;
  select id into v_sprint_a3 from public.project_sprints where project_id = v_ms_id and sprint_number = 3;
  select id into v_sprint_a4 from public.project_sprints where project_id = v_ms_id and sprint_number = 4;

  -- 1. ATUALIZAR STATUS DAS DEPENDÊNCIAS DE INSUMOS
  -- Extrato bancário real Itaú (OFX) e Safra foram recebidos na pasta DADOS_OPERACIONAIS
  update public.project_dependencies
  set status = 'received', updated_at = now()
  where project_id = v_ms_id and title ilike '%Extrato bancário real%';

  -- Mapeamento das contas bancárias ativas
  update public.project_dependencies
  set status = 'received', updated_at = now()
  where project_id = v_ms_id and title ilike '%contas bancárias%';

  -- 2. MARCAR TAREFAS DA SPRINT A1 COMO CONCLUÍDAS
  update public.project_tasks
  set status = 'done', updated_at = now()
  where project_id = v_ms_id and sprint_id = v_sprint_a1;

  -- 3. MARCAR TAREFAS DA SPRINT A2 COMO CONCLUÍDAS
  update public.project_tasks
  set status = 'done', updated_at = now()
  where project_id = v_ms_id and sprint_id = v_sprint_a2;

  -- 4. INSERIR E CONCLUIR TAREFAS DA SPRINT A3 (Baixa em Lote e Canhotos)
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

  -- 5. ATUALIZAR STATUS DAS SPRINTS NO PIPELINE
  -- A1: Concluída tecnicamente (aguarda apenas formalização assistida A4)
  update public.project_sprints
  set status = 'completed', updated_at = now()
  where id = v_sprint_a1;

  -- A2: Concluída tecnicamente
  update public.project_sprints
  set status = 'completed', updated_at = now()
  where id = v_sprint_a2;

  -- A3: Concluída tecnicamente
  update public.project_sprints
  set status = 'completed', updated_at = now()
  where id = v_sprint_a3;

  -- A4: Ativa (janela corrente de homologação assistida e linha de base)
  update public.project_sprints
  set status = 'active', updated_at = now()
  where id = v_sprint_a4;

end $$;
