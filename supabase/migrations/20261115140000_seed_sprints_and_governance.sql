-- Seed oficial das Sprints, Tarefas e Dependências de Insumos dos Projetos RSBUILD
-- Baseado no Plano Consolidado de Sprints (Ciclo 01 v2.2) do Google Drive

do $$
declare
  v_ms_id uuid := 'df440f97-3b47-4932-9f27-129b642762d9';
  v_ha_id uuid := '73221251-9730-4840-be5f-b5b2a46846c2';

  v_sprint_a1 uuid;
  v_sprint_a2 uuid;
  v_sprint_a3 uuid;
  v_sprint_a4 uuid;

  v_sprint_h1 uuid;
  v_sprint_h2 uuid;
  v_sprint_h3 uuid;
  v_sprint_h4 uuid;
begin
  -- -------------------------------------------------------------
  -- 1. SPRINTS MUNDO DO SABOR (Frente A · Ciclo 01)
  -- -------------------------------------------------------------
  insert into public.project_sprints (
    project_id, sprint_number, title, objective, completion_criteria, status, start_date, end_date, sort_order
  ) values
  (
    v_ms_id, 1, 'A1 · Uma conta bancária conciliada ponta a ponta',
    'Profundidade antes de largura: um banco, uma conta, um mês, ponta a ponta. Revelar problemas reais de leiaute e correspondência antes de ampliar cobertura.',
    'Os totais conferem com o extrato; nenhum lançamento desaparece entre importação e tela; as ações realizadas ficam registradas na auditoria.',
    'active', '2026-11-09', '2026-11-13', 1
  )
  on conflict (project_id, sprint_number) do update set
    title = excluded.title,
    objective = excluded.objective,
    completion_criteria = excluded.completion_criteria,
    status = excluded.status,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    sort_order = excluded.sort_order
  returning id into v_sprint_a1;

  insert into public.project_sprints (
    project_id, sprint_number, title, objective, completion_criteria, status, start_date, end_date, sort_order
  ) values
  (
    v_ms_id, 2, 'A2 · Leiautes priorizados, fila de exceções e auditoria manual',
    'A conciliação ganha escala e a intervenção humana ganha visibilidade. Ampliar leiautes priorizados e tornar cada intervenção manual consultável com autoria e justificativa.',
    'Nenhuma exceção desaparece; intervenções manuais aparecem na auditoria; medição de desempenho registrada com ambiente, período e volume testado.',
    'planned', '2026-11-16', '2026-11-19', 2
  )
  on conflict (project_id, sprint_number) do update set
    title = excluded.title,
    objective = excluded.objective,
    completion_criteria = excluded.completion_criteria,
    status = excluded.status,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    sort_order = excluded.sort_order
  returning id into v_sprint_a2;

  insert into public.project_sprints (
    project_id, sprint_number, title, objective, completion_criteria, status, start_date, end_date, sort_order
  ) values
  (
    v_ms_id, 3, 'A3 · Preparação de baixa em lote e busca de canhotos',
    'Preparação e conferência de baixa em lote sem executar pagamentos nem autorizar movimentação financeira; indexação de canhotos vinculados à NF-e.',
    'A preparação não executa pagamento; itens rejeitados são rastreáveis; a recuperação do canhoto é medida em cenário de teste documentado.',
    'planned', '2026-11-23', '2026-11-27', 3
  )
  on conflict (project_id, sprint_number) do update set
    title = excluded.title,
    objective = excluded.objective,
    completion_criteria = excluded.completion_criteria,
    status = excluded.status,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    sort_order = excluded.sort_order
  returning id into v_sprint_a3;

  insert into public.project_sprints (
    project_id, sprint_number, title, objective, completion_criteria, status, start_date, end_date, sort_order
  ) values
  (
    v_ms_id, 4, 'A4 · Homologação assistida, documentação e linha de base',
    'Homologação assistida e medição inicial dos módulos implementados em ambiente e dados autorizados, registrando limitações e documentando a operação.',
    'Homologação executada com dados reais autorizados; termo de aceite preenchido ou lista de ressalvas formalizada; documentação de contingência entregue.',
    'planned', '2026-11-30', '2026-12-04', 4
  )
  on conflict (project_id, sprint_number) do update set
    title = excluded.title,
    objective = excluded.objective,
    completion_criteria = excluded.completion_criteria,
    status = excluded.status,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    sort_order = excluded.sort_order
  returning id into v_sprint_a4;

  -- -------------------------------------------------------------
  -- 2. SPRINTS HUB AÇAÍ (Frente B · Ciclo 01)
  -- -------------------------------------------------------------
  insert into public.project_sprints (
    project_id, sprint_number, title, objective, completion_criteria, status, start_date, end_date, sort_order
  ) values
  (
    v_ha_id, 1, 'H1 · Contenção de risco verificado e diagnóstico técnico',
    'Conter a exposição de segurança prioritária e produzir o diagnóstico que sustenta decisões de escopo. Reproduzir fluxo de aprovação de compra por link e diagnosticar persistência.',
    'A direção testa fluxo de aprovação atual e solução de link autenticado; recebe diagnóstico técnico com inventário de persistência, integrações e agentes.',
    'active', '2026-11-09', '2026-11-13', 1
  )
  on conflict (project_id, sprint_number) do update set
    title = excluded.title,
    objective = excluded.objective,
    completion_criteria = excluded.completion_criteria,
    status = excluded.status,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    sort_order = excluded.sort_order
  returning id into v_sprint_h1;

  insert into public.project_sprints (
    project_id, sprint_number, title, objective, completion_criteria, status, start_date, end_date, sort_order
  ) values
  (
    v_ha_id, 2, 'H2 · Perfis, trilha de auditoria e segregação',
    'Perfis por função, trilha consultável e segregação de responsabilidades na plataforma.',
    'Trilha protegida contra alteração indevida; permissões aplicadas; ações negadas e permitidas evidenciadas; regras comerciais extraídas validadas.',
    'planned', '2026-11-16', '2026-11-19', 2
  )
  on conflict (project_id, sprint_number) do update set
    title = excluded.title,
    objective = excluded.objective,
    completion_criteria = excluded.completion_criteria,
    status = excluded.status,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    sort_order = excluded.sort_order
  returning id into v_sprint_h2;

  insert into public.project_sprints (
    project_id, sprint_number, title, objective, completion_criteria, status, start_date, end_date, sort_order
  ) values
  (
    v_ha_id, 3, 'H3 · Decisão e possível evolução de caixa, compras e estoque',
    'Projeção de caixa considerando despesas não convertidas em títulos; persistência de plano de compras; ciclo de estoque se aprovado.',
    'Simulação de compras com projeção de caixa e persistência entre dispositivos; transferência em lote e WhatsApp com escopo e testes próprios.',
    'planned', '2026-11-23', '2026-11-27', 3
  )
  on conflict (project_id, sprint_number) do update set
    title = excluded.title,
    objective = excluded.objective,
    completion_criteria = excluded.completion_criteria,
    status = excluded.status,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    sort_order = excluded.sort_order
  returning id into v_sprint_h3;

  insert into public.project_sprints (
    project_id, sprint_number, title, objective, completion_criteria, status, start_date, end_date, sort_order
  ) values
  (
    v_ha_id, 4, 'H4 · Custos, margem, indicadores e documentação',
    'Medir custos e sinalizar variações relevantes sem alterar preços automaticamente; medir indicadores e documentar contingência.',
    'Alertas entregues a responsável autorizado; ação esperada explícita; nenhum preço alterado automaticamente; linha de base registrada.',
    'planned', '2026-11-30', '2026-12-04', 4
  )
  on conflict (project_id, sprint_number) do update set
    title = excluded.title,
    objective = excluded.objective,
    completion_criteria = excluded.completion_criteria,
    status = excluded.status,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    sort_order = excluded.sort_order
  returning id into v_sprint_h4;

  -- -------------------------------------------------------------
  -- 3. TAREFAS SPRINT A1 (Mundo do Sabor)
  -- -------------------------------------------------------------
  insert into public.project_tasks (
    project_id, sprint_id, title, description, acceptance_criteria, status, priority, responsible_label, sort_order
  ) values
  (v_ms_id, v_sprint_a1, 'A1.1 Viabilizar acesso autorizado ao ambiente de teste/API Omie', 'Identificar administrador do Omie e obter credenciais de integração', 'Credenciais e endpoint de teste validados com sucesso', 'in_progress', 'high', 'Liderança técnica · Direção', 1),
  (v_ms_id, v_sprint_a1, 'A1.2 Relação de contas bancárias ativas e restrições', 'Disponibilizar relação das contas bancárias ativas, divisões contábeis e restrições', 'Lista validada com bancos, agências e contas', 'in_progress', 'high', 'Vitor · Financeiro', 2),
  (v_ms_id, v_sprint_a1, 'A1.3 Disponibilizar extrato real de uma conta ativa (Itaú)', 'Extrair extrato OFX real da conta Itaú para homologação ponta a ponta', 'Arquivo OFX entregue e íntegro para o período acordado', 'todo', 'critical', 'Financeiro Mundo do Sabor', 3),
  (v_ms_id, v_sprint_a1, 'A1.4 Parser e normalizador OFX para o leiaute priorizado', 'Implementação do parser OFX robusto para padrão brasileiro e formato Itaú/Inter', 'Parser extrai lançamentos com datas, FITID e valores exatos', 'done', 'high', 'Desenvolvimento', 4),
  (v_ms_id, v_sprint_a1, 'A1.5 Motor de correspondência v1 (valor, data, documento)', 'Motor de conciliação automática com correspondência direta e tolerâncias', 'Associa títulos e extratos sem perda de lançamentos', 'done', 'high', 'Desenvolvimento', 5),
  (v_ms_id, v_sprint_a1, 'A1.6 Tela de conciliação: itens conciliados, pendentes e totais', 'Interface de conciliação bancária ponta a ponta com totais conferidos', 'Totais batem com extrato; nenhum lançamento se perde', 'done', 'high', 'Desenvolvimento', 6),
  (v_ms_id, v_sprint_a1, 'A1.7 Registro de autor e horário em ações de alteração de dados', 'Trilha de auditoria para todas as conciliações e desconciliações', 'Histórico exibe quem alterou, quando e o motivo', 'done', 'high', 'Desenvolvimento', 7),
  (v_ms_id, v_sprint_a1, 'A1.8 Levantamento do fluxo físico de canhotos', 'Mapear recebimento físico de notas e canhotos sem desenvolvimento nesta sprint', 'Fluxo documentado com etapas, gargalos e responsáveis', 'todo', 'normal', 'Vitor', 8);

  -- -------------------------------------------------------------
  -- 4. TAREFAS SPRINT H1 (Hub Açaí)
  -- -------------------------------------------------------------
  insert into public.project_tasks (
    project_id, sprint_id, title, description, acceptance_criteria, status, priority, responsible_label, sort_order
  ) values
  (v_ha_id, v_sprint_h1, 'H1.1 Verificar e conter fluxo de aprovação por link compartilhado', 'Reproduzir vulnerabilidade de link e implementar link autenticado, único e com validade', 'Link exige autenticação ou expira; não permite acesso irrestrito', 'in_progress', 'critical', 'Desenvolvimento · Equipe interna', 1),
  (v_ha_id, v_sprint_h1, 'H1.2 Diagnóstico de infraestrutura e persistência da plataforma', 'Mapear servidores, persistência de dados e segregação de código/configuração', 'Diagnóstico técnico entregue documentando estado atual', 'done', 'high', 'Liderança técnica', 2),
  (v_ha_id, v_sprint_h1, 'H1.3 Mapear objetos, permissões e limites da API Omie', 'Levantamento de endpoints, rate-limits e permissões de leitura/escrita do Omie', 'Matriz de compatibilidade da API entregue', 'in_progress', 'high', 'Liderança técnica', 3),
  (v_ha_id, v_sprint_h1, 'H1.4 Proposta de escopo e sequência para ciclo de estoque Omie', 'Definir regras de negócio para entradas, saídas e transferências de estoque', 'Proposta formalizada e validada com a operação', 'in_progress', 'high', 'RSBUILD · Vitor', 4),
  (v_ha_id, v_sprint_h1, 'H1.5 Inventário de agentes em operação e dados processados', 'Listagem de bots, webhooks e automações ativas com dados manipulados', 'Inventário completo de agentes em produção', 'in_progress', 'normal', 'Vitor · Equipe interna', 5),
  (v_ha_id, v_sprint_h1, 'H1.6 Verificação de hospedagem, backup e política de retenção', 'Auditoria dos backups existentes e tempos de recuperação', 'Rotina de backup automatizada e validada', 'done', 'high', 'Liderança técnica', 6);

  -- -------------------------------------------------------------
  -- 5. DEPENDÊNCIAS DE INSUMOS CRÍTICOS
  -- -------------------------------------------------------------
  insert into public.project_dependencies (
    project_id, sprint_id, title, description, dependency_type, status, responsible_label, due_date
  ) values
  (
    v_ms_id, v_sprint_a1,
    'Extrato bancário real Itaú (OFX)',
    'Arquivo OFX com movimentação real de um mês para homologar o motor de conciliação bancária',
    'client_input', 'waiting', 'Financeiro Mundo do Sabor', '2026-11-13'
  ),
  (
    v_ms_id, v_sprint_a1,
    'Credenciais de integração API Omie (Mundo do Sabor)',
    'Chave de aplicação (App Key / Secret) para leitura de títulos e conciliação ERP',
    'access', 'waiting', 'Direção Mundo do Sabor', '2026-11-13'
  ),
  (
    v_ms_id, v_sprint_a1,
    'Mapeamento oficial das contas bancárias ativas',
    'Relação de agências, contas correntes e chaves PIX cadastradas',
    'client_input', 'received', 'Vitor · Financeiro', '2026-11-10'
  ),
  (
    v_ha_id, v_sprint_h1,
    'Validação do fluxo de aprovação de compras por link',
    'Demonstração da vulnerabilidade em ambiente seguro e aceite da solução proposta',
    'decision', 'waiting', 'Direção Hub Açaí / Flávio', '2026-11-13'
  ),
  (
    v_ha_id, v_sprint_h1,
    'Credenciais e alçadas da API Omie (Hub Açaí)',
    'Acesso homologado para leitura de pedidos, compras e estoque no Omie',
    'access', 'waiting', 'Liderança Técnica', '2026-11-16'
  );

end $$;
