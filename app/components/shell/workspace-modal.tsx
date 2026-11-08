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
  const [activeTab, setActiveTab] = useState<"marca" | "modulos" | "dados">("marca");
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
      setActiveTab("marca");
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
    <div className="workspace-modal-backdrop" onClick={onClose} style={{ overflowY: "auto", padding: "16px" }}>
      <div
        className="workspace-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "680px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          padding: "20px 24px 16px",
          overflow: "hidden"
        }}
      >
        {/* Cabeçalho Fixo */}
        <div className="workspace-modal-header" style={{ marginBottom: "12px", flexShrink: 0 }}>
          <div>
            <span className="eyebrow" style={{ fontSize: "10px", letterSpacing: "1px" }}>CUSTOMIZAÇÃO CORPORATIVA</span>
            <h3 style={{ fontSize: "18px" }}>Identidade do Workspace</h3>
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

        {/* Abas Superiores de Navegação Interna */}
        <div
          style={{
            display: "flex",
            gap: "6px",
            borderBottom: "1px solid var(--line)",
            paddingBottom: "8px",
            marginBottom: "14px",
            flexShrink: 0
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("marca")}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 700,
              fontFamily: "var(--font-brand)",
              border: activeTab === "marca" ? "1.5px solid var(--rsbuild-terracotta)" : "1px solid transparent",
              background: activeTab === "marca" ? "var(--rsbuild-terracotta-soft)" : "transparent",
              color: activeTab === "marca" ? "var(--rsbuild-terracotta)" : "var(--muted)",
              cursor: "pointer"
            }}
          >
            🎨 Identidade & Marca
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("modulos")}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 700,
              fontFamily: "var(--font-brand)",
              border: activeTab === "modulos" ? "1.5px solid var(--rsbuild-terracotta)" : "1px solid transparent",
              background: activeTab === "modulos" ? "var(--rsbuild-terracotta-soft)" : "transparent",
              color: activeTab === "modulos" ? "var(--rsbuild-terracotta)" : "var(--muted)",
              cursor: "pointer"
            }}
          >
            📦 Módulos & Núcleos
          </button>
          {currentPreset?.contacts && currentPreset.contacts.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab("dados")}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: 700,
                fontFamily: "var(--font-brand)",
                border: activeTab === "dados" ? "1.5px solid var(--rsbuild-terracotta)" : "1px solid transparent",
                background: activeTab === "dados" ? "var(--rsbuild-terracotta-soft)" : "transparent",
                color: activeTab === "dados" ? "var(--rsbuild-terracotta)" : "var(--muted)",
                cursor: "pointer"
              }}
            >
              📇 Diretório Base ({currentPreset.contacts.length})
            </button>
          )}
        </div>

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

        {/* Formulário com Área Scrollável e Footer Fixo com Botão de Salvar Sempre Visível */}
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

            const targetName = nameInput ? nameInput.value : typedName;
            const targetLogo = urlInput ? (urlInput.value || companyLogoUrl) : companyLogoUrl;

            onSave(targetName, targetLogo, nextModules, selectedOrg, currentColor);
          }}
          style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
        >
          {/* Conteúdo com Scroll Próprio */}
          <div style={{ flex: 1, overflowY: "auto", paddingRight: "4px", display: "grid", gap: "14px", alignContent: "start" }}>
            {activeTab === "marca" && (
              <>
                <label className="login-field" style={{ fontSize: "11px" }}>
                  <span>NOME DA EMPRESA OU WORKSPACE</span>
                  <input
                    name="companyName"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    required
                    placeholder="Ex: Mundo do Sabor Alimentos, Distribuidora Salvador..."
                    style={{
                      height: "40px",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      padding: "0 12px",
                      fontSize: "13px",
                      background: "var(--bg)",
                      color: "var(--ink)"
                    }}
                  />
                </label>

                <div style={{ display: "grid", gap: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink)", fontFamily: "var(--font-brand)" }}>
                    LOGOTIPO DA EMPRESA (OPCIONAL)
                  </span>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => logoInputRef.current?.click()}
                      style={{ fontSize: "11px", padding: "6px 12px" }}
                    >
                      <span>📷</span> Fazer upload de imagem
                    </button>
                    {companyLogoUrl && (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => onSave(typedName, "", enabledModules, selectedOrg, currentColor)}
                        style={{ fontSize: "11px", color: "var(--red)", padding: "6px 10px" }}
                      >
                        Remover logo
                      </button>
                    )}
                  </div>
                  {companyLogoUrl && (
                    <div style={{ background: "var(--bg)", padding: "8px", borderRadius: "6px", display: "inline-block" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={companyLogoUrl} alt="Preview" style={{ maxHeight: "32px", maxWidth: "160px", objectFit: "contain" }} />
                    </div>
                  )}
                  <input
                    name="companyLogoUrl"
                    defaultValue={companyLogoUrl.startsWith("data:") ? "" : companyLogoUrl}
                    placeholder="Ou cole a URL direta de uma imagem (https://...)"
                    style={{
                      height: "36px",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      padding: "0 12px",
                      fontSize: "11px",
                      background: "var(--bg)",
                      color: "var(--ink)"
                    }}
                  />
                </div>

                {/* Seletor de Paleta / Identidade Visual da Marca */}
                <div style={{ display: "grid", gap: "8px", padding: "10px 12px", borderRadius: "8px", background: "var(--surface)", border: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-brand)" }}>
                      PALETA DE CORES DA INTERFACE
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
                            width: "30px",
                            height: "30px",
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
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "6px" }}>
                      <input
                        type="color"
                        value={currentColor}
                        onChange={(e) => setCurrentColor(e.target.value)}
                        style={{
                          width: "34px",
                          height: "30px",
                          borderRadius: "6px",
                          border: "1px solid var(--line)",
                          cursor: "pointer",
                          padding: "0"
                        }}
                        title="Selecionar cor personalizada"
                      />
                      <span style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--ink)", fontWeight: 600 }}>
                        {currentColor.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === "modulos" && (
              <>
                {/* Trava de Blindagem Multi-Tenant / Seletor Restrito com Modo Apresentação */}
                {isSuperAdmin && (
                  <div style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "10px 12px", background: "var(--surface)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "var(--green-text, #10B981)" }} />
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-brand)", letterSpacing: "0.5px" }}>
                          NÚCLEO: {selectedOrg === "rsbuild" ? "RSBUILD INOVAÇÃO" : selectedOrg === "hub_acai" ? "HUB AÇAÍ SALVADOR" : "MUNDO DO SABOR"}
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
                        {showTenantSelector ? "▲ Ocultar" : "⚙️ Alternar Núcleo"}
                      </button>
                    </div>

                    {showTenantSelector && (
                      <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed var(--line)" }}>
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
                                  cursor: "pointer"
                                }}
                              >
                                <span style={{ fontSize: "9px", fontWeight: 700, color: "var(--rsbuild-terracotta)", display: "block" }}>
                                  {preset.badge}
                                </span>
                                <strong style={{ fontSize: "11px", color: "var(--ink)", display: "block", marginTop: "2px" }}>
                                  {preset.id === "rsbuild" ? "RSBUILD" : preset.id === "hub_acai" ? "Hub Açaí" : "Mundo do Sabor"}
                                </strong>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Grid dos 4 Produtos Contratados */}
                <div style={{ display: "grid", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--rsbuild-terracotta)", letterSpacing: "1px", fontFamily: "var(--font-brand)" }}>
                      PRODUTOS MODULARES CONTRATADOS
                    </span>
                    <span style={{ fontSize: "9px", background: "var(--rsbuild-terracotta-soft)", color: "var(--rsbuild-terracotta)", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                      🔒 Alçada Symbeon
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "8px" }}>
                    {/* 1. Finanças */}
                    <label
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: activeModulesState.finance ? "1.5px solid var(--rsbuild-terracotta)" : "1px solid var(--line)",
                        background: activeModulesState.finance ? "rgba(181, 88, 60, 0.08)" : "var(--surface)",
                        cursor: "pointer"
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
                          <strong style={{ fontSize: "11.5px", color: "var(--ink)" }}>💼 1. Finanças & Caixa</strong>
                          <span style={{ fontSize: "8.5px", fontWeight: 700, color: activeModulesState.finance ? "var(--green-text, #10B981)" : "var(--muted)" }}>
                            {activeModulesState.finance ? "● ATIVO" : "○ INATIVO"}
                          </span>
                        </div>
                        <span style={{ fontSize: "10px", color: "var(--muted)", display: "block", marginTop: "2px", lineHeight: "1.2" }}>
                          Extratos bancários multibanco e DRE.
                        </span>
                      </div>
                    </label>

                    {/* 2. Reconciliação */}
                    <label
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: activeModulesState.reconciliation ? "1.5px solid var(--rsbuild-terracotta)" : "1px solid var(--line)",
                        background: activeModulesState.reconciliation ? "rgba(181, 88, 60, 0.08)" : "var(--surface)",
                        cursor: "pointer"
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
                          <strong style={{ fontSize: "11.5px", color: "var(--ink)" }}>⚡ 2. Reconciliação ERP</strong>
                          <span style={{ fontSize: "8.5px", fontWeight: 700, color: activeModulesState.reconciliation ? "var(--green-text, #10B981)" : "var(--muted)" }}>
                            {activeModulesState.reconciliation ? "● ATIVO" : "○ INATIVO"}
                          </span>
                        </div>
                        <span style={{ fontSize: "10px", color: "var(--muted)", display: "block", marginTop: "2px", lineHeight: "1.2" }}>
                          Matching autônomo e baixas em lote Omie.
                        </span>
                      </div>
                    </label>

                    {/* 3. Logística */}
                    <label
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: activeModulesState.logistics ? "1.5px solid var(--rsbuild-terracotta)" : "1px solid var(--line)",
                        background: activeModulesState.logistics ? "rgba(181, 88, 60, 0.08)" : "var(--surface)",
                        cursor: "pointer"
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
                          <strong style={{ fontSize: "11.5px", color: "var(--ink)" }}>🚚 3. Logística & Expedição</strong>
                          <span style={{ fontSize: "8.5px", fontWeight: 700, color: activeModulesState.logistics ? "var(--green-text, #10B981)" : "var(--muted)" }}>
                            {activeModulesState.logistics ? "● ATIVO" : "○ INATIVO"}
                          </span>
                        </div>
                        <span style={{ fontSize: "10px", color: "var(--muted)", display: "block", marginTop: "2px", lineHeight: "1.2" }}>
                          WhatsApp B2B, cubagem e canhotos.
                        </span>
                      </div>
                    </label>

                    {/* 4. Auditoria */}
                    <label
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: activeModulesState.audit ? "1.5px solid var(--rsbuild-terracotta)" : "1px solid var(--line)",
                        background: activeModulesState.audit ? "rgba(181, 88, 60, 0.08)" : "var(--surface)",
                        cursor: "pointer"
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
                          <strong style={{ fontSize: "11.5px", color: "var(--ink)" }}>⚖️ 4. Auditoria & Agente RS</strong>
                          <span style={{ fontSize: "8.5px", fontWeight: 700, color: activeModulesState.audit ? "var(--green-text, #10B981)" : "var(--muted)" }}>
                            {activeModulesState.audit ? "● ATIVO" : "○ INATIVO"}
                          </span>
                        </div>
                        <span style={{ fontSize: "10px", color: "var(--muted)", display: "block", marginTop: "2px", lineHeight: "1.2" }}>
                          Blindagem Lei 5.474/68 e contencioso RS.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </>
            )}

            {activeTab === "dados" && currentPreset?.contacts && (
              <div style={{ padding: "8px 10px", borderRadius: "8px", background: "var(--bg)", border: "1px dashed var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-brand)" }}>
                    📇 CLIENTES E FORNECEDORES HOMOLOGADOS ({currentPreset.contacts.length})
                  </span>
                  <span style={{ fontSize: "9px", color: "var(--green-text, #10B981)", fontWeight: 700 }}>
                    ● Integrado
                  </span>
                </div>
                <div style={{ maxHeight: "240px", overflowY: "auto", fontSize: "11px", display: "grid", gap: "6px" }}>
                  {currentPreset.contacts.map((contact) => (
                    <div
                      key={contact.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 10px",
                        borderRadius: "5px",
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
                            padding: "2px 5px",
                            borderRadius: "3px",
                            marginRight: "6px",
                            background: contact.type === "cliente" ? "rgba(16, 185, 129, 0.12)" : "rgba(59, 130, 246, 0.12)",
                            color: contact.type === "cliente" ? "var(--green-text, #10B981)" : "#2563EB"
                          }}
                        >
                          {contact.type}
                        </span>
                        <strong style={{ color: "var(--ink)", fontSize: "11px" }}>{contact.name}</strong>
                        {contact.city && <span style={{ color: "var(--muted)", marginLeft: "4px", fontSize: "10px" }}>· {contact.city}</span>}
                      </div>
                      <span style={{ fontFamily: "monospace", color: "var(--muted)", fontSize: "9.5px" }}>
                        {contact.document}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Rodapé Fixo — Botões de Ação Sempre Visíveis */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "12px",
              paddingTop: "12px",
              borderTop: "1px solid var(--line)",
              flexShrink: 0
            }}
          >
            <div style={{ fontSize: "11px", color: "var(--muted)" }}>
              Workspace: <strong style={{ color: "var(--ink)" }}>{selectedOrg.toUpperCase()}</strong>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={onClose}
                style={{ padding: "8px 16px", fontSize: "12px" }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="primary-button"
                style={{ padding: "8px 20px", fontSize: "12px", fontWeight: 700 }}
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
