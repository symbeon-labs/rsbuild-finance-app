"use client";

import { useState } from "react";
import { FinancialRecord, formatCurrency, formatDate } from "@/lib/finance";

export function Metric({
  label,
  value,
  tone,
  detail,
  icon
}: {
  label: string;
  value: string;
  tone: string;
  detail: string;
  icon: string;
}) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <span className={`metric-icon ${tone}`}>{icon}</span>
      </div>
      <strong className="metric-value">{value}</strong>
      <span className="metric-detail">{detail}</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
  onAction
}: {
  icon: string;
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <strong>{title}</strong>
      <p>{text}</p>
      {action && onAction && (
        <button className="text-button" onClick={onAction}>
          {action} →
        </button>
      )}
    </div>
  );
}

function CopyableReference({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }
  return (
    <span className="traceability-code">
      <span><b>{label}</b> <code title={value}>{value.length > 20 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value}</code></span>
      <button type="button" onClick={() => void copy()} aria-label={`Copiar ${label}`} title={`Copiar ${label}`}>{copied ? "Copiado" : "Copiar"}</button>
    </span>
  );
}

export function RecordTable({ records }: { records: FinancialRecord[] }) {
  return (
    <>
      <details className="traceability-legend">
        <summary><span aria-hidden="true">ⓘ</span> Entenda os códigos de rastreabilidade</summary>
        <div className="traceability-legend-grid">
          <p><b>ID RSBUILD</b><span>Identificador único interno do registro financeiro na plataforma.</span></p>
          <p><b>ID de origem (FITID)</b><span>Referência recebida da instituição financeira no OFX, quando fornecida. Em outros formatos, pode ser uma referência de origem disponível.</span></p>
          <p><b>ID do lote</b><span>Identifica a importação que originou o registro e permite agrupar itens do mesmo arquivo.</span></p>
        </div>
      </details>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição / rastreabilidade</th>
              <th>Categoria</th>
              <th>Origem / Instituição</th>
              <th>Status</th>
              <th className="align-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td>{formatDate(record.date)}</td>
                <td className="description-cell">
                  <div>{record.description}</div>
                  <div className="record-origin-mobile"><span>ORIGEM / INSTITUIÇÃO</span><strong>{record.bankName || record.source || "Origem não identificada"}</strong></div>
                  <div className="traceability-stack">
                    <CopyableReference label="RSBUILD" value={record.id} />
                    {record.sourceRecordId && <CopyableReference label="ORIGEM" value={record.sourceRecordId} />}
                    {record.importBatchId && <CopyableReference label="LOTE" value={record.importBatchId} />}
                  </div>
                </td>
                <td>{record.category}</td>
                <td>
                  <span className="status-pill" style={{ background: "var(--bg)", color: "var(--ink)", borderColor: "var(--line)" }}>
                    {record.bankName || record.source}
                  </span>
                </td>
                <td>
                  <span className="status-pill">{record.status}</span>
                </td>
                <td className={record.direction === "entrada" ? "align-right positive" : "align-right negative"}>
                  {record.direction === "entrada" ? "+" : "−"} {formatCurrency(record.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function Placeholder({ title, eyebrow, text }: { title: string; eyebrow: string; text: string }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <p>{text}</p>
        </div>
      </div>
      <section className="panel placeholder-panel">
        <div className="empty-icon">◌</div>
        <strong>Configuração em preparação</strong>
        <p>Esta área será disponibilizada após a definição dos dados e regras operacionais correspondentes.</p>
      </section>
    </>
  );
}

