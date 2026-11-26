"use client";

import { Fragment, useState, useMemo, useRef, useEffect } from "react";
import {
  FinancialRecord,
  OmieRecord,
  matchRecords,
  manualMatch,
  unmatchRecord,
  formatCurrency,
  identifyBank,
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
  onImportTitlesFile?: (file: File) => void;
  onReconciliationDecision?: (recordId: string, decisionType: "manual_match" | "unmatch", counterpartLabel?: string, justification?: string) => void;
  initialSelectedBankIds?: string[];
}

type BankAccountFilter = {
  key: string;
  bankName: string;
  accountId: string;
};

const QUICK_JUSTIFICATIONS = [
  "Pagamento exato confirmado",
  "Tarifa bancária inclusa",
  "Compensação de boleto"
] as const;

function getBankVisualTheme(bankName: string): { accent: string; soft: string; monogram: string } {
  const normalized = bankName.toLowerCase();
  if (normalized.includes("itaú") || normalized.includes("itau")) {
    return { accent: "#EC7000", soft: "rgba(236, 112, 0, 0.14)", monogram: "IT" };
  }
  if (normalized.includes("safra")) {
    return { accent: "#2563EB", soft: "rgba(37, 99, 235, 0.14)", monogram: "SF" };
  }
  if (normalized.includes("bradesco")) {
    return { accent: "#CC092F", soft: "rgba(204, 9, 47, 0.14)", monogram: "BR" };
  }
  if (normalized.includes("santander")) {
    return { accent: "#DC2626", soft: "rgba(220, 38, 38, 0.14)", monogram: "ST" };
  }
  if (normalized.includes("brasil")) {
    return { accent: "#1D4ED8", soft: "rgba(29, 78, 216, 0.14)", monogram: "BB" };
  }
  if (normalized.includes("caixa")) {
    return { accent: "#0284C7", soft: "rgba(2, 132, 199, 0.14)", monogram: "CX" };
  }
  if (normalized.includes("nubank")) {
    return { accent: "#820AD1", soft: "rgba(130, 10, 209, 0.14)", monogram: "NU" };
  }
  if (normalized.includes("inter")) {
    return { accent: "#F97316", soft: "rgba(249, 115, 22, 0.14)", monogram: "IN" };
  }
  if (normalized.includes("cora")) {
    return { accent: "#E11D48", soft: "rgba(225, 29, 72, 0.14)", monogram: "CR" };
  }
  if (normalized.includes("sicoob") || normalized.includes("sicredi")) {
    return { accent: "#059669", soft: "rgba(5, 150, 105, 0.14)", monogram: normalized.includes("sicoob") ? "SC" : "SI" };
  }
  const letters = bankName
    .replace(/[^A-Za-zÀ-ÿ\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
  return {
    accent: "var(--rsbuild-terracotta)",
    soft: "var(--rsbuild-terracotta-soft)",
    monogram: letters || "BK"
  };
}

function formatCompactAccountId(accountId: string): string {
  if (accountId.length <= 18) return accountId;
  return `${accountId.slice(0, 8)}···${accountId.slice(-6)}`;
}

function getBankAccountIdentity(record: FinancialRecord): BankAccountFilter {
  const resolved = identifyBank(record.bankCode, record.bankName || record.source);
  const bankName =
    resolved.name !== "Instituição Bancária"
      ? resolved.name
      : (record.bankName?.trim() ||
        (record.bankCode ? `Banco ${record.bankCode}` : record.source?.replace(/^OFX\s+/i, "").trim() || "Instituição não identificada"));
  const accountId = record.accountId?.trim() || "sem-conta";
  const key = `${resolved.code !== "0000" ? resolved.code : bankName}::${accountId}`;
  return { key, bankName, accountId };
}

function matchesSearchTerm(
  query: string,
  fields: Array<string | number | undefined>
): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  if (!normalizedQuery) return true;
  const numericQuery = normalizedQuery.replace(/[^\d.,-]/g, "");
  return fields.some((field) => {
    if (field === undefined || field === null) return false;
    const text = String(field).toLocaleLowerCase("pt-BR");
    if (text.includes(normalizedQuery)) return true;
    if (numericQuery.length >= 2 && text.replace(/[^\d.,-]/g, "").includes(numericQuery)) return true;
    return false;
  });
}

export function ConciliacaoView({
  bankRecords,
  omieRecords,
  author,
  role,
  onRecordsUpdated,
  onImportOmieRecords,
  onImportOmieRecordsPersist,
  onImportTitlesFile,
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
  const [selectedBankAccountFilter, setSelectedBankAccountFilter] = useState<BankAccountFilter | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"all" | "entrada" | "saída">("all");
  const [sortBy, setSortBy] = useState<"suggestions" | "amount_desc" | "date_asc">("suggestions");
  const omieInputRef = useRef<HTMLInputElement>(null);
  const titlesInputRef = useRef<HTMLInputElement>(null);
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
    const totals: Record<
      string,
      { bankName: string; accountId: string; total: number; matched: number; unmatched: number; count: number; unmatchedCount: number }
    > = {};

    for (const record of bankRecords) {
      const { key, bankName, accountId } = getBankAccountIdentity(record);
      if (!totals[key]) {
        totals[key] = { bankName, accountId, total: 0, matched: 0, unmatched: 0, count: 0, unmatchedCount: 0 };
      }
      totals[key].total += record.amount;
      totals[key].count += 1;
      if (record.status === "conciliado") {
        totals[key].matched += record.amount;
      } else {
        totals[key].unmatched += record.amount;
        totals[key].unmatchedCount += 1;
      }
    }

    return totals;
  }, [bankRecords]);

  const kpis = useMemo(() => {
    const totalBankCount = bankRecords.length;
    const matchedCount = matched.length;
    const matchedPercentage = totalBankCount > 0 ? Math.round((matchedCount / totalBankCount) * 100) : 0;
    const matchedAmount = matched.reduce((acc, item) => acc + item.bankRecord.amount, 0);
    const unmatchedBankAmount = unmatchedBank.reduce((acc, item) => acc + item.amount, 0);
    const suggestedCount = suggestionsByBankId.size;
    return {
      totalBankCount,
      matchedCount,
      matchedPercentage,
      matchedAmount,
      unmatchedBankCount: unmatchedBank.length,
      unmatchedBankAmount,
      suggestedCount,
      internalTransfersCount: internalTransfers.length,
      suggestedTransfersCount: suggestedTransfers.length
    };
  }, [bankRecords.length, matched, unmatchedBank, suggestionsByBankId.size, internalTransfers.length, suggestedTransfers.length]);

  const selectedBankRecord = useMemo(
    () => unmatchedBank.find((record) => record.id === selectedBankId) ?? null,
    [unmatchedBank, selectedBankId]
  );

  const selectedOmieRecord = useMemo(
    () => unmatchedOmie.find((record) => record.id === selectedOmieId) ?? null,
    [unmatchedOmie, selectedOmieId]
  );

  const selectedBankCandidateMap = useMemo(() => {
    const map = new Map<string, OmieCandidate>();
    if (!selectedBankId) return map;
    const candidates = suggestionsByBankId.get(selectedBankId) ?? [];
    for (const candidate of candidates) {
      map.set(candidate.omieRecord.id, candidate);
    }
    return map;
  }, [selectedBankId, suggestionsByBankId]);

  const filteredUnmatchedBank = useMemo(() => {
    const filtered = unmatchedBank.filter((record) => {
      if (selectedBankAccountFilter) {
        const identity = getBankAccountIdentity(record);
        if (identity.key !== selectedBankAccountFilter.key) return false;
      }
      if (directionFilter !== "all" && record.direction !== directionFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const identity = getBankAccountIdentity(record);
        const matches = matchesSearchTerm(searchQuery, [
          record.description,
          record.amount,
          formatCurrency(record.amount),
          record.bankName,
          identity.bankName,
          identity.accountId
        ]);
        if (!matches) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "amount_desc") {
        return b.amount - a.amount;
      }
      if (sortBy === "date_asc") {
        return a.date.localeCompare(b.date);
      }
      const aCandidates = suggestionsByBankId.get(a.id) ?? [];
      const bCandidates = suggestionsByBankId.get(b.id) ?? [];
      if ((bCandidates.length > 0) !== (aCandidates.length > 0)) {
        return bCandidates.length > 0 ? 1 : -1;
      }
      const aTopScore = aCandidates[0]?.score ?? 0;
      const bTopScore = bCandidates[0]?.score ?? 0;
      if (bTopScore !== aTopScore) return bTopScore - aTopScore;
      return b.amount - a.amount;
    });
  }, [unmatchedBank, selectedBankAccountFilter, directionFilter, searchQuery, sortBy, suggestionsByBankId]);

  const filteredUnmatchedOmie = useMemo(() => {
    const filtered = unmatchedOmie.filter((record) => {
      if (directionFilter !== "all" && record.direction !== directionFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const matches = matchesSearchTerm(searchQuery, [
          record.description,
          record.documentNumber,
          record.amount,
          formatCurrency(record.amount)
        ]);
        if (!matches) return false;
      }
      return true;
    });

    const getCompatibilityRank = (record: OmieRecord): { tier: number; score: number; diff: number } => {
      if (!selectedBankRecord) {
        return { tier: 3, score: 0, diff: 0 };
      }
      const candidate = selectedBankCandidateMap.get(record.id);
      const sameDirection = record.direction === selectedBankRecord.direction;
      const diff = Math.abs(record.amount - selectedBankRecord.amount);
      const exactAmount = sameDirection && diff <= 0.01;
      const closeAmount =
        sameDirection &&
        !exactAmount &&
        (diff <= 50 || diff / Math.max(selectedBankRecord.amount, 1) <= 0.05);

      if (candidate || exactAmount) {
        return { tier: 0, score: candidate?.score ?? 100, diff };
      }
      if (closeAmount) {
        return { tier: 1, score: 0, diff };
      }
      if (sameDirection) {
        return { tier: 2, score: 0, diff };
      }
      return { tier: 3, score: 0, diff };
    };

    return [...filtered].sort((a, b) => {
      if (selectedBankRecord) {
        const rankA = getCompatibilityRank(a);
        const rankB = getCompatibilityRank(b);
        if (rankA.tier !== rankB.tier) return rankA.tier - rankB.tier;
        if (rankA.score !== rankB.score) return rankB.score - rankA.score;
        if (rankA.diff !== rankB.diff) return rankA.diff - rankB.diff;
      }
      if (sortBy === "amount_desc") {
        return b.amount - a.amount;
      }
      if (sortBy === "date_asc") {
        return a.date.localeCompare(b.date);
      }
      return b.amount - a.amount;
    });
  }, [unmatchedOmie, directionFilter, searchQuery, sortBy, selectedBankRecord, selectedBankCandidateMap]);

  const handleClearSelection = () => {
    setSelectedBankId(null);
    setSelectedOmieId(null);
    setManualJustification("");
  };

  const handleSelectAccountCard = (filter: BankAccountFilter) => {
    setSelectedBankAccountFilter(filter);
    if (selectedBankId) {
      const current = unmatchedBank.find((r) => r.id === selectedBankId);
      if (current && getBankAccountIdentity(current).key !== filter.key) {
        setSelectedBankId(null);
      }
    }
    setSelectedTab("unmatched");
  };

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
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", flexWrap: "wrap" }}>
          {onImportTitlesFile && (
            <div>
              <input
                ref={titlesInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportTitlesFile(file);
                  if (e.target) e.target.value = "";
                }}
              />
              <button
                type="button"
                className="secondary-button"
                onClick={() => titlesInputRef.current?.click()}
                title="Importa títulos a receber ou a pagar do Omie ou ERP (.xlsx ou .csv)"
                style={{ fontWeight: 600 }}
              >
                ＋ Importar Títulos (Receber/Pagar)
              </button>
            </div>
          )}

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
      </div>

      <div className="reconciliation-kpi-grid" aria-label="Indicadores de conciliação">
        <button
          type="button"
          className={`reconciliation-kpi-card reconciliation-kpi-card--green${selectedTab === "matched" ? " reconciliation-kpi-card--active" : ""}`}
          onClick={() => setSelectedTab("matched")}
        >
          <span className="reconciliation-kpi-label">
            <span>Total Conciliado ({kpis.matchedPercentage}%)</span>
            <span className="reconciliation-kpi-icon" aria-hidden="true">✓</span>
          </span>
          <strong className="reconciliation-kpi-value">{formatCurrency(kpis.matchedAmount)}</strong>
          <div className="reconciliation-progress-track" aria-hidden="true">
            <div className="reconciliation-progress-fill" style={{ width: `${kpis.matchedPercentage}%` }} />
          </div>
          <span className="reconciliation-kpi-sub">
            {kpis.matchedCount} de {kpis.totalBankCount} lançamento(s) casados
          </span>
          <span className="reconciliation-kpi-cta">
            <span>Ver casados</span>
            <span aria-hidden="true">→</span>
          </span>
        </button>

        <button
          type="button"
          className={`reconciliation-kpi-card reconciliation-kpi-card--terracotta${selectedTab === "unmatched" ? " reconciliation-kpi-card--active" : ""}`}
          onClick={() => setSelectedTab("unmatched")}
        >
          <span className="reconciliation-kpi-label">
            <span>Extratos Pendentes</span>
            <span className="reconciliation-kpi-icon" aria-hidden="true">⏳</span>
          </span>
          <strong className="reconciliation-kpi-value">{kpis.unmatchedBankCount}</strong>
          <span className="reconciliation-kpi-sub">
            {formatCurrency(kpis.unmatchedBankAmount)} aguardando conferência
          </span>
          <span className="reconciliation-kpi-cta">
            <span>Abrir mesa de conferência</span>
            <span aria-hidden="true">→</span>
          </span>
        </button>

        <button
          type="button"
          className="reconciliation-kpi-card reconciliation-kpi-card--blue"
          onClick={() => {
            setSortBy("suggestions");
            setSelectedTab("unmatched");
          }}
        >
          <span className="reconciliation-kpi-label">
            <span>Sugestões do Motor</span>
            <span className="reconciliation-kpi-icon" aria-hidden="true">✦</span>
          </span>
          <strong className="reconciliation-kpi-value">{kpis.suggestedCount}</strong>
          <span className="reconciliation-kpi-sub">
            Extrato(s) com candidatos Omie sugeridos
          </span>
          <span className="reconciliation-kpi-cta">
            <span>Priorizar sugestões</span>
            <span aria-hidden="true">→</span>
          </span>
        </button>

        <button
          type="button"
          className={`reconciliation-kpi-card reconciliation-kpi-card--violet${selectedTab === "transfers" ? " reconciliation-kpi-card--active" : ""}`}
          onClick={() => setSelectedTab("transfers")}
        >
          <span className="reconciliation-kpi-label">
            <span>Transferências Internas</span>
            <span className="reconciliation-kpi-icon" aria-hidden="true">⇄</span>
          </span>
          <strong className="reconciliation-kpi-value">{kpis.internalTransfersCount}</strong>
          <span className="reconciliation-kpi-sub">
            {kpis.suggestedTransfersCount} par(es) candidato(s) entre contas
          </span>
          <span className="reconciliation-kpi-cta">
            <span>Revisar entre contas</span>
            <span aria-hidden="true">→</span>
          </span>
        </button>
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
          {Object.keys(accountTotals).length > 0 && (
            <div className="reconciliation-account-grid" style={{ marginTop: "12px" }}>
              {Object.entries(accountTotals).map(([key, totals]) => {
                const percentage = totals.total > 0 ? Math.round((totals.matched / totals.total) * 100) : 0;
                const isSelected = selectedBankAccountFilter?.key === key;
                const theme = getBankVisualTheme(totals.bankName);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`reconciliation-account-card${isSelected ? " reconciliation-account-card--active" : ""}`}
                    style={
                      {
                        "--bank-accent": theme.accent,
                        "--bank-soft": theme.soft
                      } as React.CSSProperties
                    }
                    onClick={() =>
                      handleSelectAccountCard({
                        key,
                        bankName: totals.bankName,
                        accountId: totals.accountId
                      })
                    }
                    title={`Filtrar mesa de conciliação para ${totals.bankName} · Conta ${totals.accountId}`}
                  >
                    <div className="reconciliation-account-card-head">
                      <div className="reconciliation-bank-identity">
                        <span className="reconciliation-bank-monogram" aria-hidden="true">
                          {theme.monogram}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <strong>{totals.bankName}</strong>
                          <span>Conta {formatCompactAccountId(totals.accountId)}</span>
                        </div>
                      </div>
                      <span className="badge badge-orange">{totals.unmatchedCount} pend.</span>
                    </div>
                    <div className="reconciliation-progress-track" aria-hidden="true">
                      <div
                        className="reconciliation-progress-fill"
                        style={{ width: `${percentage}%`, background: theme.accent }}
                      />
                    </div>
                    <div className="reconciliation-account-card-metrics">
                      <span>
                        Conciliado: <b>{formatCurrency(totals.matched)}</b>
                      </span>
                      <span>
                        Pendente: <b>{formatCurrency(totals.unmatched)}</b>
                      </span>
                    </div>
                    <div className="reconciliation-account-card-footer">
                      <span>{isSelected ? "✓ Filtro ativo na mesa" : "Filtrar pendentes desta conta"}</span>
                      <span aria-hidden="true">→</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <div className="reconciliation-table-wrap" role="region" aria-label="Tabela de conciliação bancária" tabIndex={0}>
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
                  const percentage = totals.total > 0 ? ((totals.matched / totals.total) * 100).toFixed(1) : "0";

                  return (
                    <tr key={key}>
                      <td><strong>{totals.bankName}</strong></td>
                      <td>{totals.accountId}</td>
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
          </div>
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
          <div className="reconciliation-table-wrap" role="region" aria-label="Tabela de conciliação bancária" tabIndex={0}>
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
          </div>
        </section>
      )}

      {selectedTab === "unmatched" && (
        <section className="panel">
          <h2>Registros Pendentes de Conciliação</h2>
          <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "14px" }}>
            Selecione uma linha do extrato bancário e uma do Omie ERP para realizar a reconciliação manual com justificativa registrada.
          </p>
          {batchQueue.length > 0 && (
            <div className="inline-note" role="status" style={{ marginBottom: 16 }}>
              Lote recebido do Centro de Operações: <strong>{batchQueue.length} movimentação(ões) pendente(s)</strong>. A conciliação continua individual: confira o par Omie, registre a justificativa e confirme cada decisão. O próximo item será selecionado após cada confirmação.
            </div>
          )}

          <div className="reconciliation-toolbar" role="region" aria-label="Filtros da mesa de conciliação">
            <input
              type="search"
              className="reconciliation-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar descrição, documento ou valor..."
              aria-label="Buscar descrição, documento ou valor"
            />

            <div className="reconciliation-pill-group" role="group" aria-label="Filtrar por direção">
              <button
                type="button"
                className={`reconciliation-pill${directionFilter === "all" ? " reconciliation-pill--active" : ""}`}
                onClick={() => setDirectionFilter("all")}
              >
                Todos
              </button>
              <button
                type="button"
                className={`reconciliation-pill${directionFilter === "entrada" ? " reconciliation-pill--active" : ""}`}
                onClick={() => setDirectionFilter("entrada")}
              >
                Entradas
              </button>
              <button
                type="button"
                className={`reconciliation-pill${directionFilter === "saída" ? " reconciliation-pill--active" : ""}`}
                onClick={() => setDirectionFilter("saída")}
              >
                Saídas
              </button>
            </div>

            <select
              className="reconciliation-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "suggestions" | "amount_desc" | "date_asc")}
              aria-label="Ordenar registros pendentes"
            >
              <option value="suggestions">Com sugestões primeiro</option>
              <option value="amount_desc">Maior valor</option>
              <option value="date_asc">Mais antigo</option>
            </select>

            {selectedBankAccountFilter && (
              <button
                type="button"
                className="reconciliation-filter-chip"
                onClick={() => setSelectedBankAccountFilter(null)}
                title="Remover filtro de conta bancária"
              >
                <span>
                  Filtrando: {selectedBankAccountFilter.bankName} · {selectedBankAccountFilter.accountId} ×
                </span>
              </button>
            )}
          </div>

          <div className="reconciliation-split-grid">
            <div className="unmatched-section">
              <h3 style={{ fontSize: "13px", marginBottom: "8px" }}>
                Extratos Bancários Pendentes ({filteredUnmatchedBank.length}
                {filteredUnmatchedBank.length !== unmatchedBank.length ? ` de ${unmatchedBank.length}` : ""})
              </h3>
              <div className="reconciliation-table-wrap" role="region" aria-label="Tabela de conciliação bancária" tabIndex={0}>
          <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: "36px" }}>Sel</th>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Valor</th>
                    <th>Banco</th>
                    <th style={{ width: "132px" }}>Sugestões</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUnmatchedBank.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: "16px" }}>
                        Nenhum extrato pendente corresponde aos filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredUnmatchedBank.map((record) => {
                      const candidates = suggestionsByBankId.get(record.id) ?? [];
                      const topScore = candidates[0]?.score ?? 0;
                      const expanded = expandedBankId === record.id;
                      const isSelected = selectedBankId === record.id;
                      return (
                        <Fragment key={record.id}>
                          <tr
                            onClick={() => setSelectedBankId(isSelected ? null : record.id)}
                            className={`reconciliation-row${isSelected ? " reconciliation-row--selected" : ""}`}
                          >
                            <td onClick={(e) => e.stopPropagation()}>
                              <input
                                type="radio"
                                name="bankSelection"
                                checked={isSelected}
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
                                  className="reconciliation-confidence-badge"
                                  onClick={() => setExpandedBankId(expanded ? null : record.id)}
                                  title="Ver lançamentos Omie candidatos com score e evidências"
                                >
                                  {expanded ? "Ocultar" : `${candidates.length} cand. · até ${topScore} pts`}
                                </button>
                              ) : (
                                <span style={{ fontSize: "11px", color: "var(--muted)" }}>—</span>
                              )}
                            </td>
                          </tr>
                          {expanded && candidates.length > 0 && (
                            <tr key={`${record.id}-candidates`}>
                              <td colSpan={6} style={{ background: "var(--surface-raised)", padding: "10px 14px" }}>
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
                    })
                  )}
                </tbody>
              </table>
          </div>
            </div>

            <div className="unmatched-section">
              <h3 style={{ fontSize: "13px", marginBottom: "8px" }}>
                Lançamentos Omie Pendentes ({filteredUnmatchedOmie.length}
                {filteredUnmatchedOmie.length !== unmatchedOmie.length ? ` de ${unmatchedOmie.length}` : ""})
              </h3>
              <div className="reconciliation-table-wrap" role="region" aria-label="Tabela de conciliação bancária" tabIndex={0}>
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
                  {filteredUnmatchedOmie.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: "16px" }}>
                        Nenhum registro pendente no Omie para os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    filteredUnmatchedOmie.map((record) => {
                      const isSelected = selectedOmieId === record.id;
                      const candidate = selectedBankCandidateMap.get(record.id);
                      const sameDirection = selectedBankRecord ? record.direction === selectedBankRecord.direction : false;
                      const diff = selectedBankRecord ? Math.abs(record.amount - selectedBankRecord.amount) : Infinity;
                      const isExact = Boolean(selectedBankRecord && sameDirection && diff <= 0.01);
                      const isClose = Boolean(
                        selectedBankRecord &&
                          sameDirection &&
                          !isExact &&
                          (diff <= 50 || diff / Math.max(selectedBankRecord.amount, 1) <= 0.05)
                      );
                      const rowClass = [
                        "reconciliation-row",
                        isSelected
                          ? "reconciliation-row--selected"
                          : isExact
                            ? "reconciliation-row--exact"
                            : isClose || candidate
                              ? "reconciliation-row--compatible"
                              : ""
                      ]
                        .filter(Boolean)
                        .join(" ");

                      return (
                        <tr
                          key={record.id}
                          onClick={() => setSelectedOmieId(isSelected ? null : record.id)}
                          className={rowClass}
                        >
                          <td onClick={(e) => e.stopPropagation()}>
                            <input
                              type="radio"
                              name="omieSelection"
                              checked={isSelected}
                              onChange={() => setSelectedOmieId(record.id)}
                            />
                          </td>
                          <td>{formatDatePtBr(record.date)}</td>
                          <td style={{ fontSize: "11px" }}>
                            <div>{record.description}</div>
                            {(candidate || isExact || isClose) && (
                              <span
                                className={`reconciliation-match-tag ${
                                  isExact ? "reconciliation-match-tag--exact" : "reconciliation-match-tag--close"
                                }`}
                              >
                                {candidate
                                  ? `${candidate.score} pts${isExact ? " · Valor exato" : ""}`
                                  : isExact
                                    ? "Valor exato"
                                    : "Valor próximo"}
                              </span>
                            )}
                          </td>
                          <td><strong>{formatCurrency(record.amount)}</strong></td>
                          <td>{record.documentNumber || "-"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
          </div>
            </div>
          </div>

          {selectedBankRecord && selectedOmieRecord && (() => {
            const amountDiff = Math.abs(selectedBankRecord.amount - selectedOmieRecord.amount);
            const isExactDiff = amountDiff <= 0.01 && selectedBankRecord.direction === selectedOmieRecord.direction;
            return (
              <div className="reconciliation-action-dock" role="region" aria-label="Confirmação de conciliação manual">
                <div className="reconciliation-dock-header">
                  <div className="reconciliation-dock-pair">
                    <span className="reconciliation-dock-side">
                      <strong>Banco:</strong> {formatCurrency(selectedBankRecord.amount)} · {formatDatePtBr(selectedBankRecord.date)}
                    </span>
                    <span className="reconciliation-dock-arrow" aria-hidden="true">⇄</span>
                    <span className="reconciliation-dock-side">
                      <strong>Omie:</strong> {formatCurrency(selectedOmieRecord.amount)} · {formatDatePtBr(selectedOmieRecord.date)}
                    </span>
                    <span
                      className={`reconciliation-diff-badge ${
                        isExactDiff ? "reconciliation-diff-badge--ok" : "reconciliation-diff-badge--amber"
                      }`}
                    >
                      {isExactDiff ? `${formatCurrency(0)} · Valor exato` : `Diferença: ${formatCurrency(amountDiff)}`}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "var(--rsbuild-terracotta)",
                      background: "var(--rsbuild-terracotta-soft)",
                      padding: "3px 8px",
                      borderRadius: "4px"
                    }}
                  >
                    {roleMeta.badge} · {author}
                  </span>
                </div>

                <div className="reconciliation-chips-row">
                  {QUICK_JUSTIFICATIONS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`reconciliation-chip${manualJustification === preset ? " reconciliation-chip--active" : ""}`}
                      onClick={() => setManualJustification(preset)}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <div className="reconciliation-dock-form">
                  <input
                    type="text"
                    className="reconciliation-dock-input"
                    value={manualJustification}
                    onChange={(e) => setManualJustification(e.target.value)}
                    placeholder="Justificativa formal para trilha de auditoria..."
                    aria-label="Justificativa formal para conciliação manual"
                  />
                  <div className="reconciliation-dock-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={handleClearSelection}
                    >
                      Limpar seleção
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={handleManualMatch}
                      disabled={!canMatch}
                      title={!canMatch ? "Seu perfil não possui permissão para conciliação manual." : undefined}
                    >
                      Confirmar Conciliação
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </section>
      )}
    </>
  );
}
