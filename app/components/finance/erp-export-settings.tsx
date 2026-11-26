"use client";

import { useState, useEffect } from "react";
import { type ErpFormat } from "@/lib/erp-export";
import { GuideBalloon } from "@/app/components/guide/guide-balloon";
import { getGuide } from "@/lib/guides";

interface ErpExportConfig {
  id: string;
  organization_id: string;
  erp_format: string;
  field_mapping: Record<string, string>;
  custom_columns: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface ErpExportFieldMapping {
  [sourceField: string]: string;
}

function getDefaultFieldMapping(erpFormat: string): ErpExportFieldMapping {
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

interface ErpExportSettingsProps {
  organizationId: string;
  onClose?: () => void;
}

const ERP_OPTIONS = [
  { value: "omie", label: "Omie" },
  { value: "bling", label: "Bling" },
  { value: "tiny", label: "Tiny" },
  { value: "contaazul", label: "ContaAzul" },
  { value: "generic", label: "Genérico" }
];

export function ErpExportSettings({ organizationId, onClose }: ErpExportSettingsProps) {
  const [configs, setConfigs] = useState<ErpExportConfig[]>([]);
  const [selectedErp, setSelectedErp] = useState<ErpFormat>("omie");
  const [fieldMapping, setFieldMapping] = useState<ErpExportFieldMapping>({});
  const [customColumns, setCustomColumns] = useState<string>("");
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, [organizationId]);

  async function loadConfigs() {
    setLoading(true);
    try {
      const response = await fetch(`/api/erp-export-config?organizationId=${organizationId}`);
      const { configs: data } = await response.json();
      setConfigs(data || []);
    } catch (error) {
      console.error("Error loading configs:", error);
      setConfigs([]);
    }
    setLoading(false);
  }

  function handleErpChange(erp: ErpFormat) {
    setSelectedErp(erp);
    const existing = configs.find((c) => c.erp_format === erp);
    if (existing) {
      setFieldMapping(existing.field_mapping);
      setCustomColumns(existing.custom_columns.join(", "));
      setIsDefault(existing.is_default);
    } else {
      setFieldMapping(getDefaultFieldMapping(erp));
      setCustomColumns("");
      setIsDefault(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    const customCols = customColumns.split(",").map((c) => c.trim()).filter(Boolean);
    try {
      await fetch("/api/erp-export-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: organizationId,
          erp_format: selectedErp,
          field_mapping: fieldMapping,
          custom_columns: customCols,
          is_default: isDefault
        })
      });
      await loadConfigs();
    } catch (error) {
      console.error("Error saving config:", error);
    }
    setSaving(false);
  }

  async function handleSetDefault(configId: string) {
    try {
      await fetch("/api/erp-export-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configId })
      });
      await loadConfigs();
    } catch (error) {
      console.error("Error setting default:", error);
    }
  }

  async function handleDelete(configId: string) {
    if (confirm("Remover esta configuração de exportação?")) {
      try {
        await fetch(`/api/erp-export-config?configId=${configId}`, {
          method: "DELETE"
        });
        await loadConfigs();
      } catch (error) {
        console.error("Error deleting config:", error);
      }
    }
  }

  const availableFields = [
    { key: "date", label: "Data" },
    { key: "description", label: "Descrição" },
    { key: "amount", label: "Valor" },
    { key: "direction", label: "Direção" },
    { key: "category", label: "Categoria" },
    { key: "account", label: "Conta" },
    { key: "document", label: "Documento" },
    { key: "status", label: "Status" }
  ];

  if (loading) {
    return <div className="table-empty">Carregando configurações...</div>;
  }

  return (
    <div className="erp-export-settings" style={{ padding: "20px", maxWidth: "800px" }}>
      <div className="page-heading" style={{ marginBottom: "24px" }}>
        <div>
          <div className="eyebrow">CONFIGURAÇÕES</div>
          <h1>Exportação ERP</h1>
          <p>Configure como os dados serão exportados para cada ERP.</p>
        </div>
        {onClose && (
          <button className="secondary-button" onClick={onClose}>
            ✕ Fechar
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "24px" }}>
        {/* Lista de ERPs */}
        <div>
          <h3 style={{ marginBottom: "12px", fontSize: "14px" }}>ERPs Configurados</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {ERP_OPTIONS.map((erp) => {
              const config = configs.find((c) => c.erp_format === erp.value);
              return (
                <button
                  key={erp.value}
                  onClick={() => handleErpChange(erp.value as ErpFormat)}
                  style={{
                    padding: "12px",
                    border: "1px solid var(--line)",
                    borderRadius: "8px",
                    background: selectedErp === erp.value ? "var(--rsbuild-terracotta-soft)" : "var(--surface)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s"
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>{erp.label}</div>
                  {config && (
                    <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                      {config.is_default && "⭐ Padrão · "}
                      {Object.keys(config.field_mapping).length} campos mapeados
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Configuração do ERP selecionado */}
        <div>
          <h3 style={{ marginBottom: "16px", fontSize: "14px" }}>
            Configurar: {ERP_OPTIONS.find((e) => e.value === selectedErp)?.label}
          </h3>

          <div className="panel" style={{ padding: "20px" }}>
            <h4 style={{ marginBottom: "16px", fontSize: "13px" }}>Mapeamento de Campos</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
              {availableFields.map((field) => (
                <div key={field.key}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    {field.label} (RSBUILD)
                  </label>
                  <input
                    type="text"
                    value={fieldMapping[field.key] || ""}
                    onChange={(e) => setFieldMapping({ ...fieldMapping, [field.key]: e.target.value })}
                    placeholder={getDefaultFieldMapping(selectedErp)[field.key] || field.label}
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      fontSize: "13px"
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                Colunas Personalizadas (separadas por vírgula)
              </label>
              <input
                type="text"
                value={customColumns}
                onChange={(e) => setCustomColumns(e.target.value)}
                placeholder="Coluna1, Coluna2, Coluna3"
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid var(--line)",
                  borderRadius: "6px",
                  fontSize: "13px"
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                />
                <span style={{ fontSize: "13px" }}>Definir como padrão para esta organização</span>
              </label>
            </div>

            <button
              className="primary-button"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Salvando..." : "Salvar Configuração"}
            </button>
          </div>
        </div>
      </div>

      {/* Guide Balloon */}
      {getGuide("erp_settings") && (
        <GuideBalloon
          guideId="erp_settings"
          steps={getGuide("erp_settings")!.steps}
          autoStart={true}
        />
      )}
    </div>
  );
}
