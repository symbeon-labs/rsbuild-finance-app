"use client";

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

export function RecordTable({ records }: { records: FinancialRecord[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Descrição</th>
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
                {record.sourceRecordId && (
                  <span style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
                    FITID: {record.sourceRecordId}
                  </span>
                )}
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

