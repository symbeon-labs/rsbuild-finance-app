-- ==============================================================================
-- RSBUILD OS · PROVISIONAMENTO UNIVERSAL DE CAPABILITIES PARA TODOS OS WORKSPACES
-- Garante que Mundo do Sabor (QA & Produção) e Hub Açaí (QA & Produção)
-- possuam licenças ativas para finanças, reconciliação, logística e auditoria.
-- ==============================================================================

-- 1. Garantir que as capabilities fundamentais existem no catálogo
INSERT INTO public.capability_catalog (capability_key, display_name, description)
VALUES
  ('finance', 'Módulo Financeiro & DRE', 'Controle de movimentações bancárias, operações em lote e DRE'),
  ('reconciliation', 'Reconciliação ERP & Baixas', 'Cruzamento de títulos Omie contra extratos bancários e baixas'),
  ('logistics', 'Logística, Pedidos & Canhotos', 'Entrada de pedidos WhatsApp e blindagem de canhotos Lei 5.474/68'),
  ('audit', 'Governança & Torre de Controle', 'Auditoria append-only, observabilidade executiva e alçadas')
ON CONFLICT (capability_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description;

-- 2. Conceder capabilities para organizações QA
-- Mundo do Sabor QA (550e8400-e29b-41d4-a716-446655440002)
-- Hub Açaí QA (550e8400-e29b-41d4-a716-446655440001)
INSERT INTO public.organization_capability_licenses (
  organization_id, capability_key, license_status, operational_status, entitled_environments, notes, granted_at, updated_at
)
SELECT 
  o.id,
  c.capability_key,
  'granted',
  'active',
  ARRAY['qa', 'sandbox']::text[],
  'Concessão homologada de capabilities para ambiente de testes QA',
  now(),
  now()
FROM public.organizations o
CROSS JOIN (
  VALUES ('finance'), ('reconciliation'), ('logistics'), ('audit')
) AS c(capability_key)
WHERE o.slug IN ('mundo_sabor_qa', 'hub_acai_qa')
ON CONFLICT (organization_id, capability_key) DO UPDATE
SET license_status = 'granted',
    operational_status = 'active',
    entitled_environments = ARRAY['qa', 'sandbox']::text[],
    updated_at = now();

-- 3. Conceder capabilities para organizações de Produção
-- Mundo do Sabor (Produção) e Hub Açaí (Produção)
INSERT INTO public.organization_capability_licenses (
  organization_id, capability_key, license_status, operational_status, entitled_environments, notes, granted_at, updated_at
)
SELECT 
  o.id,
  c.capability_key,
  'granted',
  'active',
  ARRAY['production', 'qa', 'sandbox']::text[],
  'Concessão operacional homologada para produção RSBUILD OS',
  now(),
  now()
FROM public.organizations o
CROSS JOIN (
  VALUES ('finance'), ('reconciliation'), ('logistics'), ('audit')
) AS c(capability_key)
WHERE o.slug IN ('mundo_sabor', 'mundo-do-sabor', 'hub_acai', 'hub-acai')
ON CONFLICT (organization_id, capability_key) DO UPDATE
SET license_status = 'granted',
    operational_status = 'active',
    entitled_environments = ARRAY['production', 'qa', 'sandbox']::text[],
    updated_at = now();
