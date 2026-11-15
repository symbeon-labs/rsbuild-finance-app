"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import {
  type ModuleType,
  type NavSection,
  type EnabledModulesConfig,
  type OrganizationId,
  ORGANIZATION_PRESETS
} from "@/app/types/workspace";
import { MemberRole } from "@/lib/permissions";
import { applyBrandColor } from "@/app/lib/brand-color";
import { Sidebar } from "@/app/components/shell/sidebar";
import { Topbar } from "@/app/components/shell/topbar";
import { WorkspaceModal } from "@/app/components/shell/workspace-modal";
import { DevZonePanel } from "@/app/components/dev/dev-zone-panel";
import { TorreControleView } from "@/app/components/executive/torre-controle-view";
import { OrganizationAdminPanel } from "@/app/components/admin/organization-admin-panel";
import { OrganizationBrandBanner } from "@/app/components/admin/organization-brand-banner";
import { ProjectPortfolioView } from "@/app/components/projects/project-portfolio-view";

type ControlTowerWorkspaceProps = {
  organizationId: string;
  organizationSlug: OrganizationId;
  organizationName: string;
  membershipRole: string;
  userEmail: string;
  isDeveloperAuthorized?: boolean;
  userFullName?: string;
  userRoleTitle?: string;
  preferredTheme?: "sand" | "dark";
};

export default function ControlTowerWorkspace({
  organizationId,
  organizationSlug,
  organizationName,
  membershipRole,
  userEmail,
  isDeveloperAuthorized = false,
  userFullName,
  userRoleTitle,
  preferredTheme
}: ControlTowerWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startSignOutTransition] = useTransition();

  const canViewProjectPortfolio = true;

  const urlTab = searchParams.get("tab") as NavSection | null;
  const initialSection: NavSection =
    urlTab && ["visao-geral", "projetos", "torre-controle"].includes(urlTab)
      ? urlTab
      : "visao-geral";

  function getModuleForSection(s: NavSection): ModuleType {
    if (s === "torre-controle") return "audit";
    if (s === "projetos") return "audit";
    return "audit";
  }

  const [section, setSection] = useState<NavSection>(initialSection);
  const [activeModule, setActiveModule] = useState<ModuleType>("audit");

  function navigateTo(nextSection: NavSection) {
    setSection(nextSection);
    if (nextSection !== "visao-geral") {
      setActiveModule(getModuleForSection(nextSection));
    }
    router.push(`/?organizationId=${encodeURIComponent(organizationId)}&tab=${nextSection}`, { scroll: false });
  }

  const [notice, setNotice] = useState("");

  const currentOrgId = organizationSlug;
  const [companyName, setCompanyName] = useState(organizationName);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>("");
  const [currentUserEmail] = useState<string>(userEmail);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const [theme, setTheme] = useState<"sand" | "dark">(preferredTheme || "sand");

  function toggleTheme() {
    const next = theme === "sand" ? "dark" : "sand";
    setTheme(next);
    try {
      localStorage.setItem("rsbuild_theme", next);
    } catch {}
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", next);
    }
  }

  const [brandColor, setBrandColor] = useState<string>("#B5583C");

  const organizationPreset = ORGANIZATION_PRESETS.find((preset) => preset.id === currentOrgId);
  const [enabledModules, setEnabledModules] = useState<EnabledModulesConfig>(
    organizationPreset?.enabledModules ?? { finance: false, reconciliation: false, logistics: false, audit: true }
  );

  const [simulatedRole, setSimulatedRole] = useState<MemberRole | null>(null);
  const effectiveRole = simulatedRole || (membershipRole as MemberRole);
  const isSuperAdmin = effectiveRole === "owner";

  useEffect(() => {
    try {
      localStorage.setItem("rsbuild_selected_organization", organizationId);
      document.cookie = `rsbuild_last_org_id=${encodeURIComponent(organizationId)}; path=/; max-age=31536000; SameSite=Lax`;
      const savedLogo = localStorage.getItem(`rsbuild_workspace_logo_${organizationId}`);
      if (savedLogo) setCompanyLogoUrl(savedLogo);
      const savedModules = localStorage.getItem(`rsbuild_workspace_modules_${organizationId}`);
      if (savedModules) {
        const parsed = JSON.parse(savedModules);
        setEnabledModules({
          finance: parsed.finance !== false,
          reconciliation: parsed.reconciliation !== false,
          logistics: parsed.logistics !== false,
          audit: parsed.audit !== false
        });
      }
      const savedTheme = localStorage.getItem("rsbuild_theme") as "sand" | "dark" | null;
      if (savedTheme === "dark" || savedTheme === "sand") {
        setTheme(savedTheme);
        document.documentElement.setAttribute("data-theme", savedTheme);
      }

      {
        const savedBrandColor = localStorage.getItem(`rsbuild_workspace_brand_color_${organizationId}`);
        const colorToApply = organizationPreset?.brandColor || savedBrandColor || "#B5583C";
        setBrandColor(colorToApply);
        applyBrandColor(colorToApply);
      }
    } catch {
    }
  }, [organizationId, currentOrgId]);

  function handleSaveCompanyConfig(
    name: string,
    logo: string,
    modules?: EnabledModulesConfig,
    orgId?: OrganizationId,
    newBrandColor?: string
  ) {
    setCompanyName(name);
    setCompanyLogoUrl(logo);
    if (orgId) {
      const preset = ORGANIZATION_PRESETS.find((p) => p.id === orgId);
      const colorToApply = newBrandColor || preset?.brandColor || "#B5583C";
      setBrandColor(colorToApply);
      applyBrandColor(colorToApply);
      try {
        localStorage.setItem(`rsbuild_workspace_brand_color_${organizationId}`, colorToApply);
      } catch {}
    }
    if (modules) {
      setEnabledModules(modules);
      try {
        localStorage.setItem(`rsbuild_workspace_modules_${organizationId}`, JSON.stringify(modules));
      } catch {}
    }
    try {
      if (logo) {
        localStorage.setItem(`rsbuild_workspace_logo_${organizationId}`, logo);
      } else {
        localStorage.removeItem(`rsbuild_workspace_logo_${organizationId}`);
      }
    } catch {}
    setNotice(`Workspace configurado com sucesso para ${name}!`);
    setIsConfigOpen(false);
  }

  function handleLogoUploadFile(file: File) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const res = event.target?.result as string;
      if (res) handleSaveCompanyConfig(companyName, res);
    };
    reader.readAsDataURL(file);
  }

  return (
    <main className="app-shell">
      <Sidebar
        companyName={companyName}
        companyLogoUrl={companyLogoUrl}
        activeModule={activeModule}
        section={section}
        enabledModules={enabledModules}
        currentOrgId={currentOrgId}
        showProjectPortfolio={canViewProjectPortfolio}
        onSelectModule={(mod) => {
          setActiveModule(mod);
          if (mod === "audit") navigateTo("torre-controle");
        }}
        onSelectSection={navigateTo}
        onOpenConfig={() => setIsConfigOpen(true)}
        onSignOut={() =>
          new Promise<void>((resolve) => {
            startSignOutTransition(async () => {
              await signOut();
              resolve();
            });
          })
        }
      />
      <section className="main-area">
        <Topbar
          companyName={companyName}
          section={section}
          period="all"
          startDate=""
          endDate=""
          theme={theme}
          userRole={effectiveRole}
          userEmail={currentUserEmail}
          userFullName={userFullName}
          userRoleTitle={userRoleTitle}
          showPeriodSelector={false}
          onPeriodChange={() => {}}
          onToggleTheme={toggleTheme}
          onResetSession={() => {}}
          onOpenConfig={() => setIsConfigOpen(true)}
        />
        <div className="content">
          <OrganizationBrandBanner organizationId={organizationId} organizationName={organizationName} />
          <div className="inline-note" role="note">
            Central de Controle RSBUILD — visão governamental e observabilidade de empresas integradas.
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
            <button className="secondary-button" type="button" onClick={() => setIsAdminPanelOpen((open) => !open)}>{isAdminPanelOpen ? "Fechar administração" : "Equipe e identidade"}</button>
          </div>
          {isAdminPanelOpen && <OrganizationAdminPanel organizationId={organizationId} organizationName={organizationName} role={effectiveRole} />}
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button onClick={() => setNotice("")}>×</button>
            </div>
          )}
          {section === "projetos" && canViewProjectPortfolio && <ProjectPortfolioView canManage={["owner", "admin", "operator"].includes(membershipRole)} />}
          {section === "visao-geral" && (
            <div style={{ padding: "24px", textAlign: "center" }}>
              <h2 style={{ fontSize: "20px", marginBottom: "16px" }}>Central de Controle RSBUILD</h2>
              <p style={{ color: "var(--rsbuild-terracotta)", marginBottom: "24px" }}>
                Visão governamental e observabilidade de empresas integradas
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                <div style={{ padding: "20px", border: "1px solid var(--rsbuild-border)", borderRadius: "8px" }}>
                  <h3 style={{ fontSize: "16px", marginBottom: "12px" }}>Empresas Integradas</h3>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    <li style={{ padding: "8px 0", borderBottom: "1px solid var(--rsbuild-border)" }}>
                      <strong>Hub Açaí Salvador</strong> — Logística & Reconciliação
                    </li>
                    <li style={{ padding: "8px 0" }}>
                      <strong>Mundo do Sabor</strong> — Finanças & Logística
                    </li>
                  </ul>
                </div>
                <div style={{ padding: "20px", border: "1px solid var(--rsbuild-border)", borderRadius: "8px" }}>
                  <h3 style={{ fontSize: "16px", marginBottom: "12px" }}>Acesso Rápido</h3>
                  <p style={{ fontSize: "14px", color: "var(--rsbuild-muted)", marginBottom: "12px" }}>
                    Use o seletor de organização no topo para alternar entre empresas integradas.
                  </p>
                  <p style={{ fontSize: "14px", color: "var(--rsbuild-muted)" }}>
                    Como observador, você terá acesso limitado às operações contratadas.
                  </p>
                </div>
              </div>
            </div>
          )}
          {section === "torre-controle" && (
            <TorreControleView
              companyName={companyName}
              isDirector={isSuperAdmin}
              currentUserEmail={currentUserEmail}
              records={[]}
              totals={{ incoming: 0, outgoing: 0, balance: 0 }}
              titles={[]}
              matches={[]}
              proofs={[]}
              deliveryMetrics={{ totalInvoices: 0, totalAmount: 0, provenCount: 0, provenAmount: 0, pendingDeliveryCount: 0, pendingDeliveryAmount: 0, rejectedCount: 0, rejectedAmount: 0, lostCount: 0, lostAmount: 0, coverageRate: 0, atRiskProtestAmount: 0 }}
              evaluations={[]}
              orders={[]}
              hubAcaiMetrics={{ totalOrders: 0, totalBoxes: 0, totalRevenue: 0, hrOccupancy: 0 }}
              hasSprintZone={isSuperAdmin || isDeveloperAuthorized}
              onNavigateToTab={navigateTo}
            />
          )}
        </div>
      </section>
      <WorkspaceModal
        isOpen={isConfigOpen}
        companyName={companyName}
        companyLogoUrl={companyLogoUrl}
        currentOrgId={currentOrgId}
        isSuperAdmin={isSuperAdmin}
        enabledModules={enabledModules}
        brandColor={brandColor}
        onClose={() => setIsConfigOpen(false)}
        onSave={handleSaveCompanyConfig}
        onUploadLogo={handleLogoUploadFile}
      />
      <DevZonePanel
        developerAccessAllowed={isDeveloperAuthorized}
        currentOrgId={organizationId}
        currentOrgSlug={organizationSlug}
        realUserEmail={currentUserEmail}
        realRole={membershipRole}
        simulatedRole={simulatedRole}
        onSimulateRole={setSimulatedRole}
        recordsCount={0}
        titlesCount={0}
        proofsCount={0}
        ordersCount={0}
        onInjectBankRecords={() => {}}
        onInjectOmieRecords={() => {}}
        onInjectTitles={() => {}}
        onInjectProofs={() => {}}
        onInjectOrders={() => {}}
        onResetAllData={() => {}}
      />
    </main>
  );
}
