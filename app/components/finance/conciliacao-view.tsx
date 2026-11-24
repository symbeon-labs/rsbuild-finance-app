"use client";

import { Fragment, useState, useMemo, useRef, useEffect } from "react";
import {
  FinancialRecord,
  OmieRecord,
  matchRecords,
  manualMatch,
  unmatchRecord,
  formatCurrency,
  parseOmieMovementsCsv,
  MatchResult
} from "@/lib/finance";
import { detectInternalTransfers } from "@/lib/internal-transfers";
import { suggestOmieCandidates, type OmieCandidate } from "@/lib/reconciliation-suggestions";
import { formatDatePtBr } from "@/lib/date-format";
import {
  canPerformManualMatch,
  canApproveDiscrepantMatch,
  getRoleMetadata
} from "@/lib/permissions";

interface ConciliacaoViewProps {
  bankRecords: FinancialRecord[];
  omieRecords: OmieRecord[];
  author: string;
  role?: string;
  onRecordsUpdated: (records: FinancialRecord[]) => void;
  onImportOmieRecords?: (records: OmieRecord[]) => void;
  onImportOmieRecordsPersist?: (records: OmieRecord[]) => Promise<void>;
  onReconciliationDecision?: (recordId: string, decisionType: "manual_match" | "unmatch", counterpartLabel?: string, justification?: string) => void;
  initialSelectedBankIds?: string[];
}

export function ConciliacaoView({
  bankRecords,
  omieRecords,
  author,
  role,
  onRecordsUpdated,
  onImportOmieRecords,
  onImportOmieRecordsPersist,
  onReconciliationDecision,
  initialSelectedBankIds = []
}: ConciliacaoViewProps) {
  const [selectedTab, setSelectedTab] = useState<"summary" | "matched" | "unmatched" | "transfers">("summary");
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedOmieId, setSelectedOmieId] = useState<string | null>(null);
  const [expandedBankId, setExpandedBankId] = useState<string | null>(null);
  const [manualJustification, setManualJustification] = useState("");
  const [omieImportFeedback, setOmieImportFeedback] = useState("");
  const [batchQueue, setBatchQueue] = useState<string[]>([]);
  const omieInputRef = useRef<HTMLInputElement>(null);
  const canMatch = canPerformManualMatch(role);
  const canApproveDiscrepancy = canApproveDiscrepantMatch(role);
  const roleMeta = getRoleMetadata(role);

  const matchResults = useMemo(() => {
    return matchRecords(bankRecords, omieRecords, author);
  }, [bankRecords, omieRecords, author]);

  const { matched, unmatchedBank, unmatchedOmie } = matchResults;

  useEffect(() => {
    if (!initialSelectedBankIds.length) return;
    const pendingIds = initialSelectedBankIds.filter((id) => unmatchedBank.some((record) => record.id === id));
    setBatchQueue(pendingIds);
    setSelectedBankId(pendingIds[0] ?? null);
    setSelectedOmieId(null);
    setManualJustification("");
    setSelectedTab("unmatched");
  }, [initialSelectedBankIds, unmatchedBank]);

  const suggestionsByBankId = useMemo(() => {
    const map = new Map<string, OmieCandidate[]>();
    for (const record of unmatchedBank) {
      const candidates = suggestOmieCandidates(record, unmatchedOmie, { limit: 3 });
      if (candidates.length) map.set(record.id, candidates);
    }
    return map;
  }, [unmatchedBank, unmatchedOmie]);

  const internalTransfers = useMemo(
    () => detectInternalTransfers(bankRecords),
    [bankRecords]
  );
  const suggestedTransfers = internalTransfers.filter((item) => item.status === "suggested");
  const ambiguousTransfers = internalTransfers.filter((item) => item.status === "ambiguous");

  // Totais por conta
  const accountTotals = useMemo(() => {
    const totals: Record<string, { total: number; matched: number; unmatched: number }> = {};

    for (const record of bankRecords) {
      const key = `${record.bankCode || "banco"}-${record.accountId || "sem-conta"}`;
      if (!totals[key]) {
        totals[key] = { total: 0, matched: 0, unmatched: 0 };
      }
      totals[key].total += record.amount;
      if (record.status === "conciliado") {
        totals[key].matched += record.amount;
      } else {
        totals[key].unmatched += record.amount;
      }
    }

    return totals;
  }, [bankRecords]);

  const handleManualMatch = () => {
    if (!selectedBankId || !selectedOmieId || !manualJustification.trim()) {
      alert("Selecione um registro bancário, um registro Omie e forneça uma justificativa formal para auditoria.");
      return;
    }

    const bankRecord = unmatchedBank.find(r => r.id === selectedBankId);
    const omieRecord = unmatchedOmie.find(r => r.id === selectedOmieId);

    if (!bankRecord || !omieRecord) {
      alert("Registros não encontrados na base.");
      return;
    }

    // Trava de Alçada: Divergência de valores exige perfil executivo (Diretoria/Owner)
    const isDiscrepant = Math.abs(bankRecord.amount - omieRecord.amount) > 0.01;
    if (isDiscrepant && !canApproveDiscrepancy) {
      alert(
        `Alçada de Diretoria Necessária: O valor do extrato (${formatCurrency(bankRecord.amount)}) difere do lançamento Omie (${formatCurrency(omieRecord.amount)}).\n\nConciliações manuais com divergência financeira exigem autorização expressa de perfil Diretoria (Owner ou Admin).`
      );
      return;
    }

    const updated = manualMatch(bankRecord, omieRecord, manualJustification, author);
    const updatedRecords = bankRecords.map(r => r.id === updated.id ? updated : r);
    onRecordsUpdated(updatedRecords);
    onReconciliationDecision?.(
      bankRecord.id,
      "manual_match",
      omieRecord.description,
      manualJustification
    );

    setSelectedBankId(null);
    setSelectedOmieId(null);
    setManualJustification("");
    const remainingBatch = batchQueue.filter((id) => id !== bankRecord.id);
    setBatchQueue(remainingBatch);
    setSelectedBankId(remainingBatch[0] ?? null);
  };

  const handleUnmatch = (bankId: string) => {
    const bankRecord = bankRecords.find(r => r.id === bankId);
    if (!bankRecord) return;

    const updated = unmatchRecord(bankRecord, author);
    const updatedRecords = bankRecords.map(r => r.id === updated.id ? updated : r);
    onRecordsUpdated(updatedRecords);
    onReconciliationDecision?.(bankId, "unmatch");
  };

  const handleOmieFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || (!onImportOmieRecords && !onImportOmieRecordsPersist)) return;
    const text = await file.text();
    const result = parseOmieMovementsCsv(text);
    if (result.records.length) {
      if (onImportOmieRecordsPersist) {
        await onImportOmieRecordsPersist(result.records);
      } else {
        onImportOmieRecords?.(result.records);
      }
      setOmieImportFeedback(`${result.records.length} lançamento(s) Omie carregado(s).`);
    } else {
      setOmieImportFeedback(result.errors[0] || "Nenhum lançamento Omie reconhecido no arquivo.");
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">RECONCILIAÇÃO ERP & EXTRATOS</div>
          <h1>Conciliação Bancária Multicontas</h1>
          <p>Motor autônomo de conferência de extratos bancários contra lançamentos e títulos do Omie ERP com trilha de auditoria imutável.</p>
        </div>
        {(onImportOmieRecords || onImportOmieRecordsPersist) && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
            <input
              ref={omieInputRef}
              type="file"
              accept=".csv,.txt,text/csv"
              className="hidden-input"
              onChange={handleOmieFile}
            />
            <button
              type="button"
              className="secondary-button"
              onClick={() => omieInputRef.current?.click()}
              title="Importa exportação de movimentos do Omie (CSV) e persiste como novo snapshot no servidor."
            >
              Importar lançamentos Omie (CSV)
            </button>
            {omieImportFeedback && (
              <span style={{ fontSize: "11px", color: "var(--muted)", maxWidth: "320px", textAlign: "right" }}>
                {omieImportFeedback}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="tabs">
        <button
          className={selectedTab === "summary" ? "tab-active" : "tab"}
          onClick={() => setSelectedTab("summary")}
        >
          Resumo por Conta
        </button>
        <button
          className={selectedTab === "matched" ? "tab-active" : "tab"}
          onClick={() => setSelectedTab("matched")}
        >
          Casados / Conciliados ({matched.length})
        </button>
        <button
          className={selectedTab === "unmatched" ? "tab-active" : "tab"}
          onClick={() => setSelectedTab("unmatched")}
        >
          Pendentes / Não Casados ({unmatchedBank.length + unmatchedOmie.length})
        </button>
        <button
          className={selectedTab === "transfers" ? "tab-active" : "tab"}
          onClick={() => setSelectedTab("transfers")}
        >
          Transferências sugeridas ({internalTransfers.length})
        </button>
      </div>

      {selectedTab === "summary" && (
        <section className="panel">
          <h2>Totais por Conta Bancária</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Banco</th>
                <th>Conta / Agência</th>
                <th>Total Movimentado</th>
                <th>Conciliado</th>
                <th>Pendente</th>
                <th>% Conciliado</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(accountTotals).length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: "24px" }}>
                    Nenhum registro bancário importado para conciliação.
                  </td>
                </tr>
              ) : (
                Object.entries(accountTotals).map(([key, totals]) => {
                  const [bankCode, accountId] = key.split("-");
                  const bankName = bankRecords.find(r => r.bankCode === bankCode)?.bankName || bankCode;
                  const percentage = totals.total > 0 ? ((totals.matched / totals.total) * 100).toFixed(1) : "0";

                  return (
                    <tr key={key}>
                      <td><strong>{bankName}</strong></td>
                      <td>{accountId}</td>
                      <td>{formatCurrency(totals.total)}</td>
                      <td style={{ color: "var(--rsbuild-green, #10B981)", fontWeight: 600 }}>{formatCurrency(totals.matched)}</td>
                      <td style={{ color: "var(--rsbuild-terracotta)", fontWeight: 600 }}>{formatCurrency(totals.unmatched)}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ flex: 1, height: "6px", background: "var(--line)", borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${percentage}%`, background: "var(--rsbuild-green, #10B981)" }} />
                          </div>
                          <span style={{ fontSize: "11px", fontWeight: 600 }}>{percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      )}

      {selectedTab === "transfers" && (
        <section className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
            <div>
              <h2>Possíveis transferências entre contas próprias</h2>
              <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px" }}>
                O detector compara saídas e entradas pendentes em contas diferentes, considerando valor e proximidade das datas.
                As correspondências são sugestões; não alteram saldos, classificações ou conciliações.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <span className="badge badge-green">{suggestedTransfers.length} candidatas</span>
              <span className="badge badge-blue">{ambiguousTransfers.length} ambíguas</span>
            </div>
          </div>

          {internalTransfers.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--muted)", padding: "28px 12px" }}>
              Nenhuma possível transferência encontrada nos movimentos pendentes carregados.
            </div>
          ) : (
            <div style={{ display: "grid", gap: "12px", marginTop: "18px" }}>
              {internalTransfers.map((transfer) => {
                const outgoingAccount = [transfer.outgoing.bankName || transfer.outgoing.bankCode || "Banco não identificado", transfer.outgoing.accountId || "Conta não identificada"].join(" · ");
                const incomingAccount = [transfer.incoming.bankName || transfer.incoming.bankCode || "Banco não identificado", transfer.incoming.accountId || "Conta não identificada"].join(" · ");
                return (
                  <article key={transfer.id} style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "14px", background: "var(--surface)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
                      <strong style={{ fontSize: "12px" }}>Par de movimentações</strong>
                      <span className={transfer.status === "ambiguous" ? "badge badge-blue" : "badge badge-green"}>
                        {transfer.status === "ambiguous" ? "Revisão necessária · múltiplos pares" : transfer.confidence === "high" ? "Boa aderência" : "Revisar"}
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                      <div style={{ padding: "10px", borderRadius: "6px", background: "var(--surface-raised, rgba(255,255,255,0.04))" }}>
                        <div className="eyebrow">SAÍDA</div>
                        <strong style={{ display: "block", margin: "5px 0" }}>{formatCurrency(transfer.outgoing.amount)}</strong>
                        <div style={{ fontSize: "11px", color: "var(--muted)" }}>{formatDatePtBr(transfer.outgoing.date)} · {outgoingAccount}</div>
                        <div style={{ fontSize: "12px", marginTop: "6px" }}>{transfer.outgoing.description}</div>
                      </div>
                      <div style={{ padding: "10px", borderRadius: "6px", background: "var(--surface-raised, rgba(255,255,255,0.04))" }}>
                        <div className="eyebrow">ENTRADA</div>
                        <strong style={{ display: "block", margin: "5px 0" }}>{formatCurrency(transfer.incoming.amount)}</strong>
                        <div style={{ fontSize: "11px", color: "var(--muted)" }}>{formatDatePtBr(transfer.incoming.date)} · {incomingAccount}</div>
                        <div style={{ fontSize: "12px", marginTop: "6px" }}>{transfer.incoming.description}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginTop: "10px", fontSize: "11px", color: "var(--muted)" }}>
                      <span>Diferença de valor: {formatCurrency(transfer.amountDifference)}</span>
                      <span>Distância entre datas: {transfer.dateDifferenceDays} dia(s)</span>
                    </div>
                    <ul style={{ margin: "10px 0 0", paddingLeft: "18px", fontSize: "11px", color: "var(--muted)" }}>
                      {transfer.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                  </article>
                );
              })}
            </div>
          )}

          <div className="inline-note" style={{ marginTop: "16px" }}>
            Nesta etapa, o sistema apenas apresenta candidatos. Aprovar ou rejeitar exige uma operação auditável no servidor;
            por isso, nenhuma movimentação é reclassificada automaticamente nesta tela.
          </div>
        </section>
      )}

      {selectedTab === "matched" && (
        <section className="panel">
          <h2>Movimentações Casadas & Auditadas</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição Extrato</th>
                <th>Valor Extrato</th>
                <th>Registro Omie</th>
                <th>Valor Omie</th>
                <th>Tipo</th>
                <th>Score</th>
                <th>Justificativa / Trilha</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {matched.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", color: "var(--muted)", padding: "24px" }}>
                    Nenhum lançamento conciliado até o momento.
                  </td>
                </tr>
              ) : (
                matched.map((m, idx) => (
                  <tr key={idx}>
                    <td>{formatDatePtBr(m.bankRecord.date)}</td>
                    <td>{m.bankRecord.description}</td>
                    <td><strong>{formatCurrency(m.bankRecord.amount)}</strong></td>
                    <td>{m.omieRecord?.description || "-"}</td>
                    <td>{formatCurrency(m.omieRecord?.amount || 0)}</td>
                    <td>
                      <span className={`badge ${m.matchType === "automatic" ? "badge-green" : "badge-blue"}`}>
                        {m.matchType === "automatic" ? "Automático" : "Manual"}
                      </span>
                    </td>
                    <td>{m.matchScore ? `${m.matchScore}%` : "-"}</td>
                    <td className="cell-justify" style={{ fontSize: "11px", color: "var(--muted)" }}>
                      {m.matchReason || m.bankRecord.matchJustification || "-"}
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => handleUnmatch(m.bankRecord.id)}
                        title="Desfazer correspondência e retornar a pendente"
                      >
                        Desfazer
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}

      {selectedTab === "unmatched" && (
        <section className="panel">
          <h2>Registros Pendentes de Conciliação</h2>
          <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "16px" }}>
            Selecione uma linha do extrato bancário e uma do Omie ERP para realizar a reconciliação manual com justificativa registrada.
          </p>
          {batchQueue.length > 0 && (
            <div className="inline-note" role="status" style={{ marginBottom: 16 }}>
              Lote recebido do Centro de Operações: <strong>{batchQueue.length} movimentação(ões) pendente(s)</strong>. A conciliação continua individual: confira o par Omie, registre a justificativa e confirme cada decisão. O próximo item será selecionado após cada confirmação.
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
            <div className="unmatched-section">
              <h3 style={{ fontSize: "13px", marginBottom: "8px" }}>Extratos Bancários Pendentes ({unmatchedBank.length})</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: "36px" }}>Sel</th>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Valor</th>
                    <th>Banco</th>
                    <th style={{ width: "90px" }}>Sugestões</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatchedBank.map(record => {
                    const candidates = suggestionsByBankId.get(record.id) ?? [];
                    const expanded = expandedBankId === record.id;
                    return (
                      <Fragment key={record.id}>
                        <tr
                          onClick={() => setSelectedBankId(record.id === selectedBankId ? null : record.id)}
                          style={{ cursor: "pointer", background: selectedBankId === record.id ? "rgba(181, 88, 60, 0.1)" : undefined }}
                        >
                          <td onClick={(e) => e.stopPropagation()}>
                            <input
                              type="radio"
                              name="bankSelection"
                              checked={selectedBankId === record.id}
                              onChange={() => setSelectedBankId(record.id)}
                            />
                          </td>
                          <td>{formatDatePtBr(record.date)}</td>
                          <td style={{ fontSize: "11px" }}>{record.description}</td>
                          <td><strong>{formatCurrency(record.amount)}</strong></td>
                          <td>{record.bankName || "-"}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            {candidates.length > 0 ? (
                              <button
                                type="button"
                                className="text-button"
                                onClick={() => setExpandedBankId(expanded ? null : record.id)}
                                title="Ver lançamentos Omie candidatos com score e evidências"
                              >
                                {expanded ? "Ocultar" : `${candidates.length} cand.`}
                              </button>
                            ) : (
                              <span style={{ fontSize: "11px", color: "var(--muted)" }}>—</span>
                            )}
                          </td>
                        </tr>
                        {expanded && candidates.length > 0 && (
                          <tr key={`${record.id}-candidates`}>
                            <td colSpan={6} style={{ background: "var(--surface-raised, rgba(255,255,255,0.03))", padding: "10px 14px" }}>
                              <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "8px" }}>
                                Candidatos Omie sugeridos pelo motor (valor, data, documento e descrição). A seleção não confirma a conciliação — a confirmação exige justificativa auditada abaixo.
                              </div>
                              <div style={{ display: "grid", gap: "8px" }}>
                                {candidates.map((candidate) => (
                                  <div
                                    key={candidate.omieRecord.id}
                                    style={{
                                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap",
                                      padding: "8px 10px", border: "1px solid var(--line)", borderRadius: "6px", background: "var(--surface)"
                                    }}
                                  >
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                        <strong style={{ fontSize: "12px" }}>{formatCurrency(candidate.omieRecord.amount)}</strong>
                                        <span style={{ fontSize: "11px", color: "var(--muted)" }}>{formatDatePtBr(candidate.omieRecord.date)}</span>
                                        {candidate.amountDifference !== 0 && (
                                          <span className="badge badge-blue">dif. {formatCurrency(candidate.amountDifference)}</span>
                                        )}
                                        <span className="badge badge-green" title="Score de similaridade (0-130)">{candidate.score} pts</span>
                                      </div>
                                      <div style={{ fontSize: "11px", marginTop: "4px" }}>
                                        {candidate.omieRecord.description}
                                        {candidate.omieRecord.documentNumber && (
                                          <span style={{ color: "var(--muted)" }}> · doc {candidate.omieRecord.documentNumber}</span>
                                        )}
                                      </div>
                                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                                        {candidate.evidence.map((item) => (
                                          <span key={item} style={{ fontSize: "10px", color: "var(--muted)", border: "1px solid var(--line)", borderRadius: "4px", padding: "1px 6px" }}>{item}</span>
                                        ))}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      className="secondary-button"
                                      onClick={() => {
                                        setSelectedBankId(record.id);
                                        setSelectedOmieId(candidate.omieRecord.id);
                                        setExpandedBankId(null);
                                      }}
                                    >
                                      Selecionar par
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="unmatched-section">
              <h3 style={{ fontSize: "13px", marginBottom: "8px" }}>Lançamentos Omie Pendentes ({unmatchedOmie.length})</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: "36px" }}>Sel</th>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Valor</th>
                    <th>Documento</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatchedOmie.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: "16px" }}>
                        Nenhum registro pendente no Omie.
                      </td>
                    </tr>
                  ) : (
                    unmatchedOmie.map(record => (
                      <tr
                        key={record.id}
                        onClick={() => setSelectedOmieId(record.id === selectedOmieId ? null : record.id)}
                        style={{ cursor: "pointer", background: selectedOmieId === record.id ? "rgba(181, 88, 60, 0.1)" : undefined }}
                      >
                        <td>
                          <input
                            type="radio"
                            name="omieSelection"
                            checked={selectedOmieId === record.id}
                            onChange={() => setSelectedOmieId(record.id)}
                          />
                        </td>
                        <td>{formatDatePtBr(record.date)}</td>
                        <td style={{ fontSize: "11px" }}>{record.description}</td>
                        <td><strong>{formatCurrency(record.amount)}</strong></td>
                        <td>{record.documentNumber || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selectedBankId && selectedOmieId && (
            <div style={{ padding: "16px", background: "var(--surface-raised, rgba(255,255,255,0.05))", border: "1px solid var(--rsbuild-terracotta)", borderRadius: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "13px", color: "var(--ink)", margin: 0 }}>Conciliação Manual com Trilha de Auditoria</h3>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--rsbuild-terracotta)", background: "var(--rsbuild-terracotta-soft)", padding: "2px 8px", borderRadius: "4px" }}>
                  {roleMeta.badge}
                </span>
              </div>
              <p style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "8px" }}>
                Identificação do Responsável: <strong>{author}</strong> ({roleMeta.label}). Esta ação registrará autor, carimbo de data/hora e justificativa pericial imutável.
              </p>
              <textarea
                value={manualJustification}
                onChange={(e) => setManualJustification(e.target.value)}
                placeholder="Insira a justificativa formal para o casamento manual (ex: 'Compensação de duplicata com divergência de tarifa aprovada pela diretoria')..."
                rows={3}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", marginBottom: "12px", fontSize: "12px" }}
              />
              <button className="primary-button" onClick={handleManualMatch}>
                Confirmar Casamento Manual
              </button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
