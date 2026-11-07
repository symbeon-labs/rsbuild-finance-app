"use client";

import { useEffect, useRef, useState } from "react";
import { EnabledModulesConfig, OrganizationPreset, ORGANIZATION_PRESETS, OrganizationId } from "@/app/types/workspace";

interface WorkspaceModalProps {
  isOpen: boolean;
  companyName: string;
  companyLogoUrl: string;
  currentOrgId?: OrganizationId;
  isSuperAdmin: boolean;
  enabledModules: EnabledModulesConfig;
  onClose: () => void;
  onSave: (name: string, logoUrl: string, modules?: EnabledModulesConfig, orgId?: OrganizationId) => void;
  onUploadLogo: (file: File) => void;
}

export function WorkspaceModal({
  isOpen,
  companyName,
  companyLogoUrl,
  currentOrgId = "rsbuild",
  isSuperAdmin,
  enabledModules,
  onClose,
  onSave,
  onUploadLogo
}: WorkspaceModalProps) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationId>(currentOrgId);
  const [typedName, setTypedName] = useState<string>(companyName);
  const [activeModulesState, setActiveModulesState] = useState<EnabledModulesConfig>(enabledModules);

  useEffect(() => {
    if (isOpen) {
      setSelectedOrg(currentOrgId);
      setTypedName(companyName);
      setActiveModulesState(enabledModules);
    }
  }, [isOpen, currentOrgId, companyName, enabledModules]);

  if (!isOpen) return null;

  function handleSelectPreset(preset: OrganizationPreset) {
    setSelectedOrg(preset.id);
    setTypedName(preset.name);
    setActiveModulesState(preset.enabledModules);
  }

  return (
    <div className="workspace-modal-backdrop" onClick={onClose}>
      <div className="workspace-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "560px" }}>
        <div className="workspace-modal-header">
          <div>
            <span className="eyebrow">CUSTOMIZAÇÃO DA EMPRESA</span>
            <h3>Identidade do Workspace</h3>
          </div>
          <button
            type="button"
            className="workspace-modal-close"
            onClick={onClose}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <p className="workspace-modal-desc">
          Personalize a razão social, o logotipo e a parametrização dos módulos do ambiente operacional.
        </p>

        {/* Seletor Multi-Tenant Restrito ao Superadmin */}
        {isSuperAdmin && (
          <div style={{ marginBottom: "16px", border: "1px solid var(--line)", borderRadius: "8px", padding: "12px", background: "var(--surface)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "1px", color: "var(--rsbuild-terracotta)", fontFamily: "var(--font-brand)" }}>
                EMPRESAS HOMOLOGADAS (EXCLUSIVO SUPERADMIN)
              </span>
              <span style={{ fontSize: "9px", background: "var(--rsbuild-terracotta-soft)", color: "var(--rsbuild-terracotta)", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                🔒 Alçada Symbeon
              </span>
            </div>
            <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 10px" }}>
              Selecione uma das 3 empresas homologadas para carregar seus dados e parametrização operacional:
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
              {ORGANIZATION_PRESETS.map((preset) => {
                const isCurrent = selectedOrg === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    style={{
                      border: isCurrent ? "2px solid var(--rsbuild-terracotta)" : "1px solid var(--line)",
                      background: isCurrent ? "var(--surface-raised, rgba(255,255,255,0.06))" : "transparent",
                      borderRadius: "6px",
                      padding: "8px 6px",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <span style={{ fontSize: "9px", fontWeight: 700, color: "var(--rsbuild-terracotta)", display: "block" }}>
                      {preset.badge}
                    </span>
                    <strong style={{ fontSize: "11.5px", color: "var(--ink)", display: "block", marginTop: "2px" }}>
                      {preset.id === "rsbuild" ? "RSBUILD" : preset.id === "hub_acai" ? "Hub Açaí" : "Mundo do Sabor"}
                    </strong>
                    <span style={{ fontSize: "9.5px", color: "var(--muted)", display: "block", marginTop: "2px" }}>
                      {preset.tagline}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Hidden File Input for Logo */}
        <input
          type="file"
          ref={logoInputRef}
          style={{ display: "none" }}
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUploadLogo(file);
          }}
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const nameInput = form.elements.namedItem("companyName") as HTMLInputElement;
            const urlInput = form.elements.namedItem("companyLogoUrl") as HTMLInputElement;
            const modFinanceInput = form.elements.namedItem("modFinance") as HTMLInputElement;
            const modLogisticsInput = form.elements.namedItem("modLogistics") as HTMLInputElement;
            
            const nextModules: EnabledModulesConfig = {
              finance: modFinanceInput ? modFinanceInput.checked : activeModulesState.finance,
              logistics: modLogisticsInput ? modLogisticsInput.checked : activeModulesState.logistics
            };

            onSave(nameInput.value, urlInput.value || companyLogoUrl, nextModules, selectedOrg);
          }}
          style={{ display: "grid", gap: "16px" }}
        >
          <label className="login-field" style={{ fontSize: "11px" }}>
            <span>NOME DA EMPRESA OU WORKSPACE</span>
            <input
              name="companyName"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              required
              placeholder="Ex: Mundo do Sabor Alimentos, Distribuidora Salvador..."
              style={{
                height: "44px",
                border: "1px solid var(--line)",
                borderRadius: "6px",
                padding: "0 12px",
                fontSize: "13px",
                background: "var(--bg)",
                color: "var(--ink)"
              }}
            />
          </label>

          <div style={{ display: "grid", gap: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink)", fontFamily: "var(--font-brand)" }}>
              LOGOTIPO DA EMPRESA (OPCIONAL)
            </span>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => logoInputRef.current?.click()}
                style={{ fontSize: "11px", padding: "8px 14px" }}
              >
                <span>📷</span> Fazer upload de imagem
              </button>
              {companyLogoUrl && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onSave(typedName, "", enabledModules, selectedOrg)}
                  style={{ fontSize: "11px", color: "var(--red)" }}
                >
                  Remover logo
                </button>
              )}
            </div>
            {companyLogoUrl && (
              <div style={{ background: "var(--bg)", padding: "10px", borderRadius: "6px", display: "inline-block", marginTop: "4px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={companyLogoUrl} alt="Preview" style={{ maxHeight: "36px", maxWidth: "180px", objectFit: "contain" }} />
              </div>
            )}
            <input
              name="companyLogoUrl"
              defaultValue={companyLogoUrl.startsWith("data:") ? "" : companyLogoUrl}
              placeholder="Ou cole a URL direta de uma imagem (https://...)"
              style={{
                height: "40px",
                border: "1px solid var(--line)",
                borderRadius: "6px",
                padding: "0 12px",
                fontSize: "12px",
                background: "var(--bg)",
                color: "var(--ink)"
              }}
            />
          </div>

          {/* Controle de Módulos Contratados / Ativos (Exclusivo Superadmin / Symbeon) */}
          {isSuperAdmin ? (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: "14px", display: "grid", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--rsbuild-terracotta)", letterSpacing: "1px", fontFamily: "var(--font-brand)" }}>
                  MÓDULOS CONTRATADOS DO WORKSPACE (SUPERADMIN)
                </span>
                <span style={{ fontSize: "10px", background: "var(--rsbuild-terracotta-soft)", color: "var(--rsbuild-terracotta)", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                  🔒 Acesso Symbeon
                </span>
              </div>
              <div style={{ display: "grid", gap: "10px", background: "var(--bg)", padding: "12px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", cursor: "pointer", fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    name="modFinance"
                    checked={activeModulesState.finance}
                    onChange={(e) => setActiveModulesState((curr) => ({ ...curr, finance: e.target.checked }))}
                    style={{ accentColor: "var(--rsbuild-terracotta)", width: "16px", height: "16px" }}
                  />
                  <span>💼 Módulo Financeiro (Conciliação, Extratos & Baixas ERP)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", cursor: "pointer", fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    name="modLogistics"
                    checked={activeModulesState.logistics}
                    onChange={(e) => setActiveModulesState((curr) => ({ ...curr, logistics: e.target.checked }))}
                    style={{ accentColor: "var(--rsbuild-terracotta)", width: "16px", height: "16px" }}
                  />
                  <span>🚚 Módulo Logística & Expedição (WhatsApp, Canhotos & Cargas)</span>
                </label>
              </div>
            </div>
          ) : (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "var(--muted)" }}>
              <span>Licenciamento do Workspace gerenciado por <strong>Symbeon / RSBUILD</strong></span>
              <span style={{ color: "var(--green)", fontWeight: 600 }}>● Ativo</span>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="primary-button"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
