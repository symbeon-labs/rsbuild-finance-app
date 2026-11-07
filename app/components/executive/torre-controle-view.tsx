"use client";

import { useMemo, useState } from "react";
import { FinancialRecord, formatCurrency } from "@/lib/finance";
import { ReceivableTitle, ReconciliationMatch } from "@/lib/reconciliation";
import { DeliveryProof, DeliveryMetrics, ProtestoEvaluation } from "@/lib/delivery";
import { ParsedWhatsAppOrder } from "@/lib/orders";
import { Metric } from "@/app/components/finance/common";

interface TorreControleViewProps {
  isDirector: boolean;
  currentUserEmail: string;
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
  onNavigateToTab: (tab: any) => void;
}

export function TorreControleView({
  isDirector,
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
  onNavigateToTab
}: TorreControleViewProps) {
  const [copiedMemo, setCopiedMemo] = useState(false);

  // Score de Saúde Operacional RSBUILD (0-100)
  const atRiskProtestCount = useMemo(
    () => evaluations.filter((e) => e.risk === "bloqueio_preventivo").length,
    [evaluations]
  );

  const healthScore = useMemo(() => {
    const coverageScore = deliveryMetrics.coverageRate || 0; // peso 40%
    const readySettlements = matches.filter((m) => m.suggestedStatus === "pronto_para_baixa").length;
    const reconcilRate = titles.length > 0 ? Math.round((readySettlements / titles.length) * 100) : 100; // peso 35%
    const logisticsEfficiency = Math.min(100, hubAcaiMetrics.hrOccupancy || 0); // peso 25%

    const score = Math.round(coverageScore * 0.4 + reconcilRate * 0.35 + logisticsEfficiency * 0.25);
    return Math.max(0, Math.min(100, score));
  }, [deliveryMetrics, matches, titles, hubAcaiMetrics]);

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

  // Diagnóstico Narrativo Gerado pelo Copiloto de IA
  const aiExecutiveDiagnosis = useMemo(() => {
    const revenueFormatted = formatCurrency(hubAcaiMetrics.totalRevenue);
    const balanceFormatted = formatCurrency(totals.balance);
    const riskAmountFormatted = formatCurrency(deliveryMetrics.atRiskProtestAmount);

    let healthStatus = "Estável e Saudável";
    if (healthScore < 50) healthStatus = "Crítico - Exige Intervenção Imediata";
    else if (healthScore < 75) healthStatus = "Atenção a Gargalos Logísticos e Fiscais";

    const topFlavor = flavorsBreakdown[0]?.flavor || "Tradicional";
    const topFlavorShare = hubAcaiMetrics.totalBoxes > 0
      ? Math.round(((flavorsBreakdown[0]?.boxes || 0) / hubAcaiMetrics.totalBoxes) * 100)
      : 0;

    return {
      status: healthStatus,
      summary: `A operação apresenta índice de conformidade global de ${healthScore}%. No comercial, foram consolidadas ${hubAcaiMetrics.totalBoxes} caixas em ${hubAcaiMetrics.totalOrders} pedidos (${revenueFormatted}), com o sabor '${topFlavor}' liderando ${topFlavorShare}% da demanda. A frota de entrega (Caminhão HR) atingiu ${hubAcaiMetrics.hrOccupancy}% da cubagem programada. No financeiro, há ${riskAmountFormatted} exposto a risco de litígio por falta de canhoto, recomendando-se retenção de duplicatas antes do envio ao cartório.`,
      recommendations: [
        {
          priority: "Alta",
          action: "Blindagem de Cobrança",
          detail: `Existem ${atRiskProtestCount} nota(s) fiscal(is) sem canhoto de entrega na doca. Bloquear envio coercitivo ao Omie até confirmação do sacado.`
        },
        {
          priority: "Média",
          action: "Otimização de Rota",
          detail: hubAcaiMetrics.hrOccupancy > 85
            ? "Caminhão HR operando próximo do teto (350 caixas). Avaliar alocação de veículo auxiliar para pedidos excedentes."
            : "Ocupação da rota favorável. Margem disponível para acolher novos pedidos no mesmo frete."
        },
        {
          priority: "Estratégica",
          action: "Conciliação & Baixa em Lote",
          detail: `${matches.filter((m) => m.suggestedStatus === "pronto_para_baixa").length} títulos prontos para liquidação contábil imediata no Omie.`
        }
      ]
    };
  }, [healthScore, hubAcaiMetrics, totals, deliveryMetrics, flavorsBreakdown, matches]);

  function handleCopyMemo() {
    const memoText = `*MEMORANDO EXECUTIVO · RSBUILD OS*\n` +
      `Data: ${new Date().toLocaleDateString("pt-BR")}\n` +
      `Score Operacional: ${healthScore}%\n` +
      `Faturamento Pedidos: ${formatCurrency(hubAcaiMetrics.totalRevenue)} (${hubAcaiMetrics.totalBoxes} caixas)\n` +
      `Ocupação Frota HR: ${hubAcaiMetrics.hrOccupancy}%\n` +
      `Faturas sob Risco Jurídico: ${formatCurrency(deliveryMetrics.atRiskProtestAmount)}\n\n` +
      `*Diagnóstico da IA:*\n${aiExecutiveDiagnosis.summary}\n\n` +
      `_Gerado pela Torre de Controle RSBUILD OS_`;

    navigator.clipboard.writeText(memoText);
    setCopiedMemo(true);
    setTimeout(() => setCopiedMemo(false), 3000);
  }

  // Se o usuário não for diretor/superadmin autorizado:
  if (!isDirector) {
    return (
      <div className="panel" style={{ padding: "48px 32px", textAlign: "center", maxWidth: "600px", margin: "40px auto" }}>
        <div style={{ fontSize: "40px", marginBottom: "16px" }}>🔒</div>
        <div className="eyebrow" style={{ color: "var(--red-text, #991B1B)" }}>GOVERNANÇA & RESTRIÇÃO DE ALÇADA</div>
        <h2 style={{ fontSize: "20px", marginTop: "8px", marginBottom: "12px" }}>Acesso Restrito à Diretoria Executiva</h2>
        <p style={{ color: "var(--muted)", fontSize: "13px", lineHeight: "1.6", marginBottom: "24px" }}>
          Esta visão consolida métricas estratégicas de margem, exposição jurídica e resultados globais da organização. 
          Seu usuário atual (<code>{currentUserEmail || "Operador"}</code>) não possui nível de acesso C-Level cadastrado.
        </p>
        <button className="primary-button" onClick={() => onNavigateToTab("visao-geral")}>
          Voltar para Visão Geral Operacional
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>INTELIGÊNCIA EXECUTIVA · C-LEVEL & CONTROLADORIA</span>
            <span
              className="status-pill"
              style={{
                background: "var(--surface-raised, #F1F5F9)",
                color: "var(--rsbuild-terracotta)",
                border: "1px solid var(--line)",
                fontWeight: 700,
                fontSize: "9px"
              }}
            >
              🔒 AUDITORIA ATIVA
            </span>
          </div>
          <h1>Torre de Controle Operacional</h1>
          <p>
            Visão estratégica consolidada de faturamento, ocupação logística e blindagem jurídica com copiloto de IA.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="secondary-button" onClick={handleCopyMemo}>
            {copiedMemo ? "✓ Memorando Copiado!" : "📋 Copiar Resumo Executivo"}
          </button>
        </div>
      </div>

      {/* Grid de KPIs Macro */}
      <div className="metric-grid">
        <Metric
          label="Score de Saúde Global"
          value={`${healthScore}%`}
          tone={healthScore >= 75 ? "positive" : healthScore >= 50 ? "neutral" : "negative"}
          detail={`Conformidade cruzada: ${aiExecutiveDiagnosis.status}`}
          icon="⎈"
        />
        <Metric
          label="Faturamento do Dia (Vendas)"
          value={formatCurrency(hubAcaiMetrics.totalRevenue)}
          tone="positive"
          detail={`${hubAcaiMetrics.totalBoxes} caixas em ${hubAcaiMetrics.totalOrders} pedidos decifrados`}
          icon="💰"
        />
        <Metric
          label="Ocupação Frota de Entrega"
          value={`${hubAcaiMetrics.hrOccupancy}%`}
          tone={hubAcaiMetrics.hrOccupancy > 90 ? "negative" : "positive"}
          detail={`${hubAcaiMetrics.totalBoxes} de 350 caixas (Caminhão HR)`}
          icon="🚚"
        />
        <Metric
          label="Exposição sob Risco Fiscal"
          value={formatCurrency(deliveryMetrics.atRiskProtestAmount)}
          tone={deliveryMetrics.atRiskProtestAmount > 0 ? "negative" : "positive"}
          detail={`${atRiskProtestCount} fatura(s) sem canhoto retido`}
          icon="🛡"
        />
      </div>

      {/* Painel do Copiloto de Inteligência Executiva */}
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
              <h2>Parecer Estratégico do Copiloto de IA</h2>
            </div>
            <p>Diagnóstico sintetizado em tempo real para auxílio à tomada de decisão da diretoria.</p>
          </div>
          <span
            className="status-pill"
            style={{
              background: healthScore >= 75 ? "var(--green-bg, #DCFCE7)" : "var(--yellow-bg, #FEF3C7)",
              color: healthScore >= 75 ? "var(--green-text, #15803D)" : "var(--yellow-text, #92400E)",
              fontWeight: 700
            }}
          >
            SITUAÇÃO: {aiExecutiveDiagnosis.status.toUpperCase()}
          </span>
        </div>

        <div
          style={{
            background: "var(--surface-raised, rgba(0,0,0,0.02))",
            padding: "16px",
            borderRadius: "8px",
            fontSize: "13px",
            lineHeight: "1.6",
            color: "var(--ink)",
            marginBottom: "16px",
            border: "1px solid var(--line)"
          }}
        >
          {aiExecutiveDiagnosis.summary}
        </div>

        <h3 style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)", marginBottom: "12px" }}>
          Recomendações e Diretrizes Imediatas:
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
          {aiExecutiveDiagnosis.recommendations.map((rec, i) => (
            <div
              key={i}
              style={{
                border: "1px solid var(--line)",
                borderRadius: "8px",
                padding: "12px",
                background: "var(--surface)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <strong style={{ fontSize: "12px", color: "var(--ink)" }}>{rec.action}</strong>
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background:
                      rec.priority === "Alta"
                        ? "var(--red-bg, #FEE2E2)"
                        : rec.priority === "Média"
                        ? "var(--yellow-bg, #FEF3C7)"
                        : "var(--surface-raised, #F1F5F9)",
                    color:
                      rec.priority === "Alta"
                        ? "var(--red-text, #991B1B)"
                        : rec.priority === "Média"
                        ? "var(--yellow-text, #92400E)"
                        : "var(--ink)"
                  }}
                >
                  Prioridade {rec.priority}
                </span>
              </div>
              <p style={{ fontSize: "11.5px", color: "var(--muted)", margin: 0, lineHeight: "1.5" }}>{rec.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Gráficos Estratégicos Cruzados */}
      <div className="dashboard-grid" style={{ marginBottom: "24px" }}>
        {/* Curva de Giro por Sabor */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Distribuição de Demanda por Sabor (Curva ABC)</h2>
              <p>Volumes físicos decifrados dos pedidos do WhatsApp para carregamento.</p>
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
                    <div style={{ width: "100%", height: "8px", background: "var(--surface-raised, #E2E8F0)", borderRadius: "4px", overflow: "hidden" }}>
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
        </section>

        {/* Segurança de Cobrança vs Exposição */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Blindagem Jurídica de Faturamento (Lei 5.474/68)</h2>
              <p>Proporção de notas fiscais aptas a protesto versus bloqueio preventivo.</p>
            </div>
            <span className="subtle-tag">SEFAZ / CANHOTOS</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                <span style={{ color: "var(--green-text, #166534)", fontWeight: 600 }}>✓ Faturamento Apto a Protesto</span>
                <strong>{formatCurrency(deliveryMetrics.provenAmount)}</strong>
              </div>
              <div style={{ width: "100%", height: "10px", background: "var(--surface-raised, #E2E8F0)", borderRadius: "5px", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${deliveryMetrics.coverageRate}%`,
                    height: "100%",
                    background: "var(--green-text, #166534)",
                    borderRadius: "5px"
                  }}
                />
              </div>
              <span style={{ fontSize: "10px", color: "var(--muted)", marginTop: "2px", display: "block" }}>
                {deliveryMetrics.provenCount} de {deliveryMetrics.totalInvoices} entregas com canhoto devidamente arquivado.
              </span>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                <span style={{ color: "var(--red-text, #991B1B)", fontWeight: 600 }}>⛔ Risco de Protesto / Extraviado</span>
                <strong>{formatCurrency(deliveryMetrics.atRiskProtestAmount)}</strong>
              </div>
              <div style={{ width: "100%", height: "10px", background: "var(--surface-raised, #E2E8F0)", borderRadius: "5px", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${deliveryMetrics.totalInvoices > 0 ? Math.round((atRiskProtestCount / deliveryMetrics.totalInvoices) * 100) : 0}%`,
                    height: "100%",
                    background: "var(--red-text, #991B1B)",
                    borderRadius: "5px"
                  }}
                />
              </div>
              <span style={{ fontSize: "10px", color: "var(--muted)", marginTop: "2px", display: "block" }}>
                {atRiskProtestCount} fatura(s) com bloqueio de cobrança jurídica coercitiva.
              </span>
            </div>
          </div>
        </section>
      </div>

      <div className="inline-note">
        <strong>Diretriz de Governança Executiva:</strong> A Torre de Controle consolida a verdade operacional da empresa através do cruzamento entre os pedidos decifrados no atendimento, a capacidade dos veículos na doca e os extratos financeiros bancários, eliminando a dependência de planilhas manuais e antecipando riscos antes da conciliação no ERP.
      </div>
    </>
  );
}

