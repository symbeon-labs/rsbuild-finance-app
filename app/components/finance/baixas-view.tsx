"use client";

import { useRef } from "react";
import { formatCurrency, formatDate } from "@/lib/finance";
import { ReceivableTitle, ReconciliationMatch } from "@/lib/reconciliation";
import { canApproveBatchSettlement, getRoleMetadata } from "@/lib/permissions";
import { Metric, EmptyState } from "./common";

interface BaixasViewProps {
  titles: ReceivableTitle[];
  matches: ReconciliationMatch[];
  matchStats: {
    ready: ReconciliationMatch[];
    divergent: ReconciliationMatch[];
    pending: ReconciliationMatch[];
    totalReadyAmount: number;
  };
  role?: string;
  onReloadSample: () => void;
  onImportTitlesFile: (file: File) => void;
  onConfirmSettlementInSession: () => void;
  onExportBatchSettlement: () => void;
}

export function BaixasView({
  titles,
  matches,
  matchStats,
  role,
  onReloadSample,
  onImportTitlesFile,
  onConfirmSettlementInSession,
  onExportBatchSettlement
}: BaixasViewProps) {
  const titlesInputRef = useRef<HTMLInputElement>(null);
  const hasSettlementAuth = canApproveBatchSettlement(role);
  const roleMeta = getRoleMetadata(role);

  return (
    <>
      {/* Hidden Input for CSV upload */}
      <input
        type="file"
        ref={titlesInputRef}
        style={{ display: "none" }}
        accept=".csv,text/csv"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImportTitlesFile(file);
        }}
      />

      <div className="page-heading">
        <div>
          <div className="eyebrow">INTEGRAÇÃO ERP · LIQUIDAÇÃO</div>
          <h1>Baixas & Conciliação de Títulos</h1>
          <p>Conciliação inteligente e liquidação de contas a receber sem arrastar cards manuais no ERP.</p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            className="secondary-button"
            onClick={onReloadSample}
            title="Recarregar títulos exemplo para teste"
          >
            ⚡ Carregar Exemplo
          </button>
          <button className="secondary-button" onClick={() => titlesInputRef.current?.click()}>
            ＋ Importar Títulos (CSV)
          </button>
          {matchStats.ready.length > 0 && (
            hasSettlementAuth ? (
              <button className="primary-button" onClick={onExportBatchSettlement}>
                📥 Gerar Lote de Baixas (.CSV)
              </button>
            ) : (
              <button
                className="secondary-button"
                disabled
                title="Alçada Restrita: Exige aprovação de perfil Diretoria (Owner ou Admin) para emitir baixas financeiras no ERP."
                style={{ opacity: 0.6, cursor: "not-allowed", borderStyle: "dashed" }}
              >
                🔒 Baixa Restrita à Diretoria
              </button>
            )
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
              <button className="secondary-button" onClick={onConfirmSettlementInSession} disabled={!hasSettlementAuth} title={!hasSettlementAuth ? "Ação restrita à Diretoria (Owner ou Admin)." : "Marcar títulos como baixados nesta sessão de demonstração."}>
                {hasSettlementAuth ? "Marcar Baixados na Sessão" : "🔒 Baixa Restrita à Diretoria"}
              </button>
              <button className={hasSettlementAuth ? "primary-button" : "secondary-button"} onClick={onExportBatchSettlement} disabled={!hasSettlementAuth} title={!hasSettlementAuth ? "Ação restrita à Diretoria (Owner ou Admin)." : "Gerar arquivo de baixa para importação no Omie."}>
                {hasSettlementAuth ? "⚡ Baixar Lote Oficial Omie (.CSV)" : "🔒 Baixa Restrita à Diretoria"}
              </button>
            </div>
          )}
        </div>

        {titles.length ? (
          <div className="table-wrap">
            <table className="sticky-actions">
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
                          <span style={{ display: "block", fontSize: "11px", color: "var(--muted)" }}>
                            Nosso Nº: {m.title.ourNumber}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="description-cell">{m.title.customerName}</div>
                        <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                          {m.title.bankAccount || "Conta Geral"}
                        </span>
                      </td>
                      <td>{formatDate(m.title.dueDate)}</td>
                      <td className="align-right">{formatCurrency(m.title.amount)}</td>
                      <td>
                        {m.statementRecord ? (
                          <div>
                            <strong style={{ fontSize: "12px", color: "var(--ink)" }}>
                              {formatCurrency(m.statementRecord.amount)} em {formatDate(m.statementRecord.date)}
                            </strong>
                            <span style={{ display: "block", fontSize: "11px", color: "var(--muted)" }}>
                              {m.statementRecord.source} · {m.statementRecord.sourceRecordId ? `FITID: ${m.statementRecord.sourceRecordId}` : ""}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: "var(--muted)", fontStyle: "italic", fontSize: "12px" }}>
                            Nenhuma entrada compatível
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className="status-pill"
                          style={{
                            background: m.confidence === "exato" || m.confidence === "documental" ? "rgba(22, 132, 92, 0.15)" : m.confidence === "aproximado" ? "rgba(234, 179, 8, 0.15)" : "var(--bg)",
                            color: m.confidence === "exato" || m.confidence === "documental" ? "var(--green)" : m.confidence === "aproximado" ? "#B45309" : "var(--muted)",
                            borderColor: m.confidence === "exato" || m.confidence === "documental" ? "var(--green)" : m.confidence === "aproximado" ? "#F59E0B" : "var(--line)"
                          }}
                        >
                          {m.confidence === "exato" ? "Exato (100%)" : m.confidence === "documental" ? "Documental" : m.confidence === "aproximado" ? "Aproximado" : "Pendente"}
                        </span>
                      </td>
                      <td>
                        {m.amountDifference !== 0 ? (
                          <span style={{ color: m.amountDifference > 0 ? "var(--red)" : "#2563EB", fontWeight: 600, fontSize: "12px" }}>
                            {m.amountDifference > 0 ? `+ ${formatCurrency(m.amountDifference)} (Juros)` : `- ${formatCurrency(Math.abs(m.amountDifference))} (Desc.)`}
                          </span>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: "12px" }}>—</span>
                        )}
                      </td>
                      <td>
                        {m.title.status === "baixado" ? (
                          <span className="status-pill" style={{ background: "var(--bg)", color: "var(--muted)" }}>
                            Baixado
                          </span>
                        ) : isReady ? (
                          <span className="status-pill" style={{ background: "rgba(22, 132, 92, 0.15)", color: "var(--green)", borderColor: "var(--green)" }}>
                            Pronto p/ Baixa
                          </span>
                        ) : isDivergent ? (
                          <span className="status-pill" style={{ background: "rgba(234, 179, 8, 0.15)", color: "#B45309", borderColor: "#F59E0B" }}>
                            Revisar Diferença
                          </span>
                        ) : (
                          <span className="status-pill" style={{ background: "var(--bg)", color: "var(--muted)" }}>
                            Aguardando
                          </span>
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
            onAction={onReloadSample}
          />
        )}
      </section>

      <div className="inline-note" style={{ marginTop: "16px" }}>
        <strong>Diretriz de Liquidação Assistida:</strong> O motor de conciliação assistida gera o lote de liquidação e o arquivo de importação oficial para o ERP sem intervenção manual de arraste de cards, preservando a alçada de aprovação do operador financeiro antes da efetivação bancária.
      </div>
    </>
  );
}

