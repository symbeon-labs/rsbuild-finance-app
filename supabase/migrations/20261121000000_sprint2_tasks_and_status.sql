-- Sprint governance: populate Sprint 2 task breakdowns (A2/H2) and align
-- sprint statuses with the real calendar/dependency state.
-- A1 is blocked on client inputs (real OFX statement, Omie credentials);
-- A2/H2 windows are current, so they become active.

do $$
declare
  v_ms_id uuid;
  v_ha_id uuid;
  v_sprint_a1 uuid;
  v_sprint_a2 uuid;
  v_sprint_h1 uuid;
  v_sprint_h2 uuid;
begin
  select p.id into v_ms_id
  from public.projects p
  join public.organizations client on client.id = p.client_organization_id
  where p.project_key = 'mundo-do-sabor' and client.slug = 'mundo_sabor'
  limit 1;

  select p.id into v_ha_id
  from public.projects p
  join public.organizations client on client.id = p.client_organization_id
  where p.project_key = 'hub-acai' and client.slug = 'hub_acai'
  limit 1;

  if v_ms_id is null or v_ha_id is null then
    raise warning 'Sprint 2 seed ignorado: projetos não provisionados neste banco';
    return;
  end if;

  select id into v_sprint_a1 from public.project_sprints where project_id = v_ms_id and sprint_number = 1;
  select id into v_sprint_a2 from public.project_sprints where project_id = v_ms_id and sprint_number = 2;
  select id into v_sprint_h1 from public.project_sprints where project_id = v_ha_id and sprint_number = 1;
  select id into v_sprint_h2 from public.project_sprints where project_id = v_ha_id and sprint_number = 2;

  -- -------------------------------------------------------------
  -- 1. STATUS REALINHADO
  -- -------------------------------------------------------------
  -- A1: bloqueada por insumos do cliente (extrato OFX real + credenciais Omie)
  update public.project_sprints set status = 'blocked', updated_at = now()
  where id = v_sprint_a1 and status <> 'completed';

  -- A2 e H2: janela corrente (16–22/11) — entram em execução
  update public.project_sprints set status = 'active', updated_at = now()
  where id in (v_sprint_a2, v_sprint_h2) and status = 'planned';

  -- -------------------------------------------------------------
  -- 2. TASKS SPRINT A2 (Mundo do Sabor)
  --    Objetivo: leiautes priorizados, fila de exceções e auditoria manual
  -- -------------------------------------------------------------
  insert into public.project_tasks (
    project_id, sprint_id, title, description, acceptance_criteria, status, priority, responsible_label, sort_order
  )
  select v_ms_id, v_sprint_a2, t.title, t.description, t.acceptance_criteria, 'todo', t.priority, t.responsible_label, t.sort_order
  from (values
    ('A2.1 Priorização de leiautes bancários com fallback',
     'Definir ordem de tentativa de parsers por banco (Itaú prioritário, fallback Inter/BNB) e registrar leiaute detectado por importação',
     'Cada importação registra o leiaute reconhecido; falhas de parse primary caem para fallback sem perda de lançamentos',
     'high', 'João · Engenharia', 1),
    ('A2.2 Fila de exceções de conciliação',
     'Centralizar divergências de valor, lançamentos não localizados e matches ambíguos em fila tratável, sem descarte silencioso',
     'Nenhuma exceção desaparece entre importação e tela; cada item tem motivo e responsável de tratamento',
     'high', 'João · Engenharia', 2),
    ('A2.3 Auditoria de intervenções manuais',
     'Garantir que todo match/unmatch manual registre autoria, timestamp, justificativa e estado anterior na trilha',
     'Intervenções manuais aparecem na auditoria com autor e motivo; reversões preservam histórico',
     'high', 'João · Engenharia', 3),
    ('A2.4 Medição de desempenho do motor de conciliação',
     'Instrumentar tempo de matching e volume processado por lote, com registro de ambiente, período e tamanho do extrato',
     'Medição registrada por execução com ambiente/período/volume; baseline documentado',
     'normal', 'João · Engenharia', 4),
    ('A2.5 Homologação com segundo leiaute real',
     'Importar extrato real de segunda instituição (Inter ou BNB) em ambiente de homologação e validar totais',
     'Segundo leiaute importa sem perda; totais conferem com o extrato de origem',
     'high', 'João · Engenharia', 5)
  ) as t(title, description, acceptance_criteria, priority, responsible_label, sort_order)
  where not exists (
    select 1 from public.project_tasks pt
    where pt.sprint_id = v_sprint_a2 and pt.title = t.title
  );

  -- -------------------------------------------------------------
  -- 3. TASKS SPRINT H2 (Hub Açaí)
  --    Objetivo: perfis por função, trilha consultável e segregação
  -- -------------------------------------------------------------
  insert into public.project_tasks (
    project_id, sprint_id, title, description, acceptance_criteria, status, priority, responsible_label, sort_order
  )
  select v_ha_id, v_sprint_h2, t.title, t.description, t.acceptance_criteria, 'todo', t.priority, t.responsible_label, t.sort_order
  from (values
    ('H2.1 Perfis de acesso por função validados',
     'Confirmar que owner/admin/operador/visualizador aplicam as alçadas corretas nas operações do Hub Açaí',
     'Cada perfil executa apenas as ações permitidas; bloqueios retornam feedback educativo',
     'high', 'João · Engenharia', 1),
    ('H2.2 Trilha de auditoria consultável e protegida',
     'Verificar que audit_events é append-only na prática: sem update/delete por usuários e consulta filtrada por tenant',
     'Tentativas de alteração falham; trilha exibe eventos ordenados com ator e timestamp',
     'high', 'João · Engenharia', 2),
    ('H2.3 Evidência de ações negadas na trilha',
     'Confirmar que access.denied e insufficient_role geram eventos visíveis na auditoria do tenant',
     'Ações negadas aparecem com motivo e caminho tentado; alerta de padrão de negação disponível',
     'high', 'João · Engenharia', 3),
    ('H2.4 Segregação de responsabilidades documentada',
     'Formalizar quem propõe, executa e aprova cada tipo de ação operacional (pedidos, baixas, exportações)',
     'Matriz de segregação aprovada pela direção; nenhuma ação crítica acumula papéis incompatíveis',
     'high', 'RSBUILD · Vitor', 4),
    ('H2.5 Regras comerciais extraídas validadas',
     'Conferir com a operação as regras de faturamento, entrega e pagamento extraídas do catálogo/pedidos',
     'Regras validadas em documento; divergências registradas como ressalvas formais',
     'normal', 'Vitor · Operação Hub Açaí', 5)
  ) as t(title, description, acceptance_criteria, priority, responsible_label, sort_order)
  where not exists (
    select 1 from public.project_tasks pt
    where pt.sprint_id = v_sprint_h2 and pt.title = t.title
  );

end $$;
