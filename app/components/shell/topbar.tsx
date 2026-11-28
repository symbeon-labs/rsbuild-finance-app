"use client";

import { useState, useEffect } from "react";
import { ALL_NAV_ITEMS, NavSection } from "@/app/types/workspace";
import { getRoleMetadata } from "@/lib/permissions";
import { RsbuildIcon } from "@/app/components/rsbuild-icons";
import { FeedbackModal } from "@/app/components/feedback/feedback-modal";
import { getAllGuides, type GuideConfig } from "@/lib/guides";

interface TopbarProps {
  companyName: string;
  section: NavSection;
  period: string;
  startDate?: string;
  endDate?: string;
  theme: "sand" | "dark";
  userRole?: string;
  userEmail?: string;
  userFullName?: string;
  userRoleTitle?: string;
  showPeriodSelector?: boolean;
  onPeriodChange: (period: string, startDate?: string, endDate?: string) => void;
  onToggleTheme: () => void;
  onResetSession: () => void;
  onOpenConfig: () => void;
  onOpenTour?: () => void;
  organizationId?: string;
}

export function Topbar({
  companyName,
  section,
  period,
  startDate,
  endDate,
  theme,
  userRole,
  userEmail,
  userFullName,
  userRoleTitle,
  showPeriodSelector = true,
  onPeriodChange,
  onToggleTheme,
  onResetSession,
  onOpenConfig,
  onOpenTour,
  organizationId
}: TopbarProps) {
  const currentLabel = ALL_NAV_ITEMS.find((item) => item.id === section)?.label || "Visão Geral";
  const roleMeta = getRoleMetadata(userRole);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isGuideMenuOpen, setIsGuideMenuOpen] = useState(false);
  const allGuides = getAllGuides();

  // Close guide menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isGuideMenuOpen && !target.closest(".guides-btn") && !target.closest(".guide-menu")) {
        setIsGuideMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isGuideMenuOpen]);

  const displayUserText = userFullName ? userFullName : userEmail;
  const userFullTitle = [userFullName, userRoleTitle, userEmail, roleMeta.description].filter(Boolean).join(" · ");

  return (
    <header className="topbar">
      <div className="breadcrumb">
        <strong>{companyName}</strong> <span>/</span> {currentLabel}
      </div>
      <div className="topbar-right" style={{ position: "relative" }}>
        {/* Badge de Nível de Alçada do Integrante */}
        {userRole && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              background: "var(--surface-raised, rgba(255,255,255,0.06))",
              borderRadius: "4px",
              border: "1px solid var(--line)",
              fontSize: "11px"
            }}
            title={userFullTitle}
          >
            <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--rsbuild-terracotta)" }}>
              {roleMeta.badge}
            </span>
            {displayUserText && (
              <span style={{ color: "var(--muted)", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {displayUserText}
              </span>
            )}
          </div>
        )}
        {showPeriodSelector && (
          <>
            <span className="period-label">PERÍODO</span>
            <select
              value={period}
              onChange={(e) => onPeriodChange(e.target.value, startDate, endDate)}
              aria-label="Período"
            >
              <option value="all">Todo o histórico</option>
              <option value="current_month">Mês atual</option>
              <option value="last_month">Mês anterior</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="365">Últimos 12 meses</option>
              <option value="year">Este ano</option>
              <option value="custom">Personalizado (De / Até)...</option>
            </select>

            {period === "custom" && (
              <div className="date-range-container">
                <input
                  type="date"
                  value={startDate || ""}
                  onChange={(e) => onPeriodChange("custom", e.target.value, endDate)}
                  title="Data inicial"
                  aria-label="Data inicial"
                />
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>até</span>
                <input
                  type="date"
                  value={endDate || ""}
                  onChange={(e) => onPeriodChange("custom", startDate, e.target.value)}
                  title="Data final"
                  aria-label="Data final"
                />
              </div>
            )}
          </>
        )}

        {/* Botão de Alternância de Tema */}
        <button
          type="button"
          className="theme-toggle-btn"
          onClick={onToggleTheme}
          title={theme === "dark" ? "Alternar para Modo Sand (Claro)" : "Alternar para Modo Dark (Escuro)"}
          aria-label="Alternar tema visual"
        >
          {theme === "dark" ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
              <span>Sand</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <span>Dark</span>
            </>
          )}
        </button>

        {/* Botão para Reset de Dados da Sessão */}
        <button
          type="button"
          className="reset-session-btn"
          onClick={onResetSession}
          title="Limpar os dados temporários desta sessão; os registros financeiros persistidos não serão alterados"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          <span>Limpar sessão</span>
        </button>

        {/* Botão para Guia do Ciclo 01 */}
        {onOpenTour && (
          <button
            type="button"
            className="tour-guide-btn"
            onClick={onOpenTour}
            title="Conhecer as funcionalidades homologadas do Ciclo 01"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "5px 10px",
              background: "rgba(181, 88, 60, 0.12)",
              border: "1px solid rgba(181, 88, 60, 0.35)",
              borderRadius: "6px",
              color: "var(--rsbuild-terracotta, #B5583C)",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            <RsbuildIcon name="control-tower" size={14} tone="accent" aria-hidden="true" />
            <span>Guia Ciclo 01</span>
          </button>
        )}

        {/* Botão de Ajuda (Guias + Feedback) */}
        <button
          type="button"
          className="guides-btn"
          onClick={() => {
            if (isGuideMenuOpen) {
              setIsGuideMenuOpen(false);
            } else {
              setIsGuideMenuOpen(true);
            }
          }}
          title="Ajuda e Feedback"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            minHeight: "38px",
            padding: "0 13px",
            marginLeft: "10px",
            borderRadius: "9px",
            border: "1px solid var(--line)",
            background: "var(--bg)",
            color: "var(--muted)",
            cursor: "pointer",
            fontSize: "11px",
            fontWeight: 600,
            transition: "all 160ms ease"
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>Ajuda</span>
        </button>

        {/* Menu de Ajuda */}
        {isGuideMenuOpen && (
          <div
            className="guide-menu"
            style={{
              position: "absolute",
              top: "100%",
              right: "0",
              marginTop: "8px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "8px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              zIndex: 1001,
              minWidth: "280px",
              padding: "12px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: "12px", paddingBottom: "8px", borderBottom: "1px solid var(--line)" }}>
              <strong style={{ fontSize: "13px" }}>Ajuda e Suporte</strong>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                onClick={() => {
                  // Clear only guide-related localStorage keys
                  Object.keys(localStorage).forEach(key => {
                    if (key.startsWith("guide-seen-")) {
                      localStorage.removeItem(key);
                    }
                  });
                  setIsGuideMenuOpen(false);
                  window.location.reload();
                }}
                style={{
                  padding: "8px 12px",
                  background: "transparent",
                  border: "1px solid var(--line)",
                  borderRadius: "6px",
                  color: "var(--ink)",
                  cursor: "pointer",
                  fontSize: "12px",
                  textAlign: "left"
                }}
              >
                Reiniciar guias de ajuda
              </button>
              <button
                onClick={() => {
                  setIsGuideMenuOpen(false);
                  setIsFeedbackOpen(true);
                }}
                style={{
                  padding: "8px 12px",
                  background: "rgba(181, 88, 60, 0.1)",
                  border: "1px solid var(--rsbuild-terracotta)",
                  borderRadius: "6px",
                  color: "var(--rsbuild-terracotta)",
                  cursor: "pointer",
                  fontSize: "12px",
                  textAlign: "left"
                }}
              >
                Feedback e Sugestões
              </button>
              <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                {allGuides.length} guias disponíveis
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          className="workspace-switcher-trigger"
          onClick={onOpenConfig}
          title={`Trocar workspace e consultar módulos disponíveis — ${companyName}`}
          aria-label={`Workspaces e módulos. Workspace atual: ${companyName}. Abrir seletor.`}
          aria-haspopup="dialog"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "9px",
            minHeight: "38px",
            padding: "0 13px",
            marginLeft: "10px",
            borderRadius: "9px",
            border: "1px solid var(--rsbuild-terracotta, #B5583C)",
            background: "var(--rsbuild-terracotta-soft, rgba(181, 88, 60, 0.10))",
            color: "var(--rsbuild-terracotta, #B5583C)",
            cursor: "pointer",
            fontSize: "11px",
            fontWeight: 750,
            letterSpacing: "0.02em",
            transition: "background 160ms ease, box-shadow 160ms ease, transform 160ms ease"
          }}
        >
          <RsbuildIcon name="integration" size={17} tone="accent" aria-hidden="true" />
          <span>WORKSPACES</span>
          <span aria-hidden="true" style={{ fontSize: "13px", lineHeight: 1 }}>⌄</span>
        </button>
      </div>

      {/* Feedback Modal */}
      {organizationId && (
        <FeedbackModal
          organizationId={organizationId}
          isOpen={isFeedbackOpen}
          onClose={() => setIsFeedbackOpen(false)}
        />
      )}
    </header>
  );
}
