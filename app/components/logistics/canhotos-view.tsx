"use client";

import { ChangeEvent, useRef } from "react";
import {
  DeliveryProof,
  DeliveryMetrics,
  ProtestoEvaluation
} from "@/lib/delivery";
import { formatCurrency, formatDate } from "@/lib/finance";
import { Metric, EmptyState } from "@/app/components/finance/common";

interface CanhotosViewProps {
  proofs: DeliveryProof[];
  deliveryMetrics: DeliveryMetrics;
  evaluations: ProtestoEvaluation[];
  onImportProofsFile: (file: File) => void;
  onExportBlindage: () => void;
  onConfirmReceipt: (proofId: string) => void;
}

export function CanhotosView({
  proofs,
  deliveryMetrics,
  evaluations,
  onImportProofsFile,
  onExportBlindage,
  onConfirmReceipt
}: CanhotosViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onImportProofsFile(file);
      e.target.value = "";
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">RASTREABILIDADE DE ENTREGA & CONFORMIDADE</div>
          <h1>Protocolo Digital de Comprovantes & Canhotos</h1>
          <p>
            Indexação de comprovantes de entrega da expedição e blindagem jurídica preventiva contra protestos indevidos (Lei nº 5.474/1968).
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="secondary-button" onClick={() => fileInputRef.current?.click()}>
            <span>⇧</span> Importar Canhotos (CSV)
          </button>
          <button className="primary-button" onClick={onExportBlindage}>
            <span>⤓</span> Exportar Protocolo de Blindagem
          </button>
        </div>
      </div>

      <div className="inline-note" style={{ marginTop: "12px" }}>Os comprovantes importados e as conferências desta tela permanecem apenas na sessão atual. A tela não autentica assinatura, não comprova entrega por conta própria e não libera protesto ou cobrança.</div>

      <div className="metric-grid">
        <Metric
          label="Taxa de Comprovação"
          value={deliveryMetrics.totalInvoices > 0 ? `${deliveryMetrics.coverageRate}%` : "—"}
          tone={deliveryMetrics.totalInvoices > 0 ? (deliveryMetrics.coverageRate >= 80 ? "positive" : "negative") : "neutral"}
          detail={deliveryMetrics.totalInvoices > 0 ? `${deliveryMetrics.provenCount} de ${deliveryMetrics.totalInvoices} registros marcados como comprovados` : "Nenhum comprovante importado"}
          icon="✓"
        />
        <Metric
          label="Faturamento Blindado"
          value={formatCurrency(deliveryMetrics.provenAmount)}
          tone={deliveryMetrics.totalInvoices > 0 ? "positive" : "neutral"}
          detail="Valor associado aos registros marcados como comprovados; exige validação documental"
          icon="🛡"
        />
        <Metric
          label="Risco de Protesto / Sem Canhoto"
          value={formatCurrency(deliveryMetrics.atRiskProtestAmount)}
          tone={deliveryMetrics.totalInvoices > 0 ? "negative" : "neutral"}
          detail={deliveryMetrics.totalInvoices > 0 ? "Estimativa baseada nos registros importados; não é bloqueio jurídico externo" : "Sem dados para avaliar risco"}
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
            <p>Acompanhamento dos dados de entrega, identificação de recebedores e pendências documentais.</p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            
          </div>
        </div>

        {proofs.length > 0 ? (
          <div className="table-wrap">
            <table className="sticky-actions">
              <thead>
                <tr>
                  <th>NF-e / Chave</th>
                  <th>Cliente / Destinatário</th>
                  <th className="align-right">Valor NF</th>
                  <th>Motorista / Rota</th>
                  <th>Status Entrega</th>
                  <th>Status da Evidência</th>
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
                          <span style={{ display: "block", fontSize: "10px", color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
                            SEFAZ: {p.nfeKey.slice(0, 10)}...{p.nfeKey.slice(-6)}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="description-cell">{p.customerName}</div>
                      </td>
                      <td className="align-right font-semibold">{formatCurrency(p.nfeAmount)}</td>
                      <td>{p.driverName || "Frota Interna"}</td>
                      <td>
                        <span
                          className="status-pill"
                          style={{
                            background: isProven
                              ? "var(--green-bg, #DCFCE7)"
                              : isRejected || isLost
                              ? "var(--red-bg, #FEE2E2)"
                              : "var(--yellow-bg, #FEF3C7)",
                            color: isProven
                              ? "var(--green-text, #166534)"
                              : isRejected || isLost
                              ? "var(--red-text, #991B1B)"
                              : "var(--yellow-text, #854D0E)"
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
                              background:
                                evaluation?.risk === "liberado"
                                  ? "var(--green-bg, #DCFCE7)"
                                  : evaluation?.risk === "bloqueio_preventivo"
                                  ? "var(--red-bg, #FEE2E2)"
                                  : "var(--yellow-bg, #FEF3C7)",
                              color:
                                evaluation?.risk === "liberado"
                                  ? "var(--green-text, #166534)"
                                  : evaluation?.risk === "bloqueio_preventivo"
                                  ? "var(--red-text, #991B1B)"
                                  : "var(--yellow-text, #854D0E)",
                              fontWeight: 700
                            }}
                          >
                            {evaluation?.risk === "liberado"
                              ? "✓ Evidência cadastrada"
                              : evaluation?.risk === "bloqueio_preventivo"
                              ? "⛔ Revisão necessária"
                              : "⚠ Conferir prazo e evidência"}
                          </span>
                          <span style={{ display: "block", fontSize: "10px", color: "var(--muted)", marginTop: "4px", maxWidth: "260px", whiteSpace: "normal" }}>
                            {evaluation?.reason}
                          </span>
                        </div>
                      </td>
                      <td>
                        {p.receiverName ? (
                          <div>
                            <strong style={{ fontSize: "11px", color: "var(--ink)" }}>{p.receiverName}</strong>
                            <span style={{ display: "block", fontSize: "10px", color: "var(--muted)" }}>
                              {p.deliveryDate ? formatDate(p.deliveryDate) : "Data não informada"} {p.receiverDocument ? `· ${p.receiverDocument}` : ""}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: "var(--muted)", fontStyle: "italic", fontSize: "11px" }}>Aguardando assinatura</span>
                        )}
                      </td>
                      <td>
                        {!isProven ? (
                          <button
                            className="secondary-button"
                            style={{ fontSize: "10px", padding: "6px 10px" }}
                            onClick={() => onConfirmReceipt(p.id)}
                            title="Registrar conferência temporária; não substitui evidência válida nem libera cobrança ou protesto"
                          >
                            Conferir dados
                          </button>
                        ) : (
                          <span style={{ fontSize: "11px", color: "var(--green-text, #15803D)", fontWeight: 600 }}>Arquivado</span>
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
            title="Nenhum comprovante carregado"
            text="Importe uma planilha de expedição autorizada. Não há registros operacionais disponíveis neste workspace."
          />
        )}
      </section>

      <div className="inline-note" style={{ marginTop: "16px" }}>
        <strong>Fundamentação Jurídica (Lei nº 5.474/1968, Art. 15):</strong> A duplicata mercantil não aceita só é legalmente passível de protesto e execução judicial mediante comprovação da entrega e recebimento efetivo das mercadorias (canhoto assinado pelo sacado). O protocolo digital impede que títulos com canhotos pendentes, extraviados ou em devolução sigam para cobrança coercitiva, eliminando riscos de litígios e processos por protesto indevido.
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden-input"
        onChange={handleFileChange}
      />
    </>
  );
}
