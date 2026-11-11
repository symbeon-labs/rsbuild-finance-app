"use client";

import Image from "next/image";
import { useTransition } from "react";
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
  /** Server action de logout — invalida a sessão Supabase antes de redirecionar */
  onSignOut: () => Promise<void>;
}

const MODULE_CONFIGS: {
  id: ModuleType;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  title: string;
  menuLabel: string;
}[] = [
  {
    id: "finance",
    label: "Finanças",
    shortLabel: "Finanças",
    title: "Módulo Financeiro & Livro Caixa",
    menuLabel: "MENU FINANCEIRO",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    )
  },
  {
    id: "reconciliation",
    label: "Reconciliação",
    shortLabel: "Reconcil.",
    title: "Conciliação e revisão de títulos",
    menuLabel: "MENU CONCILIAÇÃO",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M16 21h5v-5" />
      </svg>
    )
  },
  {
    id: "logistics",
    label: "Logística",
    shortLabel: "Logística",
    title: "Módulo Logística & Expedição",
    menuLabel: "MENU LOGÍSTICA & EXPEDIÇÃO",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" />
        <polygon points="16 8 20 8 23 11 23 16 16 16 8" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    )
  },
  {
    id: "audit",
    label: "Auditoria",
    shortLabel: "Auditoria",
    title: "Governança e auditoria operacional",
    menuLabel: "MENU GOVERNANÇA",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    )
  }
];

export function Sidebar({
  companyName,
  companyLogoUrl,
  activeModule,
  section,
  enabledModules,
  currentOrgId = "rsbuild",
  onSelectModule,
  onSelectSection,
  onOpenConfig,
  onSignOut
}: SidebarProps) {
  const [isPending, startTransition] = useTransition();
  const availableModules = MODULE_CONFIGS.filter((m) => enabledModules[m.id]);
  const currentModuleConfig =
    MODULE_CONFIGS.find((m) => m.id === activeModule) || availableModules[0] || MODULE_CONFIGS[0];

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
          <b>OS</b>
        </div>
      </div>

      {/* Seletor Dinâmico de Módulos (Finanças · Reconciliação · Logística · Auditoria) */}
      {availableModules.length > 1 ? (
        <div
          className="module-switcher-container"
          style={{
            display: "grid",
            gridTemplateColumns: availableModules.length > 2 ? "repeat(2, 1fr)" : `repeat(${availableModules.length}, 1fr)`,
            gap: "4px"
          }}
        >
          {availableModules.map((mod) => {
            const isActive = activeModule === mod.id;
            return (
              <button
                key={mod.id}
                type="button"
                className={isActive ? "module-tab active" : "module-tab"}
                onClick={() => onSelectModule(mod.id)}
                title={mod.title}
                style={{
                  height: "32px",
                  padding: "0 6px",
                  fontSize: "10px",
                  letterSpacing: "0.5px"
                }}
              >
                {mod.icon}
                <span>{availableModules.length > 2 ? mod.shortLabel : mod.label}</span>
              </button>
            );
          })}
        </div>
      ) : availableModules.length === 1 ? (
        <div className="module-badge-single">
          {availableModules[0].icon}
          <span>MÓDULO {availableModules[0].label.toUpperCase()}</span>
        </div>
      ) : null}

      <div className="workspace-label">
        {currentModuleConfig.menuLabel}
      </div>

      <nav className="nav-list" aria-label="Navegação principal">
        {ALL_NAV_ITEMS.filter((item) => {
          if (item.module === "all") return true;
          // Verifica se o módulo do item está contratado
          if (!enabledModules[item.module]) return false;
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
            startTransition(async () => {
              await onSignOut();
            });
          }}
          disabled={isPending}
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
