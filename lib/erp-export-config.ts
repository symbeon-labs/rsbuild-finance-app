import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ErpExportConfig {
  id: string;
  organization_id: string;
  erp_format: string;
  field_mapping: Record<string, string>;
  custom_columns: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ErpExportFieldMapping {
  [sourceField: string]: string; // mapeamento de campo RSBUILD -> campo ERP
}

/**
 * Busca configurações de exportação por organização.
 */
export async function getErpExportConfigs(organizationId: string): Promise<ErpExportConfig[]> {
  const { data, error } = await supabase
    .from("erp_export_configs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("is_default", { ascending: false });

  if (error) {
    console.error("Erro ao buscar configs de exportação:", error);
    return [];
  }

  return data || [];
}

/**
 * Busca a configuração padrão de exportação da organização.
 */
export async function getDefaultErpExportConfig(organizationId: string): Promise<ErpExportConfig | null> {
  const configs = await getErpExportConfigs(organizationId);
  return configs.find((c) => c.is_default) || configs[0] || null;
}

/**
 * Salva ou atualiza configuração de exportação.
 */
export async function saveErpExportConfig(config: {
  organization_id: string;
  erp_format: string;
  field_mapping: ErpExportFieldMapping;
  custom_columns?: string[];
  is_default?: boolean;
}): Promise<ErpExportConfig | null> {
  const { data, error } = await supabase
    .from("erp_export_configs")
    .upsert({
      organization_id: config.organization_id,
      erp_format: config.erp_format,
      field_mapping: config.field_mapping,
      custom_columns: config.custom_columns || [],
      is_default: config.is_default || false,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao salvar config de exportação:", error);
    return null;
  }

  return data;
}

/**
 * Define configuração como padrão da organização.
 */
export async function setDefaultErpExportConfig(configId: string): Promise<boolean> {
  const { error } = await supabase
    .from("erp_export_configs")
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq("id", configId);

  if (error) {
    console.error("Erro ao definir config padrão:", error);
    return false;
  }

  return true;
}

/**
 * Remove configuração de exportação.
 */
export async function deleteErpExportConfig(configId: string): Promise<boolean> {
  const { error } = await supabase
    .from("erp_export_configs")
    .delete()
    .eq("id", configId);

  if (error) {
    console.error("Erro ao remover config de exportação:", error);
    return false;
  }

  return true;
}

/**
 * Gera mapeamento padrão para cada ERP.
 */
export function getDefaultFieldMapping(erpFormat: string): ErpExportFieldMapping {
  const defaults: Record<string, ErpExportFieldMapping> = {
    omie: {
      date: "Data",
      description: "Descrição",
      amount: "Valor",
      direction: "Tipo",
      category: "Categoria",
      account: "Conta Corrente",
      document: "Documento"
    },
    bling: {
      date: "Data",
      description: "Descrição",
      amount: "Valor",
      direction: "Tipo",
      category: "Categoria",
      account: "Conta"
    },
    tiny: {
      date: "Data",
      description: "Descrição",
      amount: "Valor",
      direction: "Natureza",
      category: "Categoria",
      account: "Conta"
    },
    contaazul: {
      date: "Data",
      description: "Descrição",
      amount: "Valor",
      direction: "Tipo",
      category: "Categoria",
      account: "Conta"
    },
    generic: {
      date: "Data",
      description: "Descrição",
      amount: "Valor",
      direction: "Direção",
      category: "Categoria",
      account: "Conta",
      document: "Documento",
      status: "Status"
    }
  };

  return defaults[erpFormat] || defaults.generic;
}
