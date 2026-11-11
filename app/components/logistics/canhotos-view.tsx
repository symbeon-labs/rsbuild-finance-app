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
            Organização de registros de entrega, metadados de recebedores e pendências para revisão humana.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="secondary-button" onClick={() => fileInputRef.current?.click()}>
            <span>⇧</span> Importar Canhotos (CSV)
          </button>
          <button className="primary-button" onClick={onExportBlindage}>
            <span>⤓</span> Exportar relatório de evidências
          </button>
        </div>
      </div>

      <div className="inline-note" style={{ marginTop: "12px" }}>Os comprovantes importados e as conferências desta tela permanecem apenas na sessão atual. A tela não autentica assinatura, não comprova entrega por conta própria e não libera protesto ou cobrança.</div>

      <div className="metric-grid">
        <Metric
          label="Cobertura de metadados"
          value={deliveryMetrics.totalInvoices > 0 ? `${deliveryMetrics.coverageRate}%` : "—"}
          tone={deliveryMetrics.totalInvoices > 0 ? (deliveryMetrics.coverageRate >= 80 ? "positive" : "negative") : "neutral"}
          detail={deliveryMetrics.totalInvoices > 0 ? `${deliveryMetrics.provenCount} de ${deliveryMetrics.totalInvoices} registros com metadados completos; autenticidade não verificada` : "Nenhum comprovante importado"}
          icon="✓"
        />
        <Metric
          label="Valor com metadados completos"
          value={formatCurrency(deliveryMetrics.provenAmount)}
          tone={deliveryMetrics.totalInvoices > 0 ? "positive" : "neutral"}
          detail="Valor associado a registros com metadados completos; não representa autenticação da evidência"
          icon="🛡"
        />
        <Metric
          label="Exposição documental estimada"
          value={formatCurrency(deliveryMetrics.atRiskProtestAmount)}
          tone={deliveryMetrics.totalInvoices > 0 ? "negative" : "neutral"}
          detail={deliveryMetrics.totalInvoices > 0 ? "Estimativa baseada nos registros importados; não representa ação externa" : "Sem dados para estimar pendências documentais"}
          icon="⚠"
        />
        <Metric
          label="Pendência documental"
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
                  const isMarkedProven = p.status === "comprovado";
                  const hasCompleteEvidenceMetadata = evaluation?.risk === "metadata_complete";
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
                            background: hasCompleteEvidenceMetadata
                              ? "var(--surface-raised, rgba(255,255,255,0.06))"
                              : isRejected || isLost
                              ? "var(--red-bg, #FEE2E2)"
                              : "var(--yellow-bg, #FEF3C7)",
                            color: hasCompleteEvidenceMetadata
                              ? "var(--ink)"
                              : isRejected || isLost
                              ? "var(--ink)"
                              : "var(--ink)"
                          }}
                        >
                          {hasCompleteEvidenceMetadata ? "Metadados completos" : isMarkedProven ? "Marcado como comprovado · dados incompletos" : isRejected ? "Recusa / Avaria" : isLost ? "Extraviado" : "Em Trânsito"}
                        </span>
                      </td>
                      <td>
                        <div>
                          <span
                            className="status-pill"
                            style={{
                              background:
                                "var(--surface-raised, rgba(255,255,255,0.06))",
                              color:
                                evaluation?.risk === "metadata_complete"
                                  ? "var(--ink)"
                                  : evaluation?.risk === "priority_review"
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
                        {!hasCompleteEvidenceMetadata ? (
                          <button
                            className="secondary-button"
                            style={{ fontSize: "10px", padding: "6px 10px" }}
                            onClick={() => onConfirmReceipt(p.id)}
                            title="Marca o registro como conferido nesta sessão; não autentica arquivo ou assinatura"
                          >
                            Marcar conferido na sessão
                          </button>
                        ) : (
                          <span style={{ fontSize: "11px", color: "var(--green-text, #15803D)", fontWeight: 600 }}>Metadados cadastrados</span>
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
        <strong>Limite operacional:</strong> esta tela organiza metadados e referências de evidências informadas pelos usuários. Não autentica arquivos ou assinaturas, não conclui sobre entrega efetiva e não determina, bloqueia ou autoriza cobrança ou protesto. Toda decisão depende de revisão humana e dos sistemas de origem.
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
