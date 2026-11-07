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

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        r.description.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.source.toLowerCase().includes(q) ||
        (r.bankName && r.bankName.toLowerCase().includes(q))
    );
  }, [records, query]);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LANÇAMENTOS</div>
          <h1>Movimentações</h1>
          <p>Consulte os registros financeiros carregados.</p>
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
            placeholder="Buscar por descrição, categoria ou origem..."
            aria-label="Buscar movimentações"
          />
          <span>{filteredRecords.length} registro(s)</span>
        </div>
        {filteredRecords.length ? (
          <RecordTable records={[...filteredRecords].sort((a, b) => b.date.localeCompare(a.date))} />
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

