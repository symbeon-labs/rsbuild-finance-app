"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BankMetadata,
  FinancialRecord,
  generateOmieOfx,
  parseCsv,
  parseOfx,
  filterRecordsByPeriodOption,
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
  INITIAL_SAMPLE_TITLES,
  INITIAL_SAMPLE_PROOFS,
  INITIAL_SAMPLE_HA_ORDERS,
  type ModuleType,
  type NavSection,
  type EnabledModulesConfig,
  type OrganizationId,
  ORGANIZATION_PRESETS,
  orgHasExecutiveTower
} from "@/app/types/workspace";
import { Sidebar } from "@/app/components/shell/sidebar";
import { Topbar } from "@/app/components/shell/topbar";
import { WorkspaceModal } from "@/app/components/shell/workspace-modal";
import { VisaoGeralView } from "@/app/components/finance/visao-geral-view";
import { MovimentacoesView } from "@/app/components/finance/movimentacoes-view";
import { ImportacoesView } from "@/app/components/finance/importacoes-view";
import { BaixasView } from "@/app/components/finance/baixas-view";
import { RelatoriosDreView } from "@/app/components/finance/relatorios-dre-view";
import { CanhotosView } from "@/app/components/logistics/canhotos-view";
import { PedidosHaView } from "@/app/components/logistics/pedidos-ha-view";
import { TorreControleView } from "@/app/components/executive/torre-controle-view";

const SUPERADMIN_EMAILS = [
  "neo.sh1w4@gmail.com",
  "admin@rsbuild.com.br",
  "diretoria@rsbuild.com.br",
  "admin@symbeon.com.br",
  "contato@symbeon.com.br"
];

export default function EnterpriseWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL Sync para Seção e Módulo
  const urlTab = searchParams.get("tab") as NavSection | null;
  const initialSection: NavSection =
    urlTab && ["visao-geral", "torre-controle", "movimentacoes", "importacoes", "baixas", "canhotos", "pedidos-ha", "relatorios"].includes(urlTab)
      ? urlTab
      : "visao-geral";

  const [section, setSection] = useState<NavSection>(initialSection);
  const [activeModule, setActiveModule] = useState<ModuleType>(
    initialSection === "canhotos" || initialSection === "pedidos-ha" ? "logistics" : "finance"
  );

  function navigateTo(nextSection: NavSection) {
    if (nextSection === "torre-controle" && !orgHasExecutiveTower(currentOrgId)) {
      setNotice("A Torre de Controle está disponível exclusivamente no workspace Hub Açaí Salvador.");
      setSection("visao-geral");
      setActiveModule("finance");
      router.push(`/?tab=visao-geral`, { scroll: false });
      return;
    }
    setSection(nextSection);
    if (nextSection === "canhotos" || nextSection === "pedidos-ha") {
      setActiveModule("logistics");
    } else if (nextSection !== "torre-controle") {
      setActiveModule("finance");
    }
    router.push(`/?tab=${nextSection}`, { scroll: false });
  }

  // Estados Financeiros & Sessão
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [pendingImport, setPendingImport] = useState<FinancialRecord[]>([]);
  const [pendingMetadata, setPendingMetadata] = useState<BankMetadata | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");

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
      localStorage.setItem("rsbuild_period_option", p);
      if (start !== undefined) localStorage.setItem("rsbuild_period_start", start);
      if (end !== undefined) localStorage.setItem("rsbuild_period_end", end);
    } catch {}
  }

  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Customização de Marca do Workspace (White-label & Multi-Tenant)
  const [currentOrgId, setCurrentOrgId] = useState<OrganizationId>("rsbuild");
  const [companyName, setCompanyName] = useState("RSBUILD Inovação");
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>("");
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("neo.sh1w4@gmail.com");
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Tema Visual: 'sand' ou 'dark'
  const [theme, setTheme] = useState<"sand" | "dark">("sand");

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

  // Controle de Módulos Habilitados
  const [enabledModules, setEnabledModules] = useState<EnabledModulesConfig>({
    finance: true,
    logistics: true
  });

  const isSuperAdmin = useMemo(() => {
    return Boolean(currentUserEmail && SUPERADMIN_EMAILS.includes(currentUserEmail.trim().toLowerCase()));
  }, [currentUserEmail]);

  // Blindagem de Governança: Torre de Controle não existe em RSBUILD nem Mundo do Sabor
  useEffect(() => {
    if (section === "torre-controle" && !orgHasExecutiveTower(currentOrgId)) {
      setSection("visao-geral");
      setActiveModule("finance");
      router.push(`/?tab=visao-geral`, { scroll: false });
    }
  }, [section, currentOrgId, router]);

  // Contas a Receber e Baixas em Lote
  const [titles, setTitles] = useState<ReceivableTitle[]>(INITIAL_SAMPLE_TITLES);

  // Canhotos de Entrega e Blindagem
  const [proofs, setProofs] = useState<DeliveryProof[]>(INITIAL_SAMPLE_PROOFS);

  // Pedidos WhatsApp
  const [orders, setOrders] = useState<ParsedWhatsAppOrder[]>(INITIAL_SAMPLE_HA_ORDERS);
  const [whatsAppText, setWhatsAppText] = useState("");
  const [parsedPreview, setParsedPreview] = useState<ParsedWhatsAppOrder | null>(null);

  // Hidratação inicial do localStorage (Configurações e Persistência de Sessão)
  useEffect(() => {
    try {
      const savedName = localStorage.getItem("rsbuild_workspace_company");
      if (savedName) setCompanyName(savedName);
      const savedOrgId = localStorage.getItem("rsbuild_workspace_org_id") as OrganizationId | null;
      if (savedOrgId) setCurrentOrgId(savedOrgId);
      const savedLogo = localStorage.getItem("rsbuild_workspace_logo");
      if (savedLogo) setCompanyLogoUrl(savedLogo);
      const savedUser = localStorage.getItem("rsbuild_auth_email");
      if (savedUser) setCurrentUserEmail(savedUser);
      const savedModules = localStorage.getItem("rsbuild_workspace_modules");
      if (savedModules) {
        const parsed = JSON.parse(savedModules);
        setEnabledModules(parsed);
      }
      const savedTheme = localStorage.getItem("rsbuild_theme") as "sand" | "dark" | null;
      if (savedTheme === "dark" || savedTheme === "sand") {
        setTheme(savedTheme);
        document.documentElement.setAttribute("data-theme", savedTheme);
      }

      // Persistência de Período
      const savedPeriod = localStorage.getItem("rsbuild_period_option") as PeriodOption | null;
      if (savedPeriod) setPeriod(savedPeriod);
      const savedStart = localStorage.getItem("rsbuild_period_start");
      if (savedStart) setCustomStartDate(savedStart);
      const savedEnd = localStorage.getItem("rsbuild_period_end");
      if (savedEnd) setCustomEndDate(savedEnd);

      // Persistência de Dados Operacionais
      const savedRecords = localStorage.getItem("rsbuild_session_records");
      if (savedRecords) setRecords(JSON.parse(savedRecords));
      const savedTitles = localStorage.getItem("rsbuild_session_titles");
      if (savedTitles) setTitles(JSON.parse(savedTitles));
      const savedProofs = localStorage.getItem("rsbuild_session_proofs");
      if (savedProofs) setProofs(JSON.parse(savedProofs));
      const savedOrders = localStorage.getItem("rsbuild_session_orders");
      if (savedOrders) setOrders(JSON.parse(savedOrders));
    } catch {
      // Ignora falhas em sandbox restrito / SSR
    }
  }, []);

  // Watchers de auto-save de dados no localStorage
  useEffect(() => {
    try {
      localStorage.setItem("rsbuild_session_records", JSON.stringify(records));
    } catch {}
  }, [records]);

  useEffect(() => {
    try {
      localStorage.setItem("rsbuild_session_titles", JSON.stringify(titles));
    } catch {}
  }, [titles]);

  useEffect(() => {
    try {
      localStorage.setItem("rsbuild_session_proofs", JSON.stringify(proofs));
    } catch {}
  }, [proofs]);

  useEffect(() => {
    try {
      localStorage.setItem("rsbuild_session_orders", JSON.stringify(orders));
    } catch {}
  }, [orders]);

  function handleSaveCompanyConfig(
    name: string,
    logo: string,
    modules?: EnabledModulesConfig,
    orgId?: OrganizationId
  ) {
    setCompanyName(name);
    setCompanyLogoUrl(logo);
    if (orgId) {
      setCurrentOrgId(orgId);
      try {
        localStorage.setItem("rsbuild_workspace_org_id", orgId);
      } catch {}
    }
    if (modules) {
      setEnabledModules(modules);
      try {
        localStorage.setItem("rsbuild_workspace_modules", JSON.stringify(modules));
      } catch {}
      if (!modules.finance && modules.logistics && activeModule === "finance") {
        navigateTo("pedidos-ha");
      } else if (!modules.logistics && modules.finance && activeModule === "logistics") {
        navigateTo("visao-geral");
      }
    }
    try {
      localStorage.setItem("rsbuild_workspace_company", name);
      if (logo) {
        localStorage.setItem("rsbuild_workspace_logo", logo);
      } else {
        localStorage.removeItem("rsbuild_workspace_logo");
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
    if (typeof window !== "undefined" && !window.confirm("Reiniciar todos os dados operacionais da sessão atual?")) {
      return;
    }
    setRecords([]);
    setTitles(INITIAL_SAMPLE_TITLES);
    setProofs(INITIAL_SAMPLE_PROOFS);
    setOrders(INITIAL_SAMPLE_HA_ORDERS);
    setPendingImport([]);
    setPendingMetadata(null);
    setImportErrors([]);
    setFileName("");
    try {
      localStorage.removeItem("rsbuild_session_records");
      localStorage.removeItem("rsbuild_session_titles");
      localStorage.removeItem("rsbuild_session_proofs");
      localStorage.removeItem("rsbuild_session_orders");
    } catch {}
    setNotice("Sessão reiniciada com dados de demonstração.");
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

  function confirmImport() {
    setRecords((current) => [...pendingImport, ...current]);
    setNotice(`${pendingImport.length} movimentação(ões) adicionada(s) à sessão atual.`);
    setPendingImport([]);
    setPendingMetadata(null);
    setImportErrors([]);
    setFileName("");
  }

  function cancelImport() {
    setPendingImport([]);
    setPendingMetadata(null);
    setImportErrors([]);
    setFileName("");
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
    setNotice(`Planilha oficial de Baixa em Lote do Omie gerada com sucesso (${settlements.length} títulos liquidados).`);
  }

  function handleConfirmSettlementInSession() {
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
    setNotice(`Protocolo de blindagem jurídica exportado com sucesso (${evaluations.length} notas analisadas).`);
  }

  function handleConfirmReceipt(proofId: string) {
    const today = new Date().toISOString().slice(0, 10);
    setProofs((curr) =>
      curr.map((p) => {
        if (p.id !== proofId) return p;
        return {
          ...p,
          status: "comprovado",
          deliveryDate: p.deliveryDate || today,
          receiverName: p.receiverName || "Recebedor Confirmado (Operador)",
          receiverDocument: p.receiverDocument || "Confirmado em Sessão",
          notes: "Canhoto validado manualmente no fechamento."
        };
      })
    );
    setNotice("Canhoto validado e liberado para protesto/cobrança jurídica com sucesso!");
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
    setNotice(`Pedido de ${parsedPreview.customerName} adicionado à esteira de expedição com sucesso!`);
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
          navigateTo(mod === "finance" ? "visao-geral" : "pedidos-ha");
        }}
        onSelectSection={navigateTo}
        onOpenConfig={() => setIsConfigOpen(true)}
      />
      <section className="main-area">
        <Topbar
          companyName={companyName}
          section={section}
          period={period}
          startDate={customStartDate}
          endDate={customEndDate}
          theme={theme}
          onPeriodChange={handlePeriodChange}
          onToggleTheme={toggleTheme}
          onResetSession={resetSession}
          onOpenConfig={() => setIsConfigOpen(true)}
        />
        <div className="content">
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button onClick={() => setNotice("")}>×</button>
            </div>
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
              onSelectFile={() => inputRef.current?.click()}
              onCancelImport={cancelImport}
              onExportOmieOfx={() => handleExportOmie(pendingImport)}
              onConfirmImport={confirmImport}
            />
          )}
          {section === "baixas" && (
            <BaixasView
              titles={titles}
              matches={matches}
              matchStats={matchStats}
              onReloadSample={() => setTitles(INITIAL_SAMPLE_TITLES)}
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
              onReloadSample={() => setProofs(INITIAL_SAMPLE_PROOFS)}
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
              onReloadSample={() => setOrders(INITIAL_SAMPLE_HA_ORDERS)}
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
        onClose={() => setIsConfigOpen(false)}
        onSave={handleSaveCompanyConfig}
        onUploadLogo={handleLogoUploadFile}
      />
    </main>
  );
}
