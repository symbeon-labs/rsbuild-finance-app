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
  brandColor?: string;
  onClose: () => void;
  onSave: (name: string, logoUrl: string, modules?: EnabledModulesConfig, orgId?: OrganizationId, brandColor?: string) => void;
  onUploadLogo: (file: File) => void;
}

export function WorkspaceModal({
  isOpen,
  companyName,
  companyLogoUrl,
  currentOrgId = "rsbuild",
  isSuperAdmin,
  enabledModules,
  brandColor = "#B5583C",
  onClose,
  onSave,
  onUploadLogo
}: WorkspaceModalProps) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationId>(currentOrgId);
  const [typedName, setTypedName] = useState<string>(companyName);
  const [activeModulesState, setActiveModulesState] = useState<EnabledModulesConfig>(enabledModules);
  const [currentColor, setCurrentColor] = useState<string>(brandColor);
  const [showTenantSelector, setShowTenantSelector] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedOrg(currentOrgId);
      setTypedName(companyName);
      setActiveModulesState(enabledModules);
      setCurrentColor(brandColor);
      setShowTenantSelector(false); // Garante que começa recolhido para reuniões
    }
  }, [isOpen, currentOrgId, companyName, enabledModules, brandColor]);

  if (!isOpen) return null;

  function handleSelectPreset(preset: OrganizationPreset) {
    setSelectedOrg(preset.id);
    setTypedName(preset.name);
    setActiveModulesState(preset.enabledModules);
    if (preset.brandColor) {
      setCurrentColor(preset.brandColor);
    }
  }

  const currentPreset = ORGANIZATION_PRESETS.find((p) => p.id === selectedOrg);

  return (
    <div className="workspace-modal-backdrop" onClick={onClose}>
      <div className="workspace-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "620px" }}>
        <div className="workspace-modal-header">
          <div>
            <span className="eyebrow">CUSTOMIZAÇÃO CORPORATIVA</span>
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
          Personalize a razão social, logotipo institucional e o portfólio de produtos ativos neste ambiente.
        </p>

        {/* Trava de Blindagem Multi-Tenant / Seletor Restrito com Modo Apresentação */}
        {isSuperAdmin && (
          <div style={{ marginBottom: "16px", border: "1px solid var(--line)", borderRadius: "8px", padding: "12px", background: "var(--surface)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "var(--green-text, #10B981)" }} />
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-brand)", letterSpacing: "0.5px" }}>
                  NÚCLEO ATIVO: {selectedOrg === "rsbuild" ? "RSBUILD INOVAÇÃO" : selectedOrg === "hub_acai" ? "HUB AÇAÍ SALVADOR" : "MUNDO DO SABOR"}
                </span>
                <span style={{ fontSize: "9px", background: "rgba(16, 185, 129, 0.12)", color: "var(--green-text, #10B981)", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                  Blindado
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowTenantSelector(!showTenantSelector)}
                style={{
                  fontSize: "10px",
                  background: "transparent",
                  border: "1px solid var(--line)",
                  color: "var(--muted)",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: 600
                }}
              >
                {showTenantSelector ? "▲ Ocultar Núcleos" : "⚙️ Alternar Núcleo"}
              </button>
            </div>

            {/* Painel de seleção de empresas (oculto por padrão durante reuniões) */}
            {showTenantSelector && (
              <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px dashed var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--rsbuild-terracotta)", letterSpacing: "0.8px" }}>
                    ALÇADA SYMBEON · NÚCLEOS HOMOLOGADOS
                  </span>
                  <span style={{ fontSize: "9px", color: "var(--muted)" }}>Confidencial</span>
                </div>
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
                        <strong style={{ fontSize: "11px", color: "var(--ink)", display: "block", marginTop: "2px" }}>
                          {preset.id === "rsbuild" ? "RSBUILD" : preset.id === "hub_acai" ? "Hub Açaí" : "Mundo do Sabor"}
                        </strong>
                        <span style={{ fontSize: "9px", color: "var(--muted)", display: "block", marginTop: "2px", lineHeight: "1.3" }}>
                          {preset.tagline}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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
            const modReconciliationInput = form.elements.namedItem("modReconciliation") as HTMLInputElement;
            const modLogisticsInput = form.elements.namedItem("modLogistics") as HTMLInputElement;
            const modAuditInput = form.elements.namedItem("modAudit") as HTMLInputElement;

            const nextModules: EnabledModulesConfig = {
              finance: modFinanceInput ? modFinanceInput.checked : activeModulesState.finance,
              reconciliation: modReconciliationInput ? modReconciliationInput.checked : activeModulesState.reconciliation,
              logistics: modLogisticsInput ? modLogisticsInput.checked : activeModulesState.logistics,
              audit: modAuditInput ? modAuditInput.checked : activeModulesState.audit
            };

            onSave(nameInput.value, urlInput.value || companyLogoUrl, nextModules, selectedOrg, currentColor);
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

          {/* Seletor de Paleta / Identidade Visual da Marca */}
          <div style={{ display: "grid", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink)", fontFamily: "var(--font-brand)" }}>
                PALETA DE CORES / IDENTIDADE VISUAL
              </span>
              <span style={{ fontSize: "10px", color: "var(--muted)" }}>
                Padrão: Laranja RSBUILD (#B5583C)
              </span>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              {[
                { name: "Laranja RSBUILD (Padrão)", color: "#B5583C" },
                { name: "Roxo Hub Açaí", color: "#7C3AED" },
                { name: "Azul Mundo do Sabor", color: "#2563EB" },
                { name: "Verde Esmeralda", color: "#059669" },
                { name: "Grafite Corporativo", color: "#374151" }
              ].map((swatch) => {
                const isSelected = currentColor.toLowerCase() === swatch.color.toLowerCase();
                return (
                  <button
                    key={swatch.color}
                    type="button"
                    onClick={() => setCurrentColor(swatch.color)}
                    title={swatch.name}
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      backgroundColor: swatch.color,
                      border: isSelected ? "3px solid var(--ink)" : "2px solid #ffffff",
                      outline: isSelected ? "2px solid " + swatch.color : "none",
                      cursor: "pointer",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                      transition: "transform 0.15s ease"
                    }}
                  />
                );
              })}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "4px" }}>
                <input
                  type="color"
                  value={currentColor}
                  onChange={(e) => setCurrentColor(e.target.value)}
                  style={{
                    width: "36px",
                    height: "32px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    cursor: "pointer",
                    padding: "0"
                  }}
                  title="Selecionar cor personalizada"
                />
                <span style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--muted)" }}>
                  {currentColor.toUpperCase()}
                </span>
              </div>
            </div>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "10px" }}>
                {/* 1. Finanças */}
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: activeModulesState.finance ? "1.5px solid var(--rsbuild-terracotta)" : "1px solid var(--line)",
                    background: activeModulesState.finance ? "rgba(181, 88, 60, 0.08)" : "var(--surface)",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <input
                    type="checkbox"
                    name="modFinance"
                    checked={activeModulesState.finance}
                    onChange={(e) => setActiveModulesState((curr) => ({ ...curr, finance: e.target.checked }))}
                    style={{ accentColor: "var(--rsbuild-terracotta)", width: "16px", height: "16px", marginTop: "2px" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "12px", color: "var(--ink)" }}>💼 1. Finanças & Caixa</strong>
                      <span style={{ fontSize: "8.5px", fontWeight: 700, color: activeModulesState.finance ? "var(--green-text, #10B981)" : "var(--muted)" }}>
                        {activeModulesState.finance ? "● ATIVO" : "○ INATIVO"}
                      </span>
                    </div>
                    <span style={{ fontSize: "10.5px", color: "var(--muted)", display: "block", marginTop: "2px", lineHeight: "1.3" }}>
                      Extratos bancários multibanco (OFX/CSV), lançamentos e DRE.
                    </span>
                  </div>
                </label>

                {/* 2. Reconciliação */}
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: activeModulesState.reconciliation ? "1.5px solid var(--rsbuild-terracotta)" : "1px solid var(--line)",
                    background: activeModulesState.reconciliation ? "rgba(181, 88, 60, 0.08)" : "var(--surface)",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <input
                    type="checkbox"
                    name="modReconciliation"
                    checked={activeModulesState.reconciliation}
                    onChange={(e) => setActiveModulesState((curr) => ({ ...curr, reconciliation: e.target.checked }))}
                    style={{ accentColor: "var(--rsbuild-terracotta)", width: "16px", height: "16px", marginTop: "2px" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "12px", color: "var(--ink)" }}>⚡ 2. Reconciliação ERP</strong>
                      <span style={{ fontSize: "8.5px", fontWeight: 700, color: activeModulesState.reconciliation ? "var(--green-text, #10B981)" : "var(--muted)" }}>
                        {activeModulesState.reconciliation ? "● ATIVO" : "○ INATIVO"}
                      </span>
                    </div>
                    <span style={{ fontSize: "10.5px", color: "var(--muted)", display: "block", marginTop: "2px", lineHeight: "1.3" }}>
                      Matching autônomo de títulos x extratos e liquidações em lote no Omie.
                    </span>
                  </div>
                </label>

                {/* 3. Logística */}
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: activeModulesState.logistics ? "1.5px solid var(--rsbuild-terracotta)" : "1px solid var(--line)",
                    background: activeModulesState.logistics ? "rgba(181, 88, 60, 0.08)" : "var(--surface)",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <input
                    type="checkbox"
                    name="modLogistics"
                    checked={activeModulesState.logistics}
                    onChange={(e) => setActiveModulesState((curr) => ({ ...curr, logistics: e.target.checked }))}
                    style={{ accentColor: "var(--rsbuild-terracotta)", width: "16px", height: "16px", marginTop: "2px" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "12px", color: "var(--ink)" }}>🚚 3. Logística & Expedição</strong>
                      <span style={{ fontSize: "8.5px", fontWeight: 700, color: activeModulesState.logistics ? "var(--green-text, #10B981)" : "var(--muted)" }}>
                        {activeModulesState.logistics ? "● ATIVO" : "○ INATIVO"}
                      </span>
                    </div>
                    <span style={{ fontSize: "10.5px", color: "var(--muted)", display: "block", marginTop: "2px", lineHeight: "1.3" }}>
                      Decodificação WhatsApp B2B, cubagem de frota e canhotos de entrega.
                    </span>
                  </div>
                </label>

                {/* 4. Auditoria */}
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: activeModulesState.audit ? "1.5px solid var(--rsbuild-terracotta)" : "1px solid var(--line)",
                    background: activeModulesState.audit ? "rgba(181, 88, 60, 0.08)" : "var(--surface)",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <input
                    type="checkbox"
                    name="modAudit"
                    checked={activeModulesState.audit}
                    onChange={(e) => setActiveModulesState((curr) => ({ ...curr, audit: e.target.checked }))}
                    style={{ accentColor: "var(--rsbuild-terracotta)", width: "16px", height: "16px", marginTop: "2px" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "12px", color: "var(--ink)" }}>⚖️ 4. Auditoria & Agente RS</strong>
                      <span style={{ fontSize: "8.5px", fontWeight: 700, color: activeModulesState.audit ? "var(--green-text, #10B981)" : "var(--muted)" }}>
                        {activeModulesState.audit ? "● ATIVO" : "○ INATIVO"}
                      </span>
                    </div>
                    <span style={{ fontSize: "10.5px", color: "var(--muted)", display: "block", marginTop: "2px", lineHeight: "1.3" }}>
                      Blindagem jurídica (Lei 5.474/68), laudos periciais e integração RS Advogados.
                    </span>
                  </div>
                </label>
              </div>

              {/* Diretório de Clientes e Fornecedores Pré-cadastrados da Empresa */}
              {currentPreset?.contacts && currentPreset.contacts.length > 0 && (
                <div style={{ marginTop: "10px", padding: "10px", borderRadius: "8px", background: "var(--bg)", border: "1px dashed var(--line)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-brand)" }}>
                      📇 CADASTRO BASE DE CLIENTES & FORNECEDORES ({currentPreset.contacts.length})
                    </span>
                    <span style={{ fontSize: "9px", color: "var(--green-text, #10B981)", fontWeight: 600 }}>
                      ● Integrado
                    </span>
                  </div>
                  <div style={{ maxHeight: "110px", overflowY: "auto", fontSize: "10px", display: "grid", gap: "4px" }}>
                    {currentPreset.contacts.map((contact) => (
                      <div
                        key={contact.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          background: "var(--surface)",
                          border: "1px solid var(--line)"
                        }}
                      >
                        <div>
                          <span
                            style={{
                              fontSize: "8.5px",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              padding: "1px 4px",
                              borderRadius: "3px",
                              marginRight: "6px",
                              background: contact.type === "cliente" ? "rgba(16, 185, 129, 0.12)" : "rgba(59, 130, 246, 0.12)",
                              color: contact.type === "cliente" ? "var(--green-text, #10B981)" : "#2563EB"
                            }}
                          >
                            {contact.type}
                          </span>
                          <strong style={{ color: "var(--ink)" }}>{contact.name}</strong>
                          {contact.city && <span style={{ color: "var(--muted)", marginLeft: "4px" }}>· {contact.city}</span>}
                        </div>
                        <span style={{ fontFamily: "monospace", color: "var(--muted)", fontSize: "9px" }}>
                          {contact.document}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
