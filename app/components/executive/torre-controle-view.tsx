"use client";

import { useEffect, useMemo, useState } from "react";
import { FinancialRecord, formatCurrency } from "@/lib/finance";
import { ReceivableTitle, ReconciliationMatch } from "@/lib/reconciliation";
import { DeliveryProof, DeliveryMetrics, ProtestoEvaluation } from "@/lib/delivery";
import { ParsedWhatsAppOrder } from "@/lib/orders";
import { Metric } from "@/app/components/finance/common";
import { OmieIntegrationCard, OmieIntegrationStatus } from "@/app/components/admin/omie-integration-card";
import { computeCashFlowProjection, PayableTitleInput } from "@/lib/cash-flow";
import { buildControllershipSummary, ControllershipAuditInput } from "@/lib/controllership";

interface TorreControleViewProps {
  organizationId?: string;
  companyName?: string;
  isDirector?: boolean;
  canManageIntegration?: boolean;
  currentUserEmail?: string;
  isPlatformAdministrator?: boolean;
  records: FinancialRecord[];
  totals: { incoming: number; outgoing: number; balance: number };
  titles: ReceivableTitle[];
  matches: ReconciliationMatch[];
  proofs: DeliveryProof[];
  deliveryMetrics: DeliveryMetrics;
  evaluations: ProtestoEvaluation[];
  orders: ParsedWhatsAppOrder[];
  hubAcaiMetrics: {
    totalOrders: number;
    totalBoxes: number;
    totalRevenue: number;
    hrOccupancy: number;
  };
  hasSprintZone?: boolean; // Zona das Sprints apenas para RSBUILD
  onNavigateToTab: (tab: any) => void;
}

type TorreSubTab = "estrategia" | "fluxo" | "controladoria" | "sincronizacao";
type SeverityFilter = "all" | "high" | "medium" | "info";

export function TorreControleView({
  organizationId = "",
  companyName = "RSBUILD Inovação",
  isDirector = false,
  canManageIntegration = false,
  currentUserEmail,
  isPlatformAdministrator = false,
  records,
  totals,
  titles,
  matches,
  proofs,
  deliveryMetrics,
  evaluations,
  orders,
  hubAcaiMetrics,
  hasSprintZone = false,
  onNavigateToTab
}: TorreControleViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<TorreSubTab>("estrategia");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [copiedMemo, setCopiedMemo] = useState(false);
  const [omieStatus, setOmieStatus] = useState<OmieIntegrationStatus | null>(null);
  const [auditEvents, setAuditEvents] = useState<ControllershipAuditInput[]>([]);

  const canAdminIntegration = canManageIntegration || isDirector;

  // Contexto operacional (Hub Açaí vs RSBUILD / Indústria)
  const isHubAcai = useMemo(
    () => companyName.toLowerCase().includes("açaí") || companyName.toLowerCase().includes("acai"),
    [companyName]
  );

  useEffect(() => {
    if (!canAdminIntegration || !organizationId) return;
    let active = true;
    fetch(`/api/organization-integrations?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data?.integrations) return;
        const omie = data.integrations.find((item: OmieIntegrationStatus) => item.provider === "omie");
        if (omie) setOmieStatus(omie);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [organizationId, canAdminIntegration]);

  // Busca eventos de auditoria para o Painel de Controladoria
  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    fetch(`/api/audit-events?organizationId=${encodeURIComponent(organizationId)}&limit=100`, { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return;
        const events: ControllershipAuditInput[] = Array.isArray(data?.events) ? data.events : [];
        setAuditEvents(events);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [organizationId]);

  // Todos os registros exigem revisão humana; metadados completos não autenticam a evidência.
  const documentaryReviewCount = evaluations.length;
  const incompleteEvidenceCount = evaluations.filter((e) => e.risk !== "metadata_complete").length;

  // Títulos prontos para baixa
  const readySettlements = useMemo(
    () => matches.filter((m) => m.suggestedStatus === "pronto_para_baixa").length,
    [matches]
  );

  // Separação entre recebíveis e contas a pagar em aberto
  const { receivableTitles, payableTitles } = useMemo(() => {
    const receivables: ReceivableTitle[] = [];
    const payables: PayableTitleInput[] = [];

    for (const t of titles) {
      if (t.status === "baixado") continue;
      if (t.category === "payable") {
        payables.push({
          id: t.id,
          amount: t.amount,
          dueDate: t.dueDate,
          status: t.status === "cancelado" ? "cancelado" : "pendente",
          supplierName: t.customerName
        });
      } else {
        receivables.push(t);
      }
    }

    return { receivableTitles: receivables, payableTitles: payables };
  }, [titles]);

  // Cálculo modular do healthScore ponderado pelas fontes disponíveis no tenant
  const { healthScore, scoreCompositionText } = useMemo(() => {
    const components: Array<{ label: string; score: number; weight: number }> = [];

    if (records.length > 0) {
      const liquidityScore =
        totals.balance >= 0
          ? Math.min(100, 75 + (totals.incoming > 0 ? Math.round((totals.balance / totals.incoming) * 25) : 0))
          : Math.max(10, 50 - Math.round((Math.abs(totals.balance) / Math.max(1, totals.incoming)) * 40));
      components.push({ label: "liquidez dos extratos", score: liquidityScore, weight: 0.25 });
    }

    if (titles.length > 0 && records.length > 0) {
      const reconcilRate = Math.round((readySettlements / titles.length) * 100);
      components.push({ label: "correspondência de títulos", score: reconcilRate, weight: 0.35 });
    }

    if (proofs.length > 0) {
      components.push({ label: "cobertura de comprovantes", score: deliveryMetrics.coverageRate, weight: 0.4 });
    }

    if (isHubAcai && orders.length > 0) {
      const logisticsEfficiency = Math.min(100, hubAcaiMetrics.hrOccupancy);
      components.push({ label: "ocupação estimada da frota", score: logisticsEfficiency, weight: 0.25 });
    }

    if (components.length === 0) {
      return {
        healthScore: null,
        scoreCompositionText:
          "Indicador experimental: importe extratos bancários ou títulos financeiros para calcular o índice modular."
      };
    }

    const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
    const weightedSum = components.reduce((sum, c) => sum + c.score * c.weight, 0);
    const score = Math.max(0, Math.min(100, Math.round(weightedSum / totalWeight)));

    const breakdown = components
      .map((c) => `${c.label} (${Math.round((c.weight / totalWeight) * 100)}%)`)
      .join(", ");

    return {
      healthScore: score,
      scoreCompositionText: `Indicador experimental: cálculo modular ponderado por ${breakdown}. Pesos e critérios provisórios; não utilizar como KPI oficial.`
    };
  }, [records.length, totals.balance, totals.incoming, titles.length, readySettlements, proofs.length, deliveryMetrics.coverageRate, isHubAcai, orders.length, hubAcaiMetrics.hrOccupancy]);

  // Curva de Sabores Vendidos no WhatsApp (Hub Açaí)
  const flavorsBreakdown = useMemo(() => {
    const counts: Record<string, { boxes: number; revenue: number }> = {};
    orders.forEach((ord) => {
      ord.items.forEach((item) => {
        if (!counts[item.flavor]) {
          counts[item.flavor] = { boxes: 0, revenue: 0 };
        }
        counts[item.flavor].boxes += item.boxesTotal || item.quantity;
        counts[item.flavor].revenue += item.totalAmount;
      });
    });
    return Object.entries(counts)
      .map(([flavor, data]) => ({ flavor, ...data }))
      .sort((a, b) => b.boxes - a.boxes);
  }, [orders]);

  // Distribuição de Títulos por Banco (para RSBUILD e Indústria)
  const bankDistribution = useMemo(() => {
    const counts: Record<string, { count: number; total: number }> = {};
    titles.forEach((t) => {
      const b = t.bankAccount || "Outros Bancos";
      if (!counts[b]) counts[b] = { count: 0, total: 0 };
      counts[b].count += 1;
      counts[b].total += t.amount;
    });
    return Object.entries(counts)
      .map(([bank, data]) => ({ bank, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [titles]);

  // Síntese calculada a partir dos dados disponíveis
  const rsGuardiaoDiagnosis = useMemo(() => {
    if (healthScore === null) {
      return {
        status: "Dados insuficientes",
        statusTone: "neutral",
        summary:
          "Ainda não há dados operacionais suficientes para calcular o índice de governança. Importe extratos bancários e títulos financeiros para habilitar a análise consolidada.",
        recommendations: [
          {
            priority: "Alta",
            action: "Completar fontes de dados",
            detail: isHubAcai
              ? "Disponibilize registros financeiros, títulos, comprovantes de entrega e pedidos para habilitar a análise consolidada."
              : "Disponibilize extratos bancários e títulos a receber/pagar para habilitar a análise consolidada."
          }
        ]
      };
    }

    let healthStatus = "Faixa experimental elevada";
    let statusTone = "positive";
    if (healthScore < 50) {
      healthStatus = "Faixa experimental baixa";
      statusTone = "negative";
    } else if (healthScore < 75) {
      healthStatus = "Faixa experimental intermediária";
      statusTone = "neutral";
    }

    if (isHubAcai) {
      const revenueFormatted = formatCurrency(hubAcaiMetrics.totalRevenue);
      const riskAmountFormatted = formatCurrency(deliveryMetrics.atRiskProtestAmount);
      const topFlavor = flavorsBreakdown[0]?.flavor || "Tradicional";
      const topFlavorShare =
        hubAcaiMetrics.totalBoxes > 0
          ? Math.round(((flavorsBreakdown[0]?.boxes || 0) / hubAcaiMetrics.totalBoxes) * 100)
          : 0;

      return {
        status: healthStatus,
        statusTone,
        summary: `Painel de governança Hub Açaí: índice calculado de ${healthScore}%. No comercial, foram consolidadas ${hubAcaiMetrics.totalBoxes} caixas (${revenueFormatted}), com o sabor '${topFlavor}' liderando ${topFlavorShare}% da esteira de pedidos. O caminhão HR opera a ${hubAcaiMetrics.hrOccupancy}% da capacidade. No financeiro, há ${riskAmountFormatted} associados a ${documentaryReviewCount} registro(s) para revisão humana.`,
        recommendations: [
          {
            priority: "Alta",
            action: "Revisão de evidências",
            detail: `Existem ${documentaryReviewCount} registro(s) que exigem revisão humana. Metadados cadastrados não autenticam arquivos ou assinaturas.`
          },
          {
            priority: "Média",
            action: "Ocupação da Frota HR",
            detail:
              hubAcaiMetrics.hrOccupancy > 85
                ? "Caminhão HR operando próximo da lotação (350 cx). Avaliar suporte de veículo auxiliar na rota."
                : "Capacidade da frota favorável. Margem livre para acolher novos pedidos sem custo extra de frete."
          },
          {
            priority: "Estratégica",
            action: "Revisão de correspondências",
            detail: `${readySettlements} correspondências candidatas para revisão humana. ${
              omieStatus?.status === "verified" ? "Integração Omie verificada." : "A integração Omie não está conectada."
            }`
          }
        ]
      };
    }

    const totalIncomingFormatted = formatCurrency(totals.incoming);
    const balanceFormatted = formatCurrency(totals.balance);

    return {
      status: healthStatus,
      statusTone,
      summary: `Painel de governança · ${companyName}: índice calculado em ${healthScore}%. Os registros financeiros disponíveis totalizam ${totalIncomingFormatted} em entradas e saldo líquido de ${balanceFormatted}. Existem ${readySettlements} correspondências candidatas para revisão humana; nenhuma baixa ou sincronização com ERP é executada automaticamente.`,
      recommendations: [
        {
          priority: "Alta",
          action: "Reconciliação ERP & Baixas",
          detail: `${readySettlements} correspondência(s) candidata(s) identificada(s) por valor e data; exigem revisão humana e não foram enviadas ao ERP.`
        },
        {
          priority: "Média",
          action: "Governança de Caixa",
          detail: `Saldo operacional mantido em ${balanceFormatted} distribuído entre as contas homologadas, com ${payableTitles.length} título(s) a pagar em aberto.`
        },
        {
          priority: "Estratégica",
          action: "Conferência de dados",
          detail: "Validar a origem e a cobertura dos dados antes de emitir demonstrativos ou afirmar sincronização contábil."
        }
      ]
    };
  }, [
    isHubAcai,
    healthScore,
    companyName,
    hubAcaiMetrics,
    deliveryMetrics,
    documentaryReviewCount,
    flavorsBreakdown,
    totals,
    readySettlements,
    omieStatus,
    payableTitles.length
  ]);

  // Fluxo de Caixa Projetado 7/15/30/60 dias com recebíveis e contas a pagar
  const cashFlowProjection = useMemo(
    () =>
      computeCashFlowProjection({
        currentBalance: totals.balance,
        titles: receivableTitles,
        payables: payableTitles
      }),
    [totals.balance, receivableTitles, payableTitles]
  );

  // Painel de Controladoria e Auditoria
  const controllershipSummary = useMemo(
    () => buildControllershipSummary({ auditEvents, matches }),
    [auditEvents, matches]
  );

  const filteredControllershipItems = useMemo(() => {
    if (severityFilter === "all") return controllershipSummary.items;
    return controllershipSummary.items.filter((item) => item.severity === severityFilter);
  }, [controllershipSummary.items, severityFilter]);

  function handleCopyMemo() {
    const contextLines = isHubAcai
      ? `Valor dos pedidos na sessão: ${formatCurrency(hubAcaiMetrics.totalRevenue)} (${hubAcaiMetrics.totalBoxes} caixas)\n` +
        `Ocupação estimada da HR: ${hubAcaiMetrics.hrOccupancy}%\n` +
        `Pendências documentais: ${formatCurrency(deliveryMetrics.atRiskProtestAmount)}\n`
      : `Entradas importadas: ${formatCurrency(totals.incoming)}\n` +
        `Saldo consolidado: ${formatCurrency(totals.balance)}\n` +
        `Correspondências prontas: ${readySettlements} título(s)\n` +
        `Contas a pagar em aberto: ${payableTitles.length} título(s)\n`;

    const memoText =
      `*RELATÓRIO EXECUTIVO · RSBUILD OS*\n` +
      `Workspace: ${companyName}\n` +
      `Data: ${new Date().toLocaleDateString("pt-BR")}\n` +
      `Score Operacional: ${healthScore === null ? "Não calculado — dados insuficientes" : `${healthScore}%`}\n` +
      contextLines +
      `\n*Síntese do painel:*\n${rsGuardiaoDiagnosis.summary}\n\n` +
      `_Documento gerado a partir dos dados disponíveis no workspace; não representa aprovação ou sincronização externa._`;

    navigator.clipboard.writeText(memoText);
    setCopiedMemo(true);
    setTimeout(() => setCopiedMemo(false), 3000);
  }

  return (
    <>
      {/* Cabeçalho Executivo estilo Command Center */}
      <div className="page-heading">
        <div>
          <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  display: "inline-block",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "var(--green)"
                }}
              />
              <strong>PAINEL DE GOVERNANÇA</strong> · AUDITORIA &amp; CONTROLE OPERACIONAL
            </span>
            <span
              className="status-pill"
              style={{
                background: "var(--surface-raised)",
                color: "var(--ink)",
                border: "1px solid var(--line)",
                fontWeight: 600,
                fontSize: "9.5px",
                padding: "2px 8px"
              }}
            >
              MÓDULO DE GOVERNANÇA E CONTROLE
            </span>
          </div>
          <h1>Torre de Governança &amp; Controle</h1>
          <p>
            Acompanhamento operacional do workspace <strong>{companyName}</strong>: organização de dados, identificação de
            inconsistências e acompanhamento de pendências para revisão pelos responsáveis.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <button className="secondary-button" onClick={handleCopyMemo}>
            {copiedMemo ? "✓ Memorando Copiado!" : "📋 Copiar Síntese Operacional"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setActiveSubTab("sincronizacao")}
            style={
              omieStatus?.status === "verified"
                ? { borderColor: "var(--green)", color: "var(--green)", background: "var(--green-soft)" }
                : undefined
            }
          >
            {omieStatus?.status === "verified"
              ? "● Omie Conectada"
              : omieStatus?.configured
              ? "● Omie Configurada"
              : "🔌 Configurar Omie ERP"}
          </button>
        </div>
      </div>

      {/* Subseletor Evidente de Comando Executivo */}
      <div className="torre-command-tabs" role="tablist" aria-label="Sub-abas da Torre de Controle">
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === "estrategia"}
          onClick={() => setActiveSubTab("estrategia")}
          className={`torre-command-tab${activeSubTab === "estrategia" ? " torre-command-tab--active" : ""}`}
        >
          <span>⎈</span>
          <span>Visão Executiva</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === "fluxo"}
          onClick={() => setActiveSubTab("fluxo")}
          className={`torre-command-tab${activeSubTab === "fluxo" ? " torre-command-tab--active" : ""}`}
        >
          <span>📈</span>
          <span>Fluxo de Caixa 7/15/30/60d</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === "controladoria"}
          onClick={() => setActiveSubTab("controladoria")}
          className={`torre-command-tab${activeSubTab === "controladoria" ? " torre-command-tab--active" : ""}`}
        >
          <span>⚖</span>
          <span>Controladoria &amp; Trilha</span>
          <span className="torre-command-badge">{controllershipSummary.totalAlerts}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === "sincronizacao"}
          onClick={() => setActiveSubTab("sincronizacao")}
          className={`torre-command-tab${activeSubTab === "sincronizacao" ? " torre-command-tab--active" : ""}`}
        >
          <span>⇄</span>
          <span>Evidências &amp; Integrações ERP</span>
          <span className="torre-command-badge">{documentaryReviewCount}</span>
        </button>

        {hasSprintZone && (
          <button
            type="button"
            onClick={() => onNavigateToTab("projetos")}
            className="torre-command-tab"
            style={{ marginLeft: "auto" }}
          >
            <span>📊</span>
            <span>Zona das Sprints</span>
          </button>
        )}
      </div>

      {/* ABA 1: VISÃO EXECUTIVA */}
      {activeSubTab === "estrategia" && (
        <>
          <div className="metric-grid">
            <Metric
              label="Indicador experimental"
              value={healthScore === null ? "—" : `${healthScore}%`}
              tone={healthScore === null ? "neutral" : healthScore >= 75 ? "positive" : healthScore >= 50 ? "neutral" : "negative"}
              detail={`Faixa provisória: ${rsGuardiaoDiagnosis.status}. Critérios ainda não homologados.`}
              icon="⎈"
            />
            {isHubAcai ? (
              <>
                <Metric
                  label="Valor dos pedidos na sessão"
                  value={hubAcaiMetrics.totalOrders > 0 ? formatCurrency(hubAcaiMetrics.totalRevenue) : "—"}
                  tone="neutral"
                  detail={
                    hubAcaiMetrics.totalOrders > 0
                      ? `${hubAcaiMetrics.totalBoxes} caixas em ${hubAcaiMetrics.totalOrders} pedidos temporários`
                      : "Nenhum pedido processado nesta sessão"
                  }
                  icon="💰"
                />
                <Metric
                  label="Ocupação estimada da HR"
                  value={hubAcaiMetrics.totalOrders > 0 ? `${hubAcaiMetrics.hrOccupancy}%` : "—"}
                  tone={hubAcaiMetrics.totalOrders > 0 ? (hubAcaiMetrics.hrOccupancy > 90 ? "negative" : "neutral") : "neutral"}
                  detail={
                    hubAcaiMetrics.totalOrders > 0
                      ? `${hubAcaiMetrics.totalBoxes} / 350 caixas; capacidade precisa ser validada`
                      : "Sem pedidos para estimar ocupação"
                  }
                  icon="🚚"
                />
                <Metric
                  label="Exposição documental estimada"
                  value={formatCurrency(deliveryMetrics.atRiskProtestAmount)}
                  tone={proofs.length > 0 ? (deliveryMetrics.atRiskProtestAmount > 0 ? "negative" : "neutral") : "neutral"}
                  detail={
                    proofs.length > 0
                      ? `${documentaryReviewCount} registro(s) para revisão humana; nenhuma ação externa é executada`
                      : "Sem comprovantes para avaliar exposição"
                  }
                  icon="🛡"
                />
              </>
            ) : (
              <>
                <Metric
                  label="Entradas importadas"
                  value={records.length > 0 ? formatCurrency(totals.incoming) : "—"}
                  tone="neutral"
                  detail={
                    records.length > 0
                      ? `${records.filter((r) => r.direction === "entrada").length} crédito(s) no período`
                      : "Nenhum movimento importado"
                  }
                  icon="↗"
                />
                <Metric
                  label="Saldo calculado dos registros"
                  value={records.length > 0 ? formatCurrency(totals.balance) : "—"}
                  tone={records.length > 0 ? (totals.balance >= 0 ? "neutral" : "negative") : "neutral"}
                  detail="Posição consolidada multibanco"
                  icon="🏦"
                />
                <Metric
                  label="Correspondências bancárias"
                  value={`${readySettlements} títulos`}
                  tone="positive"
                  detail="Candidatas à revisão humana; sem envio ao ERP"
                  icon="✓"
                />
              </>
            )}
          </div>

          <div className="inline-note" style={{ marginTop: "12px" }}>
            {scoreCompositionText}
          </div>

          {/* Síntese de Governança com ações rápidas */}
          <section
            className="panel"
            style={{
              borderLeft: "4px solid var(--rsbuild-terracotta)",
              marginBottom: "24px",
              background: "var(--surface)"
            }}
          >
            <div className="panel-heading">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "var(--rsbuild-terracotta)", fontSize: "16px" }}>✦</span>
                  <h2>Síntese de Governança</h2>
                </div>
                <p>Síntese executiva orientada a regras de negócio e proteção patrimonial da organização.</p>
              </div>
              <span
                className="status-pill"
                style={{
                  background:
                    healthScore !== null && healthScore >= 75
                      ? "var(--green-soft)"
                      : healthScore !== null && healthScore < 50
                      ? "var(--red-soft)"
                      : "var(--rsbuild-terracotta-soft)",
                  color:
                    healthScore !== null && healthScore >= 75
                      ? "var(--green)"
                      : healthScore !== null && healthScore < 50
                      ? "var(--red)"
                      : "var(--rsbuild-terracotta)",
                  fontWeight: 700
                }}
              >
                {rsGuardiaoDiagnosis.status.toUpperCase()}
              </span>
            </div>

            <div
              style={{
                background: "var(--surface-raised)",
                padding: "16px",
                borderRadius: "8px",
                fontSize: "13px",
                lineHeight: "1.6",
                color: "var(--ink)",
                marginBottom: "16px",
                border: "1px solid var(--line)"
              }}
            >
              {rsGuardiaoDiagnosis.summary}
            </div>

            <div className="torre-action-grid">
              <button
                type="button"
                className="torre-action-tile torre-action-tile--terracotta"
                onClick={() => onNavigateToTab("conciliacao")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
                  <span className="torre-action-tile-icon" aria-hidden="true">⇄</span>
                  <div>
                    <strong style={{ display: "block", fontSize: "13px" }}>Ir para Conciliação</strong>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                      Conferência multibanco de extratos
                    </span>
                  </div>
                </div>
                <span className="torre-action-tile-arrow" aria-hidden="true">→</span>
              </button>

              <button
                type="button"
                className="torre-action-tile torre-action-tile--green"
                onClick={() => onNavigateToTab("baixas")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
                  <span className="torre-action-tile-icon" aria-hidden="true">✓</span>
                  <div>
                    <strong style={{ display: "block", fontSize: "13px" }}>Revisar Baixas &amp; Títulos</strong>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                      {readySettlements} título(s) candidato(s)
                    </span>
                  </div>
                </div>
                <span className="torre-action-tile-arrow" aria-hidden="true">→</span>
              </button>

              <button
                type="button"
                className="torre-action-tile torre-action-tile--blue"
                onClick={() => onNavigateToTab("canhotos")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
                  <span className="torre-action-tile-icon" aria-hidden="true">🛡</span>
                  <div>
                    <strong style={{ display: "block", fontSize: "13px" }}>Protocolo de Canhotos</strong>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                      {documentaryReviewCount} evidência(s) registrada(s)
                    </span>
                  </div>
                </div>
                <span className="torre-action-tile-arrow" aria-hidden="true">→</span>
              </button>
            </div>

            <h3
              style={{
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "1.2px",
                color: "var(--muted)",
                marginBottom: "12px"
              }}
            >
              Recomendações e Diretrizes Imediatas:
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
              {rsGuardiaoDiagnosis.recommendations.map((rec, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: "8px",
                    padding: "14px",
                    background: "var(--surface)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <strong style={{ fontSize: "12.5px", color: "var(--ink)" }}>{rec.action}</strong>
                    <span
                      style={{
                        fontSize: "9px",
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: "4px",
                        background:
                          rec.priority === "Alta"
                            ? "var(--red-soft)"
                            : rec.priority === "Média"
                            ? "var(--rsbuild-terracotta-soft)"
                            : "var(--surface-raised)",
                        color:
                          rec.priority === "Alta"
                            ? "var(--red)"
                            : rec.priority === "Média"
                            ? "var(--rsbuild-terracotta)"
                            : "var(--ink)",
                        border: "1px solid var(--line)"
                      }}
                    >
                      Prioridade {rec.priority}
                    </span>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0, lineHeight: "1.5" }}>{rec.detail}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Gráficos Estratégicos Cruzados */}
          <div className="dashboard-grid" style={{ marginBottom: "24px" }}>
            <section className="panel">
              {isHubAcai ? (
                <>
                  <div className="panel-heading">
                    <div>
                      <h2>Distribuição de Demanda por Sabor (Curva ABC)</h2>
                      <p>Volumes físicos consolidados a partir das mensagens do WhatsApp.</p>
                    </div>
                    <span className="subtle-tag">CAIXAS FÍSICAS</span>
                  </div>

                  {flavorsBreakdown.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
                      {flavorsBreakdown.map((item, idx) => {
                        const total = hubAcaiMetrics.totalBoxes || 1;
                        const percentage = Math.round((item.boxes / total) * 100);
                        return (
                          <div key={idx}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                              <strong>{item.flavor}</strong>
                              <span style={{ color: "var(--muted)" }}>
                                {item.boxes} cx ({percentage}%) · {formatCurrency(item.revenue)}
                              </span>
                            </div>
                            <div style={{ width: "100%", height: "8px", background: "var(--surface-raised)", borderRadius: "4px", overflow: "hidden", border: "1px solid var(--line)" }}>
                              <div
                                style={{
                                  width: `${percentage}%`,
                                  height: "100%",
                                  background: idx === 0 ? "var(--rsbuild-terracotta)" : "var(--ink)",
                                  borderRadius: "4px",
                                  transition: "width 0.4s ease"
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ color: "var(--muted)", fontSize: "12px" }}>Nenhum pedido processado para gerar a curva de demanda.</p>
                  )}
                </>
              ) : (
                <>
                  <div className="panel-heading">
                    <div>
                      <h2>Distribuição de Títulos por Carteira Bancária</h2>
                      <p>Concentração de títulos cadastrados por instituição financeira.</p>
                    </div>
                    <span className="subtle-tag">MULTIBANCO</span>
                  </div>

                  {bankDistribution.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
                      {bankDistribution.map((item, idx) => {
                        const totalOverall = bankDistribution.reduce((acc, curr) => acc + curr.total, 0) || 1;
                        const percentage = Math.round((item.total / totalOverall) * 100);
                        return (
                          <div key={idx}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                              <strong>{item.bank}</strong>
                              <span style={{ color: "var(--muted)" }}>
                                {item.count} título(s) ({percentage}%) · {formatCurrency(item.total)}
                              </span>
                            </div>
                            <div style={{ width: "100%", height: "8px", background: "var(--surface-raised)", borderRadius: "4px", overflow: "hidden", border: "1px solid var(--line)" }}>
                              <div
                                style={{
                                  width: `${percentage}%`,
                                  height: "100%",
                                  background: idx === 0 ? "var(--rsbuild-terracotta)" : "var(--ink)",
                                  borderRadius: "4px",
                                  transition: "width 0.4s ease"
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ color: "var(--muted)", fontSize: "12px" }}>Nenhum título pendente cadastrado para distribuição bancária.</p>
                  )}
                </>
              )}
            </section>

            {/* Cobertura Documental */}
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Cobertura de metadados de entrega</h2>
                  <p>Proporção de registros com metadados de entrega completos; autenticidade não verificada.</p>
                </div>
                <span className="subtle-tag">SEFAZ / CANHOTOS</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                    <span style={{ color: "var(--green)", fontWeight: 600 }}>✓ Metadados de entrega completos</span>
                    <strong>{formatCurrency(deliveryMetrics.provenAmount)}</strong>
                  </div>
                  <div style={{ width: "100%", height: "10px", background: "var(--surface-raised)", borderRadius: "5px", overflow: "hidden", border: "1px solid var(--line)" }}>
                    <div
                      style={{
                        width: `${deliveryMetrics.coverageRate}%`,
                        height: "100%",
                        background: "var(--green)",
                        borderRadius: "5px"
                      }}
                    />
                  </div>
                  <span style={{ fontSize: "10px", color: "var(--muted)", marginTop: "3px", display: "block" }}>
                    {deliveryMetrics.provenCount} de {deliveryMetrics.totalInvoices} registros com metadados completos; arquivos não autenticados.
                  </span>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                    <span style={{ color: "var(--red)", fontWeight: 600 }}>⛔ Valor sem metadados completos de entrega</span>
                    <strong>{formatCurrency(deliveryMetrics.atRiskProtestAmount)}</strong>
                  </div>
                  <div style={{ width: "100%", height: "10px", background: "var(--surface-raised)", borderRadius: "5px", overflow: "hidden", border: "1px solid var(--line)" }}>
                    <div
                      style={{
                        width: `${deliveryMetrics.totalInvoices > 0 ? Math.round((incompleteEvidenceCount / deliveryMetrics.totalInvoices) * 100) : 0}%`,
                        height: "100%",
                        background: "var(--red)",
                        borderRadius: "5px"
                      }}
                    />
                  </div>
                  <span style={{ fontSize: "10px", color: "var(--muted)", marginTop: "3px", display: "block" }}>
                    {incompleteEvidenceCount} registro(s) sem metadados completos; revisar antes de qualquer decisão operacional.
                  </span>
                </div>
              </div>
            </section>
          </div>
        </>
      )}

      {/* ABA 2: FLUXO DE CAIXA 7/15/30/60d */}
      {activeSubTab === "fluxo" && (
        <section className="panel" style={{ marginBottom: "24px" }}>
          <div className="panel-heading">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "16px" }}>📈</span>
                <h2>Fluxo de Caixa Projetado (7 / 15 / 30 / 60 dias)</h2>
              </div>
              <p>
                Projeção de liquidez calculada a partir do saldo bancário atual ({formatCurrency(cashFlowProjection.currentBalance)})
                somado aos recebíveis ({receivableTitles.length}) e contas a pagar ({payableTitles.length}) em aberto.
              </p>
            </div>
            {cashFlowProjection.hasNegativeBalanceRisk ? (
              <span
                className="status-pill"
                style={{
                  background: "var(--red-soft)",
                  color: "var(--red)",
                  fontWeight: 700
                }}
              >
                ⚠ ALERTA: RISCO DE SALDO NEGATIVO (D+{cashFlowProjection.firstNegativeHorizonDays})
              </span>
            ) : (
              <span
                className="status-pill"
                style={{
                  background: "var(--green-soft)",
                  color: "var(--green)",
                  fontWeight: 700
                }}
              >
                ✓ COBERTURA DE LIQUIDEZ PRESERVADA
              </span>
            )}
          </div>

          {/* Alerta de Títulos Vencidos (Receber e/ou Pagar) */}
          {(cashFlowProjection.overdueReceivablesCount > 0 || cashFlowProjection.overduePayablesCount > 0) && (
            <div
              style={{
                background: "var(--rsbuild-terracotta-soft)",
                border: "1px solid var(--rsbuild-terracotta)",
                borderRadius: "8px",
                padding: "12px 16px",
                fontSize: "12.5px",
                color: "var(--ink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                flexWrap: "wrap",
                marginBottom: "16px"
              }}
            >
              <span>
                <strong>Atenção operacional:</strong>{" "}
                {cashFlowProjection.overdueReceivablesCount > 0 && (
                  <>
                    <strong>{cashFlowProjection.overdueReceivablesCount} título(s) vencido(s) a receber</strong> (
                    <strong>{formatCurrency(cashFlowProjection.overdueReceivables)}</strong>)
                  </>
                )}
                {cashFlowProjection.overdueReceivablesCount > 0 && cashFlowProjection.overduePayablesCount > 0 && " e "}
                {cashFlowProjection.overduePayablesCount > 0 && (
                  <>
                    <strong>{cashFlowProjection.overduePayablesCount} título(s) vencido(s) a pagar</strong> (
                    <strong>{formatCurrency(cashFlowProjection.overduePayables)}</strong>)
                  </>
                )}{" "}
                anteriores à data base.
              </span>
              <button
                type="button"
                className="secondary-button"
                style={{ padding: "4px 10px", fontSize: "11px" }}
                onClick={() => onNavigateToTab("baixas")}
              >
                Ver Títulos →
              </button>
            </div>
          )}

          {/* Grid dos 4 Horizontes */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
            {cashFlowProjection.horizons.map((h) => (
              <div
                key={h.days}
                style={{
                  border: h.negativeAlert ? "2px solid var(--red)" : "1px solid var(--line)",
                  borderRadius: "8px",
                  padding: "16px",
                  background: h.negativeAlert ? "var(--red-soft)" : "var(--surface)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>
                    D+{h.days} ({h.label})
                  </span>
                  <span
                    style={{
                      fontSize: "9.5px",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: h.negativeAlert ? "var(--red-soft)" : "var(--green-soft)",
                      color: h.negativeAlert ? "var(--red)" : "var(--green)"
                    }}
                  >
                    {h.negativeAlert ? "DÉFICIT" : "SUPERÁVIT"}
                  </span>
                </div>

                <div style={{ fontSize: "11.5px", color: "var(--muted)", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Entradas previstas:</span>
                    <strong style={{ color: "var(--green)" }}>+{formatCurrency(h.receivablesInWindow)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Saídas (Contas a Pagar):</span>
                    <strong style={{ color: h.payablesInWindow > 0 ? "var(--red)" : "var(--muted)" }}>
                      -{formatCurrency(h.payablesInWindow)}
                    </strong>
                  </div>
                </div>

                <div style={{ borderTop: "1px solid var(--line)", paddingTop: "8px" }}>
                  <div style={{ fontSize: "10.5px", color: "var(--muted)", marginBottom: "2px" }}>Saldo Projetado:</div>
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: 700,
                      color: h.projectedBalance < 0 ? "var(--red)" : "var(--ink)"
                    }}
                  >
                    {formatCurrency(h.projectedBalance)}
                  </div>
                  {(cashFlowProjection.overdueReceivables > 0 || cashFlowProjection.overduePayables > 0) && (
                    <div style={{ fontSize: "10px", color: "var(--muted)", marginTop: "4px" }}>
                      c/ vencidos: <strong>{formatCurrency(h.projectedBalanceWithOverdue)}</strong>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "14px", fontSize: "11.5px", color: "var(--muted)" }}>
            {cashFlowProjection.hasPayablesData ? (
              <>
                ✓ <em>Nota de governança:</em> Projeção consolidada considerando{" "}
                <strong>{payableTitles.length} título(s) a pagar</strong> e{" "}
                <strong>{receivableTitles.length} título(s) a receber</strong> em aberto na organização.
              </>
            ) : (
              <>
                ℹ <em>Nota de governança:</em> Nenhum título de Contas a Pagar em aberto encontrado na organização. O cálculo atual
                considera apenas entradas de recebíveis.
              </>
            )}
          </div>
        </section>
      )}

      {/* ABA 3: CONTROLADORIA & TRILHA */}
      {activeSubTab === "controladoria" && (
        <section className="panel" style={{ marginBottom: "24px" }}>
          <div className="panel-heading">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "16px" }}>⚖</span>
                <h2>Painel de Controladoria &amp; Integridade Operacional</h2>
              </div>
              <p>
                Monitoramento contínuo de exceções: descontos concedidos, alterações de valores, baixas manuais, estornos e tentativas
                fora de alçada.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span
                className="status-pill"
                style={{
                  background: controllershipSummary.totalAlerts > 0 ? "var(--rsbuild-terracotta-soft)" : "var(--surface-raised)",
                  color: controllershipSummary.totalAlerts > 0 ? "var(--rsbuild-terracotta)" : "var(--ink)",
                  fontWeight: 700
                }}
              >
                {controllershipSummary.totalAlerts} OCORRÊNCIA(S) AUDITADA(S)
              </span>
              <button type="button" className="secondary-button" onClick={() => onNavigateToTab("auditoria")}>
                Abrir Trilha Completa →
              </button>
            </div>
          </div>

          {/* 5 Contadores de Exceção */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px", marginBottom: "16px" }}>
            <div style={{ padding: "10px 14px", borderRadius: "6px", background: "var(--surface-raised)", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>Descontos Concedidos</div>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: controllershipSummary.totalDiscountsGranted > 0 ? "var(--rsbuild-terracotta)" : "var(--ink)",
                  marginTop: "2px"
                }}
              >
                {formatCurrency(controllershipSummary.totalDiscountsGranted)}
              </div>
              <span style={{ fontSize: "10px", color: "var(--muted)" }}>
                {controllershipSummary.countsByCategory.desconto_abatimento} título(s)
              </span>
            </div>

            <div style={{ padding: "10px 14px", borderRadius: "6px", background: "var(--surface-raised)", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>Alterações Valor/Venc.</div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)", marginTop: "2px" }}>
                {controllershipSummary.countsByCategory.alteracao_valor_vencimento}
              </div>
              <span style={{ fontSize: "10px", color: "var(--muted)" }}>ajustes registrados</span>
            </div>

            <div style={{ padding: "10px 14px", borderRadius: "6px", background: "var(--surface-raised)", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>Baixas &amp; Estornos</div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)", marginTop: "2px" }}>
                {controllershipSummary.countsByCategory.baixa_manual_estorno}
              </div>
              <span style={{ fontSize: "10px", color: "var(--muted)" }}>intervenções manuais</span>
            </div>

            <div style={{ padding: "10px 14px", borderRadius: "6px", background: "var(--surface-raised)", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>Fora de Alçada</div>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: controllershipSummary.countsByCategory.fora_de_alcada > 0 ? "var(--red)" : "var(--ink)",
                  marginTop: "2px"
                }}
              >
                {controllershipSummary.countsByCategory.fora_de_alcada}
              </div>
              <span style={{ fontSize: "10px", color: "var(--muted)" }}>bloqueios preventivos</span>
            </div>

            <div style={{ padding: "10px 14px", borderRadius: "6px", background: "var(--surface-raised)", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>Divergências Banco/ERP</div>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: controllershipSummary.countsByCategory.divergencia_conciliacao > 0 ? "var(--red)" : "var(--ink)",
                  marginTop: "2px"
                }}
              >
                {controllershipSummary.countsByCategory.divergencia_conciliacao}
              </div>
              <span style={{ fontSize: "10px", color: "var(--muted)" }}>inconsistências</span>
            </div>
          </div>

          {/* Filtro rápido por severidade */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: "14px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)" }}>Filtrar severidade:</span>
            {(
              [
                { id: "all", label: "Todas" },
                { id: "high", label: "Alta" },
                { id: "medium", label: "Média" },
                { id: "info", label: "Info" }
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSeverityFilter(opt.id)}
                className="secondary-button"
                style={{
                  padding: "4px 12px",
                  fontSize: "11px",
                  fontWeight: severityFilter === opt.id ? 700 : 500,
                  borderColor: severityFilter === opt.id ? "var(--rsbuild-terracotta)" : "var(--line)",
                  background: severityFilter === opt.id ? "var(--rsbuild-terracotta-soft)" : "var(--surface)",
                  color: severityFilter === opt.id ? "var(--rsbuild-terracotta)" : "var(--ink)"
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Tabela auditada */}
          {filteredControllershipItems.length > 0 ? (
            <div className="table-wrap">
              <table className="sticky-actions" style={{ fontSize: "12px" }}>
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>Evento / Descrição</th>
                    <th>Responsável</th>
                    <th>Data</th>
                    <th className="align-right">Impacto Financeiro</th>
                    <th>Severidade</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredControllershipItems.slice(0, 12).map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span
                          className="status-pill"
                          style={{
                            fontSize: "9.5px",
                            fontWeight: 600,
                            background: "var(--surface-raised)",
                            color: "var(--ink)",
                            border: "1px solid var(--line)"
                          }}
                        >
                          {item.categoryLabel}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: "var(--ink)" }}>{item.title}</strong>
                        {item.justification && (
                          <span style={{ display: "block", fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                            {item.justification}
                          </span>
                        )}
                      </td>
                      <td style={{ color: "var(--muted)" }}>{item.actorLabel}</td>
                      <td style={{ color: "var(--muted)" }}>
                        {item.occurredAt ? new Date(item.occurredAt).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="align-right font-semibold">
                        {item.financialImpact !== null ? formatCurrency(item.financialImpact) : "—"}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background:
                              item.severity === "high"
                                ? "var(--red-soft)"
                                : item.severity === "medium"
                                ? "var(--rsbuild-terracotta-soft)"
                                : "var(--surface-raised)",
                            color:
                              item.severity === "high"
                                ? "var(--red)"
                                : item.severity === "medium"
                                ? "var(--rsbuild-terracotta)"
                                : "var(--ink)"
                          }}
                        >
                          {item.severity === "high" ? "ALTA" : item.severity === "medium" ? "MÉDIA" : "INFO"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              style={{
                padding: "16px",
                textAlign: "center",
                color: "var(--muted)",
                fontSize: "12px",
                border: "1px dashed var(--line)",
                borderRadius: "6px"
              }}
            >
              Nenhuma exceção ou inconformidade operacional encontrada para o filtro selecionado.
            </div>
          )}
        </section>
      )}

      {/* ABA 4: EVIDÊNCIAS & INTEGRAÇÕES ERP */}
      {activeSubTab === "sincronizacao" && (
        <>
          <section className="panel" style={{ marginBottom: "24px" }}>
            <div className="panel-heading" style={{ marginBottom: "18px" }}>
              <div>
                <h2>Integrações ERP &amp; Exportações</h2>
                <p>
                  {omieStatus?.status === "verified"
                    ? "Integração Omie ativa e verificada. Os lotes preparados abaixo exigem revisão humana antes da importação."
                    : "Conecte a API do Omie abaixo para consultar títulos em aberto em tempo real e preparar lotes de baixa."}
                </p>
              </div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "5px 12px",
                  borderRadius: "20px",
                  background:
                    omieStatus?.status === "verified"
                      ? "var(--green-soft)"
                      : omieStatus?.configured
                      ? "var(--rsbuild-terracotta-soft)"
                      : "var(--surface-raised)",
                  color:
                    omieStatus?.status === "verified"
                      ? "var(--green)"
                      : omieStatus?.configured
                      ? "var(--rsbuild-terracotta)"
                      : "var(--muted)",
                  border: "1px solid var(--line)"
                }}
              >
                {omieStatus?.status === "verified"
                  ? "● Omie Verificada"
                  : omieStatus?.configured
                  ? "● Omie Configurada"
                  : "○ Omie Não Conectada"}
              </span>
            </div>

            {organizationId && (
              <div style={{ marginBottom: "24px" }}>
                <OmieIntegrationCard
                  organizationId={organizationId}
                  organizationName={companyName}
                  canAdmin={canAdminIntegration}
                  currentUserEmail={currentUserEmail}
                  isPlatformAdministrator={isPlatformAdministrator}
                  onStatusChange={setOmieStatus}
                />
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginTop: "16px" }}>
              {isHubAcai ? (
                <div style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "16px", background: "var(--surface)" }}>
                  <div style={{ fontSize: "20px", marginBottom: "8px" }}>📦</div>
                  <strong style={{ fontSize: "13px", color: "var(--ink)" }}>Pedidos de Venda Decifrados</strong>
                  <p style={{ fontSize: "11.5px", color: "var(--muted)", margin: "4px 0 12px" }}>
                    {orders.length} pedidos estruturados ({hubAcaiMetrics.totalBoxes} caixas) prontos para envio.
                  </p>
                  <button className="secondary-button" style={{ fontSize: "11px", width: "100%" }} onClick={() => onNavigateToTab("pedidos-ha")}>
                    Revisar Pedidos WhatsApp
                  </button>
                </div>
              ) : (
                <div style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "16px", background: "var(--surface)" }}>
                  <div style={{ fontSize: "20px", marginBottom: "8px" }}>⇄</div>
                  <strong style={{ fontSize: "13px", color: "var(--ink)" }}>Conciliação Bancária &amp; Extratos</strong>
                  <p style={{ fontSize: "11.5px", color: "var(--muted)", margin: "4px 0 12px" }}>
                    {records.length} lançamento(s) bancário(s) e {titles.length} título(s) carregados para conferência.
                  </p>
                  <button className="secondary-button" style={{ fontSize: "11px", width: "100%" }} onClick={() => onNavigateToTab("conciliacao")}>
                    Abrir Conciliação Bancária
                  </button>
                </div>
              )}

              <div style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "16px", background: "var(--surface)" }}>
                <div style={{ fontSize: "20px", marginBottom: "8px" }}>✓</div>
                <strong style={{ fontSize: "13px", color: "var(--ink)" }}>Lote de Baixas Bancárias</strong>
                <p style={{ fontSize: "11.5px", color: "var(--muted)", margin: "4px 0 12px" }}>
                  {readySettlements} títulos com correspondência pronta.
                </p>
                <button className="secondary-button" style={{ fontSize: "11px", width: "100%" }} onClick={() => onNavigateToTab("baixas")}>
                  Revisar Baixas &amp; Liquidações
                </button>
              </div>

              <div style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "16px", background: "var(--surface)" }}>
                <div style={{ fontSize: "20px", marginBottom: "8px" }}>🛡</div>
                <strong style={{ fontSize: "13px", color: "var(--ink)" }}>Registro de Evidências de Entrega</strong>
                <p style={{ fontSize: "11.5px", color: "var(--muted)", margin: "4px 0 12px" }}>
                  {evaluations.length} notas auditadas contra a Lei de Duplicatas Mercantis.
                </p>
                <button className="secondary-button" style={{ fontSize: "11px", width: "100%" }} onClick={() => onNavigateToTab("canhotos")}>
                  Revisar Protocolo de Canhotos
                </button>
              </div>
            </div>
          </section>

          {/* Revisão de Evidências de Entrega */}
          <section className="panel" style={{ marginBottom: "24px" }}>
            <div className="panel-heading">
              <div>
                <h2>Revisão de evidências de entrega</h2>
                <p>Registros que exigem conferência humana de metadados e evidências de entrega.</p>
              </div>
              <button className="secondary-button" onClick={() => onNavigateToTab("canhotos")}>
                Ir para Protocolo de Canhotos →
              </button>
            </div>

            {evaluations.length > 0 ? (
              <div className="table-wrap">
                <table className="sticky-actions">
                  <thead>
                    <tr>
                      <th>NF-e / Destinatário</th>
                      <th className="align-right">Valor da Nota</th>
                      <th>Estado documental</th>
                      <th>Observação operacional</th>
                      <th>Ação Sugerida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluations.map((ev, i) => (
                      <tr key={i}>
                        <td>
                          <strong>NF-{ev.nfeNumber}</strong>
                          <span style={{ display: "block", color: "var(--muted)", fontSize: "11px" }}>{ev.customerName}</span>
                        </td>
                        <td className="align-right font-semibold">{formatCurrency(ev.nfeAmount)}</td>
                        <td>
                          <span
                            className="status-pill"
                            style={{
                              background: "var(--surface-raised)",
                              color: "var(--ink)",
                              border: "1px solid var(--line)",
                              fontWeight: 700
                            }}
                          >
                            {ev.risk === "metadata_complete"
                              ? "Metadados completos · autenticidade pendente"
                              : ev.risk === "priority_review"
                              ? "Revisão prioritária"
                              : "Metadados incompletos · revisar"}
                          </span>
                        </td>
                        <td style={{ fontSize: "11px", color: "var(--muted)", maxWidth: "300px" }}>{ev.reason}</td>
                        <td>
                          {ev.risk === "priority_review" ? (
                            <span style={{ fontSize: "11px", color: "var(--rsbuild-terracotta)", fontWeight: 600 }}>
                              Encaminhar para revisão prioritária
                            </span>
                          ) : ev.risk === "documentary_review" ? (
                            <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>
                              Completar metadados e revisar
                            </span>
                          ) : (
                            <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>
                              Conferir autenticidade da evidência
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div
                style={{
                  padding: "16px",
                  textAlign: "center",
                  color: "var(--muted)",
                  fontSize: "12px",
                  border: "1px dashed var(--line)",
                  borderRadius: "6px"
                }}
              >
                Nenhuma evidência de entrega pendente de revisão neste workspace.
              </div>
            )}
          </section>
        </>
      )}

      <div className="inline-note">
        <strong>Diretriz de governança:</strong> os resultados exibidos são cálculos auxiliares sobre os registros disponíveis nesta
        sessão. Não substituem revisão profissional, revisão especializada ou integração com sistemas de origem.
      </div>
    </>
  );
}
