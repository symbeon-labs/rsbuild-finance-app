"use client";

import { useMemo, useState } from "react";

type PayablePreviewRow = {
  rowNumber: number;
  supplierName: string;
  supplierDocument?: string;
  documentNumber: string;
  issueDate?: string;
  dueDate: string;
  amountMinor: number;
  category?: string;
  costCenter?: string;
  deduplicationKey: string;
};

type PreviewIssue = { rowNumber: number; code: string; message: string };
type PreviewResponse = {
  previewId: string;
  fileName: string;
  fileSha256: string;
  parserVersion: string;
  sheetName?: string;
  availableSheets?: string[];
  parsedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  rows: PayablePreviewRow[];
  errors: PreviewIssue[];
  truncatedErrors: boolean;
};
type CommitResponse = {
  batchId: string;
  insertedCount: number;
  duplicateCount: number;
  rejectedCount: number;
  parsedCount: number;
  sheetName?: string | null;
};

interface PayablesImportPanelProps {
  organizationId: string;
}

const money = (amountMinor: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL"
}).format(amountMinor / 100);

export function PayablesImportPanel({ organizationId }: PayablesImportPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [sheetName, setSheetName] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CommitResponse | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const availableSheets = preview?.availableSheets ?? [];
  const previewMatchesSelection = Boolean(preview) && (preview?.sheetName ?? "") === sheetName;
  const canCommit = Boolean(file && preview && previewMatchesSelection && preview.acceptedCount > 0 && !isPreviewing && !isCommitting);
  const rows = useMemo(() => preview?.rows.slice(0, 20) ?? [], [preview]);

  function reset() {
    setFile(null);
    setSheetName("");
    setPreview(null);
    setError("");
    setResult(null);
    setFileInputKey((key) => key + 1);
  }

  async function runPreview(nextFile = file, nextSheet = sheetName) {
    if (!nextFile) {
      setError("Selecione um arquivo CSV ou XLSX.");
      return;
    }
    setIsPreviewing(true);
    setError("");
    setResult(null);
    setPreview(null);
    try {
      const form = new FormData();
      form.set("organizationId", organizationId);
      form.set("file", nextFile);
      if (nextSheet) form.set("sheetName", nextSheet);
      const response = await fetch("/api/payables/import/preview", { method: "POST", body: form, cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Não foi possível gerar a prévia.");
      setPreview(payload as PreviewResponse);
      setSheetName(payload.sheetName ?? "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao analisar o arquivo.");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function commitImport() {
    if (!file || !preview || !preview.acceptedCount) return;
    setIsCommitting(true);
    setError("");
    try {
      const form = new FormData();
      form.set("organizationId", organizationId);
      form.set("file", file);
      if (sheetName) form.set("sheetName", sheetName);
      const response = await fetch("/api/payables/import/commit", { method: "POST", body: form, cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Não foi possível confirmar a importação.");
      setResult(payload as CommitResponse);
      setPreview(null);
      setFile(null);
      setSheetName("");
      setFileInputKey((key) => key + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao confirmar a importação.");
    } finally {
      setIsCommitting(false);
    }
  }

  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <div className="panel-heading">
        <div>
          <div className="eyebrow">CONTAS A PAGAR</div>
          <h2>Importar títulos de fornecedores</h2>
          <p>Analise CSV ou XLSX, revise as linhas reconhecidas e confirme a persistência na organização ativa.</p>
        </div>
      </div>

      <div className="upload-zone" style={{ marginTop: 12 }}>
        <div className="upload-icon">⇧</div>
        <h3>Arquivo de contas a pagar</h3>
        <p>CSV ou XLSX · até 10 MB · máximo de 5.000 linhas</p>
        <input
          key={fileInputKey}
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            setFile(selected);
            setPreview(null);
            setSheetName("");
            setError("");
            setResult(null);
          }}
          aria-label="Selecionar arquivo de contas a pagar"
        />
        {file && <p><strong>{file.name}</strong> · {(file.size / 1024 / 1024).toFixed(2)} MB</p>}
        <button type="button" className="secondary-button" onClick={() => void runPreview()} disabled={!file || isPreviewing || isCommitting}>
          {isPreviewing ? "Analisando arquivo..." : "Gerar prévia"}
        </button>
      </div>

      {error && <div className="error-list" role="alert"><strong>Não foi possível concluir</strong><p>{error}</p></div>}

      {preview && (
        <div style={{ marginTop: 20 }}>
          {!previewMatchesSelection && <p className="inline-note">A planilha selecionada mudou. Atualize a prévia antes de confirmar.</p>}
          <div className="metric-grid">
            <div className="metric-card"><span>Linhas analisadas</span><strong>{preview.parsedCount}</strong></div>
            <div className="metric-card"><span>Válidas</span><strong>{preview.acceptedCount}</strong></div>
            <div className="metric-card"><span>Rejeitadas</span><strong>{preview.rejectedCount}</strong></div>
            <div className="metric-card"><span>Duplicadas no arquivo</span><strong>{preview.duplicateCount}</strong></div>
          </div>

          {availableSheets.length > 1 && (
            <div style={{ display: "flex", alignItems: "end", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              <label style={{ display: "grid", gap: 5, minWidth: 220 }}>
                <span>Planilha do arquivo</span>
                <select value={sheetName} onChange={(event) => setSheetName(event.target.value)}>
                  {availableSheets.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              <button type="button" className="secondary-button" onClick={() => void runPreview(file, sheetName)} disabled={isPreviewing || isCommitting}>
                Atualizar prévia
              </button>
            </div>
          )}

          {preview.errors.length > 0 && (
            <div className="error-list" style={{ marginTop: 16 }}>
              <strong>Linhas que precisam de revisão</strong>
              {preview.errors.map((issue, index) => (
                <p key={index}>Linha {issue.rowNumber}: {issue.message}</p>
              ))}
              {preview.truncatedErrors && <p>Há mais ocorrências; a API limitou a exibição a 100 mensagens.</p>}
            </div>
          )}

          <div className="preview-heading" style={{ marginTop: 20 }}>
            <div><h3>Prévia dos títulos válidos</h3><p>Até 20 linhas são exibidas para conferência.</p></div>
            <span>{preview.acceptedCount} título(s)</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Linha</th><th>Fornecedor</th><th>Documento</th><th>Vencimento</th><th>Valor</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.deduplicationKey}>
                    <td>{row.rowNumber}</td>
                    <td>{row.supplierName}</td>
                    <td>{row.documentNumber}</td>
                    <td>{new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${row.dueDate}T00:00:00Z`))}</td>
                    <td>{money(row.amountMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.acceptedCount > rows.length && <p className="file-hint">Exibindo {rows.length} de {preview.acceptedCount} linhas válidas.</p>}

          <div className="import-actions" style={{ marginTop: 16 }}>
            <button type="button" className="secondary-button" onClick={reset} disabled={isCommitting}>Cancelar</button>
            <button type="button" className="primary-button" onClick={() => void commitImport()} disabled={!canCommit}>
              {isCommitting ? "Persistindo títulos..." : `Confirmar importação · ${preview.acceptedCount} título(s)`}
            </button>
          </div>
          <p className="inline-note">A confirmação reprocessa o arquivo no servidor. Apenas linhas válidas e não duplicadas serão persistidas; nenhuma baixa ou pagamento é executado.</p>
        </div>
      )}

      {result && (
        <div className="quality-row" role="status" style={{ marginTop: 16 }}>
          <div><strong>Importação concluída</strong><p>Lote {result.batchId}</p></div>
          <div>Inseridos: <strong>{result.insertedCount}</strong> · Duplicados: <strong>{result.duplicateCount}</strong> · Rejeitados: <strong>{result.rejectedCount}</strong></div>
          <button type="button" className="text-button" onClick={reset}>Nova importação</button>
        </div>
      )}
    </section>
  );
}
