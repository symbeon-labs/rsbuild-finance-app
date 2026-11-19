"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import {
  BankMetadata,
  FinancialRecord,
  OmieRecord,
  generateOmieOfx,
  decodeImportText,
  discoverCsvColumns,
  parseCsv,
  parseOfx,
  filterRecordsByPeriodOption,
  updateAuditTrail,
  type PeriodOption
} from "@/lib/finance";
import {
  ReceivableTitle,
  ReconciliationMatch,
  matchTitlesWithRecords,
  buildSettlementItems,
  generateOmieBatchSettlementCsv,
  parseReceivablesCsv
} from "@/lib/reconciliation";
import {
  DeliveryProof,
  computeDeliveryMetrics,
  evaluateProtestoRisk,
  generateDeliveryBlindageCsv,
  parseDeliveryCsv
} from "@/lib/delivery";
import {
  ParsedWhatsAppOrder,
  generateOmieSalesOrderCsv,
  parseWhatsAppOrderMessage
} from "@/lib/orders";
import {
  type ModuleType,
  type NavSection,
  type EnabledModulesConfig,
  type OrganizationId,
  ORGANIZATION_PRESETS,
  orgHasExecutiveTower
} from "@/app/types/workspace";
import { MemberRole, canAccessSprintZone, canApproveBatchSettlement } from "@/lib/permissions";
import { applyBrandColor, deriveBrandTokens } from "@/app/lib/brand-color";
import { MODULE_CONFIGS, Sidebar } from "@/app/components/shell/sidebar";
import { RsbuildIcon } from "@/app/components/rsbuild-icons";
import { Topbar } from "@/app/components/shell/topbar";
import { WorkspaceModal } from "@/app/components/shell/workspace-modal";
import { DevZonePanel } from "@/app/components/dev/dev-zone-panel";
import { VisaoGeralView } from "@/app/components/finance/visao-geral-view";
import { MovimentacoesView } from "@/app/components/finance/movimentacoes-view";
import { ImportacoesView } from "@/app/components/finance/importacoes-view";
import { ConciliacaoView } from "@/app/components/finance/conciliacao-view";
import { BaixasView } from "@/app/components/finance/baixas-view";
import { RelatoriosDreView } from "@/app/components/finance/relatorios-dre-view";
import { CanhotosView } from "@/app/components/logistics/canhotos-view";
import { PedidosHaView } from "@/app/components/logistics/pedidos-ha-view";
import { TorreControleView } from "@/app/components/executive/torre-controle-view";
import { AuditTrailView } from "@/app/components/admin/audit-trail-view";
import { OrganizationAdminPanel } from "@/app/components/admin/organization-admin-panel";
import { OrganizationBrandBanner } from "@/app/components/admin/organization-brand-banner";
 
function formatOperationalNotice(message: string): string {
  if (message.includes("capability_entitlement_unavailable")) {
    return "Este módulo ainda não está liberado para este ambiente. A administração da RSBUILD pode revisar e autorizar o acesso.";
  }
  if (message.includes("financial_records_unavailable")) {
    return "Não foi possível consultar os registros financeiros agora. Tente novamente em instantes; se o problema continuar, informe a administração.";
  }
  if (message.includes("unauthenticated")) {
    return "Sua sessão precisa ser renovada. Entre novamente para continuar.";
  }
  if (message.includes("forbidden") || message.includes("organization_access_denied")) {
    return "Seu perfil não possui autorização para realizar esta ação neste ambiente.";
  }
  return message;
}

import { ProductTourModal } from "@/app/components/shell/product-tour-modal";
import { FinanceEvaluationGuide } from "@/app/components/finance/finance-evaluation-guide";

type OperationalWorkspaceProps = {
  organizationId: string;
  organizationSlug: OrganizationId;
  organizationName: string;
  availableOrganizationSlugs: string[];
  membershipRole: string;
  isPlatformAdministrator?: boolean;
  userEmail: string;
  isDeveloperAuthorized?: boolean;
  userFullName?: string;
  userRoleTitle?: string;
  preferredTheme?: "sand" | "dark";
};

const OPERATIONAL_NAV_SECTIONS: NavSection[] = [
  "workspace", "visao-geral", "torre-controle", "auditoria", "movimentacoes",
  "importacoes", "conciliacao", "baixas", "canhotos", "pedidos-ha", "relatorios"
];

function getOperationalModuleForSection(section: NavSection, organizationSlug: OrganizationId): ModuleType {
  if (section === "baixas" || section === "conciliacao") return "reconciliation";
  if (section === "pedidos-ha" || section === "canhotos") return "logistics";
  if (section === "torre-controle" || section === "auditoria") return "audit";
  if (section === "workspace") {
    return ORGANIZATION_PRESETS.find((preset) => preset.id === organizationSlug)?.defaultModule ?? "finance";
  }
  return "finance";
}

export default function OperationalWorkspace({
  organizationId,
  organizationSlug,
  organizationName,
  availableOrganizationSlugs,
  membershipRole,
  isPlatformAdministrator = false,
  userEmail,
  isDeveloperAuthorized = false,
  userFullName,
  userRoleTitle,
  preferredTheme
}: OperationalWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startSignOutTransition] = useTransition();

  // Portfólio de projetos NÃO é visível em workspaces operacionais
  const canViewProjectPortfolio = false;

  const urlTab = searchParams.get("tab") as NavSection | null;
  const initialSection: NavSection = urlTab && OPERATIONAL_NAV_SECTIONS.includes(urlTab) ? urlTab : "workspace";

  const [section, setSection] = useState<NavSection>(initialSection);
  const [activeModule, setActiveModule] = useState<ModuleType>(
    getOperationalModuleForSection(initialSection, organizationSlug)
  );

  useEffect(() => {
    const nextSection: NavSection =
      urlTab && OPERATIONAL_NAV_SECTIONS.includes(urlTab) ? urlTab : "workspace";
    setSection(nextSection);
    setActiveModule(getOperationalModuleForSection(nextSection, organizationSlug));
    if (!urlTab || !OPERATIONAL_NAV_SECTIONS.includes(urlTab)) {
      router.replace(`/?organizationId=${encodeURIComponent(organizationId)}&tab=workspace`, { scroll: false });
    }
  }, [urlTab, organizationSlug, organizationId, router]);

  function navigateTo(nextSection: NavSection) {
    setSection(nextSection);
    if (nextSection !== "visao-geral") {
      setActiveModule(getOperationalModuleForSection(nextSection, organizationSlug));
    }
    router.push(`/?organizationId=${encodeURIComponent(organizationId)}&tab=${nextSection}`, { scroll: false });
  }

  // Estados Financeiros & Sessão
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<FinancialRecord[]>([]);
  const [pendingMetadata, setPendingMetadata] = useState<BankMetadata | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [detectedColumns, setDetectedColumns] = useState<ReturnType<typeof discoverCsvColumns>>([]);

  const [omieRecords, setOmieRecords] = useState<OmieRecord[]>([]);

  const [simulatedRole, setSimulatedRole] = useState<MemberRole | null>(null);
  const effectiveRole = simulatedRole || (membershipRole as MemberRole);
  const isSuperAdmin = effectiveRole === "owner";

  const [period, setPeriod] = useState<PeriodOption>("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  function handlePeriodChange(nextPeriod: string, start?: string, end?: string) {
    const p = nextPeriod as PeriodOption;
    setPeriod(p);
    if (start !== undefined) setCustomStartDate(start);
    if (end !== undefined) setCustomEndDate(end);
    try {
      localStorage.setItem(`rsbuild_period_option_${organizationId}`, p);
      if (start !== undefined) localStorage.setItem(`rsbuild_period_start_${organizationId}`, start);
      if (end !== undefined) localStorage.setItem(`rsbuild_period_end_${organizationId}`, end);
    } catch {}
  }

  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingFileRef = useRef<File | null>(null);

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
    organizationPreset?.enabledModules ?? { finance: true, reconciliation: false, logistics: false, audit: false }
  );

  const [titles, setTitles] = useState<ReceivableTitle[]>([]);
  const [proofs, setProofs] = useState<DeliveryProof[]>([]);
  const [orders, setOrders] = useState<ParsedWhatsAppOrder[]>([]);
  const [whatsAppText, setWhatsAppText] = useState("");
  const [parsedPreview, setParsedPreview] = useState<ParsedWhatsAppOrder | null>(null);

  useEffect(() => {
    let active = true;
    setRecords([]);
    setIsLoadingRecords(true);
    fetch(`/api/imports?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Não foi possível carregar os movimentos financeiros.");
        return payload;
      })
      .then((payload) => {
        if (active) setRecords(Array.isArray(payload.records) ? payload.records : []);
      })
      .catch((error) => {
        if (active) setNotice(error instanceof Error ? error.message : "Falha ao carregar movimentos financeiros.");
      })
      .finally(() => {
        if (active) setIsLoadingRecords(false);
      });
    return () => { active = false; };
  }, [organizationId]);

  useEffect(() => {
    let active = true;
    fetch(`/api/titles?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Não foi possível carregar títulos.");
        return payload;
      })
      .then((payload) => {
        if (active) setTitles(Array.isArray(payload.titles) ? payload.titles : []);
      })
      .catch((error) => {
        if (active) console.error("Falha ao carregar títulos:", error);
      });
    return () => { active = false; };
  }, [organizationId]);

  useEffect(() => {
    let active = true;
    fetch(`/api/proofs?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Não foi possível carregar canhotos.");
        return payload;
      })
      .then((payload) => {
        if (active) setProofs(Array.isArray(payload.proofs) ? payload.proofs : []);
      })
      .catch((error) => {
        if (active) console.error("Falha ao carregar canhotos:", error);
      });
    return () => { active = false; };
  }, [organizationId]);

  useEffect(() => {
    let active = true;
    fetch(`/api/orders?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Não foi possível carregar pedidos.");
        return payload;
      })
      .then((payload) => {
        if (active) setOrders(Array.isArray(payload.orders) ? payload.orders : []);
      })
      .catch((error) => {
        if (active) console.error("Falha ao carregar pedidos:", error);
      });
    return () => { active = false; };
  }, [organizationId]);

  useEffect(() => {
    let active = true;
    fetch(`/api/erp-movements?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Não foi possível carregar lançamentos ERP.");
        return payload;
      })
      .then((payload) => {
        if (active && Array.isArray(payload.movements)) setOmieRecords(payload.movements);
      })
      .catch((error) => {
        if (active) console.error("Falha ao carregar lançamentos ERP:", error);
      });
    return () => { active = false; };
  }, [organizationId]);

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
        const fallbackColor = savedBrandColor || organizationPreset?.brandColor || "#B5583C";
        setBrandColor(fallbackColor);
        applyBrandColor(fallbackColor);
      }
      fetch(`/api/organization-branding?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
        .then((response) => response.ok ? response.json() : null)
        .then((branding) => {
          // O banner oficial do tenant tem precedência sobre o logo local legado.
          if (branding?.bannerUrl) setCompanyLogoUrl(branding.bannerUrl);
          if (!branding?.brandColor) return;
          setBrandColor(branding.brandColor);
          applyBrandColor(branding.brandColor);
        })
        .catch(() => {});

      const savedPeriod = localStorage.getItem(`rsbuild_period_option_${organizationId}`) as PeriodOption | null;
      if (savedPeriod) setPeriod(savedPeriod);
      const savedStart = localStorage.getItem(`rsbuild_period_start_${organizationId}`);
      if (savedStart) setCustomStartDate(savedStart);
      const savedEnd = localStorage.getItem(`rsbuild_period_end_${organizationId}`);
      if (savedEnd) setCustomEndDate(savedEnd);

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
      const { main, hover, soft } = deriveBrandTokens(colorToApply);
      fetch("/api/organization-branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, brandColor: main, brandColorHover: hover, brandColorSoft: soft })
      }).catch(() => {});
    }
    if (modules) {
      setEnabledModules(modules);
      try {
        localStorage.setItem(`rsbuild_workspace_modules_${organizationId}`, JSON.stringify(modules));
      } catch {}
      if (!modules.finance && modules.logistics && activeModule === "finance") {
        navigateTo("pedidos-ha");
      } else if (!modules.logistics && modules.finance && activeModule === "logistics") {
        navigateTo("visao-geral");
      }
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

  function resetSession() {
    if (typeof window !== "undefined" && !window.confirm("Limpar dados temporários desta sessão? Dados persistidos no servidor não serão alterados.")) {
      return;
    }
    setOmieRecords([]);
    setPendingImport([]);
    setPendingMetadata(null);
    setImportErrors([]);
    setFileName("");
    setNotice("Dados temporários desta sessão foram limpos. Dados persistidos no servidor não foram alterados.");
  }

  const filteredRecords = useMemo(() => {
    return filterRecordsByPeriodOption(records, {
      option: period,
      startDate: customStartDate,
      endDate: customEndDate
    });
  }, [records, period, customStartDate, customEndDate]);

  const deliveryMetrics = useMemo(() => computeDeliveryMetrics(proofs), [proofs]);

  const evaluations = useMemo(() => {
    return proofs.map((p) => {
      const relatedTitle = titles.find((t) => t.documentNumber.includes(p.nfeNumber));
      const isOverdue = relatedTitle ? new Date(relatedTitle.dueDate) < new Date() : false;
      return evaluateProtestoRisk(p, { dueDate: relatedTitle?.dueDate, isOverdue });
    });
  }, [proofs, titles]);

  const hubAcaiMetrics = useMemo(() => {
    const totalOrders = orders.length;
    const totalBoxes = orders.reduce((sum, o) => sum + o.totalBoxes, 0);
    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const hrOccupancy = Math.min(100, Math.round((totalBoxes / 350) * 100));
    return { totalOrders, totalBoxes, totalRevenue, hrOccupancy };
  }, [orders]);

  const totals = useMemo(() => {
    const incoming = filteredRecords.filter((item) => item.direction === "entrada").reduce((sum, item) => sum + item.amount, 0);
    const outgoing = filteredRecords.filter((item) => item.direction === "saída").reduce((sum, item) => sum + item.amount, 0);
    return { incoming, outgoing, balance: incoming - outgoing };
  }, [filteredRecords]);

  const matches = useMemo(() => {
    return matchTitlesWithRecords(titles, records);
  }, [titles, records]);

  const matchStats = useMemo(() => {
    const ready = matches.filter((m) => m.suggestedStatus === "pronto_para_baixa");
    const divergent = matches.filter((m) => m.suggestedStatus === "divergente");
    const pending = matches.filter((m) => m.suggestedStatus === "nao_identificado");
    const totalReadyAmount = ready.reduce((sum, m) => sum + (m.statementRecord?.amount || 0), 0);
    return { ready, divergent, pending, totalReadyAmount };
  }, [matches]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setNotice("");
    setPendingImport([]);
    setImportErrors([]);
    setPendingMetadata(null);
    setDetectedColumns([]);
    const extension = file.name.trim().toLowerCase().split(".").pop();
    if (extension !== "csv" && extension !== "ofx") {
      setFileName(file.name);
      setImportErrors(["Formato não suportado. Selecione um arquivo CSV ou OFX."]);
      navigateTo("importacoes");
      event.target.value = "";
      return;
    }
    if (!file.size || file.size > 10 * 1024 * 1024) {
      setFileName(file.name);
      setImportErrors([!file.size ? "O arquivo está vazio." : "O arquivo excede o limite de 10 MiB."]);
      navigateTo("importacoes");
      event.target.value = "";
      return;
    }
    try {
      const text = decodeImportText(new Uint8Array(await file.arrayBuffer()));
      if (extension === "csv") setDetectedColumns(discoverCsvColumns(text.split(/\r?\n/, 1)[0] ?? ""));
      const result = extension === "ofx" ? parseOfx(text) : parseCsv(text);
      pendingFileRef.current = file;
      setFileName(file.name);
      setPendingImport(result.records);
      setImportErrors(result.errors);
      setPendingMetadata(result.metadata || null);
    } catch (error) {
      pendingFileRef.current = null;
      setFileName(file.name);
      setImportErrors([error instanceof Error ? error.message : "Não foi possível ler o arquivo. Exporte novamente em CSV/OFX."]);
    }
    navigateTo("importacoes");
    event.target.value = "";
  }

  async function confirmImport() {
    if (isImporting || !pendingImport.length || importErrors.length) return;
    setIsImporting(true);
    setNotice("");
    try {
      const form = new FormData();
      const selectedFile = pendingFileRef.current;
      if (!selectedFile) throw new Error("Selecione novamente o arquivo para confirmar a importação.");
      form.set("organizationId", organizationId);
      form.set("file", selectedFile);
      const response = await fetch("/api/imports", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) {
        const detail = Array.isArray(payload.details) && payload.details.length ? ` ${payload.details.join(" ")}` : "";
        throw new Error((payload.error || "Falha ao persistir a importação.") + detail);
      }
      const refresh = await fetch(`/api/imports?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
      const refreshed = await refresh.json();
      if (!refresh.ok) throw new Error("Importação gravada, mas não foi possível atualizar o dashboard. Recarregue a página.");
      setRecords(Array.isArray(refreshed.records) ? refreshed.records : []);
      setNotice(`Importação persistida: ${payload.insertedCount ?? 0} novo(s) registro(s), ${payload.duplicateCount ?? 0} duplicado(s) ignorado(s).`);
      setPendingImport([]);
      setPendingMetadata(null);
      setImportErrors([]);
      setFileName("");
      pendingFileRef.current = null;
      if (inputRef.current) inputRef.current.value = "";
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível concluir a importação.");
    } finally {
      setIsImporting(false);
    }
  }

  function cancelImport() {
    setPendingImport([]);
    setPendingMetadata(null);
    setImportErrors([]);
    setFileName("");
    pendingFileRef.current = null;
    if (inputRef.current) inputRef.current.value = "";
    setNotice("Importação cancelada.");
  }

  async function handleOmieImportPersist(newRecords: OmieRecord[]) {
    try {
      const response = await fetch(`/api/erp-movements?organizationId=${encodeURIComponent(organizationId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceLabel: "Importação CSV Omie",
          movements: newRecords.map((r) => ({
            date: r.date,
            description: r.description,
            amount: r.amount,
            direction: r.direction,
            documentNumber: r.documentNumber,
            category: r.category
          }))
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Falha ao persistir lançamentos ERP.");
      setNotice(`${payload.insertedCount ?? 0} lançamento(s) ERP persistido(s) como novo snapshot.`);
      const refresh = await fetch(`/api/erp-movements?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
      const refreshed = await refresh.json();
      if (refresh.ok && Array.isArray(refreshed.movements)) setOmieRecords(refreshed.movements);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao persistir lançamentos ERP.");
    }
  }

  async function handleReconciliationDecision(
    recordId: string,
    decisionType: "manual_match" | "unmatch",
    counterpartLabel?: string,
    justification?: string
  ) {
    try {
      await fetch(`/api/reconciliation-decisions?organizationId=${encodeURIComponent(organizationId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decisions: [{ financialRecordId: recordId, decisionType, counterpartLabel, justification }]
        })
      });
      const refresh = await fetch(`/api/imports?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
      const refreshed = await refresh.json();
      if (refresh.ok && Array.isArray(refreshed.records)) setRecords(refreshed.records);
    } catch {
      // Decisão já aplicada localmente; falha de persistência não deve quebrar a UI
    }
  }

  function handleExportOmie(targetRecords?: FinancialRecord[]) {
    const list = targetRecords && targetRecords.length ? targetRecords : filteredRecords.length ? filteredRecords : records;
    if (!list.length) return;
    const ofxContent = generateOmieOfx(list, pendingMetadata || undefined);
    const blob = new Blob([ofxContent], { type: "application/x-ofx;charset=windows-1252" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `extrato_padronizado_omie_${dateStr}.ofx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotice(`Arquivo OFX normalizado para o Omie exportado com sucesso (${list.length} registros).`);
  }

  async function handleImportTitlesFileData(file: File) {
    const text = await file.text();
    const result = parseReceivablesCsv(text);
    if (result.errors.length > 0) {
      setNotice(`Aviso: ${result.errors[0]}`);
      return;
    }
    try {
      const response = await fetch(`/api/titles?organizationId=${encodeURIComponent(organizationId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titles: result.titles })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Falha ao importar títulos.");
      setNotice(`${payload.insertedCount ?? 0} título(s) persistido(s) com sucesso.`);
      const refresh = await fetch(`/api/titles?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
      const refreshed = await refresh.json();
      if (refresh.ok) setTitles(Array.isArray(refreshed.titles) ? refreshed.titles : []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao importar títulos.");
    }
  }

  function handleExportBatchSettlement(customMatches?: ReconciliationMatch[]) {
    if (!canApproveBatchSettlement(membershipRole)) {
      setNotice("Ação bloqueada: somente Owner ou Admin pode gerar o lote oficial de baixas.");
      return;
    }
    const target = customMatches && customMatches.length ? customMatches : matchStats.ready;
    if (!target.length) {
      setNotice("Não há títulos com correspondência bancária pronta para baixa.");
      return;
    }
    const settlements = buildSettlementItems(target);
    const csvContent = generateOmieBatchSettlementCsv(settlements);
    const blob = new Blob([csvContent], { type: "text/csv;charset=windows-1252" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `lote_baixas_omie_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotice(`Arquivo CSV gerado para conferência e eventual importação manual no Omie (${settlements.length} itens). Nenhum título foi baixado pelo RSBUILD OS.`);
  }

  async function handleConfirmSettlementInSession() {
    if (!canApproveBatchSettlement(membershipRole)) {
      setNotice("Ação bloqueada: somente Owner ou Admin pode confirmar baixas.");
      return;
    }
    const target = matchStats.ready;
    if (!target.length) {
      setNotice("Não há títulos com correspondência bancária pronta para baixa.");
      return;
    }
    const settlements = buildSettlementItems(target).map((item) => ({
      receivableTitleId: item.titleId,
      documentNumber: item.documentNumber,
      customerName: item.customerName,
      amount: item.amountPaid,
      settlementDate: item.settlementDate,
      sourceRecordId: item.sourceRecordId,
      observation: item.observation
    }));
    try {
      const response = await fetch(`/api/settlements?organizationId=${encodeURIComponent(organizationId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settlements })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Falha ao persistir baixas.");
      setNotice(`${payload.insertedCount ?? 0} baixa(s) persistida(s) com sucesso.`);
      const matchedTitleIds = new Set(target.map((m) => m.title.id));
      setTitles((curr) =>
        curr.map((t) => (matchedTitleIds.has(t.id) ? { ...t, status: "baixado" as const } : t))
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao persistir baixas.");
    }
  }

  async function handleImportProofsFileData(file: File) {
    const text = await file.text();
    const result = parseDeliveryCsv(text);
    if (result.errors.length > 0) {
      setNotice(`Aviso na importação de canhotos: ${result.errors[0]}`);
      return;
    }
    try {
      const response = await fetch(`/api/proofs?organizationId=${encodeURIComponent(organizationId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proofs: result.proofs })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Falha ao importar canhotos.");
      setNotice(`${payload.insertedCount ?? 0} comprovante(s) importado(s) com sucesso.`);
      const refresh = await fetch(`/api/proofs?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
      const refreshed = await refresh.json();
      if (refresh.ok) setProofs(Array.isArray(refreshed.proofs) ? refreshed.proofs : []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao importar canhotos.");
    }
  }

  function handleExportBlindageReport() {
    if (!proofs.length) {
      setNotice("Não há canhotos ou notas registradas para exportar o protocolo.");
      return;
    }
    const csvContent = generateDeliveryBlindageCsv(proofs, evaluations);
    const blob = new Blob([csvContent], { type: "text/csv;charset=windows-1252" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `protocolo_blindagem_canhotos_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotice(`Relatório CSV exportado (${evaluations.length} registros analisados). O arquivo não constitui parecer jurídico nem comprova autenticidade documental.`);
  }

  async function handleConfirmReceipt(proofId: string) {
    const proof = proofs.find((item) => item.id === proofId);
    if (!proof) {
      setNotice("Comprovante não encontrado nesta sessão.");
      return;
    }
    if (!proof.deliveryDate || !proof.receiverName?.trim() || !proof.receiverDocument?.trim() || !proof.proofFileUrl?.trim()) {
      setNotice("Conferência bloqueada: informe data de entrega, nome, documento do recebedor e referência do arquivo de evidência original. O sistema não pode inventar esses dados.");
      return;
    }
    try {
      const response = await fetch(`/api/proofs/${proofId}?organizationId=${encodeURIComponent(organizationId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "comprovado",
          deliveryDate: proof.deliveryDate,
          receiverName: proof.receiverName,
          receiverDocument: proof.receiverDocument,
          proofFileUrl: proof.proofFileUrl
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Falha ao atualizar canhoto.");
      setProofs((curr) =>
        curr.map((item) => item.id === proofId
          ? { ...item, status: "comprovado" }
          : item)
      );
      setNotice("Conferência registrada com sucesso no servidor.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao atualizar canhoto.");
    }
  }

  function handleParseWhatsApp() {
    if (!whatsAppText.trim()) {
      setNotice("Cole ou digite a mensagem de WhatsApp antes de processar.");
      return;
    }
    const result = parseWhatsAppOrderMessage(whatsAppText);
    setParsedPreview(result);
    setNotice(`Mensagem decifrada: ${result.customerName} (${result.totalBoxes} caixas identificadas).`);
  }

  async function handleConfirmParsedOrder() {
    if (!parsedPreview) return;
    try {
      const response = await fetch(`/api/orders?organizationId=${encodeURIComponent(organizationId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders: [parsedPreview] })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Falha ao persistir pedido.");
      setNotice(`Pedido de ${parsedPreview.customerName} persistido com sucesso.`);
      const refresh = await fetch(`/api/orders?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
      const refreshed = await refresh.json();
      if (refresh.ok) setOrders(Array.isArray(refreshed.orders) ? refreshed.orders : []);
      setParsedPreview(null);
      setWhatsAppText("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao persistir pedido.");
    }
  }

  function handleExportOmieSalesOrders() {
    if (!orders.length) {
      setNotice("Não há pedidos estruturados para exportar.");
      return;
    }
    const csvContent = generateOmieSalesOrderCsv(orders);
    const blob = new Blob([csvContent], { type: "text/csv;charset=windows-1252" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `pedidos_vendas_omie_hub_acai_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotice(`Arquivo de Pedidos de Venda exportado com sucesso para o Omie (${orders.length} pedidos).`);
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
          if (mod === "finance") navigateTo("visao-geral");
          else if (mod === "reconciliation") navigateTo("baixas");
          else if (mod === "logistics") navigateTo("pedidos-ha");
          else if (mod === "audit") navigateTo("torre-controle");
        }}
        onSelectSection={navigateTo}
        onOpenConfig={() => setIsConfigOpen(true)}
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
          period={period}
          startDate={customStartDate}
          endDate={customEndDate}
          theme={theme}
          userRole={effectiveRole}
          userEmail={currentUserEmail}
          userFullName={userFullName}
          userRoleTitle={userRoleTitle}
          showPeriodSelector={!["workspace", "torre-controle", "auditoria", "pedidos-ha", "canhotos"].includes(section)}
          onPeriodChange={handlePeriodChange}
          onToggleTheme={toggleTheme}
          onResetSession={resetSession}
          onOpenConfig={() => setIsConfigOpen(true)}
          onOpenTour={() => setIsTourOpen(true)}
        />
        {/* Faixa de Retorno à Holding RSBUILD */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 20px",
            background: "linear-gradient(90deg, rgba(181,88,60,0.08) 0%, rgba(181,88,60,0.03) 100%)",
            borderBottom: "1px solid rgba(181,88,60,0.15)",
            fontSize: "12px",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)" }}>
            <span style={{ fontSize: "14px" }}>🏢</span>
            <span>Workspace operacional de <strong style={{ color: "var(--ink)" }}>{companyName}</strong></span>
            <span style={{ color: "var(--line)" }}>·</span>
            <span>Gerenciado pela Holding RSBUILD</span>
          </div>
          <button
            type="button"
            onClick={() => {
              document.cookie = `rsbuild_selected_org=${encodeURIComponent("0269fe05-0990-41a8-a28c-2919691eaf0f")}; path=/; max-age=31536000; SameSite=Lax`;
              window.location.href = `/?organizationId=0269fe05-0990-41a8-a28c-2919691eaf0f&tab=visao-geral`;
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "5px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(181,88,60,0.3)",
              background: "rgba(181,88,60,0.08)",
              color: "var(--rsbuild-terracotta, #B5583C)",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <span>←</span>
            <span>Voltar à Central de Controle RSBUILD</span>
          </button>
        </div>
        <div className="content">
          {section !== "workspace" && <OrganizationBrandBanner organizationId={organizationId} organizationName={organizationName} />}
          {section === "workspace" ? (
            <section aria-labelledby="workspace-launcher-title" style={{ maxWidth: 1120, margin: "0 auto", padding: "clamp(24px, 5vw, 56px) 0" }}>
              <div style={{ marginBottom: 30 }}>
                <p style={{ margin: "0 0 8px", color: "var(--muted)", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>CENTRAL DE OPERAÇÕES</p>
                <h1 id="workspace-launcher-title" style={{ margin: 0, color: "var(--ink)", fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 650, letterSpacing: "-0.04em" }}>{companyName}</h1>
                <p style={{ margin: "10px 0 0", maxWidth: 620, color: "var(--muted)", fontSize: 14, lineHeight: 1.65 }}>Selecione um módulo para acessar as operações disponíveis neste workspace.</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 235px), 1fr))", gap: 14 }}>
                {MODULE_CONFIGS.filter((module) => enabledModules[module.id]).map((module) => {
                  const destinations: Record<ModuleType, NavSection> = {
                    finance: "visao-geral",
                    reconciliation: "baixas",
                    logistics: "pedidos-ha",
                    audit: "torre-controle"
                  };
                  const descriptions: Record<ModuleType, string> = {
                    finance: "Movimentações, importações e visão financeira",
                    reconciliation: "Conferência de títulos, conciliação e baixas",
                    logistics: "Pedidos, expedição e comprovantes de entrega",
                    audit: "Governança, rastreabilidade e auditoria operacional"
                  };
                  return (
                    <button
                      key={module.id}
                      type="button"
                      onClick={() => navigateTo(destinations[module.id])}
                      aria-label={`Abrir módulo ${module.label}`}
                      style={{
                        display: "flex", alignItems: "center", gap: 16, minHeight: 132,
                        padding: "22px", textAlign: "left", cursor: "pointer",
                        color: "var(--ink)", background: "var(--surface)",
                        border: "1px solid var(--line)", borderRadius: 12,
                        transition: "none"
                      }}
                    >
                      <span style={{ display: "grid", placeItems: "center", flex: "0 0 46px", width: 46, height: 46, borderRadius: 10, color: "var(--rsbuild-terracotta, #B5583C)", background: "var(--surface-raised, rgba(255,255,255,0.04))" }}>
                        <RsbuildIcon name={module.icon} size={25} tone="accent" />
                      </span>
                      <span style={{ display: "grid", gap: 7, minWidth: 0 }}>
                        <strong style={{ fontSize: 16, fontWeight: 650 }}>{module.label}</strong>
                        <span style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>{descriptions[module.id]}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : (
          <>
          <div className="inline-note" role="note">
            Títulos, canhotos e pedidos são persistidos no Supabase com isolamento por organização.
          </div>
          {isLoadingRecords && <div className="inline-note" role="status">Carregando movimentos financeiros da organização...</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setIsAdminPanelOpen((open) => !open)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <span>{isAdminPanelOpen ? "✕" : "⚙️"}</span>
              <span>{isAdminPanelOpen ? "Fechar Gestão da Empresa" : "Equipe & Identidade da Empresa"}</span>
            </button>
          </div>
          {isAdminPanelOpen && <OrganizationAdminPanel organizationId={organizationId} organizationName={organizationName} role={effectiveRole} />}
          {notice && (
            <div className="notice" role="status">
              {formatOperationalNotice(notice)}
              <button onClick={() => setNotice("")}>×</button>
            </div>
          )}
          {["mundo_sabor_qa", "hub_acai_qa"].includes(organizationSlug) && (
            <FinanceEvaluationGuide section={section} organizationName={organizationName} organizationId={organizationId} />
          )}
          {section === "visao-geral" && (
            <VisaoGeralView
              records={filteredRecords}
              totals={totals}
              onNavigateToMovimentacoes={() => navigateTo("movimentacoes")}
              onOpenImport={() => inputRef.current?.click()}
            />
          )}
          {section === "torre-controle" && (
            <TorreControleView
              companyName={companyName}
              isDirector={isSuperAdmin}
              currentUserEmail={currentUserEmail}
              records={records}
              totals={totals}
              titles={titles}
              matches={matches}
              proofs={proofs}
              deliveryMetrics={deliveryMetrics}
              evaluations={evaluations}
              orders={orders}
              hubAcaiMetrics={hubAcaiMetrics}
              hasSprintZone={canAccessSprintZone(effectiveRole, organizationSlug) || isDeveloperAuthorized}
              onNavigateToTab={navigateTo}
            />
          )}
          {section === "auditoria" && (
            <AuditTrailView organizationId={organizationId} organizationName={companyName} />
          )}
          {section === "movimentacoes" && (
            <MovimentacoesView
              records={filteredRecords}
              onOpenImport={() => inputRef.current?.click()}
              onExportOmie={handleExportOmie}
            />
          )}
          {section === "importacoes" && (
            <ImportacoesView
              fileName={fileName}
              detectedColumns={detectedColumns}
              pendingImport={pendingImport}
              pendingMetadata={pendingMetadata}
              importErrors={importErrors}
              isImporting={isImporting}
              onSelectFile={() => inputRef.current?.click()}
              onCancelImport={cancelImport}
              onExportOmieOfx={() => handleExportOmie(pendingImport)}
              onConfirmImport={confirmImport}
            />
          )}
          {section === "conciliacao" && (
            <ConciliacaoView
              bankRecords={filteredRecords}
              omieRecords={omieRecords}
              author={currentUserEmail}
              role={effectiveRole}
              onRecordsUpdated={setRecords}
              onImportOmieRecordsPersist={handleOmieImportPersist}
              onReconciliationDecision={handleReconciliationDecision}
            />
          )}
          {section === "baixas" && (
            <BaixasView
              titles={titles}
              matches={matches}
              matchStats={matchStats}
              role={effectiveRole}
              onImportTitlesFile={handleImportTitlesFileData}
              onConfirmSettlementInSession={handleConfirmSettlementInSession}
              onExportBatchSettlement={handleExportBatchSettlement}
            />
          )}
          {section === "canhotos" && (
            <CanhotosView
              proofs={proofs}
              deliveryMetrics={deliveryMetrics}
              evaluations={evaluations}
              onImportProofsFile={handleImportProofsFileData}
              onExportBlindage={handleExportBlindageReport}
              onConfirmReceipt={handleConfirmReceipt}
            />
          )}
          {section === "pedidos-ha" && (
            <PedidosHaView
              orders={orders}
              hubAcaiMetrics={hubAcaiMetrics}
              whatsAppText={whatsAppText}
              parsedPreview={parsedPreview}
              onWhatsAppTextChange={setWhatsAppText}
              onParseMessage={handleParseWhatsApp}
              onConfirmOrder={handleConfirmParsedOrder}
              onExportOmieCsv={handleExportOmieSalesOrders}
              onClearText={() => setWhatsAppText("")}
              onLoadExample={() =>
                setWhatsAppText(
                  "Bom dia! Aqui é o Fabiano da Sorveteria Barra Vento.\n" +
                    "Favor mandar pra gente amanhã:\n" +
                    "- 12 caixas de tradicional 10L\n" +
                    "- 4 caixas de morango\n" +
                    "- 4 caixas de banana\n" +
                    "- duas de cupuaçu\n" +
                    "Fazer no boleto 7 dias."
                )
              }
            />
          )}
          {section === "relatorios" && <RelatoriosDreView records={filteredRecords} isLoading={isLoadingRecords} />}
          </>
          )}
        </div>
      </section>
      <input
        ref={inputRef}
        className="hidden-input"
        type="file"
        accept=".csv,.ofx,text/csv,application/x-ofx"
        onChange={handleFile}
      />
      <WorkspaceModal
        isOpen={isConfigOpen}
        companyName={companyName}
        companyLogoUrl={companyLogoUrl}
        currentOrgId={currentOrgId}
        currentOrgRealId={organizationId}
        availableOrganizationSlugs={availableOrganizationSlugs}
        isSuperAdmin={isSuperAdmin}
        canManageModules={isPlatformAdministrator}
        enabledModules={enabledModules}
        brandColor={brandColor}
        onClose={() => setIsConfigOpen(false)}
        onSave={handleSaveCompanyConfig}
        onUploadLogo={handleLogoUploadFile}
      />
      <DevZonePanel
        developerAccessAllowed={isDeveloperAuthorized || canAccessSprintZone(membershipRole, organizationSlug)}
        currentOrgId={organizationId}
        currentOrgSlug={organizationSlug}
        realUserEmail={currentUserEmail}
        realRole={membershipRole}
        simulatedRole={simulatedRole}
        onSimulateRole={setSimulatedRole}
        recordsCount={records.length}
        titlesCount={titles.length}
        proofsCount={proofs.length}
        ordersCount={orders.length}
        onInjectBankRecords={(newRecords) => setRecords(newRecords)}
        onInjectOmieRecords={(newOmie) => setOmieRecords(newOmie)}
        onInjectTitles={(newTitles) => setTitles(newTitles)}
        onInjectProofs={(newProofs) => setProofs(newProofs)}
        onInjectOrders={(newOrders) => setOrders(newOrders)}
        onResetAllData={resetSession}
      />
      <ProductTourModal
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        onNavigateToSection={(targetSection) => navigateTo(targetSection)}
      />
    </main>
  );
}
