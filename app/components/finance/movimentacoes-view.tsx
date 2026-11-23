"use client";

import { useState, useMemo } from "react";
import { FinancialRecord } from "@/lib/finance";
import { EmptyState, RecordTable } from "./common";

interface MovimentacoesViewProps {
  records: FinancialRecord[];
  onOpenImport: () => void;
  onExportOmie: () => void;
}

export function MovimentacoesView({
  records,
  onOpenImport,
  onExportOmie
}: MovimentacoesViewProps) {
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState("all");
  const [category, setCategory] = useState("all");
  const [institution, setInstitution] = useState("all");
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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

      <section className="panel">
        <div className="table-toolbar">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar descrição, origem, FITID ou lote..."
            aria-label="Buscar movimentações"
          />
          <span>{filteredRecords.length} de {records.length} registro(s)</span>
        </div>

        {records.length > 0 && (
          <div
            aria-label="Filtros das movimentações"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "10px",
              margin: "12px 0 18px"
            }}
          >
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              Instituição / origem
              <select value={institution} onChange={(event) => setInstitution(event.target.value)}>
                <option value="all">Todas</option>
                {institutions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              Categoria
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="all">Todas</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              Movimento
              <select value={direction} onChange={(event) => setDirection(event.target.value)}>
                <option value="all">Entradas e saídas</option>
                <option value="entrada">Entradas</option>
                <option value="saída">Saídas</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">Todos</option>
                <option value="pendente">Pendente</option>
                <option value="conciliado">Conciliado</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              Data inicial
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              Data final
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </label>
          </div>
        )}

        {hasActiveFilters && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <button type="button" className="text-button" onClick={clearFilters}>Limpar filtros</button>
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
    </>
  );
}
