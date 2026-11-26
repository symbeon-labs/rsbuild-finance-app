-- ==============================================================================
-- ERP EXPORT CONFIGS · Configurações de exportação por organização
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.erp_export_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  erp_format TEXT NOT NULL,
  field_mapping JSONB NOT NULL DEFAULT '{}',
  custom_columns TEXT[] DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, erp_format)
);

-- Índice para busca por organização
CREATE INDEX IF NOT EXISTS idx_erp_export_configs_org ON public.erp_export_configs(organization_id);

-- RLS: usuários só veem configs da própria organização
ALTER TABLE public.erp_export_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization export configs"
  ON public.erp_export_configs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own organization export configs"
  ON public.erp_export_configs FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own organization export configs"
  ON public.erp_export_configs FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own organization export configs"
  ON public.erp_export_configs FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_erp_export_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_erp_export_configs_updated_at
  BEFORE UPDATE ON public.erp_export_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_erp_export_configs_updated_at();
