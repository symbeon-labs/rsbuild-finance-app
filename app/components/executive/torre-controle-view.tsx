"use client";

import { useMemo, useState } from "react";
import { FinancialRecord, formatCurrency } from "@/lib/finance";
import { ReceivableTitle, ReconciliationMatch } from "@/lib/reconciliation";
import { DeliveryProof, DeliveryMetrics, ProtestoEvaluation } from "@/lib/delivery";
import { ParsedWhatsAppOrder } from "@/lib/orders";
import { Metric } from "@/app/components/finance/common";

interface TorreControleViewProps {
  companyName?: string;
  isDirector?: boolean;
  currentUserEmail?: string;
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

type TorreSubTab = "estrategia" | "auditoria" | "sincronizacao" | "sprints";

export function TorreControleView({
  companyName = "RSBUILD Inovação",
  currentUserEmail,
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
  const [copiedMemo, setCopiedMemo] = useState(false);

  // Todos os registros exigem revisão humana; metadados completos não autenticam a evidência.
  const documentaryReviewCount = evaluations.length;
  const incompleteEvidenceCount = evaluations.filter((e) => e.risk !== "metadata_complete").length;

  // O índice só existe quando todas as fontes que compõem o cálculo têm dados.
  // Ausência de registros não pode ser interpretada como 100% de conformidade.
  const healthScore = useMemo(() => {
    if (!records.length || !titles.length || !proofs.length || !orders.length) return null;
    const coverageScore = deliveryMetrics.coverageRate;
    const readySettlements = matches.filter((m) => m.suggestedStatus === "pronto_para_baixa").length;
    const reconcilRate = Math.round((readySettlements / titles.length) * 100);
    const logisticsEfficiency = Math.min(100, hubAcaiMetrics.hrOccupancy);
    const score = Math.round(coverageScore * 0.4 + reconcilRate * 0.35 + logisticsEfficiency * 0.25);
    return Math.max(0, Math.min(100, score));
  }, [records, deliveryMetrics, matches, titles, proofs, orders, hubAcaiMetrics]);

  // Curva de Sabores Vendidos no WhatsApp
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

  // Verificação de contexto operacional (Hub Açaí vs RSBUILD / Indústria)
  const isHubAcai = useMemo(
    () => companyName.toLowerCase().includes("açaí") || companyName.toLowerCase().includes("acai"),
    [companyName]
  );

  // Títulos prontos para baixa
  const readySettlements = useMemo(
    () => matches.filter((m) => m.suggestedStatus === "pronto_para_baixa").length,
    [matches]
  );

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
  const rsAgentDiagnosis = useMemo(() => {
    if (healthScore === null) {
      return {
        status: "Dados insuficientes",
        statusTone: "neutral",
        summary: "Ainda não há dados operacionais suficientes e consistentes para calcular um índice de governança. Importe e valide as fontes necessárias antes de emitir um diagnóstico.",
        recommendations: [
          { priority: "Alta", action: "Completar fontes de dados", detail: "Disponibilize registros financeiros, títulos, comprovantes de entrega e pedidos para habilitar a análise consolidada." }
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
      const topFlavorShare = hubAcaiMetrics.totalBoxes > 0
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
            detail: hubAcaiMetrics.hrOccupancy > 85
              ? "Caminhão HR operando próximo da lotação (350 cx). Avaliar suporte de veículo auxiliar na rota."
              : "Capacidade da frota favorável. Margem livre para acolher novos pedidos sem custo extra de frete."
          },
          {
            priority: "Estratégica",
            action: "Revisão de correspondências",
            detail: `${readySettlements} correspondências candidatas para revisão humana. A integração Omie não está conectada.`
          }
        ]
      };
    }

    // Diagnóstico sob medida para RSBUILD e Holding
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
          detail: `Saldo operacional mantido em ${balanceFormatted} distribuído entre as contas homologadas com cobertura de liquidez positiva.`
        },
        {
          priority: "Estratégica",
          action: "Auditoria & DRE",
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
    atRiskProtestCount,
    flavorsBreakdown,
    totals,
    readySettlements
  ]);

  function handleCopyMemo() {
    const memoText = `*RELATÓRIO EXECUTIVO · RSBUILD OS*\n` +
      `Workspace: ${companyName}\n` +
      `Data: ${new Date().toLocaleDateString("pt-BR")}\n` +
      `Score Operacional: ${healthScore === null ? "Não calculado — dados insuficientes" : `${healthScore}%`}\n` +
      `Valor dos pedidos na sessão: ${formatCurrency(hubAcaiMetrics.totalRevenue)} (${hubAcaiMetrics.totalBoxes} caixas)\n` +
      `Ocupação estimada da HR: ${hubAcaiMetrics.hrOccupancy}%\n` +
      `Pendências documentais: ${formatCurrency(deliveryMetrics.atRiskProtestAmount)}\n\n` +
      `*Síntese do painel:*\n${rsAgentDiagnosis.summary}\n\n` +
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
              <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "var(--green-text, #10B981)" }} />
              <strong>PAINEL DE GOVERNANÇA</strong> · AUDITORIA & CONTROLE OPERACIONAL
            </span>
            <span
              className="status-pill"
              style={{
                background: "var(--surface-raised, rgba(255,255,255,0.06))",
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
          <h1>Torre de Governança & Controle</h1>
          <p>
            Acompanhamento operacional do workspace <strong>{companyName}</strong>: organização de dados, identificação de inconsistências e acompanhamento de pendências para revisão pelos responsáveis.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <button className="secondary-button" onClick={handleCopyMemo}>
            {copiedMemo ? "✓ Memorando Copiado!" : "📋 Copiar Síntese Operacional"}
          </button>
          <button className="secondary-button" type="button" disabled title="A integração Omie ainda não está conectada neste ambiente">
            Integração Omie não conectada
          </button>
        </div>
      </div>

      {/* Subseletor Operacional da Torre de Controle */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--line)",
          marginBottom: "20px",
          paddingBottom: "8px"
        }}
      >
        <button
          type="button"
          onClick={() => setActiveSubTab("estrategia")}
          className={activeSubTab === "estrategia" ? "secondary-button active" : "secondary-button"}
          style={{
            padding: "8px 16px",
            fontSize: "12px",
            fontWeight: activeSubTab === "estrategia" ? 700 : 500,
            background: activeSubTab === "estrategia" ? "var(--surface-raised, rgba(255,255,255,0.08))" : "transparent",
            borderColor: activeSubTab === "estrategia" ? "var(--rsbuild-terracotta)" : "var(--line)",
            color: "var(--ink)"
          }}
        >
          <span>⎈</span> Visão Estratégica & Síntese
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("auditoria")}
          className={activeSubTab === "auditoria" ? "secondary-button active" : "secondary-button"}
          style={{
            padding: "8px 16px",
            fontSize: "12px",
            fontWeight: activeSubTab === "auditoria" ? 700 : 500,
            background: activeSubTab === "auditoria" ? "var(--surface-raised, rgba(255,255,255,0.08))" : "transparent",
            borderColor: activeSubTab === "auditoria" ? "var(--rsbuild-terracotta)" : "var(--line)",
            color: "var(--ink)"
          }}
        >
          <span>🛡</span> Pendências documentais ({documentaryReviewCount})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("sincronizacao")}
          className={activeSubTab === "sincronizacao" ? "secondary-button active" : "secondary-button"}
          style={{
            padding: "8px 16px",
            fontSize: "12px",
            fontWeight: activeSubTab === "sincronizacao" ? 700 : 500,
            background: activeSubTab === "sincronizacao" ? "var(--surface-raised, rgba(255,255,255,0.08))" : "transparent",
            borderColor: activeSubTab === "sincronizacao" ? "var(--rsbuild-terracotta)" : "var(--line)",
            color: "var(--ink)"
          }}
        >
          <span>⇄</span> Integrações ERP
        </button>

        {hasSprintZone && (
          <button
            type="button"
            onClick={() => setActiveSubTab("sprints")}
            className={activeSubTab === "sprints" ? "secondary-button active" : "secondary-button"}
            style={{
              padding: "8px 16px",
              fontSize: "12px",
              fontWeight: activeSubTab === "sprints" ? 700 : 500,
              background: activeSubTab === "sprints" ? "var(--surface-raised, rgba(255,255,255,0.08))" : "transparent",
              borderColor: activeSubTab === "sprints" ? "var(--rsbuild-terracotta)" : "var(--line)",
              color: "var(--ink)"
            }}
          >
            <span>📊</span> Zona das Sprints
          </button>
        )}
      </div>

      {/* ABA 1: VISÃO ESTRATÉGICA & PARECER DO AGENTE RS */}
      {activeSubTab === "estrategia" && (
        <>
          {/* Grid de KPIs Macro Adaptativo ao Workspace */}
          <div className="metric-grid">
            <Metric
              label="Indicador experimental"
              value={healthScore === null ? "—" : `${healthScore}%`}
              tone={healthScore === null ? "neutral" : healthScore >= 75 ? "positive" : healthScore >= 50 ? "neutral" : "negative"}
              detail={`Faixa provisória: ${rsAgentDiagnosis.status}. Critérios ainda não homologados.`}
              icon="⎈"
            />
            {isHubAcai ? (
              <>
                <Metric
                  label="Valor dos pedidos na sessão"
                  value={hubAcaiMetrics.totalOrders > 0 ? formatCurrency(hubAcaiMetrics.totalRevenue) : "—"}
                  tone={hubAcaiMetrics.totalOrders > 0 ? "neutral" : "neutral"}
                  detail={hubAcaiMetrics.totalOrders > 0 ? `${hubAcaiMetrics.totalBoxes} caixas em ${hubAcaiMetrics.totalOrders} pedidos temporários` : "Nenhum pedido processado nesta sessão"}
                  icon="💰"
                />
                <Metric
                  label="Ocupação estimada da HR"
                  value={hubAcaiMetrics.totalOrders > 0 ? `${hubAcaiMetrics.hrOccupancy}%` : "—"}
                  tone={hubAcaiMetrics.totalOrders > 0 ? (hubAcaiMetrics.hrOccupancy > 90 ? "negative" : "neutral") : "neutral"}
                  detail={hubAcaiMetrics.totalOrders > 0 ? `${hubAcaiMetrics.totalBoxes} / 350 caixas; capacidade precisa ser validada` : "Sem pedidos para estimar ocupação"}
                  icon="🚚"
                />
                <Metric
                  label="Exposição documental estimada"
                  value={formatCurrency(deliveryMetrics.atRiskProtestAmount)}
                  tone={proofs.length > 0 ? (deliveryMetrics.atRiskProtestAmount > 0 ? "negative" : "neutral") : "neutral"}
                  detail={proofs.length > 0 ? `${documentaryReviewCount} registro(s) para revisão humana; nenhuma ação externa é executada` : "Sem comprovantes para avaliar exposição"}
                  icon="🛡"
                />
              </>
            ) : (
              <>
                <Metric
                  label="Entradas importadas"
                  value={records.length > 0 ? formatCurrency(totals.incoming) : "—"}
                  tone={records.length > 0 ? "neutral" : "neutral"}
                  detail={records.length > 0 ? `${records.filter((r) => r.direction === "entrada").length} crédito(s) no período` : "Nenhum movimento importado"}
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

          <div className="inline-note" style={{ marginTop: "12px" }}>Indicador experimental: cálculo provisório ponderado por cobertura de comprovantes (40%), correspondências de títulos (35%) e ocupação estimada da frota (25%). Pesos e critérios ainda não foram homologados; não utilizar como KPI oficial ou evidência de governança.</div>

          {/* Painel de análise */}
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
                      ? "var(--green-bg, rgba(16, 185, 129, 0.15))"
                      : "var(--yellow-bg, rgba(245, 158, 11, 0.15))",
                  color:
                    healthScore !== null && healthScore >= 75
                      ? "var(--green-text, #10B981)"
                      : "var(--yellow-text, #F59E0B)",
                  fontWeight: 700
                }}
              >
                {rsAgentDiagnosis.status.toUpperCase()}
              </span>
            </div>

            <div
              style={{
                background: "var(--surface-raised, rgba(255,255,255,0.03))",
                padding: "16px",
                borderRadius: "8px",
                fontSize: "13px",
                lineHeight: "1.6",
                color: "var(--ink)",
                marginBottom: "20px",
                border: "1px solid var(--line)"
              }}
            >
              {rsAgentDiagnosis.summary}
            </div>

            <h3 style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1.2px", color: "var(--muted)", marginBottom: "12px" }}>
              Recomendações e Diretrizes Imediatas:
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
              {rsAgentDiagnosis.recommendations.map((rec, i) => (
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
                            ? "var(--red-bg, rgba(239, 68, 68, 0.15))"
                            : rec.priority === "Média"
                            ? "var(--yellow-bg, rgba(245, 158, 11, 0.15))"
                            : "var(--surface-raised, rgba(255, 255, 255, 0.08))",
                        color:
                          rec.priority === "Alta"
                            ? "var(--red-text, #EF4444)"
                            : rec.priority === "Média"
                            ? "var(--yellow-text, #F59E0B)"
                            : "var(--ink)"
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
            {/* Gráfico Adaptativo: Curva ABC no Hub Açaí vs Carteiras Bancárias na RSBUILD */}
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
                            <div style={{ width: "100%", height: "8px", background: "var(--surface-raised, rgba(255,255,255,0.06))", borderRadius: "4px", overflow: "hidden" }}>
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
                      <p>Concentração de faturamento a receber por instituição financeira.</p>
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
                            <div style={{ width: "100%", height: "8px", background: "var(--surface-raised, rgba(255,255,255,0.06))", borderRadius: "4px", overflow: "hidden" }}>
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

            {/* Segurança de Cobrança vs Exposição */}
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Blindagem Jurídica de Cobrança (Lei 5.474/68)</h2>
                  <p>Proporção de faturamento resguardado por comprovantes na doca.</p>
                </div>
                <span className="subtle-tag">SEFAZ / CANHOTOS</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                    <span style={{ color: "var(--green-text, #10B981)", fontWeight: 600 }}>✓ Faturamento Blindado (Apto a Protesto)</span>
                    <strong>{formatCurrency(deliveryMetrics.provenAmount)}</strong>
                  </div>
                  <div style={{ width: "100%", height: "10px", background: "var(--surface-raised, rgba(255,255,255,0.06))", borderRadius: "5px", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${deliveryMetrics.coverageRate}%`,
                        height: "100%",
                        background: "var(--green-text, #10B981)",
                        borderRadius: "5px"
                      }}
                    />
                  </div>
                  <span style={{ fontSize: "10px", color: "var(--muted)", marginTop: "3px", display: "block" }}>
                    {deliveryMetrics.provenCount} de {deliveryMetrics.totalInvoices} entregas com canhoto arquivado.
                  </span>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                    <span style={{ color: "var(--red-text, #EF4444)", fontWeight: 600 }}>⛔ Valor sem metadados completos de entrega</span>
                    <strong>{formatCurrency(deliveryMetrics.atRiskProtestAmount)}</strong>
                  </div>
                  <div style={{ width: "100%", height: "10px", background: "var(--surface-raised, rgba(255,255,255,0.06))", borderRadius: "5px", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${deliveryMetrics.totalInvoices > 0 ? Math.round((incompleteEvidenceCount / deliveryMetrics.totalInvoices) * 100) : 0}%`,
                        height: "100%",
                        background: "var(--red-text, #EF4444)",
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

      {/* ABA 2: PENDÊNCIAS DOCUMENTAIS */}
      {activeSubTab === "auditoria" && (
        <section className="panel" style={{ marginBottom: "24px" }}>
          <div className="panel-heading">
            <div>
              <h2>Auditoria de Risco Jurídico de Cobrança</h2>
              <p>Notas fiscais que necessitam de intervenção ou arquivamento de comprovante de entrega.</p>
            </div>
            <button className="secondary-button" onClick={() => onNavigateToTab("canhotos")}>
              Ir para Protocolo de Canhotos →
            </button>
          </div>

          <div className="table-wrap">
            <table className="sticky-actions">
              <thead>
                <tr>
                  <th>NF-e / Destinatário</th>
                  <th className="align-right">Valor da Nota</th>
                  <th>Avaliação de risco</th>
                  <th>Fundamentação Legal</th>
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
                          background:
                            ev.risk === "liberado"
                              ? "var(--green-bg, rgba(16, 185, 129, 0.15))"
                              : "var(--red-bg, rgba(239, 68, 68, 0.15))",
                          color:
                            ev.risk === "liberado"
                              ? "var(--green-text, #10B981)"
                              : "var(--red-text, #EF4444)",
                          fontWeight: 700
                        }}
                      >
                        {ev.risk === "liberado" ? "✓ APTO A COBRANÇA" : "⛔ BLOQUEIO PREVENTIVO"}
                      </span>
                    </td>
                    <td style={{ fontSize: "11px", color: "var(--muted)", maxWidth: "300px" }}>{ev.reason}</td>
                    <td>
                      {ev.risk === "bloqueio_preventivo" ? (
                        <span style={{ fontSize: "11px", color: "var(--rsbuild-terracotta)", fontWeight: 600 }}>
                          Reter Duplicata no ERP
                        </span>
                      ) : (
                        <span style={{ fontSize: "11px", color: "var(--green-text, #10B981)", fontWeight: 600 }}>
                          Liberado para Cartório
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ABA 3: ESTEIRA DE SINCRONIZAÇÃO ASSISTIDA ERP */}
      {activeSubTab === "sincronizacao" && (
        <section className="panel" style={{ marginBottom: "24px" }}>
          <div className="panel-heading">
            <div>
              <h2>Integrações e exportações</h2>
              <p>A integração com o Omie ainda não está conectada. Nenhum lote foi enviado ou está aguardando envio.</p>
            </div>
            <button className="secondary-button" type="button" disabled title="A integração Omie ainda não está conectada neste ambiente">
              Integração não disponível
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginTop: "16px" }}>
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

            <div style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "16px", background: "var(--surface)" }}>
              <div style={{ fontSize: "20px", marginBottom: "8px" }}>✓</div>
              <strong style={{ fontSize: "13px", color: "var(--ink)" }}>Lote de Baixas Bancárias</strong>
              <p style={{ fontSize: "11.5px", color: "var(--muted)", margin: "4px 0 12px" }}>
                {matches.filter((m) => m.suggestedStatus === "pronto_para_baixa").length} títulos com correspondência pronta.
              </p>
              <button className="secondary-button" style={{ fontSize: "11px", width: "100%" }} onClick={() => onNavigateToTab("baixas")}>
                Revisar Baixas & Liquidações
              </button>
            </div>

            <div style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "16px", background: "var(--surface)" }}>
              <div style={{ fontSize: "20px", marginBottom: "8px" }}>🛡</div>
              <strong style={{ fontSize: "13px", color: "var(--ink)" }}>Protocolo de Blindagem SEFAZ</strong>
              <p style={{ fontSize: "11.5px", color: "var(--muted)", margin: "4px 0 12px" }}>
                {evaluations.length} notas auditadas contra a Lei de Duplicatas Mercantis.
              </p>
              <button className="secondary-button" style={{ fontSize: "11px", width: "100%" }} onClick={() => onNavigateToTab("canhotos")}>
                Revisar Protocolo de Canhotos
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ABA 4: ZONA DAS SPRINTS - Apenas RSBUILD */}
      {activeSubTab === "sprints" && (
        <section className="panel" style={{ marginBottom: "24px" }}>
          <div className="panel-heading">
            <div>
              <h2>Zona das Sprints - Ciclo 01</h2>
              <p>Acompanhamento do progresso das sprints de Mundo do Sabor e Hub Açaí (09/11 - 04/12/2026).</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "20px", marginTop: "20px" }}>
            {/* Frente A - Mundo do Sabor */}
            <div style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "20px", background: "var(--surface)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <span style={{ fontSize: "24px" }}>🍦</span>
                <div>
                  <h3 style={{ fontSize: "14px", margin: 0, color: "var(--ink)" }}>Frente A - Mundo do Sabor</h3>
                  <p style={{ fontSize: "11px", color: "var(--muted)", margin: "4px 0 0" }}>Engenharia Financeira (ENG-MS-01, ENG-MS-02, ENG-MS-03)</p>
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <strong style={{ fontSize: "12px", color: "var(--ink)" }}>Sprint A1 (09-13/11)</strong>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>4/8 tarefas (50%)</span>
                </div>
                <div style={{ height: "8px", background: "var(--line)", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "50%", background: "var(--rsbuild-terracotta)", borderRadius: "4px" }} />
                </div>
                <div style={{ fontSize: "10px", color: "var(--muted)", marginTop: "4px" }}>
                  ✅ A1.4 Parser OFX · ✅ A1.5 Motor correspondência · ✅ A1.6 Tela conciliação · ✅ A1.7 Trilha auditoria
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <strong style={{ fontSize: "12px", color: "var(--ink)" }}>Sprint A2 (16-19/11)</strong>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>0/7 tarefas (0%)</span>
                </div>
                <div style={{ height: "8px", background: "var(--line)", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "0%", background: "var(--rsbuild-terracotta)", borderRadius: "4px" }} />
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <strong style={{ fontSize: "12px", color: "var(--ink)" }}>Sprint A3 (23-27/11)</strong>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>0/6 tarefas (0%)</span>
                </div>
                <div style={{ height: "8px", background: "var(--line)", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "0%", background: "var(--rsbuild-terracotta)", borderRadius: "4px" }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <strong style={{ fontSize: "12px", color: "var(--ink)" }}>Sprint A4 (30/11-04/12)</strong>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>0/6 tarefas (0%)</span>
                </div>
                <div style={{ height: "8px", background: "var(--line)", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "0%", background: "var(--rsbuild-terracotta)", borderRadius: "4px" }} />
                </div>
              </div>
            </div>

            {/* Frente B - Hub Açaí */}
            <div style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "20px", background: "var(--surface)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <span style={{ fontSize: "24px" }}>🍨</span>
                <div>
                  <h3 style={{ fontSize: "14px", margin: 0, color: "var(--ink)" }}>Frente B - Hub Açaí</h3>
                  <p style={{ fontSize: "11px", color: "var(--muted)", margin: "4px 0 0" }}>Engenharia Logística (ENG-HA-01, H1-H4)</p>
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <strong style={{ fontSize: "12px", color: "var(--ink)" }}>Sprint H1 (09-13/11)</strong>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>0/6 tarefas (0%)</span>
                </div>
                <div style={{ height: "8px", background: "var(--line)", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "0%", background: "var(--rsbuild-terracotta)", borderRadius: "4px" }} />
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <strong style={{ fontSize: "12px", color: "var(--ink)" }}>Sprint H2 (16-19/11)</strong>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>0/6 tarefas (0%)</span>
                </div>
                <div style={{ height: "8px", background: "var(--line)", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "0%", background: "var(--rsbuild-terracotta)", borderRadius: "4px" }} />
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <strong style={{ fontSize: "12px", color: "var(--ink)" }}>Sprint H3 (23-27/11)</strong>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>0/5 tarefas (0%)</span>
                </div>
                <div style={{ height: "8px", background: "var(--line)", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "0%", background: "var(--rsbuild-terracotta)", borderRadius: "4px" }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <strong style={{ fontSize: "12px", color: "var(--ink)" }}>Sprint H4 (30/11-04/12)</strong>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>0/6 tarefas (0%)</span>
                </div>
                <div style={{ height: "8px", background: "var(--line)", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "0%", background: "var(--rsbuild-terracotta)", borderRadius: "4px" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Status Geral */}
          <div style={{ marginTop: "24px", padding: "16px", background: "var(--surface-raised, rgba(255,255,255,0.03))", borderRadius: "8px", border: "1px solid var(--line)" }}>
            <h3 style={{ fontSize: "13px", margin: "0 0 12px 0", color: "var(--ink)" }}>Status Geral do Ciclo 01</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              <div>
                <div style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "4px" }}>Progresso Total</div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--ink)" }}>4/26</div>
                <div style={{ fontSize: "11px", color: "var(--muted)" }}>tarefas (15%)</div>
              </div>
              <div>
                <div style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "4px" }}>Bloqueadores</div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--red-text, #EF4444)" }}>7</div>
                <div style={{ fontSize: "11px", color: "var(--muted)" }}>dependências externas</div>
              </div>
              <div>
                <div style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "4px" }}>Frente A</div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--rsbuild-terracotta)" }}>50%</div>
                <div style={{ fontSize: "11px", color: "var(--muted)" }}>Sprint A1 completa</div>
              </div>
              <div>
                <div style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "4px" }}>Frente B</div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--yellow-text, #F59E0B)" }}>0%</div>
                <div style={{ fontSize: "11px", color: "var(--muted)" }}>Aguardando decisões</div>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="inline-note">
        <strong>Diretriz de governança:</strong> os resultados exibidos são cálculos auxiliares sobre os registros disponíveis nesta sessão. Não substituem revisão profissional, homologação jurídica ou integração com sistemas de origem.
      </div>
    </>
  );
}
