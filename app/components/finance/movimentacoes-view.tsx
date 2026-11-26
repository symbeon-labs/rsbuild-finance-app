"use client";

import { useState, useMemo } from "react";
import { FinancialRecord } from "@/lib/finance";
import { EmptyState, RecordTable } from "./common";
import { generateFinancialRecordsExcel, downloadExcelFile } from "@/lib/export";
import { ExportMenu, type ExportFormat } from "./export-menu";
import { generateErpCsv, type ErpFormat } from "@/lib/erp-export";
import { ErpExportSettings } from "./erp-export-settings";

interface MovimentacoesViewProps {
  records: FinancialRecord[];
  onOpenImport: () => void;
  onExportOmie: () => void;
  organizationId?: string;
}

export function MovimentacoesView({
  records,
  onOpenImport,
  onExportOmie,
  organizationId = ""
}: MovimentacoesViewProps) {
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState("all");
  const [category, setCategory] = useState("all");
  const [institution, setInstitution] = useState("all");
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showErpSettings, setShowErpSettings] = useState(false);

  const categories = useMemo(
    () => [...new Set(records.map((record) => record.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [records]
  );
  const institutions = useMemo(
    () => [...new Set(records.map((record) => record.bankName || record.source).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [records]
  );

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return records.filter((record) => {
      const searchable = [
        record.description,
        record.category,
        record.source,
        record.bankName ?? "",
        record.sourceRecordId ?? "",
        record.importBatchId ?? ""
      ].join(" ").toLocaleLowerCase("pt-BR");
      return (
        (!q || searchable.includes(q)) &&
        (direction === "all" || record.direction === direction) &&
        (category === "all" || record.category === category) &&
        (institution === "all" || (record.bankName || record.source) === institution) &&
        (status === "all" || record.status === status) &&
        (!dateFrom || record.date >= dateFrom) &&
        (!dateTo || record.date <= dateTo)
      );
    });
  }, [records, query, direction, category, institution, status, dateFrom, dateTo]);

  function clearFilters() {
    setQuery("");
    setDirection("all");
    setCategory("all");
    setInstitution("all");
    setStatus("all");
    setDateFrom("");
    setDateTo("");
  }

  function onExportFormat(format:ExportFormat,erpFormat?:ErpFormat) {
    if (!filteredRecords.length) return;
    
    if(format==="excel"){
      const data=generateFinancialRecordsExcel(filteredRecords,"Movimentações Financeiras","período selecionado");
      downloadExcelFile(data,`movimentacoes-${new Date().toISOString().slice(0,10)}.xlsx`);
    } else if(format==="csv"&&erpFormat){
      const csv=generateErpCsv(filteredRecords,{format:erpFormat,organizationId:"",organizationName:"Movimentações Financeiras",periodLabel:"período selecionado"});
      const blob=new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"});
      const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`movimentacoes-${erpFormat}-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
    } else if(format==="ofx"){
      // OFX já existe via onExportOmie
      onExportOmie();
    }
  }

  const hasActiveFilters = Boolean(
    query || direction !== "all" || category !== "all" || institution !== "all" ||
    status !== "all" || dateFrom || dateTo
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LANÇAMENTOS</div>
          <h1>Movimentações</h1>
          <p>Consulte e filtre os registros financeiros por coluna.</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <ExportMenu target="movimentacoes" onExport={onExportFormat} disabled={!filteredRecords.length} organizationId={organizationId} />
          {organizationId && (
            <button
              className="secondary-button"
              onClick={() => setShowErpSettings(true)}
              title="Configurar exportação ERP"
            >
              ⚙️ Configurar ERP
            </button>
          )}
          {records.length > 0 && (
            <button
              className="secondary-button"
              onClick={onExportOmie}
              title="Exportar lote padronizado para conciliação no Omie"
            >
              📥 Exportar OFX (Omie)
            </button>
          )}
          <button className="primary-button" onClick={onOpenImport}>
            ＋ Importar arquivo
          </button>
        </div>
      </div>

      <section className="panel movements-panel">
        <div className="table-toolbar movements-toolbar">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar descrição, origem, FITID ou lote..."
            aria-label="Buscar movimentações"
          />
          <span className="movements-count">{filteredRecords.length} de {records.length} registro(s)</span>
        </div>

        {records.length > 0 && (
          <div className="movement-filters" aria-label="Filtros das movimentações">
            <div className="movement-filters-heading">
              <div>
                <strong>Refinar movimentações</strong>
                <span>Combine os critérios para localizar lançamentos</span>
              </div>
              {hasActiveFilters && (
                <button type="button" className="text-button movement-clear" onClick={clearFilters}>Limpar filtros</button>
              )}
            </div>
            <label className="movement-filter-field">
              Instituição / origem
              <select value={institution} onChange={(event) => setInstitution(event.target.value)}>
                <option value="all">Todas</option>
                {institutions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="movement-filter-field">
              Categoria
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="all">Todas</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="movement-filter-field">
              Movimento
              <select value={direction} onChange={(event) => setDirection(event.target.value)}>
                <option value="all">Entradas e saídas</option>
                <option value="entrada">Entradas</option>
                <option value="saída">Saídas</option>
              </select>
            </label>
            <label className="movement-filter-field">
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">Todos</option>
                <option value="pendente">Pendente</option>
                <option value="conciliado">Conciliado</option>
              </select>
            </label>
            <label className="movement-filter-field">
              Data inicial
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </label>
            <label className="movement-filter-field">
              Data final
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </label>
          </div>
        )}

        {filteredRecords.length ? (
          <RecordTable records={[...filteredRecords].sort((a, b) => b.date.localeCompare(a.date))} />
        ) : records.length > 0 ? (
          <EmptyState
            icon="⌕"
            title="Nenhuma movimentação encontrada"
            text="Não há registros que correspondam aos filtros selecionados."
          />
        ) : (
          <EmptyState
            icon="⇄"
            title="Nenhuma movimentação encontrada"
            text="Carregue um extrato CSV ou OFX para consultar os lançamentos."
            action="Importar arquivo"
            onAction={onOpenImport}
          />
        )}
      </section>

      {showErpSettings && organizationId && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--surface)", borderRadius: "12px", maxWidth: "90vw", maxHeight: "90vh", overflow: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <ErpExportSettings organizationId={organizationId} onClose={() => setShowErpSettings(false)} />
          </div>
        </div>
      )}
    </>
  );
}
