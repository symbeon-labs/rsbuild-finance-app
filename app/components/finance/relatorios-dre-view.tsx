"use client";

import { useMemo, useState } from "react";
import { FinancialRecord, formatCurrency } from "@/lib/finance";
import { Metric, RecordTable } from "./common";

interface RelatoriosDreViewProps {
  records: FinancialRecord[];
  isLoading?: boolean;
}

export function RelatoriosDreView({ records, isLoading = false }: RelatoriosDreViewProps) {
  const [showRecords, setShowRecords] = useState(false);
  const [direction, setDirection] = useState<"all" | "entrada" | "saída">("all");

  const summary = useMemo(() => {
    const incoming = records.filter((r) => r.direction === "entrada").reduce((sum, r) => sum + r.amount, 0);
    const outgoing = records.filter((r) => r.direction === "saída").reduce((sum, r) => sum + r.amount, 0);
    const dates = records.map((r) => r.date).sort();
    const byDate = new Map<string, { incoming: number; outgoing: number; count: number }>();
    for (const record of records) {
      const day = byDate.get(record.date) ?? { incoming: 0, outgoing: 0, count: 0 };
      if (record.direction === "entrada") day.incoming += record.amount;
      else day.outgoing += record.amount;
      day.count += 1;
      byDate.set(record.date, day);
    }
    return { incoming, outgoing, net: incoming - outgoing, dates, byDate: [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)) };
  }, [records]);

  const visibleRecords = useMemo(
    () => [...records].filter((r) => direction === "all" || r.direction === direction).sort((a, b) => b.date.localeCompare(a.date)),
    [records, direction]
  );

  const dateLabel = summary.dates.length
    ? `${new Date(summary.dates[0] + "T12:00:00").toLocaleDateString("pt-BR")} a ${new Date(summary.dates[summary.dates.length - 1] + "T12:00:00").toLocaleDateString("pt-BR")}`
    : "Sem período disponível";

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">DEMONSTRATIVO GERENCIAL · BASE DE CAIXA</div>
          <h1>Relatórios DRE</h1>
          <p>Visão dinâmica dos movimentos financeiros persistidos no ambiente atual.</p>
        </div>
      </div>

      <section className="panel" style={{ marginBottom: 18, borderLeft: "3px solid var(--rsbuild-terracotta, #B5583C)" }}>
        <div className="panel-heading">
          <div>
            <h2>Consolidação do período</h2>
            <p>{dateLabel} · valores em BRL · {records.length} lançamentos</p>
          </div>
          <span className="subtle-tag">QA · CAIXA</span>
        </div>
        {isLoading ? <p>Carregando movimentos financeiros...</p> : records.length === 0 ? (
          <p>Não há movimentos financeiros persistidos para esta organização.</p>
        ) : (
          <div className="metric-grid">
            <Metric label="Entradas" value={formatCurrency(summary.incoming)} tone="positive" detail={`${records.filter(r => r.direction === "entrada").length} lançamentos`} icon="↙" />
            <Metric label="Saídas" value={formatCurrency(summary.outgoing)} tone="negative" detail={`${records.filter(r => r.direction === "saída").length} lançamentos`} icon="↗" />
            <Metric label="Resultado líquido de caixa" value={formatCurrency(summary.net)} tone="neutral" detail="Entradas menos saídas" icon="＝" />
            <Metric label="Movimentos" value={String(records.length)} tone="neutral" detail="Registros persistidos no Supabase" icon="▤" />
          </div>
        )}
      </section>

      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-heading">
          <div><h2>Movimentação diária</h2><p>Consolidação por data de lançamento</p></div>
        </div>
        {summary.byDate.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%" }}>
              <thead><tr><th>Data</th><th>Lançamentos</th><th>Entradas</th><th>Saídas</th><th>Resultado</th></tr></thead>
              <tbody>{summary.byDate.map(([date, day]) => (
                <tr key={date}>
                  <td>{new Date(date + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                  <td>{day.count}</td>
                  <td className="positive">{formatCurrency(day.incoming)}</td>
                  <td className="negative">{formatCurrency(day.outgoing)}</td>
                  <td>{formatCurrency(day.incoming - day.outgoing)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p>Aguardando registros financeiros.</p>}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><h2>Composição dos lançamentos</h2><p>Detalhamento dos registros que formam os totais</p></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select aria-label="Filtrar movimentos" value={direction} onChange={(e) => setDirection(e.target.value as typeof direction)}>
              <option value="all">Todos</option><option value="entrada">Entradas</option><option value="saída">Saídas</option>
            </select>
            <button className="secondary-button" type="button" onClick={() => setShowRecords((v) => !v)}>{showRecords ? "Ocultar lançamentos" : "Ver lançamentos"}</button>
          </div>
        </div>
        {showRecords && <RecordTable records={visibleRecords} />}
        {!showRecords && <p>Os totais acima são calculados diretamente dos lançamentos persistidos. Selecione “Ver lançamentos” para abrir a composição.</p>}
      </section>

      <div className="inline-note" role="note" style={{ marginTop: 16 }}>
        Demonstrativo gerencial preliminar em base de caixa. Ainda não representa DRE contábil/fiscal nem classifica automaticamente custos, despesas, impostos, financiamentos ou retiradas. Saldo inicial/final bancário e conciliação devem ser validados separadamente.
      </div>
    </>
  );
}
