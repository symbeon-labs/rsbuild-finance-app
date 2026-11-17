-- Backlog interno RSBUILD: hardening de acessos e governança de identidades
-- Registra como projeto/sprint/tasks os itens de segurança pendentes
-- para os acessos de Flávio e Vitor (QA + RSBUILD).

DO $$
DECLARE
  rsbuild_org_id uuid;
  client_org_id uuid;
  project_id uuid;
  sprint_id uuid;
  creator_id uuid;
BEGIN
  SELECT id INTO rsbuild_org_id FROM organizations WHERE slug = 'rsbuild' LIMIT 1;
  IF rsbuild_org_id IS NULL THEN
    RAISE EXCEPTION 'Organização rsbuild não encontrada';
  END IF;

  -- Org interna que representa a própria plataforma como "cliente" do projeto
  -- (constraint projects_check exige managing <> client)
  SELECT id INTO client_org_id FROM organizations WHERE slug = 'rsbuild_qa_alpha' LIMIT 1;
  IF client_org_id IS NULL THEN
    RAISE EXCEPTION 'Organização rsbuild_qa_alpha não encontrada';
  END IF;

  -- Criador do backlog: primeiro owner da RSBUILD
  SELECT user_id INTO creator_id
  FROM organization_memberships
  WHERE organization_id = rsbuild_org_id AND role = 'owner'
  ORDER BY created_at ASC
  LIMIT 1;

  -- Projeto interno "RSBUILD OS Core"
  INSERT INTO projects (managing_organization_id, client_organization_id, client_display_name, project_key, name, description, status, start_date, created_by)
  VALUES (rsbuild_org_id, client_org_id, 'RSBUILD OS', 'rsbuild-os-core', 'RSBUILD OS — Plataforma & Governança',
          'Evolução da plataforma RSBUILD OS: workspace central, governança de agentes, identidade e acessos.', 'active', CURRENT_DATE, creator_id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO project_id;

  IF project_id IS NULL THEN
    SELECT id INTO project_id FROM projects WHERE project_key = 'rsbuild-os-core' LIMIT 1;
  END IF;

  -- Sprint 1: Hardening de acessos
  INSERT INTO project_sprints (project_id, sprint_number, title, objective, completion_criteria, status, start_date, end_date, sort_order, created_by)
  VALUES (project_id, 1, 'S1 · Hardening de acessos e MFA',
          'Elevar o nível de segurança dos acessos administrativos e operacionais.',
          'MFA ativo para admins; grants auditados; senhas rotacionadas; revisão de papéis concluída.',
          'planned', CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days', 1, creator_id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO sprint_id;

  IF sprint_id IS NULL THEN
    SELECT id INTO sprint_id FROM project_sprints WHERE project_id = project_id AND sprint_number = 1 LIMIT 1;
  END IF;

  -- Tasks do backlog
  INSERT INTO project_tasks (project_id, sprint_id, title, description, acceptance_criteria, status, priority, responsible_label, sort_order, created_by)
  VALUES
    (project_id, sprint_id,
     'Ativar MFA obrigatório para roles admin/owner',
     'Configurar TOTP no Supabase Auth e exigir verificação para roles admin/owner em todos os workspaces.',
     'Login de admin/owner exige segundo fator; usuários sem MFA configurado recebem prompt de setup.',
     'todo', 'critical', 'Plataforma', 1, creator_id),
    (project_id, sprint_id,
     'Auditar grants de membership retroativamente',
     'Inserir audit_events para os grants manuais de Flávio e Vitor e garantir que futuros grants gerem evento access.granted.',
     'audit_events contém registros de concessão com actor, target, role e timestamp para todos os memberships atuais.',
     'todo', 'high', 'Plataforma', 2, creator_id),
    (project_id, sprint_id,
     'Rotacionar senhas iniciais de Flávio e Vitor',
     'Forçar troca de senha no primeiro acesso ou definir senhas temporárias seguras; remover conhecimento compartilhado.',
     'Ambos os usuários autenticam com senha própria; procedimento de troca documentado.',
     'todo', 'high', 'Operações', 3, creator_id),
    (project_id, sprint_id,
     'Migrar Vitor para email corporativo',
     'Criar conta com email @rs2build.com.br (ou domínio corporativo) e revogar acesso da conta Gmail pessoal.',
     'Vitor acessa exclusivamente via email corporativo; membership antiga revogada.',
     'todo', 'normal', 'Operações', 4, creator_id),
    (project_id, sprint_id,
     'Definir expiração para organizações QA',
     'Adicionar data de revisão/expiração às orgs hub_acai_qa e mundo_sabor_qa e documentar ciclo de vida.',
     'Organizações QA possuem expires_at ou política de revisão trimestral documentada.',
     'todo', 'normal', 'Plataforma', 5, creator_id),
    (project_id, sprint_id,
     'Implementar revisão periódica de acessos',
     'Criar relatório de acessos ativos com último login e flag para contas sem atividade > 90 dias.',
     'Relatório disponível na Central de Acessos com métricas de uso por usuário.',
     'todo', 'normal', 'Plataforma', 6, creator_id),
    (project_id, sprint_id,
     'Testes RLS/pgTAP para isolamento de tenants',
     'Adicionar testes de banco que validam que memberships de uma org não acessam dados de outra.',
     'Suíte pgTAP roda no CI e falha se RLS de organization_memberships ou tabelas tenant forem regredidas.',
     'todo', 'high', 'Engenharia', 7, creator_id)
  ON CONFLICT DO NOTHING;
END $$;
