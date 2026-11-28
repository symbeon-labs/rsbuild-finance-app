"use client";

import { useEffect, useMemo, useState } from "react";
import { BankMetadata, CsvColumnMatch, FinancialRecord, formatCurrency } from "@/lib/finance";
import { RecordTable } from "./common";
import { DataIntakePanel } from "./data-intake-panel";
import { GuideBalloon } from "@/app/components/guide/guide-balloon";
import { getGuide } from "@/lib/guides";

interface ImportacoesViewProps {
  organizationId: string;
  fileName: string;
  detectedColumns?: CsvColumnMatch[];
  pendingImport: FinancialRecord[];
  pendingMetadata: BankMetadata | null;
  importErrors: string[];
  isImporting: boolean;
  onSelectFile: () => void;
  onCancelImport: () => void;
  onExportOmieOfx: () => void;
  onConfirmImport: (accountId: string | null) => void;
  canWrite?: boolean;
}

export function ImportacoesView({
  organizationId,
  fileName,
  detectedColumns = [],
  pendingImport,
  pendingMetadata,
  importErrors,
  isImporting,
  onSelectFile,
  onCancelImport,
  onExportOmieOfx,
  onConfirmImport,
  canWrite = false
}: ImportacoesViewProps) {
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; institution: string | null; external_reference: string | null }>>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState("");
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState("all");
  const [category, setCategory] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  useEffect(() => {
    if (!organizationId || !pendingImport.length) return;
    let active = true;
    setAccountsLoading(true);
    setAccountsError("");
    fetch(`/api/financial-accounts?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Não foi possível carregar as contas.");
        if (active) setAccounts(Array.isArray(payload.accounts) ? payload.accounts : []);
      })
      .catch((error) => { if (active) setAccountsError(error instanceof Error ? error.message : "Falha ao carregar contas."); })
      .finally(() => { if (active) setAccountsLoading(false); });
    return () => { active = false; };
  }, [organizationId, pendingImport.length]);
  const categories = useMemo(
    () => [...new Set(pendingImport.map((record) => record.category).filter(Boolean))].sort(),
    [pendingImport]
  );
  const hasActiveFilters = Boolean(search || direction !== "all" || category !== "all" || dateFrom || dateTo);
  function clearFilters() {
    setSearch("");
    setDirection("all");
    setCategory("all");
    setDateFrom("");
    setDateTo("");
  }
  const filteredRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return pendingImport.filter((record) => {
      const matchesSearch = !query || record.description.toLocaleLowerCase("pt-BR").includes(query) || (record.sourceRecordId ?? "").toLocaleLowerCase("pt-BR").includes(query);
      const matchesDirection = direction === "all" || record.direction === direction;
      const matchesCategory = category === "all" || record.category === category;
      const matchesFrom = !dateFrom || record.date >= dateFrom;
      const matchesTo = !dateTo || record.date <= dateTo;
      return matchesSearch && matchesDirection && matchesCategory && matchesFrom && matchesTo;
    });
  }, [pendingImport, search, direction, category, dateFrom, dateTo]);
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
          <button type="button" className="secondary-button" onClick={onSelectFile}>
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

        {detectedColumns.length > 0 && (
          <div className="import-column-map" style={{ marginTop: 16, padding: 14, border: "1px solid var(--border)", borderRadius: 10 }}>
            <strong>Estrutura identificada</strong>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "4px 0 10px" }}>O RSBUILD reconheceu os cabeçalhos e associou os campos conhecidos ao padrão financeiro.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {detectedColumns.map((column, index) => (
                <span key={index} style={{ display: "inline-flex", gap: 6, alignItems: "center", padding: "5px 8px", borderRadius: 7, background: "var(--muted)", fontSize: 11 }}>
                  <span>{column.source}</span><span aria-hidden="true">→</span><strong>{column.field ?? "Ignorada"}</strong>
                </span>
              ))}
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
            <div className="import-account-link">
              <div>
                <strong>Vincular a uma conta <span>(opcional)</span></strong>
                <p>Se o arquivo não identificar a conta automaticamente, selecione a conta da organização. O vínculo será gravado junto com a importação.</p>
              </div>
              <select value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)} disabled={accountsLoading}>
                <option value="">Identificação automática / sem associação manual</option>
                {accounts.map((account) => <option key={account.id} value={account.id}>{[account.institution, account.name, account.external_reference ? `•••• ${account.external_reference.slice(-4)}` : ""].filter(Boolean).join(" · ")}</option>)}
              </select>
              {accountsLoading && <span style={{ fontSize: 12 }}>Carregando contas...</span>}
              {accountsError && <span role="alert" style={{ color: "var(--destructive)", fontSize: 12 }}>{accountsError}</span>}
            </div>
            <div className="preview-heading import-preview-heading">
              <div>
                <h2>Prévia dos registros</h2>
                <p>Confira os dados antes de confirmar a importação.</p>
              </div>
              <span className="import-total-count">{pendingImport.length} registros no arquivo</span>
            </div>
            <div className="import-filters" aria-label="Filtros da prévia de importação">
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Buscar descrição ou ID
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ex.: PIX, fornecedor..." />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Movimento
                <select value={direction} onChange={(e) => setDirection(e.target.value)}>
                  <option value="all">Todos</option><option value="entrada">Entradas</option><option value="saída">Saídas</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Categoria
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="all">Todas</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>De
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Até
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </label>
            </div>
            <div className="import-filter-summary">
              <span aria-live="polite"><strong>{filteredRecords.length}</strong> de {pendingImport.length} registros exibidos</span>
              {hasActiveFilters && <button type="button" className="text-button" onClick={clearFilters}>Limpar filtros</button>}
            </div>
            {filteredRecords.length > 0 ? (
              <RecordTable records={filteredRecords.slice(0, 8)} />
            ) : (
              <div className="import-filter-empty" role="status">Nenhum registro corresponde aos filtros. Ajuste ou limpe os critérios para continuar.</div>
            )}
            <div className="import-actions" aria-label="Ações da importação">
              <button type="button" className="secondary-button" onClick={onCancelImport}>
                Cancelar
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={onExportOmieOfx}
                title="Exportar lote normalizado pronto para Omie"
              >
                ⚡ Exportar OFX (Omie)
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => { void onConfirmImport(selectedAccountId || null); }}
                disabled={isImporting || importErrors.length > 0 || pendingImport.length === 0}
                aria-busy={isImporting}
              >
                {isImporting ? "Persistindo..." : "Confirmar importação"}
              </button>
            </div>
          </>
        )}
      </section>

      <div className="inline-note">
        Os movimentos confirmados são gravados no banco da organização ativa. A prévia só é persistida após a confirmação.
      </div>

      <DataIntakePanel organizationId={organizationId} canWrite={canWrite} />
      
      {/* Guide Balloon */}
      {getGuide("importacoes") && (
        <GuideBalloon
          guideId="importacoes"
          steps={getGuide("importacoes")!.steps}
          autoStart={true}
        />
      )}
    </>
  );
}

