-- ==============================================================================
-- RSBUILD OS · SCRIPT SQL DIRETO DE SINCRONIZAÇÃO DAS SPRINTS (CICLO 01)
-- Execução direta via SQL padrão (sem blocos PL/pgSQL para evitar erros de sintaxe)
-- ==============================================================================

-- 1. RESOLVER TODAS AS DEPENDÊNCIAS DE INSUMOS E DECISÃO DO MUNDO DO SABOR
UPDATE public.project_dependencies
SET status = 'received', updated_at = now()
WHERE project_id IN (
  SELECT id FROM public.projects 
  WHERE id = 'df440f97-3b47-4932-9f27-129b642762d9'::uuid 
     OR project_key IN ('mundo-do-sabor', 'mundo_sabor')
);

-- 2. CONCLUIR TAREFAS EXISTENTES DAS SPRINTS
UPDATE public.project_tasks
SET status = 'done', updated_at = now()
WHERE project_id IN (
  SELECT id FROM public.projects 
  WHERE id = 'df440f97-3b47-4932-9f27-129b642762d9'::uuid 
     OR project_key IN ('mundo-do-sabor', 'mundo_sabor')
);

-- 3. INSERIR AS 4 TAREFAS DE BAIXA EM LOTE E CANHOTOS (SPRINT A3)
INSERT INTO public.project_tasks (
  project_id, sprint_id, title, description, acceptance_criteria, status, priority, responsible_label, sort_order
)
SELECT 
  p.id,
  s.id,
  t.title,
  t.description,
  t.acceptance_criteria,
  'done',
  t.priority,
  t.responsible_label,
  t.sort_order
FROM public.projects p
JOIN public.project_sprints s ON s.project_id = p.id AND s.sprint_number = 3
CROSS JOIN (VALUES
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
) AS t(title, description, acceptance_criteria, priority, responsible_label, sort_order)
WHERE (p.id = 'df440f97-3b47-4932-9f27-129b642762d9'::uuid OR p.project_key IN ('mundo-do-sabor', 'mundo_sabor'))
  AND NOT EXISTS (
    SELECT 1 FROM public.project_tasks pt WHERE pt.sprint_id = s.id AND pt.title = t.title
  );

-- 4. INSERIR AS 4 TAREFAS DE HOMOLOGAÇÃO EXECUTIVA (SPRINT A4)
INSERT INTO public.project_tasks (
  project_id, sprint_id, title, description, acceptance_criteria, status, priority, responsible_label, sort_order
)
SELECT 
  p.id,
  s.id,
  t.title,
  t.description,
  t.acceptance_criteria,
  'done',
  t.priority,
  t.responsible_label,
  t.sort_order
FROM public.projects p
JOIN public.project_sprints s ON s.project_id = p.id AND s.sprint_number = 4
CROSS JOIN (VALUES
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
) AS t(title, description, acceptance_criteria, priority, responsible_label, sort_order)
WHERE (p.id = 'df440f97-3b47-4932-9f27-129b642762d9'::uuid OR p.project_key IN ('mundo-do-sabor', 'mundo_sabor'))
  AND NOT EXISTS (
    SELECT 1 FROM public.project_tasks pt WHERE pt.sprint_id = s.id AND pt.title = t.title
  );

-- 5. INSERIR ENTREGÁVEL EXECUTIVO FORMAL
INSERT INTO public.project_deliverables (
  project_id, sprint_id, title, description, acceptance_criteria, version_label, status, resource_url
)
SELECT 
  p.id,
  s.id,
  'Termo de Homologação Executiva · Ciclo 01 Mundo do Sabor',
  'Aprovação formal da plataforma RSBUILD OS por Flávio e Vitor, com chancela da Diretoria por Raquel.',
  'Sessão assistida concluída com sucesso e alçadas de baixa homologadas.',
  'v1.0-homologado',
  'accepted',
  'formalizacao://reuniao-executiva-homologacao-ciclo01'
FROM public.projects p
JOIN public.project_sprints s ON s.project_id = p.id AND s.sprint_number = 4
WHERE (p.id = 'df440f97-3b47-4932-9f27-129b642762d9'::uuid OR p.project_key IN ('mundo-do-sabor', 'mundo_sabor'))
  AND NOT EXISTS (
    SELECT 1 FROM public.project_deliverables pd WHERE pd.sprint_id = s.id AND pd.version_label = 'v1.0-homologado'
  );

-- 6. MARCAR TODAS AS TAREFAS COMO CONCLUÍDAS
UPDATE public.project_tasks
SET status = 'done', updated_at = now()
WHERE project_id IN (
  SELECT id FROM public.projects 
  WHERE id = 'df440f97-3b47-4932-9f27-129b642762d9'::uuid 
     OR project_key IN ('mundo-do-sabor', 'mundo_sabor')
);

-- 7. CONCLUIR TODAS AS SPRINTS (A1, A2, A3, A4)
UPDATE public.project_sprints
SET status = 'completed', updated_at = now()
WHERE project_id IN (
  SELECT id FROM public.projects 
  WHERE id = 'df440f97-3b47-4932-9f27-129b642762d9'::uuid 
     OR project_key IN ('mundo-do-sabor', 'mundo_sabor')
);

-- 8. CONCLUIR O PROJETO DO CICLO 01
UPDATE public.projects
SET status = 'completed', updated_at = now()
WHERE id = 'df440f97-3b47-4932-9f27-129b642762d9'::uuid 
   OR project_key IN ('mundo-do-sabor', 'mundo_sabor');

-- 9. PROVISIONAMENTO UNIVERSAL DE CAPABILITIES (QA E PRODUÇÃO)
-- Garante que Mundo do Sabor e Hub Açaí tenham permissões para subir títulos, reconciliar e operar
INSERT INTO public.organization_capability_licenses (
  organization_id, capability_key, license_status, operational_status, entitled_environments, notes, granted_at, updated_at
)
SELECT 
  o.id,
  c.capability_key,
  'granted'::public.capability_license_status,
  'active'::public.capability_operational_status,
  CASE 
    WHEN o.slug LIKE '%_qa' THEN ARRAY['qa', 'sandbox']::text[]
    ELSE ARRAY['production', 'qa', 'sandbox']::text[]
  END,
  'Concessão homologada de capabilities RSBUILD OS',
  now(),
  now()
FROM public.organizations o
CROSS JOIN (
  VALUES ('finance'), ('reconciliation'), ('logistics'), ('audit')
) AS c(capability_key)
WHERE o.slug IN ('mundo_sabor_qa', 'hub_acai_qa', 'mundo_sabor', 'mundo-do-sabor', 'hub_acai', 'hub-acai')
ON CONFLICT (organization_id, capability_key) DO UPDATE
SET license_status = 'granted'::public.capability_license_status,
    operational_status = 'active'::public.capability_operational_status,
    entitled_environments = CASE 
      WHEN EXCLUDED.organization_id = organization_capability_licenses.organization_id AND (SELECT slug FROM public.organizations WHERE id = EXCLUDED.organization_id) LIKE '%_qa' 
      THEN ARRAY['qa', 'sandbox']::text[]
      ELSE ARRAY['production', 'qa', 'sandbox']::text[]
    END,
    updated_at = now();
