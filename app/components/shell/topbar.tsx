"use client";

import { ALL_NAV_ITEMS, NavSection } from "@/app/types/workspace";

interface TopbarProps {
  companyName: string;
  section: NavSection;
  period: string;
  startDate?: string;
  endDate?: string;
  theme: "sand" | "dark";
  onPeriodChange: (period: string, startDate?: string, endDate?: string) => void;
  onToggleTheme: () => void;
  onResetSession: () => void;
  onOpenConfig: () => void;
}

export function Topbar({
  companyName,
  section,
  period,
  startDate,
  endDate,
  theme,
  onPeriodChange,
  onToggleTheme,
  onResetSession,
  onOpenConfig
}: TopbarProps) {
  const currentLabel = ALL_NAV_ITEMS.find((item) => item.id === section)?.label || "Visão Geral";

  return (
    <header className="topbar">
      <div className="breadcrumb">
        <strong>{companyName}</strong> <span>/</span> {currentLabel}
      </div>
      <div className="topbar-right">
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
          title="Reiniciar registros em cache e restaurar dados iniciais de demonstração"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          <span>Reiniciar</span>
        </button>

        <button
          className="avatar"
          onClick={onOpenConfig}
          title={`Personalizar Workspace (${companyName})`}
          style={{ border: "none", cursor: "pointer" }}
        >
          {companyName ? companyName.trim().charAt(0).toUpperCase() : "R"}
        </button>
      </div>
    </header>
  );
}
