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
import { AuditTrailView } from "@/app/components/admin/audit-trail-view";
import { AccessDirectoryView } from "@/app/components/admin/access-directory-view";
import { OrganizationAdminPanel } from "@/app/components/admin/organization-admin-panel";
import { OrganizationBrandBanner } from "@/app/components/admin/organization-brand-banner";
import { SandboxView } from "@/app/components/admin/sandbox-view";
import { AgentsGovernanceView } from "@/app/components/admin/agents-governance-view";
import { ProjectPortfolioView } from "@/app/components/projects/project-portfolio-view";
import { LeadInboxView } from "@/app/components/admin/lead-inbox-view";
import { HoldingOverviewCockpit } from "@/app/components/executive/holding-overview-cockpit";
import { HoldingWorkspaceManagementView, type HoldingWorkspaceOrganization } from "@/app/components/executive/holding-workspace-management-view";
import { ProductTourModal } from "@/app/components/shell/product-tour-modal";

type ControlTowerWorkspaceProps = {
  organizationId: string;
  organizationSlug: OrganizationId;
  organizationName: string;
  availableOrganizationSlugs: string[];
  availableOrganizations: HoldingWorkspaceOrganization[];
  availableSandboxOrganizations: HoldingWorkspaceOrganization[];
  membershipRole: string;
  userEmail: string;
  isDeveloperAuthorized?: boolean;
  canAccessSandbox?: boolean;
  userFullName?: string;
  userRoleTitle?: string;
  preferredTheme?: "sand" | "dark";
};

export default function ControlTowerWorkspace({
  organizationId,
  organizationSlug,
  organizationName,
  availableOrganizationSlugs,
  availableOrganizations,
  availableSandboxOrganizations,
  membershipRole,
  userEmail,
  isDeveloperAuthorized = false,
  canAccessSandbox = false,
  userFullName,
  userRoleTitle,
  preferredTheme
}: ControlTowerWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startSignOutTransition] = useTransition();
  const isProjectCollaborator = membershipRole === "operator";

  const canViewProjectPortfolio = true;


  const urlTab = searchParams.get("tab") as NavSection | null;
  const initialSection: NavSection = isProjectCollaborator
    ? "projetos"
    : urlTab && ["workspace", "visao-geral", "projetos", "mensagens", "auditoria", "acessos", "agentes", "sandbox"].includes(urlTab)
      ? urlTab
      : "visao-geral";

  function getModuleForSection(_s: NavSection): ModuleType {
    return "audit";
  }

  const [section, setSection] = useState<NavSection>(initialSection);
  const [activeModule, setActiveModule] = useState<ModuleType>("audit");

  function navigateTo(nextSection: NavSection) {
    // Na RSBUILD a Torre de Controle operacional não existe — governança
    // de agentes e auditoria assumiram esse papel
    const target = isProjectCollaborator ? "projetos" : nextSection === "torre-controle" ? "agentes" : nextSection;
    setSection(target);
    if (target !== "visao-geral") {
      setActiveModule(getModuleForSection(target));
    }
    router.push(`/?organizationId=${encodeURIComponent(organizationId)}&tab=${target}`, { scroll: false });
  }

  const [notice, setNotice] = useState("");

  const currentOrgId = organizationSlug;
  const [companyName, setCompanyName] = useState(organizationName);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>("");
  const [currentUserEmail] = useState<string>(userEmail);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);

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
        projectCollaboratorOnly={isProjectCollaborator}
        canAccessSandbox={canAccessSandbox}
        canAccessLeadInbox={["owner", "admin", "operator"].includes(membershipRole)}
        onSelectModule={(mod) => {
          setActiveModule(mod);
          if (mod === "audit") navigateTo("auditoria");
        }}
        onSelectSection={navigateTo}
        onOpenConfig={() => { if (!isProjectCollaborator) setIsConfigOpen(true); }}
        onSignOut={() =>
          new Promise<void>((resolve) => {
            startSignOutTransition(async () => {
              try {
                await signOut();
              } finally {
                // redirect() lança NEXT_REDIRECT — resolve sempre para
                // não travar o estado pending do botão na sidebar
                resolve();
              }
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
          onOpenConfig={() => { if (!isProjectCollaborator) setIsConfigOpen(true); }}
          onOpenTour={() => setIsTourOpen(true)}
        />
        <div className="content">
          <OrganizationBrandBanner organizationId={organizationId} organizationName={organizationName} />
          {!isProjectCollaborator && <div className="inline-note" role="note">
            Central de Controle RSBUILD — visão governamental e observabilidade de empresas integradas.
          </div>}
          {!isProjectCollaborator && <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setIsAdminPanelOpen((open) => !open)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <span>{isAdminPanelOpen ? "✕" : "⚙️"}</span>
              <span>{isAdminPanelOpen ? "Fechar Gestão da Empresa" : "Equipe & Identidade da Empresa"}</span>
            </button>
          </div>}
          {!isProjectCollaborator && isAdminPanelOpen && <OrganizationAdminPanel organizationId={organizationId} organizationName={organizationName} role={effectiveRole} />}
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button onClick={() => setNotice("")}>×</button>
            </div>
          )}
          {section === "workspace" && (
            <HoldingWorkspaceManagementView
              organizations={availableOrganizations}
              sandboxOrganizations={availableSandboxOrganizations}
              currentOrganizationId={organizationId}
            />
          )}
          {section === "projetos" && canViewProjectPortfolio && <ProjectPortfolioView canManage={["owner", "admin", "operator"].includes(membershipRole)} />}
          {!isProjectCollaborator && section === "mensagens" && <LeadInboxView />}
          {!isProjectCollaborator && section === "visao-geral" && (
            <HoldingOverviewCockpit
              onNavigateToTab={navigateTo}
              userRole={effectiveRole}
              userFullName={userFullName}
            />
          )}
          {!isProjectCollaborator && section === "auditoria" && (
            <AuditTrailView organizationId={organizationId} organizationName={organizationName} />
          )}
          {!isProjectCollaborator && section === "acessos" && (
            <AccessDirectoryView />
          )}
          {!isProjectCollaborator && section === "agentes" && (
            <AgentsGovernanceView canDecide={["owner", "admin"].includes(membershipRole)} />
          )}
          {!isProjectCollaborator && section === "sandbox" && (
            <SandboxView />
          )}
        </div>
      </section>
      <WorkspaceModal
        isOpen={isConfigOpen && !isProjectCollaborator}
        companyName={companyName}
        companyLogoUrl={companyLogoUrl}
        currentOrgId={currentOrgId}
        currentOrgRealId={organizationId}
        availableOrganizationSlugs={availableOrganizationSlugs}
        isSuperAdmin={isSuperAdmin}
        enabledModules={enabledModules}
        brandColor={brandColor}
        onClose={() => setIsConfigOpen(false)}
        onSave={handleSaveCompanyConfig}
        onUploadLogo={handleLogoUploadFile}
      />
      {!isProjectCollaborator && <DevZonePanel
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
      />}
      <ProductTourModal
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        onNavigateToSection={(targetSection) => navigateTo(targetSection)}
      />
    </main>
  );
}
