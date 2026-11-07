"use client";

import { useRef } from "react";
import { EnabledModulesConfig } from "@/app/types/workspace";

interface WorkspaceModalProps {
  isOpen: boolean;
  companyName: string;
  companyLogoUrl: string;
  isSuperAdmin: boolean;
  enabledModules: EnabledModulesConfig;
  onClose: () => void;
  onSave: (name: string, logoUrl: string, modules?: EnabledModulesConfig) => void;
  onUploadLogo: (file: File) => void;
}

export function WorkspaceModal({
  isOpen,
  companyName,
  companyLogoUrl,
  isSuperAdmin,
  enabledModules,
  onClose,
  onSave,
  onUploadLogo
}: WorkspaceModalProps) {
  const logoInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  return (
    <div className="workspace-modal-backdrop" onClick={onClose}>
      <div className="workspace-modal-card" onClick={(e) => e.stopPropagation()}>
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
          Personalize o nome corporativo e a marca exibidos no cabeçalho e na barra lateral do ambiente.
        </p>

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
            const modExecutiveInput = form.elements.namedItem("modExecutive") as HTMLInputElement;
            onSave(nameInput.value, urlInput.value || companyLogoUrl, {
              finance: modFinanceInput ? modFinanceInput.checked : true,
              logistics: modLogisticsInput ? modLogisticsInput.checked : true,
              executive: modExecutiveInput ? modExecutiveInput.checked : true
            });
          }}
          style={{ display: "grid", gap: "16px", marginTop: "16px" }}
        >
          <label className="login-field" style={{ fontSize: "11px" }}>
            <span>NOME DA EMPRESA OU WORKSPACE</span>
            <input
              name="companyName"
              defaultValue={companyName}
              required
              placeholder="Ex: Mundo do Sabor Alimentos, Distribuidora Salvador..."
              style={{
                height: "46px",
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
                  onClick={() => onSave(companyName, "", enabledModules)}
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
                height: "42px",
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
                <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12.5px", cursor: "pointer", fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    name="modFinance"
                    defaultChecked={enabledModules.finance}
                    style={{ accentColor: "var(--rsbuild-terracotta)", width: "16px", height: "16px" }}
                  />
                  <span>💼 Módulo Financeiro (Conciliação, Extratos & Baixas ERP)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12.5px", cursor: "pointer", fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    name="modLogistics"
                    defaultChecked={enabledModules.logistics}
                    style={{ accentColor: "var(--rsbuild-terracotta)", width: "16px", height: "16px" }}
                  />
                  <span>🚚 Módulo Logística & Expedição (WhatsApp, Canhotos & Cargas)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12.5px", cursor: "pointer", fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    name="modExecutive"
                    defaultChecked={enabledModules.executive}
                    style={{ accentColor: "var(--rsbuild-terracotta)", width: "16px", height: "16px" }}
                  />
                  <span>🏛️ Módulo Diretoria & Governança (Torre de Controle, Agente RS & BI)</span>
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

