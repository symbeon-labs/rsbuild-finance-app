"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import {
  BankMetadata,
  FinancialRecord,
  OmieRecord,
  generateOmieOfx,
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
import { applyBrandColor } from "@/app/lib/brand-color";
import { Sidebar } from "@/app/components/shell/sidebar";
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
import { OrganizationAdminPanel } from "@/app/components/admin/organization-admin-panel";
import { OrganizationBrandBanner } from "@/app/components/admin/organization-brand-banner";
import { ProjectPortfolioView } from "@/app/components/projects/project-portfolio-view";

type EnterpriseWorkspaceProps = {
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

export default function EnterpriseWorkspace({
  organizationId,
  organizationSlug,
  organizationName,
  membershipRole,
  userEmail,
  isDeveloperAuthorized = false,
  userFullName,
  userRoleTitle,
  preferredTheme
}: EnterpriseWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startSignOutTransition] = useTransition();

  // URL Sync para Seção e Módulo
  const urlTab = searchParams.get("tab") as NavSection | null;
  const initialSection: NavSection =
    urlTab && ["visao-geral", "projetos", "torre-controle", "movimentacoes", "importacoes", "conciliacao", "baixas", "canhotos", "pedidos-ha", "relatorios"].includes(urlTab)
      ? urlTab
      : "visao-geral";

  function getModuleForSection(s: NavSection): ModuleType {
    if (s === "baixas" || s === "conciliacao") return "reconciliation";
    if (s === "pedidos-ha" || s === "canhotos") return "logistics";
    if (s === "torre-controle") return "audit";
    if (s === "projetos") return ORGANIZATION_PRESETS.find((preset) => preset.id === organizationSlug)?.defaultModule ?? "finance";
    return "finance";
  }

  const [section, setSection] = useState<NavSection>(initialSection);
  const [activeModule, setActiveModule] = useState<ModuleType>(getModuleForSection(initialSection));

  function navigateTo(nextSection: NavSection) {
    setSection(nextSection);
    if (nextSection !== "visao-geral") {
      setActiveModule(getModuleForSection(nextSection));
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

  // Registros Omie para conciliação
  const [omieRecords, setOmieRecords] = useState<OmieRecord[]>([]);

  // Simulação de Papéis na Zona Dev (Modo Engenharia)
  const [simulatedRole, setSimulatedRole] = useState<MemberRole | null>(null);
  const effectiveRole = simulatedRole || (membershipRole as MemberRole);
  const isSuperAdmin = effectiveRole === "owner";

  // Filtro de Período Contábil e Customizado
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

  // Customização de Marca do Workspace (White-label & Multi-Tenant)
  const currentOrgId = organizationSlug;
  const [companyName, setCompanyName] = useState(organizationName);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>("");
  const [currentUserEmail] = useState<string>(userEmail);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Tema Visual: 'sand' ou 'dark'
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

  // Cor de Marca do Workspace (Brand Color Picker) — substitui --rsbuild-terracotta dinamicamente
  const [brandColor, setBrandColor] = useState<string>("#B5583C");

  // Módulos iniciais respeitam a configuração declarada para cada organização.
  // Preferências locais podem personalizar apenas o workspace atual neste navegador.
  const organizationPreset = ORGANIZATION_PRESETS.find((preset) => preset.id === currentOrgId);
  const [enabledModules, setEnabledModules] = useState<EnabledModulesConfig>(
    organizationPreset?.enabledModules ?? { finance: true, reconciliation: false, logistics: false, audit: false }
  );

  // isSuperAdmin calculado reativamente com base em effectiveRole

  // Contas a Receber e Baixas em Lote
  const [titles, setTitles] = useState<ReceivableTitle[]>([]);

  // Canhotos de Entrega e Blindagem
  const [proofs, setProofs] = useState<DeliveryProof[]>([]);

  // Pedidos WhatsApp
  const [orders, setOrders] = useState<ParsedWhatsAppOrder[]>([]);
  const [whatsAppText, setWhatsAppText] = useState("");
  const [parsedPreview, setParsedPreview] = useState<ParsedWhatsAppOrder | null>(null);

  // Carrega sempre a fonte autoritativa financeira da organização autenticada.
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

  // Hidratação inicial do localStorage (Configurações e Persistência de Sessão)
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

      // Hidratação da Cor de Marca (Brand Color Picker)
      {
        const savedBrandColor = localStorage.getItem(`rsbuild_workspace_brand_color_${organizationId}`);
        const colorToApply = organizationPreset?.brandColor || savedBrandColor || "#B5583C";
        setBrandColor(colorToApply);
        applyBrandColor(colorToApply);
      }

      // Persistência de Período
      const savedPeriod = localStorage.getItem(`rsbuild_period_option_${organizationId}`) as PeriodOption | null;
      if (savedPeriod) setPeriod(savedPeriod);
      const savedStart = localStorage.getItem(`rsbuild_period_start_${organizationId}`);
      if (savedStart) setCustomStartDate(savedStart);
      const savedEnd = localStorage.getItem(`rsbuild_period_end_${organizationId}`);
      if (savedEnd) setCustomEndDate(savedEnd);

    } catch {
      // Ignora falhas em sandbox restrito / SSR
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
      // O tenant ativo é definido no servidor; o seletor visual não pode trocar a organização autenticada.
      // Aplica apenas a paleta visual local do preset correspondente.
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
    if (typeof window !== "undefined" && !window.confirm("Limpar os dados temporários desta sessão? Os registros financeiros persistidos não serão alterados.")) {
      return;
    }
    setOmieRecords([]);
    setTitles([]);
    setProofs([]);
    setOrders([]);
    setPendingImport([]);
    setPendingMetadata(null);
    setImportErrors([]);
    setFileName("");
    try {
      localStorage.removeItem(`rsbuild_session_titles_${organizationId}`);
      localStorage.removeItem(`rsbuild_session_proofs_${organizationId}`);
      localStorage.removeItem(`rsbuild_session_orders_${organizationId}`);
    } catch {}
    setNotice("Dados temporários desta sessão foram limpos. Registros financeiros persistidos não foram alterados.");
  }

  // Filtragem Reativa de Registros por Período
  const filteredRecords = useMemo(() => {
    return filterRecordsByPeriodOption(records, {
      option: period,
      startDate: customStartDate,
      endDate: customEndDate
    });
  }, [records, period, customStartDate, customEndDate]);

  // Cálculos Logística
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

  // Cálculos Financeiros (Baseados no Período Selecionado)
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

  // Handlers de Arquivo e Exportação
  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    pendingFileRef.current = file;
    setFileName(file.name);
    setNotice("");
    const text = await file.text();
    const result = file.name.toLowerCase().endsWith(".ofx") ? parseOfx(text) : parseCsv(text);
    setPendingImport(result.records);
    setImportErrors(result.errors);
    setPendingMetadata(result.metadata || null);
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
    } else {
      setTitles((curr) => [...result.titles, ...curr]);
      setNotice(`${result.titles.length} título(s) a receber carregado(s) com sucesso.`);
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

  function handleConfirmSettlementInSession() {
    if (!canApproveBatchSettlement(membershipRole)) {
      setNotice("Ação bloqueada: somente Owner ou Admin pode confirmar baixas.");
      return;
    }
    const matchedTitleIds = new Set(matchStats.ready.map((m) => m.title.id));
    setTitles((curr) =>
      curr.map((t) => (matchedTitleIds.has(t.id) ? { ...t, status: "baixado" as const } : t))
    );
    setNotice(`${matchedTitleIds.size} título(s) marcados como baixados na sessão.`);
  }

  async function handleImportProofsFileData(file: File) {
    const text = await file.text();
    const result = parseDeliveryCsv(text);
    if (result.errors.length > 0) {
      setNotice(`Aviso na importação de canhotos: ${result.errors[0]}`);
    }
    if (result.proofs.length > 0) {
      setProofs((curr) => [...result.proofs, ...curr]);
      setNotice(`${result.proofs.length} comprovante(s) de entrega importado(s) com sucesso.`);
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

  function handleConfirmReceipt(proofId: string) {
    const proof = proofs.find((item) => item.id === proofId);
    if (!proof) {
      setNotice("Comprovante não encontrado nesta sessão.");
      return;
    }
    if (!proof.deliveryDate || !proof.receiverName?.trim() || !proof.receiverDocument?.trim() || !proof.proofFileUrl?.trim()) {
      setNotice("Conferência bloqueada: informe data de entrega, nome, documento do recebedor e referência do arquivo de evidência original. O sistema não pode inventar esses dados.");
      return;
    }
    setProofs((curr) =>
      curr.map((item) => item.id === proofId
        ? { ...item, status: "comprovado" }
        : item)
    );
    setNotice("Conferência registrada apenas nesta sessão. Isso não autentica a assinatura, não altera o ERP e não libera cobrança ou protesto.");
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

  function handleConfirmParsedOrder() {
    if (!parsedPreview) return;
    setOrders((curr) => [parsedPreview, ...curr]);
    setNotice(`Pedido de ${parsedPreview.customerName} adicionado à fila temporária desta sessão. A fila não foi persistida nem enviada ao ERP.`);
    setParsedPreview(null);
    setWhatsAppText("");
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
          period={period}
          startDate={customStartDate}
          endDate={customEndDate}
          theme={theme}
          userRole={effectiveRole}
          userEmail={currentUserEmail}
          userFullName={userFullName}
          userRoleTitle={userRoleTitle}
          onPeriodChange={handlePeriodChange}
          onToggleTheme={toggleTheme}
          onResetSession={resetSession}
          onOpenConfig={() => setIsConfigOpen(true)}
        />
        <div className="content">
          <OrganizationBrandBanner organizationId={organizationId} organizationName={organizationName} />
          <div className="inline-note" role="note">
            Títulos, canhotos e pedidos deste protótipo são dados locais de demonstração, isolados por organização; não representam persistência oficial no servidor.
          </div>
          {isLoadingRecords && <div className="inline-note" role="status">Carregando movimentos financeiros da organização...</div>}
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
          {section === "projetos" && <ProjectPortfolioView />}
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
          {section === "relatorios" && <RelatoriosDreView />}
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
        isSuperAdmin={isSuperAdmin}
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
    </main>
  );
}
