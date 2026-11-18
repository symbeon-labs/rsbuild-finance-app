"use client";

import { useEffect, useRef, useState } from "react";
import { EnabledModulesConfig, OrganizationPreset, ORGANIZATION_PRESETS, OrganizationId } from "@/app/types/workspace";
import { RsbuildIcon, type RsbuildIconName } from "@/app/components/rsbuild-icons";
import { getWorkspaceCapabilityAvailability } from "@/app/actions/capability-licenses";

function getPresetIdentity(preset: OrganizationPreset) {
  if (preset.id.endsWith("_qa")) return { label: "AMBIENTE QA", icon: "approval" as RsbuildIconName };
  if (preset.id === "rsbuild") return { label: "HOLDING", icon: "control-tower" as RsbuildIconName };
  if (preset.id === "hub_acai") return { label: "DISTRIBUIÇÃO", icon: "logistics" as RsbuildIconName };
  return { label: "INDÚSTRIA", icon: "finance" as RsbuildIconName };
}

const ORG_ID_BY_SLUG: Record<string, string> = {
  rsbuild: "0269fe05-0990-41a8-a28c-2919691eaf0f",
  hub_acai: "ff3cdab7-3b25-4ea7-aabf-5ae4f9cd9a76",
  mundo_sabor: "c5356414-adce-4fdc-941b-15cfe26b991e",
  hub_acai_qa: "550e8400-e29b-41d4-a716-446655440001",
  mundo_sabor_qa: "550e8400-e29b-41d4-a716-446655440002",
};

interface WorkspaceModalProps {
  isOpen: boolean;
  companyName: string;
  companyLogoUrl: string;
  currentOrgId?: OrganizationId;
  currentOrgRealId?: string;
  currentEnvironment?: "qa" | "production";
  availableOrganizationSlugs?: string[];
  isSuperAdmin: boolean;
  /** Somente Platform Admin pode alterar a disponibilidade de capacidades. */
  canManageModules?: boolean;
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
  currentOrgRealId,
  currentEnvironment = "production",
  availableOrganizationSlugs = [],
  isSuperAdmin,
  canManageModules = false,
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
  const [capabilityStatuses, setCapabilityStatuses] = useState<Record<string, string>>({});
  const [capabilityStatusesLoading, setCapabilityStatusesLoading] = useState(false);
  const [capabilityStatusesError, setCapabilityStatusesError] = useState("");

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

  useEffect(() => {
    let active = true;
    const selectedOrgRealId = ORG_ID_BY_SLUG[selectedOrg] ?? currentOrgRealId;
    const selectedEnvironment = selectedOrg.endsWith("_qa") ? "qa" : currentEnvironment;
    if (isOpen && activeTab === "modulos" && selectedOrgRealId) {
      setCapabilityStatusesLoading(true);
      setCapabilityStatusesError("");
      getWorkspaceCapabilityAvailability(selectedOrgRealId, selectedEnvironment)
        .then((result) => {
          if (!active) return;
          if (result.ok) setCapabilityStatuses(result.capabilities as Record<string, string>);
          else setCapabilityStatusesError(result.error);
        })
        .catch(() => {
          if (active) setCapabilityStatusesError("Não foi possível consultar a disponibilidade dos módulos.");
        })
        .finally(() => {
          if (active) setCapabilityStatusesLoading(false);
        });
    }
    return () => { active = false; };
  }, [isOpen, activeTab, selectedOrg, currentOrgRealId, currentEnvironment]);

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
            <h3 style={{ fontSize: "18px" }}>Configurações do Workspace</h3>
          </div>
          <button
            type="button"
            className="workspace-modal-close"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
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
            <RsbuildIcon name="users" size={15} tone={activeTab === "marca" ? "accent" : "secondary"} /> Identidade & Marca
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
            <RsbuildIcon name="control-tower" size={15} tone={activeTab === "modulos" ? "accent" : "secondary"} /> Módulos & Núcleos
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
              <RsbuildIcon name="document" size={15} tone={activeTab === "dados" ? "accent" : "secondary"} /> Diretório Base ({currentPreset.contacts.length})
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

            const nextModules: EnabledModulesConfig = canManageModules ? {
              finance: modFinanceInput ? modFinanceInput.checked : activeModulesState.finance,
              reconciliation: modReconciliationInput ? modReconciliationInput.checked : activeModulesState.reconciliation,
              logistics: modLogisticsInput ? modLogisticsInput.checked : activeModulesState.logistics,
              audit: modAuditInput ? modAuditInput.checked : activeModulesState.audit
            } : enabledModules;

            const targetName = nameInput ? nameInput.value : typedName;
            const targetLogo = urlInput ? (urlInput.value || companyLogoUrl) : companyLogoUrl;

            // Tenant switching: if the selected org differs from the current one, navigate directly
            const selectedOrgRealId = ORG_ID_BY_SLUG[selectedOrg];
            const isOrgChange = currentOrgRealId
              ? selectedOrgRealId && selectedOrgRealId !== currentOrgRealId
              : selectedOrg !== currentOrgId;
            if (isOrgChange && selectedOrgRealId) {
              document.cookie = `rsbuild_selected_org=${encodeURIComponent(selectedOrgRealId)}; path=/; max-age=31536000; SameSite=Lax`;
              window.location.href = `/?organizationId=${selectedOrgRealId}&tab=visao-geral`;
              return;
            }

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
                      <RsbuildIcon name="import" size={15} tone="secondary" /> Fazer upload de imagem
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
                {availableOrganizationSlugs.length > 1 && (
                  <div style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "10px 12px", background: "var(--surface)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "var(--green-text, #10B981)" }} />
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-brand)", letterSpacing: "0.5px" }}>
                          NÚCLEO: {currentPreset?.name ?? selectedOrg}
                        </span>
                        <span style={{ fontSize: "9px", background: "rgba(16, 185, 129, 0.12)", color: "var(--green-text, #10B981)", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                          <RsbuildIcon name="guardian" size={11} tone="secondary" /> Acesso restrito
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
                        {showTenantSelector ? "Ocultar ambientes" : "Trocar ambiente"}
                      </button>
                    </div>

                    {showTenantSelector && (
                      <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed var(--line)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "8px" }}>
                          {ORGANIZATION_PRESETS.filter((preset) => availableOrganizationSlugs.includes(preset.id)).map((preset) => {
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
                                  <RsbuildIcon name={getPresetIdentity(preset).icon} size={15} tone="accent" />
                                  {getPresetIdentity(preset).label}
                                </span>
                                <strong style={{ fontSize: "11px", color: "var(--ink)", display: "block", marginTop: "5px" }}>
                                  {preset.name}
                                </strong>
                                <span style={{ display: "block", fontSize: "9px", color: "var(--muted)", marginTop: "3px", lineHeight: 1.35 }}>
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

                {/* Catálogo: estado informativo derivado da licença real do tenant. */}
                <div style={{ display: "grid", gap: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--rsbuild-terracotta)", letterSpacing: "1px", fontFamily: "var(--font-brand)" }}>
                      CATÁLOGO DE CAPACIDADES RSBUILD
                    </span>
                    <span style={{ fontSize: "9px", background: "var(--rsbuild-terracotta-soft)", color: "var(--rsbuild-terracotta)", padding: "3px 7px", borderRadius: "5px", fontWeight: 700 }}>
                      <RsbuildIcon name="guardian" size={12} tone="accent" /> DISPONIBILIDADE CONTROLADA PELA RSBUILD
                    </span>
                  </div>
                  <p style={{ margin: 0, color: "var(--muted)", fontSize: "10px", lineHeight: 1.45 }}>
                    A situação abaixo reflete a licença desta organização para o ambiente {selectedOrg.endsWith("_qa") ? "QA" : "PRODUÇÃO"}. Os indicadores são informativos; a gestão de licenças ocorre na governança da plataforma.
                  </p>
                  <p style={{ margin: 0, color: "var(--muted)", fontSize: "9px", lineHeight: 1.4 }}>
                    O Sandbox é um laboratório interno isolado, acessado pela Central RSBUILD. Ele não é um workspace QA nem utiliza este catálogo de licenças diretamente.
                  </p>
                  {capabilityStatusesLoading ? (
                    <div role="status" style={{ padding: 14, border: "1px solid var(--line)", borderRadius: 8, color: "var(--muted)", fontSize: 11 }}>
                      Consultando disponibilidade dos módulos…
                    </div>
                  ) : capabilityStatusesError ? (
                    <div role="alert" style={{ padding: 12, border: "1px solid rgba(217,119,6,.35)", borderRadius: 8, background: "rgba(245,158,11,.07)", color: "var(--muted)", fontSize: 11 }}>
                      {capabilityStatusesError}
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 9 }}>
                      {([
                        { key: "finance", title: "1. Finanças & Caixa", description: "Extratos bancários multibanco e DRE.", icon: "finance" as const },
                        { key: "reconciliation", title: "2. Reconciliação ERP", description: "Matching bancário, títulos e baixas em lote Omie.", icon: "reconciliation" as const },
                        { key: "logistics", title: "3. Logística & Expedição", description: "Pedidos, cubagem e comprovantes de entrega.", icon: "logistics" as const },
                        { key: "audit", title: "4. Auditoria & RS Guardião", description: "Auditoria, evidências e governança.", icon: "guardian" as const }
                      ]).map((module) => {
                        const status = capabilityStatuses[module.key] ?? "blocked";
                        const available = status === "available";
                        const inDevelopment = status === "in_development" || status === "not_implemented" || status === "pending_activation";
                        const tone = available ? "#059669" : inDevelopment || status === "expired" ? "#B7791F" : "var(--muted)";
                        const label = available ? "DISPONÍVEL" : status === "in_development" ? "EM DESENVOLVIMENTO" : status === "not_implemented" ? "LIBERADO · NÃO IMPLEMENTADO" : status === "pending_activation" ? "AGUARDANDO ATIVAÇÃO" : status === "expired" ? "LICENÇA EXPIRADA" : status === "suspended" ? "SUSPENSO" : status === "revoked" ? "REVOGADO" : "AGUARDANDO LIBERAÇÃO";
                        return (
                          <article key={module.key} style={{
                            display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0,
                            padding: "11px 12px", borderRadius: 9,
                            border: available ? "1.5px solid rgba(5,150,105,.55)" : "1px solid var(--line)",
                            background: available ? "rgba(16,185,129,.075)" : "var(--surface)",
                            boxShadow: available ? "inset 3px 0 0 #059669" : "none"
                          }}>
                            <span aria-hidden="true" style={{
                              display: "grid", placeItems: "center", flex: "0 0 30px", width: 30, height: 30,
                              borderRadius: 8, background: available ? "rgba(5,150,105,.12)" : "var(--bg)", color: tone
                            }}>
                              <RsbuildIcon name={module.icon} size={17} tone="secondary" />
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                                <strong style={{ color: "var(--ink)", fontSize: 11.5, lineHeight: 1.35 }}>{module.title}</strong>
                                <span style={{
                                  flex: "0 0 auto", maxWidth: 132, textAlign: "right", fontSize: 8, lineHeight: 1.3,
                                  fontWeight: 800, letterSpacing: ".025em", color: tone
                                }}>
                                  {label}
                                </span>
                              </div>
                              <span style={{ display: "block", marginTop: 4, color: "var(--muted)", fontSize: 10, lineHeight: 1.4 }}>
                                {module.description}
                              </span>
                              {available && <span style={{ display: "inline-flex", marginTop: 7, padding: "3px 7px", borderRadius: 999, background: "rgba(5,150,105,.12)", color: "#047857", fontSize: 8, fontWeight: 800, letterSpacing: ".04em" }}>
                                ✓ LIBERADO PARA {currentEnvironment.toUpperCase()}
                              </span>}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === "dados" && currentPreset?.contacts && (
              <div style={{ padding: "8px 10px", borderRadius: "8px", background: "var(--bg)", border: "1px dashed var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-brand)" }}>
                    <RsbuildIcon name="users" size={14} tone="secondary" /> CLIENTES E FORNECEDORES HOMOLOGADOS ({currentPreset.contacts.length})
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
              Ambiente selecionado: <strong style={{ color: "var(--ink)" }}>{currentPreset?.name ?? selectedOrg}</strong>
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
