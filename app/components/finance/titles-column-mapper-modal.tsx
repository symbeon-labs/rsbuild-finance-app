"use client";

import { useState, useMemo } from "react";
import {
  SpreadsheetSheetPreview,
  TitleColumnMapping,
  ReceivableTitle,
  suggestTitleColumnMapping,
  parseTitlesWithMapping
} from "@/lib/reconciliation";

interface TitlesColumnMapperModalProps {
  fileName: string;
  sheets: SpreadsheetSheetPreview[];
  onConfirm: (titles: ReceivableTitle[]) => Promise<void> | void;
  onClose: () => void;
}

export function TitlesColumnMapperModal({
  fileName,
  sheets,
  onConfirm,
  onClose
}: TitlesColumnMapperModalProps) {
  const [sheetIndex, setSheetIndex] = useState(0);
  const currentSheet = sheets[sheetIndex] || { name: fileName, rows: [] };
  const initialSuggestion = useMemo(
    () => suggestTitleColumnMapping(currentSheet),
    [currentSheet]
  );

  const [headerRowIndex, setHeaderRowIndex] = useState<number>(initialSuggestion.headerRowIndex);
  const [valueCol, setValueCol] = useState<number>(initialSuggestion.valueCol);
  const [dueDateCol, setDueDateCol] = useState<number>(initialSuggestion.dueDateCol);
  const [customerCol, setCustomerCol] = useState<number>(initialSuggestion.customerCol ?? -1);
  const [documentCol, setDocumentCol] = useState<number>(initialSuggestion.documentCol ?? -1);
  const [bankAccountCol, setBankAccountCol] = useState<number>(initialSuggestion.bankAccountCol ?? -1);
  const [typeCol, setTypeCol] = useState<number>(initialSuggestion.typeCol ?? -1);
  const [directionMode, setDirectionMode] = useState<"auto" | "receivable" | "payable">(
    initialSuggestion.directionMode
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSheetChange = (nextIdx: number) => {
    setSheetIndex(nextIdx);
    const nextSheet = sheets[nextIdx];
    if (nextSheet) {
      const sug = suggestTitleColumnMapping(nextSheet);
      setHeaderRowIndex(sug.headerRowIndex);
      setValueCol(sug.valueCol);
      setDueDateCol(sug.dueDateCol);
      setCustomerCol(sug.customerCol ?? -1);
      setDocumentCol(sug.documentCol ?? -1);
      setBankAccountCol(sug.bankAccountCol ?? -1);
      setTypeCol(sug.typeCol ?? -1);
      setDirectionMode(sug.directionMode);
    }
  };

  const maxCols = useMemo(
    () => Math.max(...currentSheet.rows.slice(0, 20).map((r) => r.length), 1),
    [currentSheet.rows]
  );

  const columnOptions = useMemo(() => {
    const headerCells = headerRowIndex >= 0 ? currentSheet.rows[headerRowIndex] || [] : [];
    return Array.from({ length: maxCols }, (_, idx) => {
      const label = headerCells[idx] ? `${headerCells[idx]} (Col ${idx + 1})` : `Coluna ${idx + 1}`;
      return { idx, label };
    });
  }, [currentSheet.rows, headerRowIndex, maxCols]);

  const mapping: TitleColumnMapping = useMemo(
    () => ({
      sheetIndex,
      headerRowIndex,
      valueCol,
      dueDateCol,
      customerCol: customerCol >= 0 ? customerCol : undefined,
      documentCol: documentCol >= 0 ? documentCol : undefined,
      bankAccountCol: bankAccountCol >= 0 ? bankAccountCol : undefined,
      typeCol: typeCol >= 0 ? typeCol : undefined,
      directionMode
    }),
    [sheetIndex, headerRowIndex, valueCol, dueDateCol, customerCol, documentCol, bankAccountCol, typeCol, directionMode]
  );

  const previewResult = useMemo(
    () => parseTitlesWithMapping(sheets, mapping),
    [sheets, mapping]
  );

  const previewRows = useMemo(() => {
    const start = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
    return currentSheet.rows.slice(start, start + 5);
  }, [currentSheet.rows, headerRowIndex]);

  async function handleConfirm() {
    if (!previewResult.titles.length || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm(previewResult.titles);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        background: "rgba(15, 23, 42, 0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px"
      }}
    >
      <div
        className="panel"
        style={{
          width: "min(880px, 100%)",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "var(--bg)",
          color: "var(--ink)",
          border: "1px solid var(--line)",
          borderRadius: "12px",
          padding: "24px",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.35)"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "16px" }}>
          <div>
            <div className="eyebrow">IMPORTADOR UNIVERSAL DE PLANILHAS</div>
            <h2 style={{ margin: "4px 0" }}>Mapear Colunas: {fileName}</h2>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
              Planilha fora do padrão automático. Indique abaixo quais colunas correspondem a cada campo para importar de qualquer ERP ou Excel.
            </p>
          </div>
          <button type="button" className="secondary-button" onClick={onClose} disabled={isSubmitting}>
            ✕ Fechar
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "12px", marginBottom: "16px" }}>
          {sheets.length > 1 && (
            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
              Aba da Planilha
              <select
                value={sheetIndex}
                onChange={(e) => handleSheetChange(Number(e.target.value))}
                style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)" }}
              >
                {sheets.map((s, idx) => (
                  <option key={s.name + idx} value={idx}>{s.name}</option>
                ))}
              </select>
            </label>
          )}

          <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
            Linha do Cabeçalho
            <select
              value={headerRowIndex}
              onChange={(e) => setHeaderRowIndex(Number(e.target.value))}
              style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)" }}
            >
              <option value={-1}>Sem cabeçalho (dados na Linha 1)</option>
              {currentSheet.rows.slice(0, 15).map((r, idx) => (
                <option key={idx} value={idx}>
                  Linha {idx + 1}: {r.filter(Boolean).slice(0, 3).join(" | ").slice(0, 32)}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
            Natureza dos Títulos
            <select
              value={directionMode}
              onChange={(e) => setDirectionMode(e.target.value as "auto" | "receivable" | "payable")}
              style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)" }}
            >
              <option value="auto">Automático (sinal +/- ou coluna Tipo)</option>
              <option value="receivable">📥 Tudo Contas a Receber</option>
              <option value="payable">📤 Tudo Contas a Pagar</option>
            </select>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "12px", marginBottom: "18px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
            Coluna de Valor *
            <select
              value={valueCol}
              onChange={(e) => setValueCol(Number(e.target.value))}
              style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)" }}
            >
              {columnOptions.map((o) => <option key={o.idx} value={o.idx}>{o.label}</option>)}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
            Coluna de Vencimento / Data *
            <select
              value={dueDateCol}
              onChange={(e) => setDueDateCol(Number(e.target.value))}
              style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)" }}
            >
              {columnOptions.map((o) => <option key={o.idx} value={o.idx}>{o.label}</option>)}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
            Cliente / Fornecedor / Descrição
            <select
              value={customerCol}
              onChange={(e) => setCustomerCol(Number(e.target.value))}
              style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)" }}
            >
              <option value={-1}>(Opcional / Não mapear)</option>
              {columnOptions.map((o) => <option key={o.idx} value={o.idx}>{o.label}</option>)}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
            Nº Documento / NF
            <select
              value={documentCol}
              onChange={(e) => setDocumentCol(Number(e.target.value))}
              style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)" }}
            >
              <option value={-1}>(Gerar automático)</option>
              {columnOptions.map((o) => <option key={o.idx} value={o.idx}>{o.label}</option>)}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
            Conta Bancária / Banco
            <select
              value={bankAccountCol}
              onChange={(e) => setBankAccountCol(Number(e.target.value))}
              style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)" }}
            >
              <option value={-1}>(Opcional / Não mapear)</option>
              {columnOptions.map((o) => <option key={o.idx} value={o.idx}>{o.label}</option>)}
            </select>
          </label>

          {directionMode === "auto" && (
            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
              Coluna Tipo (Pagar/Receber)
              <select
                value={typeCol}
                onChange={(e) => setTypeCol(Number(e.target.value))}
                style={{ padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)" }}
              >
                <option value={-1}>(Detectar pelo sinal +/-)</option>
                {columnOptions.map((o) => <option key={o.idx} value={o.idx}>{o.label}</option>)}
              </select>
            </label>
          )}
        </div>

        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
            Prévia das primeiras linhas ({previewResult.titles.length} título(s) válido(s) reconhecido(s))
          </div>
          <div className="table-wrap" style={{ maxHeight: "190px", overflow: "auto", border: "1px solid var(--line)", borderRadius: "8px" }}>
            <table>
              <thead>
                <tr>
                  {columnOptions.map((o) => (
                    <th key={o.idx} style={{ fontSize: "11px", whiteSpace: "nowrap" }}>{o.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {columnOptions.map((o) => (
                      <td key={o.idx} style={{ fontSize: "12px", whiteSpace: "nowrap" }}>{row[o.idx] || "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "13px", color: previewResult.titles.length > 0 ? "var(--green, #16A34A)" : "var(--red, #DC2626)", fontWeight: 600 }}>
            {previewResult.titles.length > 0
              ? `✓ ${previewResult.titles.length} título(s) pronto(s) para importar`
              : "Selecione as colunas de Valor e Vencimento/Data válidas."}
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" className="secondary-button" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={previewResult.titles.length === 0 || isSubmitting}
              onClick={handleConfirm}
            >
              {isSubmitting ? "Importando..." : `Importar ${previewResult.titles.length} Título(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
