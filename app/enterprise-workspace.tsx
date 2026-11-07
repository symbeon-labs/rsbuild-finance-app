"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { BankMetadata, FinancialRecord, formatCurrency, formatDate, generateOmieOfx, parseCsv, parseOfx } from "@/lib/finance";
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
  DeliveryStatus,
  ProtestoEvaluation,
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

type ModuleType = "finance" | "logistics";
type Section = "visao-geral" | "movimentacoes" | "importacoes" | "baixas" | "canhotos" | "pedidos-ha" | "relatorios";

interface NavItem {
  id: Section;
  label: string;
  icon: string;
  module: ModuleType | "all";
}

const allNavItems: NavItem[] = [
  // Módulo Financeiro
  { id: "visao-geral", label: "Visão Geral", icon: "◫", module: "all" },
  { id: "movimentacoes", label: "Movimentações", icon: "⇄", module: "finance" },
  { id: "importacoes", label: "Importações", icon: "⇧", module: "finance" },
  { id: "baixas", label: "Baixas & Liquidações", icon: "✓", module: "finance" },
  { id: "relatorios", label: "Relatórios DRE", icon: "▥", module: "finance" },

  // Módulo Logística & Expedição
  { id: "pedidos-ha", label: "Entrada de Pedidos", icon: "📱", module: "logistics" },
  { id: "canhotos", label: "Comprovantes & Canhotos", icon: "📦", module: "logistics" }
];

const INITIAL_SAMPLE_TITLES: ReceivableTitle[] = [
  {
    id: "tit-101",
    documentNumber: "NF-4580",
    customerName: "Supermercado Real Salvador",
    amount: 1500.0,
    dueDate: "2026-04-10",
    bankAccount: "Itaú Unibanco",
    ourNumber: "0341999888",
    status: "pendente"
  },
  {
    id: "tit-102",
    documentNumber: "NF-4581",
    customerName: "Distribuidora Alimentos Bahia",
    amount: 3200.5,
    dueDate: "2026-04-12",
    bankAccount: "Banco do Nordeste (BNB)",
    status: "pendente"
  },
  {
    id: "tit-103",
    documentNumber: "NF-4582",
    customerName: "Padaria e Lanchonete Estrela",
    amount: 850.0,
    dueDate: "2026-04-15",
    bankAccount: "Banco Inter",
    status: "pendente"
  },
  {
    id: "tit-104",
    documentNumber: "NF-4583",
    customerName: "Mercado Regional Lauro de Freitas",
    amount: 5000.0,
    dueDate: "2026-04-20",
    bankAccount: "Itaú Unibanco",
    status: "pendente"
  },
  {
    id: "tit-105",
    documentNumber: "NF-4584",
    customerName: "Cantina Sabor Central",
    amount: 2400.0,
    dueDate: "2026-04-22",
    bankAccount: "Itaú Unibanco",
    status: "pendente"
  }
];

const INITIAL_SAMPLE_PROOFS: DeliveryProof[] = [
  {
    id: "prf-4580",
    nfeNumber: "4580",
    nfeKey: "29260401234567000199550010000045801000000010",
    customerName: "Supermercado Real Salvador",
    nfeAmount: 1500.0,
    issueDate: "2026-04-01",
    deliveryDate: "2026-04-03",
    status: "comprovado",
    driverName: "Carlos Rota Litoral",
    receiverName: "Marcos Souza (Doca 2)",
    receiverDocument: "RG 12.345.678-BA",
    proofFileUrl: "canhoto_nf_4580_assinado.pdf"
  },
  {
    id: "prf-4581",
    nfeNumber: "4581",
    customerName: "Distribuidora Alimentos Bahia",
    nfeAmount: 3200.5,
    issueDate: "2026-04-02",
    status: "recusa_devolucao",
    driverName: "Carlos Rota Litoral",
    notes: "Recusa parcial registrada: 4 caixas avariadas na descarga."
  },
  {
    id: "prf-4582",
    nfeNumber: "4582",
    customerName: "Padaria e Lanchonete Estrela",
    nfeAmount: 850.0,
    issueDate: "2026-04-03",
    status: "pendente_entrega",
    driverName: "Raimundo Entregas",
    notes: "Carga em trânsito com previsão hoje às 17h."
  },
  {
    id: "prf-4583",
    nfeNumber: "4583",
    customerName: "Mercado Regional Lauro de Freitas",
    nfeAmount: 5000.0,
    issueDate: "2026-04-04",
    deliveryDate: "2026-04-05",
    status: "comprovado",
    driverName: "Raimundo Entregas",
    receiverName: "Sueli Alcântara (Financeiro)",
    receiverDocument: "CPF 012.345.678-99",
    proofFileUrl: "canhoto_nf_4583_carimbado.jpg"
  },
  {
    id: "prf-4584",
    nfeNumber: "4584",
    customerName: "Cantina Sabor Central",
    nfeAmount: 2400.0,
    issueDate: "2026-03-25",
    status: "extraviado",
    driverName: "Terceirizado Rota 4",
    notes: "Motorista não retornou com canhoto físico assinado."
  }
];

const INITIAL_SAMPLE_HA_ORDERS: ParsedWhatsAppOrder[] = [
  {
    id: "ord-ha-001",
    rawMessage: "Bom dia! Aqui é o Marcos do Açaí do Parque Salvador.\nManda 15 caixas do tradicional 10L e 5 de banana.\nBoleto 7 dias.",
    customerName: "Marcos do Açaí do Parque Salvador",
    paymentMethod: "boleto_7d",
    items: [
      {
        sku: "ACAI-TRAD-10L",
        productName: "Açaí Tradicional Especial 10L",
        flavor: "Tradicional",
        quantity: 15,
        unitPrice: 120.0,
        totalAmount: 1800.0,
        boxesTotal: 15,
        rawText: "15 caixas do tradicional 10L",
        confidence: "alta"
      },
      {
        sku: "ACAI-BAN-10L",
        productName: "Açaí com Banana 10L",
        flavor: "Banana",
        quantity: 5,
        unitPrice: 125.0,
        totalAmount: 625.0,
        boxesTotal: 5,
        rawText: "5 de banana",
        confidence: "alta"
      }
    ],
    totalBoxes: 20,
    totalAmount: 2425.0,
    confidence: "alta",
    unrecognizedLines: [],
    createdAt: new Date().toISOString(),
    status: "confirmado"
  },
  {
    id: "ord-ha-002",
    rawMessage: "Sou a Danielle do Quiosque Orla Pituba.\nPreciso de 4 de morango, 2 de cupuaçu e 4 de trufado ninho.\nPix na entrega.",
    customerName: "Danielle do Quiosque Orla Pituba",
    paymentMethod: "pix",
    items: [
      {
        sku: "ACAI-MOR-10L",
        productName: "Açaí com Morango 10L",
        flavor: "Morango",
        quantity: 4,
        unitPrice: 125.0,
        totalAmount: 500.0,
        boxesTotal: 4,
        rawText: "4 de morango",
        confidence: "alta"
      },
      {
        sku: "ACAI-CUPU-10L",
        productName: "Açaí com Cupuaçu 10L",
        flavor: "Cupuaçu",
        quantity: 2,
        unitPrice: 130.0,
        totalAmount: 260.0,
        boxesTotal: 2,
        rawText: "2 de cupuaçu",
        confidence: "alta"
      },
      {
        sku: "ACAI-TRUF-10L",
        productName: "Açaí Trufado Leite Ninho 10L",
        flavor: "Trufado Ninho",
        quantity: 4,
        unitPrice: 145.0,
        totalAmount: 580.0,
        boxesTotal: 4,
        rawText: "4 de trufado ninho",
        confidence: "alta"
      }
    ],
    totalBoxes: 10,
    totalAmount: 1340.0,
    confidence: "alta",
    unrecognizedLines: [],
    createdAt: new Date().toISOString(),
    status: "confirmado"
  }
];

export default function EnterpriseWorkspace() {
  const [activeModule, setActiveModule] = useState<ModuleType>("finance");
  const [section, setSection] = useState<Section>("visao-geral");
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [pendingImport, setPendingImport] = useState<FinancialRecord[]>([]);
  const [pendingMetadata, setPendingMetadata] = useState<BankMetadata | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("30");
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Lista de e-mails com permissão de Superadmin / Engenharia Symbeon
  const SUPERADMIN_EMAILS = ["neo.sh1w4@gmail.com"];

  // Customização de Marca do Workspace (White-label)
  const [companyName, setCompanyName] = useState("RSBUILD Inovação");
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>("");
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("neo.sh1w4@gmail.com");
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Controle de Módulos Habilitados pelo Dono da Plataforma (Feature Flags)
  const [enabledModules, setEnabledModules] = useState<{ finance: boolean; logistics: boolean }>({
    finance: true,
    logistics: true
  });

  const isSuperAdmin = useMemo(() => {
    return Boolean(currentUserEmail && SUPERADMIN_EMAILS.includes(currentUserEmail.trim().toLowerCase()));
  }, [currentUserEmail]);

  useEffect(() => {
    try {
      const savedName = localStorage.getItem("rsbuild_workspace_company");
      if (savedName) setCompanyName(savedName);
      const savedLogo = localStorage.getItem("rsbuild_workspace_logo");
      if (savedLogo) setCompanyLogoUrl(savedLogo);
      const savedUser = localStorage.getItem("rsbuild_auth_email");
      if (savedUser) setCurrentUserEmail(savedUser);
      const savedModules = localStorage.getItem("rsbuild_workspace_modules");
      if (savedModules) {
        const parsed = JSON.parse(savedModules);
        setEnabledModules(parsed);
        if (!parsed.finance && parsed.logistics) {
          setActiveModule("logistics");
          setSection("pedidos-ha");
        }
      }
    } catch {
      // Ignora falhas de localStorage em SSR / sandbox restrito
    }
  }, []);

  function handleSaveCompanyConfig(name: string, logo: string, modules?: { finance: boolean; logistics: boolean }) {
    setCompanyName(name);
    setCompanyLogoUrl(logo);
    if (modules) {
      setEnabledModules(modules);
      try {
        localStorage.setItem("rsbuild_workspace_modules", JSON.stringify(modules));
      } catch {
        // noop
      }
      if (!modules.finance && modules.logistics && activeModule === "finance") {
        setActiveModule("logistics");
        setSection("pedidos-ha");
      } else if (modules.finance && !modules.logistics && activeModule === "logistics") {
        setActiveModule("finance");
        setSection("visao-geral");
      }
    }
    try {
      localStorage.setItem("rsbuild_workspace_company", name);
      if (logo) {
        localStorage.setItem("rsbuild_workspace_logo", logo);
      } else {
        localStorage.removeItem("rsbuild_workspace_logo");
      }
    } catch {
      // noop
    }
    setNotice("Configuração do Workspace atualizada com sucesso!");
    setIsConfigOpen(false);
  }

  function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const res = event.target?.result as string;
      if (res) {
        handleSaveCompanyConfig(companyName, res);
      }
    };
    reader.readAsDataURL(file);
  }

  // Estado para Contas a Receber e Baixas em Lote (ENG-MS-02)
  const [titles, setTitles] = useState<ReceivableTitle[]>(INITIAL_SAMPLE_TITLES);
  const titlesInputRef = useRef<HTMLInputElement>(null);

  // Estado para Canhotos de Entrega e Blindagem de Cobrança (ENG-MS-03)
  const [proofs, setProofs] = useState<DeliveryProof[]>(INITIAL_SAMPLE_PROOFS);
  const proofsInputRef = useRef<HTMLInputElement>(null);

  const deliveryMetrics = useMemo(() => computeDeliveryMetrics(proofs), [proofs]);

  const evaluations = useMemo(() => {
    return proofs.map((p) => {
      const relatedTitle = titles.find((t) => t.documentNumber.includes(p.nfeNumber));
      const isOverdue = relatedTitle ? new Date(relatedTitle.dueDate) < new Date() : false;
      return evaluateProtestoRisk(p, { dueDate: relatedTitle?.dueDate, isOverdue });
    });
  }, [proofs, titles]);

  // Estado para Pedidos WhatsApp do Hub Açaí (ENG-HA-01)
  const [orders, setOrders] = useState<ParsedWhatsAppOrder[]>(INITIAL_SAMPLE_HA_ORDERS);
  const [whatsAppText, setWhatsAppText] = useState("");
  const [parsedPreview, setParsedPreview] = useState<ParsedWhatsAppOrder | null>(null);

  const hubAcaiMetrics = useMemo(() => {
    const totalOrders = orders.length;
    const totalBoxes = orders.reduce((sum, o) => sum + o.totalBoxes, 0);
    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const hrOccupancy = Math.min(100, Math.round((totalBoxes / 350) * 100));
    return { totalOrders, totalBoxes, totalRevenue, hrOccupancy };
  }, [orders]);

  const totals = useMemo(() => {
    const incoming = records.filter((item) => item.direction === "entrada").reduce((sum, item) => sum + item.amount, 0);
    const outgoing = records.filter((item) => item.direction === "saída").reduce((sum, item) => sum + item.amount, 0);
    return { incoming, outgoing, balance: incoming - outgoing };
  }, [records]);

  const filteredRecords = useMemo(() => records.filter((item) =>
    `${item.description} ${item.category} ${item.source} ${item.bankName || ""}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))
  ), [records, query]);

  // Casamento algorítmico entre títulos a receber e extratos importados
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
    setFileName(file.name);
    setNotice("");
    const text = await file.text();
    const result = file.name.toLowerCase().endsWith(".ofx") ? parseOfx(text) : parseCsv(text);
    setPendingImport(result.records);
    setImportErrors(result.errors);
    setPendingMetadata(result.metadata || null);
    setSection("importacoes");
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

  function resetSession() {
    setRecords([]);
    setPendingImport([]);
    setPendingMetadata(null);
    setImportErrors([]);
    setNotice("A sessão foi limpa.");
  }

  function handleExportOmie(targetRecords?: FinancialRecord[]) {
    const list = targetRecords && targetRecords.length ? targetRecords : (records.length ? records : pendingImport);
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

  // Ações de Baixa em Lote (ENG-MS-02)
  async function handleImportTitlesFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = parseReceivablesCsv(text);
    if (result.errors.length > 0) {
      setNotice(`Aviso: ${result.errors[0]}`);
    } else {
      setTitles((curr) => [...result.titles, ...curr]);
      setNotice(`${result.titles.length} título(s) a receber carregado(s) do Omie com sucesso.`);
    }
    event.target.value = "";
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

  // Ações de Canhotos e Blindagem de Protesto (ENG-MS-03)
  async function handleImportProofsFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = parseDeliveryCsv(text);
    if (result.errors.length > 0) {
      setNotice(`Aviso na importação de canhotos: ${result.errors[0]}`);
    }
    if (result.proofs.length > 0) {
      setProofs((curr) => [...result.proofs, ...curr]);
      setNotice(`${result.proofs.length} comprovante(s) de entrega importado(s) com sucesso.`);
    }
    event.target.value = "";
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

  // Ações do Padronizador WhatsApp Hub Açaí (ENG-HA-01)
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
            <span title={companyName}>{companyName.length > 18 ? companyName.slice(0, 18) + "…" : companyName.toUpperCase()}</span>
            <b>v0.1</b>
          </div>
        </div>
        {/* Seletor de Módulos (Visível se ambos os módulos estiverem contratados/ativos) */}
        {enabledModules.finance && enabledModules.logistics ? (
          <div className="module-switcher-container">
            <button
              type="button"
              className={activeModule === "finance" ? "module-tab active" : "module-tab"}
              onClick={() => {
                setActiveModule("finance");
                setSection("visao-geral");
              }}
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
              onClick={() => {
                setActiveModule("logistics");
                setSection("pedidos-ha");
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" />
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
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
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
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
          {allNavItems
            .filter((item) => {
              if (item.module === "all") return true;
              return item.module === activeModule;
            })
            .map((item) => (
              <button
                key={item.id}
                className={section === item.id ? "nav-item active" : "nav-item"}
                onClick={() => setSection(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>{item.label}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-user-row" style={{ cursor: "pointer" }} onClick={() => setIsConfigOpen(true)} title="Clique para personalizar empresa e logotipo">
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
            onClick={() => { window.location.href = "/login"; }}
            title="Sair da sessão"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sair
          </button>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <strong>{companyName}</strong> <span>/</span> {allNavItems.find((item) => item.id === section)?.label}
          </div>
          <div className="topbar-right">
            <span className="period-label">PERÍODO</span>
            <select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Período">
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="365">Últimos 12 meses</option>
            </select>
            <button
              className="avatar"
              onClick={() => setIsConfigOpen(true)}
              title={`Personalizar Workspace (${companyName})`}
              style={{ border: "none", cursor: "pointer" }}
            >
              {companyName ? companyName.trim().charAt(0).toUpperCase() : "R"}
            </button>
          </div>
        </header>

        <div className="content">
          {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Fechar aviso">×</button></div>}

          {section === "visao-geral" && <>
            <div className="page-heading">
              <div><div className="eyebrow">PAINEL FINANCEIRO</div><h1>Visão geral</h1><p>Acompanhe a movimentação e a posição financeira da empresa.</p></div>
              <button className="primary-button" onClick={() => inputRef.current?.click()}><span>＋</span> Importar movimentações</button>
            </div>
            <div className="metric-grid">
              <Metric label="Entradas no período" value={formatCurrency(totals.incoming)} tone="positive" detail={records.length ? "Registros importados nesta sessão" : "Aguardando dados"} icon="↙" />
              <Metric label="Saídas no período" value={formatCurrency(totals.outgoing)} tone="negative" detail={records.length ? "Registros importados nesta sessão" : "Aguardando dados"} icon="↗" />
              <Metric label="Resultado do período" value={formatCurrency(totals.balance)} tone="neutral" detail="Entradas menos saídas" icon="＝" />
              <Metric label="Movimentações" value={String(records.length)} tone="neutral" detail={records.filter((item) => item.status === "pendente").length + " pendentes de revisão"} icon="▤" />
            </div>
            <div className="dashboard-grid">
              <section className="panel chart-panel">
                <div className="panel-heading"><div><h2>Movimentação financeira</h2><p>Consolidação dos registros importados</p></div><span className="subtle-tag">BRL</span></div>
                {records.length ? <div className="activity-summary"><div><span>Entradas</span><strong className="positive">{formatCurrency(totals.incoming)}</strong></div><div><span>Saídas</span><strong className="negative">{formatCurrency(totals.outgoing)}</strong></div><div><span>Saldo líquido</span><strong>{formatCurrency(totals.balance)}</strong></div></div> : <EmptyState icon="⌁" title="Ainda não há movimentações" text="Importe um extrato bancário para começar a visualizar a posição financeira." action="Importar extrato" onAction={() => inputRef.current?.click()} />}
              </section>
              <section className="panel">
                <div className="panel-heading"><div><h2>Qualidade dos dados</h2><p>Situação dos registros carregados</p></div></div>
                <div className="quality-row"><span>Movimentações importadas</span><strong>{records.length}</strong></div>
                <div className="quality-row"><span>Pendentes de revisão</span><strong>{records.filter((item) => item.status === "pendente").length}</strong></div>
                <div className="quality-row"><span>Fontes identificadas</span><strong>{new Set(records.map((item) => item.source)).size}</strong></div>
                <div className="quality-footnote">A classificação e a conciliação serão habilitadas conforme a configuração das fontes.</div>
              </section>
            </div>
            <section className="panel recent-panel">
              <div className="panel-heading"><div><h2>Movimentações recentes</h2><p>Últimos registros adicionados</p></div><button className="text-button" onClick={() => setSection("movimentacoes")}>Ver todas <span>→</span></button></div>
              {records.length ? <RecordTable records={[...records].sort((a,b) => b.date.localeCompare(a.date)).slice(0,5)} /> : <div className="table-empty">Os registros aparecerão aqui após a primeira importação.</div>}
            </section>
          </>}

          {section === "movimentacoes" && <>
            <div className="page-heading">
              <div>
                <div className="eyebrow">LANÇAMENTOS</div>
                <h1>Movimentações</h1>
                <p>Consulte os registros financeiros carregados.</p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                {records.length > 0 && (
                  <button className="secondary-button" onClick={() => handleExportOmie()} title="Exportar lote padronizado para conciliação no Omie">
                    📥 Exportar OFX (Omie)
                  </button>
                )}
                <button className="primary-button" onClick={() => inputRef.current?.click()}>＋ Importar arquivo</button>
              </div>
            </div>
            <section className="panel"><div className="table-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por descrição, categoria ou origem..." aria-label="Buscar movimentações" /><span>{filteredRecords.length} registro(s)</span></div>{filteredRecords.length ? <RecordTable records={[...filteredRecords].sort((a,b) => b.date.localeCompare(a.date))} /> : <EmptyState icon="⇄" title="Nenhuma movimentação encontrada" text="Carregue um extrato CSV ou OFX para consultar os lançamentos." action="Importar arquivo" onAction={() => inputRef.current?.click()} />}</section>
          </>}

          {section === "importacoes" && <>
            <div className="page-heading"><div><div className="eyebrow">ENTRADA DE DADOS</div><h1>Importações</h1><p>Carregue extratos e revise os registros antes de adicioná-los.</p></div></div>
            <section className="panel import-panel">
              <div className="upload-zone"><div className="upload-icon">⇧</div><h2>Importar extrato financeiro</h2><p>Selecione um arquivo CSV ou OFX para visualizar os registros.</p><button className="secondary-button" onClick={() => inputRef.current?.click()}>Selecionar arquivo</button><span className="file-hint">CSV ou OFX · Até 10 MB</span></div>
              {fileName && (
                <div className="import-file">
                  <span className="file-badge">ARQ</span>
                  <div>
                    <strong>{fileName}</strong>
                    <span>{pendingImport.length} registro(s) reconhecido(s)</span>
                    {pendingMetadata?.bankName && (
                      <span style={{ display: "block", fontSize: "12px", color: "#0284c7", marginTop: "3px" }}>
                        🏦 {pendingMetadata.bankName}
                        {pendingMetadata.accountId ? ` · Conta: ${pendingMetadata.accountId}` : ""}
                        {pendingMetadata.balance !== undefined ? ` · Saldo: ${formatCurrency(pendingMetadata.balance)}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {importErrors.length > 0 && <div className="error-list"><strong>Revisar importação</strong>{importErrors.map((error, index) => <p key={index}>{error}</p>)}</div>}
              {pendingImport.length > 0 && <>
                <div className="preview-heading"><div><h2>Prévia dos registros</h2><p>Confira os dados antes de confirmar a importação.</p></div><span>{pendingImport.length} registros</span></div>
                <RecordTable records={pendingImport.slice(0,8)} />
                <div className="import-actions">
                  <button className="secondary-button" onClick={() => {setPendingImport([]);setFileName("");setImportErrors([]);setPendingMetadata(null);}}>Cancelar</button>
                  <button className="secondary-button" onClick={() => handleExportOmie(pendingImport)} title="Exportar lote normalizado pronto para Omie">
                    ⚡ Exportar OFX (Omie)
                  </button>
                  <button className="primary-button" onClick={confirmImport}>Confirmar importação</button>
                </div>
              </>}
            </section>
            <div className="inline-note">Os registros desta versão permanecem disponíveis durante a sessão atual. A persistência segura e a conexão com as fontes serão configuradas na etapa de integração.</div>
          </>}

          {section === "baixas" && <>
            <div className="page-heading">
              <div>
                <div className="eyebrow">INTEGRAÇÃO ERP · LIQUIDAÇÃO</div>
                <h1>Baixas & Conciliação de Títulos</h1>
                <p>Conciliação inteligente e liquidação de contas a receber sem arrastar cards manuais no ERP.</p>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button className="secondary-button" onClick={() => setTitles(INITIAL_SAMPLE_TITLES)} title="Recarregar títulos exemplo para teste">
                  ⚡ Carregar Exemplo
                </button>
                <button className="secondary-button" onClick={() => titlesInputRef.current?.click()}>
                  ＋ Importar Títulos (CSV)
                </button>
                {matchStats.ready.length > 0 && (
                  <button className="primary-button" onClick={() => handleExportBatchSettlement()}>
                    📥 Gerar Lote de Baixas (.CSV)
                  </button>
                )}
              </div>
            </div>

            <section className="dashboard-grid">
              <Metric
                label="Prontos para Baixa (Casados)"
                value={`${matchStats.ready.length} títulos`}
                tone="positive"
                detail={`Total liquidável: ${formatCurrency(matchStats.totalReadyAmount)}`}
                icon="✓"
              />
              <Metric
                label="Divergentes / Juros / Desconto"
                value={`${matchStats.divergent.length} títulos`}
                tone={matchStats.divergent.length > 0 ? "warning" : "neutral"}
                detail="Requer validação expressa do operador"
                icon="!"
              />
              <Metric
                label="Aguardando Extrato Bancário"
                value={`${matchStats.pending.length} títulos`}
                tone="neutral"
                detail="Ainda não localizados nas entradas bancárias"
                icon="◫"
              />
            </section>

            <section className="panel" style={{ marginTop: "24px" }}>
              <div className="panel-heading">
                <div>
                  <h2>Painel de Conciliação e Baixa em Lote</h2>
                  <p>Cruzamento entre contas a receber do Omie e lançamentos bancários conciliados</p>
                </div>
                {matchStats.ready.length > 0 && (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button className="secondary-button" onClick={handleConfirmSettlementInSession}>
                      Marcar Baixados na Sessão
                    </button>
                    <button className="primary-button" onClick={() => handleExportBatchSettlement()}>
                      ⚡ Baixar Lote Oficial Omie (.CSV)
                    </button>
                  </div>
                )}
              </div>

              {titles.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nº Documento</th>
                        <th>Cliente / Sacado</th>
                        <th>Vencimento</th>
                        <th className="align-right">Valor Título</th>
                        <th>Entrada Extrato Bancário</th>
                        <th>Confiança</th>
                        <th>Diferença</th>
                        <th>Status Sugerido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches.map((m) => {
                        const isReady = m.suggestedStatus === "pronto_para_baixa";
                        const isDivergent = m.suggestedStatus === "divergente";
                        return (
                          <tr key={m.title.id} style={{ opacity: m.title.status === "baixado" ? 0.6 : 1 }}>
                            <td>
                              <strong>{m.title.documentNumber}</strong>
                              {m.title.ourNumber && (
                                <span style={{ display: "block", fontSize: "11px", color: "#64748B" }}>
                                  Nosso Nº: {m.title.ourNumber}
                                </span>
                              )}
                            </td>
                            <td>
                              <div className="description-cell">{m.title.customerName}</div>
                              <span style={{ fontSize: "11px", color: "#64748B" }}>{m.title.bankAccount || "Conta Geral"}</span>
                            </td>
                            <td>{formatDate(m.title.dueDate)}</td>
                            <td className="align-right">{formatCurrency(m.title.amount)}</td>
                            <td>
                              {m.statementRecord ? (
                                <div>
                                  <strong style={{ fontSize: "12px", color: "#0F172A" }}>
                                    {formatCurrency(m.statementRecord.amount)} em {formatDate(m.statementRecord.date)}
                                  </strong>
                                  <span style={{ display: "block", fontSize: "11px", color: "#64748B" }}>
                                    {m.statementRecord.source} · {m.statementRecord.sourceRecordId ? `FITID: ${m.statementRecord.sourceRecordId}` : ""}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ color: "#94A3B8", fontStyle: "italic", fontSize: "12px" }}>Nenhuma entrada compatível</span>
                              )}
                            </td>
                            <td>
                              <span
                                className="status-pill"
                                style={{
                                  background: m.confidence === "exato" || m.confidence === "documental" ? "#DCFCE7" : m.confidence === "aproximado" ? "#FEF3C7" : "#F1F5F9",
                                  color: m.confidence === "exato" || m.confidence === "documental" ? "#15803D" : m.confidence === "aproximado" ? "#92400E" : "#64748B",
                                  borderColor: m.confidence === "exato" || m.confidence === "documental" ? "#86EFAC" : m.confidence === "aproximado" ? "#FCD34D" : "#CBD5E1"
                                }}
                              >
                                {m.confidence === "exato" ? "Exato (100%)" : m.confidence === "documental" ? "Documental" : m.confidence === "aproximado" ? "Aproximado" : "Pendente"}
                              </span>
                            </td>
                            <td>
                              {m.amountDifference !== 0 ? (
                                <span style={{ color: m.amountDifference > 0 ? "#DC2626" : "#2563EB", fontWeight: 600, fontSize: "12px" }}>
                                  {m.amountDifference > 0 ? `+ ${formatCurrency(m.amountDifference)} (Juros)` : `- ${formatCurrency(Math.abs(m.amountDifference))} (Desc.)`}
                                </span>
                              ) : (
                                <span style={{ color: "#64748B", fontSize: "12px" }}>—</span>
                              )}
                            </td>
                            <td>
                              {m.title.status === "baixado" ? (
                                <span className="status-pill" style={{ background: "#E2E8F0", color: "#334155" }}>Baixado</span>
                              ) : isReady ? (
                                <span className="status-pill" style={{ background: "#DCFCE7", color: "#15803D", borderColor: "#86EFAC" }}>Pronto p/ Baixa</span>
                              ) : isDivergent ? (
                                <span className="status-pill" style={{ background: "#FEF3C7", color: "#92400E", borderColor: "#FCD34D" }}>Revisar Diferença</span>
                              ) : (
                                <span className="status-pill" style={{ background: "#F1F5F9", color: "#64748B" }}>Aguardando</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon="✓"
                  title="Nenhum título a receber carregado"
                  text="Carregue os títulos pendentes do Omie ou utilize a amostra da Mundo do Sabor."
                  action="Carregar Amostra Mundo do Sabor"
                  onAction={() => setTitles(INITIAL_SAMPLE_TITLES)}
                />
              )}
            </section>
            <div className="inline-note" style={{ marginTop: "16px" }}>
              <strong>Diretriz de Liquidação Assistida:</strong> O motor de conciliação assistida gera o lote de liquidação e o arquivo de importação oficial para o ERP sem intervenção manual de arraste de cards, preservando a alçada de aprovação do operador financeiro antes da efetivação bancária.
            </div>
          </>}

          {section === "canhotos" && <>
            <div className="page-heading">
              <div>
                <div className="eyebrow">RASTREABILIDADE DE ENTREGA & CONFORMIDADE</div>
                <h1>Protocolo Digital de Comprovantes & Canhotos</h1>
                <p>Indexação de comprovantes de entrega da expedição e blindagem jurídica preventiva contra protestos indevidos (Lei nº 5.474/1968).</p>
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button className="secondary-button" onClick={() => proofsInputRef.current?.click()}>
                  <span>⇧</span> Importar Canhotos (CSV)
                </button>
                <button className="primary-button" onClick={handleExportBlindageReport}>
                  <span>⤓</span> Exportar Protocolo de Blindagem
                </button>
              </div>
            </div>

            <div className="metric-grid">
              <Metric
                label="Taxa de Comprovação"
                value={`${deliveryMetrics.coverageRate}%`}
                tone="positive"
                detail={`${deliveryMetrics.provenCount} de ${deliveryMetrics.totalInvoices} entregas comprovadas`}
                icon="✓"
              />
              <Metric
                label="Faturamento Blindado"
                value={formatCurrency(deliveryMetrics.provenAmount)}
                tone="positive"
                detail="Canhoto assinado / Apto a protesto"
                icon="🛡"
              />
              <Metric
                label="Risco de Protesto / Sem Canhoto"
                value={formatCurrency(deliveryMetrics.atRiskProtestAmount)}
                tone="negative"
                detail="Bloqueio preventivo ativo"
                icon="⚠"
              />
              <Metric
                label="Em Trânsito / Expedição"
                value={`${deliveryMetrics.pendingDeliveryCount} faturas`}
                tone="neutral"
                detail={formatCurrency(deliveryMetrics.pendingDeliveryAmount)}
                icon="🚚"
              />
            </div>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Painel de Gestão e Rastreabilidade de Canhotos</h2>
                  <p>Acompanhamento individual de NF-e, recebedores na doca e veredito de proteção judicial.</p>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="secondary-button" onClick={() => setProofs(INITIAL_SAMPLE_PROOFS)}>
                    Restaurar Amostra Mundo do Sabor
                  </button>
                </div>
              </div>

              {proofs.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>NF-e / Chave</th>
                        <th>Cliente / Destinatário</th>
                        <th className="align-right">Valor NF</th>
                        <th>Motorista / Rota</th>
                        <th>Status Entrega</th>
                        <th>Blindagem de Protesto</th>
                        <th>Recebedor / Data</th>
                        <th>Ação Operacional</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proofs.map((p) => {
                        const evaluation = evaluations.find((ev) => ev.proofId === p.id || ev.nfeNumber === p.nfeNumber);
                        const isProven = p.status === "comprovado";
                        const isRejected = p.status === "recusa_devolucao";
                        const isLost = p.status === "extraviado";

                        return (
                          <tr key={p.id}>
                            <td>
                              <strong>NF-{p.nfeNumber}</strong>
                              {p.nfeKey && (
                                <span style={{ display: "block", fontSize: "10px", color: "#64748B", fontFamily: "var(--font-mono, monospace)" }}>
                                  SEFAZ: {p.nfeKey.slice(0, 10)}...{p.nfeKey.slice(-6)}
                                </span>
                              )}
                            </td>
                            <td>
                              <div className="description-cell">{p.customerName}</div>
                              {p.notes && (
                                <span style={{ fontSize: "10px", color: "#94A3B8", fontStyle: "italic" }}>
                                  Obs: {p.notes}
                                </span>
                              )}
                            </td>
                            <td className="align-right font-semibold">{formatCurrency(p.nfeAmount)}</td>
                            <td>
                              <span style={{ fontSize: "11px", color: "#475569" }}>
                                {p.driverName || "Expedição Interna"}
                              </span>
                            </td>
                            <td>
                              <span
                                className="status-pill"
                                style={{
                                  background: isProven ? "#DCFCE7" : isRejected ? "#FEE2E2" : isLost ? "#F3E8FF" : "#FEF3C7",
                                  color: isProven ? "#15803D" : isRejected ? "#991B1B" : isLost ? "#6B21A8" : "#92400E",
                                  borderColor: isProven ? "#86EFAC" : isRejected ? "#FCA5A5" : isLost ? "#D8B4FE" : "#FCD34D"
                                }}
                              >
                                {isProven ? "Comprovado" : isRejected ? "Recusa / Avaria" : isLost ? "Extraviado" : "Em Trânsito"}
                              </span>
                            </td>
                            <td>
                              <div>
                                <span
                                  className="status-pill"
                                  style={{
                                    background: evaluation?.risk === "liberado" ? "#DCFCE7" : evaluation?.risk === "bloqueio_preventivo" ? "#FEE2E2" : "#FEF3C7",
                                    color: evaluation?.risk === "liberado" ? "#166534" : evaluation?.risk === "bloqueio_preventivo" ? "#991B1B" : "#854D0E",
                                    fontWeight: 700
                                  }}
                                >
                                  {evaluation?.risk === "liberado"
                                    ? "✓ APTO A PROTESTO"
                                    : evaluation?.risk === "bloqueio_preventivo"
                                    ? "⛔ BLOQUEIO PREVENTIVO"
                                    : "⚠ ATENÇÃO PRAZO"}
                                </span>
                                <span style={{ display: "block", fontSize: "10px", color: "#64748B", marginTop: "4px", maxWidth: "260px", whiteSpace: "normal" }}>
                                  {evaluation?.reason}
                                </span>
                              </div>
                            </td>
                            <td>
                              {p.receiverName ? (
                                <div>
                                  <strong style={{ fontSize: "11px", color: "#1E293B" }}>{p.receiverName}</strong>
                                  <span style={{ display: "block", fontSize: "10px", color: "#64748B" }}>
                                    {p.deliveryDate ? formatDate(p.deliveryDate) : "Data não informada"} {p.receiverDocument ? `· ${p.receiverDocument}` : ""}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ color: "#94A3B8", fontStyle: "italic", fontSize: "11px" }}>Aguardando assinatura</span>
                              )}
                            </td>
                            <td>
                              {!isProven ? (
                                <button
                                  className="secondary-button"
                                  style={{ fontSize: "10px", padding: "6px 10px" }}
                                  onClick={() => handleConfirmReceipt(p.id)}
                                  title="Validar recebimento e liberar título para cobrança/protesto"
                                >
                                  Validar Canhoto
                                </button>
                              ) : (
                                <span style={{ fontSize: "11px", color: "#15803D", fontWeight: 600 }}>Arquivado</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon="📦"
                  title="Nenhum canhoto carregado"
                  text="Importe a planilha de expedição ou utilize os dados de amostra da Mundo do Sabor."
                  action="Carregar Amostra Mundo do Sabor"
                  onAction={() => setProofs(INITIAL_SAMPLE_PROOFS)}
                />
              )}
            </section>

            <div className="inline-note" style={{ marginTop: "16px" }}>
              <strong>Fundamentação Jurídica (Lei nº 5.474/1968, Art. 15):</strong> A duplicata mercantil não aceita só é legalmente passível de protesto e execução judicial mediante comprovação da entrega e recebimento efetivo das mercadorias (canhoto assinado pelo sacado). O protocolo digital impede que títulos com canhotos pendentes, extraviados ou em devolução sigam para cobrança coercitiva, eliminando riscos de litígios e processos por protesto indevido.
            </div>
          </>}

          {section === "pedidos-ha" && <>
            <div className="page-heading">
              <div>
                <div className="eyebrow">OPERAÇÃO DE VENDAS & EXPEDIÇÃO</div>
                <h1>Padronizador Inteligente de Pedidos WhatsApp</h1>
                <p>Conversão automática de texto livre em pedidos estruturados com grade de produtos, quantidades e contagem de volumes para expedição.</p>
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button className="primary-button" onClick={handleExportOmieSalesOrders}>
                  <span>⤓</span> Exportar Pedidos para ERP (CSV)
                </button>
              </div>
            </div>

            <div className="metric-grid">
              <Metric
                label="Carga do Dia"
                value={`${hubAcaiMetrics.totalBoxes} caixas`}
                tone="neutral"
                detail={`${hubAcaiMetrics.totalOrders} pedidos na esteira`}
                icon="📦"
              />
              <Metric
                label="Faturamento do Dia"
                value={formatCurrency(hubAcaiMetrics.totalRevenue)}
                tone="positive"
                detail="Receita bruta dos pedidos decifrados"
                icon="💰"
              />
              <Metric
                label="Ocupação Caminhão HR"
                value={`${hubAcaiMetrics.hrOccupancy}%`}
                tone={hubAcaiMetrics.hrOccupancy > 90 ? "negative" : "positive"}
                detail={`${hubAcaiMetrics.totalBoxes} / 350 caixas de capacidade`}
                icon="🚚"
              />
              <Metric
                label="Produtividade Atendimento"
                value="Zero Digitação"
                tone="positive"
                detail="Elimina contagem manual no dedo (C1)"
                icon="⚡"
              />
            </div>

            <div className="dashboard-grid" style={{ marginBottom: "20px" }}>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Ingestão de Mensagem do WhatsApp</h2>
                    <p>Cole o texto da conversa ou áudio transcrito do cliente.</p>
                  </div>
                  <button
                    className="secondary-button"
                    style={{ fontSize: "10px", padding: "6px 10px" }}
                    onClick={() =>
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
                  >
                    Carregar Exemplo Real
                  </button>
                </div>
                <textarea
                  style={{
                    width: "100%",
                    minHeight: "140px",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    fontSize: "12px",
                    fontFamily: "inherit",
                    resize: "vertical",
                    outline: "none"
                  }}
                  placeholder="Ex: Bom dia! Aqui é o Marcos do Açaí do Parque. Manda 10 caixas do tradicional 10L e 5 de banana pra amanhã cedo..."
                  value={whatsAppText}
                  onChange={(e) => setWhatsAppText(e.target.value)}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                  <button className="secondary-button" onClick={() => setWhatsAppText("")}>Limpar</button>
                  <button className="primary-button" onClick={handleParseWhatsApp}>
                    <span>⚡</span> Decifrar Mensagem de Pedido
                  </button>
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Pré-visualização Estruturada</h2>
                    <p>Validação da interpretação semântica antes de confirmar.</p>
                  </div>
                  {parsedPreview && (
                    <span
                      className="status-pill"
                      style={{
                        background: parsedPreview.confidence === "alta" ? "#DCFCE7" : "#FEF3C7",
                        color: parsedPreview.confidence === "alta" ? "#15803D" : "#92400E",
                        fontWeight: 700
                      }}
                    >
                      Confiança: {parsedPreview.confidence.toUpperCase()}
                    </span>
                  )}
                </div>

                {parsedPreview ? (
                  <div>
                    <div style={{ marginBottom: "12px", fontSize: "12px" }}>
                      <strong>Cliente:</strong> {parsedPreview.customerName}
                      <span style={{ display: "block", color: "#64748B", fontSize: "11px", marginTop: "2px" }}>
                        Condição: {parsedPreview.paymentMethod.replace("_", " ").toUpperCase()} · Total: {parsedPreview.totalBoxes} caixas · {formatCurrency(parsedPreview.totalAmount)}
                      </span>
                    </div>

                    <div className="table-wrap" style={{ maxHeight: "150px" }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Sabor / Produto</th>
                            <th className="align-right">Qtd</th>
                            <th className="align-right">Caixas</th>
                            <th className="align-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedPreview.items.map((it, idx) => (
                            <tr key={idx}>
                              <td><strong>{it.flavor}</strong> <span style={{ fontSize: "10px", color: "#64748B" }}>({it.productName})</span></td>
                              <td className="align-right">{it.quantity}</td>
                              <td className="align-right font-semibold">{it.boxesTotal} cx</td>
                              <td className="align-right font-semibold">{formatCurrency(it.totalAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ marginTop: "14px", display: "flex", justifyContent: "flex-end" }}>
                      <button className="primary-button" onClick={handleConfirmParsedOrder}>
                        <span>✓</span> Confirmar e Adicionar à Carga do Dia
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state" style={{ minHeight: "150px" }}>
                    <div className="empty-icon">📱</div>
                    <strong>Nenhuma mensagem processada</strong>
                    <p>Cole o texto do WhatsApp ao lado e clique em decifrar para visualizar a decomposição dos itens.</p>
                  </div>
                )}
              </section>
            </div>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Fila de Pedidos do Dia (Expedição & Carregamento)</h2>
                  <p>Consolidação da carga para os veículos de entrega e expedição logística.</p>
                </div>
                <button className="secondary-button" onClick={() => setOrders(INITIAL_SAMPLE_HA_ORDERS)}>
                  Restaurar Amostra de Demonstração
                </button>
              </div>

              {orders.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Cód. Pedido</th>
                        <th>Cliente / Sacado</th>
                        <th>Sabores e Quantidades</th>
                        <th className="align-right">Caixas Físicas</th>
                        <th>Pagamento</th>
                        <th className="align-right">Valor Total</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((ord) => (
                        <tr key={ord.id}>
                          <td><strong>{ord.id.slice(0, 12)}</strong></td>
                          <td>
                            <div className="description-cell">{ord.customerName}</div>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", maxWidth: "340px" }}>
                              {ord.items.map((it, i) => (
                                <span
                                  key={i}
                                  style={{
                                    fontSize: "10px",
                                    background: "#F1F5F9",
                                    color: "#334155",
                                    padding: "3px 7px",
                                    borderRadius: "4px",
                                    border: "1px solid #E2E8F0"
                                  }}
                                >
                                  {it.quantity}x {it.flavor}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="align-right font-semibold" style={{ color: "#4338CA" }}>
                            {ord.totalBoxes} cx
                          </td>
                          <td>
                            <span className="status-pill" style={{ background: "#F1F5F9", color: "#334155" }}>
                              {ord.paymentMethod.replace("_", " ").toUpperCase()}
                            </span>
                          </td>
                          <td className="align-right font-semibold">{formatCurrency(ord.totalAmount)}</td>
                          <td>
                            <span className="status-pill" style={{ background: "#DCFCE7", color: "#15803D" }}>
                              {ord.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon="📱"
                  title="Nenhum pedido na esteira"
                  text="Decifre novas mensagens do WhatsApp para montar a carga de expedição."
                  action="Carregar Pedidos de Exemplo"
                  onAction={() => setOrders(INITIAL_SAMPLE_HA_ORDERS)}
                />
              )}
            </section>

            <div className="inline-note" style={{ marginTop: "16px" }}>
              <strong>Automação de Entrada de Pedidos:</strong> Pedidos recebidos via mensagem de WhatsApp de clientes são interpretados em lote, decodificando produtos, quantidades e totalizando volumes físicos automaticamente para capacidade dos veículos de entrega e geração dos pedidos de venda integrados ao ERP.
            </div>
          </>}

          {section === "relatorios" && <Placeholder title="Relatórios" eyebrow="ANÁLISE FINANCEIRA" text="Os relatórios serão habilitados após a validação das fontes e dos dados financeiros importados." />}
        </div>
      </section>
      <input ref={inputRef} className="hidden-input" type="file" accept=".csv,.ofx,text/csv,application/x-ofx" onChange={handleFile} />
      <input ref={titlesInputRef} className="hidden-input" type="file" accept=".csv,text/csv" onChange={handleImportTitlesFile} />
      <input ref={proofsInputRef} className="hidden-input" type="file" accept=".csv,text/csv" onChange={handleImportProofsFile} />
      <input ref={logoInputRef} className="hidden-input" type="file" accept="image/*" onChange={handleLogoUpload} />
      <button className="session-reset" onClick={resetSession} title="Limpar os registros da sessão">Limpar sessão</button>

      {/* Modal de Personalização do Workspace */}
      {isConfigOpen && (
        <div className="workspace-modal-backdrop" onClick={() => setIsConfigOpen(false)}>
          <div className="workspace-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="workspace-modal-header">
              <div>
                <span className="eyebrow">CUSTOMIZAÇÃO DA EMPRESA</span>
                <h3>Identidade do Workspace</h3>
              </div>
              <button
                type="button"
                className="workspace-modal-close"
                onClick={() => setIsConfigOpen(false)}
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <p className="workspace-modal-desc">
              Personalize o nome corporativo e a marca exibidos no cabeçalho e na barra lateral do ambiente.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const nameInput = form.elements.namedItem("companyName") as HTMLInputElement;
                const urlInput = form.elements.namedItem("companyLogoUrl") as HTMLInputElement;
                const modFinanceInput = form.elements.namedItem("modFinance") as HTMLInputElement;
                const modLogisticsInput = form.elements.namedItem("modLogistics") as HTMLInputElement;
                handleSaveCompanyConfig(nameInput.value, urlInput.value || companyLogoUrl, {
                  finance: modFinanceInput ? modFinanceInput.checked : true,
                  logistics: modLogisticsInput ? modLogisticsInput.checked : true
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
                    background: "#fff"
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
                      onClick={() => handleSaveCompanyConfig(companyName, "", enabledModules)}
                      style={{ fontSize: "11px", color: "var(--red)" }}
                    >
                      Remover logo
                    </button>
                  )}
                </div>
                {companyLogoUrl && (
                  <div style={{ background: "#F5F1EB", padding: "10px", borderRadius: "6px", display: "inline-block", marginTop: "4px" }}>
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
                    background: "#fff"
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
                  <div style={{ display: "grid", gap: "10px", background: "#FAF8F5", padding: "12px", borderRadius: "8px", border: "1px solid var(--line)" }}>
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
                  onClick={() => setIsConfigOpen(false)}
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
      )}
    </main>
  );
}

function Metric({ label, value, tone, detail, icon }: { label: string; value: string; tone: string; detail: string; icon: string }) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}>{icon}</span></div><strong className="metric-value">{value}</strong><span className="metric-detail">{detail}</span></div>;
}

function EmptyState({ icon, title, text, action, onAction }: { icon: string; title: string; text: string; action: string; onAction: () => void }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><strong>{title}</strong><p>{text}</p><button className="text-button" onClick={onAction}>{action} →</button></div>;
}

function RecordTable({ records }: { records: FinancialRecord[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Descrição</th>
            <th>Categoria</th>
            <th>Origem / Instituição</th>
            <th>Status</th>
            <th className="align-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>{formatDate(record.date)}</td>
              <td className="description-cell">
                <div>{record.description}</div>
                {record.sourceRecordId && (
                  <span style={{ fontSize: "11px", color: "#64748B", fontFamily: "var(--font-mono, monospace)" }}>
                    FITID: {record.sourceRecordId}
                  </span>
                )}
              </td>
              <td>{record.category}</td>
              <td>
                <span className="status-pill" style={{ background: "#F1F5F9", color: "#334155", borderColor: "#CBD5E1" }}>
                  {record.bankName || record.source}
                </span>
              </td>
              <td><span className="status-pill">{record.status}</span></td>
              <td className={record.direction === "entrada" ? "align-right positive" : "align-right negative"}>
                {record.direction === "entrada" ? "+" : "−"} {formatCurrency(record.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Placeholder({ title, eyebrow, text }: { title: string; eyebrow: string; text: string }) {
  return <><div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{text}</p></div></div><section className="panel placeholder-panel"><div className="empty-icon">◌</div><strong>Configuração em preparação</strong><p>Esta área será disponibilizada após a definição dos dados e regras operacionais correspondentes.</p></section></>;
}
