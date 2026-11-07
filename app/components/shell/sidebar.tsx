"use client";

import Image from "next/image";
import {
  ALL_NAV_ITEMS,
  EnabledModulesConfig,
  ModuleType,
  NavSection,
  OrganizationId,
  orgHasExecutiveTower
} from "@/app/types/workspace";

interface SidebarProps {
  companyName: string;
  companyLogoUrl: string;
  activeModule: ModuleType;
  section: NavSection;
  enabledModules: EnabledModulesConfig;
  currentOrgId?: OrganizationId;
  onSelectModule: (module: ModuleType) => void;
  onSelectSection: (section: NavSection) => void;
  onOpenConfig: () => void;
}

export function Sidebar({
  companyName,
  companyLogoUrl,
  activeModule,
  section,
  enabledModules,
  currentOrgId = "rsbuild",
  onSelectModule,
  onSelectSection,
  onOpenConfig
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand-header">
        <div className="brand-logo-card">
          {companyLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={companyLogoUrl}
              alt={companyName}
              className="brand-logo-img"
              style={{ maxHeight: "44px", width: "auto", objectFit: "contain" }}
            />
          ) : (
            <Image
              src="/brand/rsbuild-logo-primary.svg"
              alt="RSBUILD Inovação Corporativa"
              width={200}
              height={64}
              priority
              className="brand-logo-img"
            />
          )}
        </div>
        <div className="brand-tagline">
          <span title={companyName}>
            {companyName.length > 18 ? companyName.slice(0, 18) + "…" : companyName.toUpperCase()}
          </span>
          <b>v1.1.0</b>
        </div>
      </div>

      {/* Seletor de Módulos Operacionais (Finanças vs Logística) */}
      {enabledModules.finance && enabledModules.logistics ? (
        <div className="module-switcher-container">
          <button
            type="button"
            className={activeModule === "finance" ? "module-tab active" : "module-tab"}
            onClick={() => onSelectModule("finance")}
            title="Módulo Financeiro & Controladoria"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            <span>Finanças</span>
          </button>
          <button
            type="button"
            className={activeModule === "logistics" ? "module-tab active" : "module-tab"}
            onClick={() => onSelectModule("logistics")}
            title="Módulo Logística & Expedição"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
            <span>Logística</span>
          </button>
        </div>
      ) : (
        <div className="module-badge-single">
          {enabledModules.logistics ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" />
                <polygon points="16 8 20 8 23 11 23 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
              <span>MÓDULO LOGÍSTICA</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              <span>MÓDULO FINANCEIRO</span>
            </>
          )}
        </div>
      )}

      <div className="workspace-label">
        {activeModule === "finance" ? "MENU FINANCEIRO" : "MENU LOGÍSTICA"}
      </div>

      <nav className="nav-list" aria-label="Navegação principal">
        {ALL_NAV_ITEMS.filter((item) => {
          if (item.module === "all") return true;
          return item.module === activeModule;
        }).map((item) => (
          <button
            key={item.id}
            className={section === item.id ? "nav-item active" : "nav-item"}
            onClick={() => onSelectSection(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.id === "torre-controle" && (
              <span
                style={{
                  fontSize: "8.5px",
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                  padding: "2px 5px",
                  borderRadius: "4px",
                  background: "var(--rsbuild-terracotta-soft)",
                  color: "var(--rsbuild-terracotta)"
                }}
              >
                AGENTE RS
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div
          className="sidebar-user-row"
          style={{ cursor: "pointer" }}
          onClick={onOpenConfig}
          title="Clique para personalizar empresa e logotipo"
        >
          <div className="connection-dot" />
          <div>
            <strong>{companyName}</strong>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span>Personalizar workspace</span>
              <span style={{ fontSize: "10px", color: "var(--rsbuild-terracotta)" }}>✎</span>
            </span>
          </div>
        </div>
        <button
          className="signout-btn"
          onClick={() => {
            window.location.href = "/login";
          }}
          title="Sair da sessão"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sair
        </button>
      </div>
    </aside>
  );
}
