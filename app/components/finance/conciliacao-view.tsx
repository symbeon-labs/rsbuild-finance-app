"use client";

import { useState, useMemo } from "react";
import {
  FinancialRecord,
  OmieRecord,
  matchRecords,
  manualMatch,
  unmatchRecord,
  formatCurrency,
  MatchResult
} from "@/lib/finance";
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
}

export function ConciliacaoView({
  bankRecords,
  omieRecords,
  author,
  role,
  onRecordsUpdated
}: ConciliacaoViewProps) {
  const [selectedTab, setSelectedTab] = useState<"summary" | "matched" | "unmatched">("summary");
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedOmieId, setSelectedOmieId] = useState<string | null>(null);
  const [manualJustification, setManualJustification] = useState("");
  const canMatch = canPerformManualMatch(role);
  const canApproveDiscrepancy = canApproveDiscrepantMatch(role);
  const roleMeta = getRoleMetadata(role);

  const matchResults = useMemo(() => {
    return matchRecords(bankRecords, omieRecords, author);
  }, [bankRecords, omieRecords, author]);

  const { matched, unmatchedBank, unmatchedOmie } = matchResults;

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

    setSelectedBankId(null);
    setSelectedOmieId(null);
    setManualJustification("");
  };

  const handleUnmatch = (bankId: string) => {
    const bankRecord = bankRecords.find(r => r.id === bankId);
    if (!bankRecord) return;

    const updated = unmatchRecord(bankRecord, author);
    const updatedRecords = bankRecords.map(r => r.id === updated.id ? updated : r);
    onRecordsUpdated(updatedRecords);
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">RECONCILIAÇÃO ERP & EXTRATOS</div>
          <h1>Conciliação Bancária Multicontas</h1>
          <p>Motor autônomo de conferência de extratos bancários contra lançamentos e títulos do Omie ERP com trilha de auditoria imutável.</p>
        </div>
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
                    <td>{m.bankRecord.date}</td>
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
                  </tr>
                </thead>
                <tbody>
                  {unmatchedBank.map(record => (
                    <tr
                      key={record.id}
                      onClick={() => setSelectedBankId(record.id === selectedBankId ? null : record.id)}
                      style={{ cursor: "pointer", background: selectedBankId === record.id ? "rgba(181, 88, 60, 0.1)" : undefined }}
                    >
                      <td>
                        <input
                          type="radio"
                          name="bankSelection"
                          checked={selectedBankId === record.id}
                          onChange={() => setSelectedBankId(record.id)}
                        />
                      </td>
                      <td>{record.date}</td>
                      <td style={{ fontSize: "11px" }}>{record.description}</td>
                      <td><strong>{formatCurrency(record.amount)}</strong></td>
                      <td>{record.bankName || "-"}</td>
                    </tr>
                  ))}
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
                        <td>{record.date}</td>
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
