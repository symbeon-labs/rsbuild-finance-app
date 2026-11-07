"use client";

import { BankMetadata, FinancialRecord, formatCurrency } from "@/lib/finance";
import { RecordTable } from "./common";

interface ImportacoesViewProps {
  fileName: string;
  pendingImport: FinancialRecord[];
  pendingMetadata: BankMetadata | null;
  importErrors: string[];
  onSelectFile: () => void;
  onCancelImport: () => void;
  onExportOmieOfx: () => void;
  onConfirmImport: () => void;
}

export function ImportacoesView({
  fileName,
  pendingImport,
  pendingMetadata,
  importErrors,
  onSelectFile,
  onCancelImport,
  onExportOmieOfx,
  onConfirmImport
}: ImportacoesViewProps) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ENTRADA DE DADOS</div>
          <h1>Importações</h1>
          <p>Carregue extratos e revise os registros antes de adicioná-los.</p>
        </div>
      </div>

      <section className="panel import-panel">
        <div className="upload-zone">
          <div className="upload-icon">⇧</div>
          <h2>Importar extrato financeiro</h2>
          <p>Selecione um arquivo CSV ou OFX para visualizar os registros.</p>
          <button className="secondary-button" onClick={onSelectFile}>
            Selecionar arquivo
          </button>
          <span className="file-hint">CSV ou OFX · Até 10 MB</span>
        </div>

        {fileName && (
          <div className="import-file">
            <span className="file-badge">ARQ</span>
            <div>
              <strong>{fileName}</strong>
              <span>{pendingImport.length} registro(s) reconhecido(s)</span>
              {pendingMetadata?.bankName && (
                <span style={{ display: "block", fontSize: "12px", color: "var(--rsbuild-terracotta)", marginTop: "3px", fontWeight: 600 }}>
                  🏦 {pendingMetadata.bankName}
                  {pendingMetadata.accountId ? ` · Conta: ${pendingMetadata.accountId}` : ""}
                  {pendingMetadata.balance !== undefined ? ` · Saldo: ${formatCurrency(pendingMetadata.balance)}` : ""}
                </span>
              )}
            </div>
          </div>
        )}

        {importErrors.length > 0 && (
          <div className="error-list">
            <strong>Revisar importação</strong>
            {importErrors.map((error, index) => (
              <p key={index}>{error}</p>
            ))}
          </div>
        )}

        {pendingImport.length > 0 && (
          <>
            <div className="preview-heading">
              <div>
                <h2>Prévia dos registros</h2>
                <p>Confira os dados antes de confirmar a importação.</p>
              </div>
              <span>{pendingImport.length} registros</span>
            </div>
            <RecordTable records={pendingImport.slice(0, 8)} />
            <div className="import-actions">
              <button className="secondary-button" onClick={onCancelImport}>
                Cancelar
              </button>
              <button
                className="secondary-button"
                onClick={onExportOmieOfx}
                title="Exportar lote normalizado pronto para Omie"
              >
                ⚡ Exportar OFX (Omie)
              </button>
              <button className="primary-button" onClick={onConfirmImport}>
                Confirmar importação
              </button>
            </div>
          </>
        )}
      </section>

      <div className="inline-note">
        Os registros desta versão permanecem disponíveis e persistidos durante sua sessão de trabalho.
      </div>
    </>
  );
}

