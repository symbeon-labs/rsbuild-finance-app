/**
 * RSBUILD OS · Motor de Fluxo de Caixa Projetado (7, 15, 30 e 60 dias)
 *
 * Calcula a projeção de liquidez a partir do saldo bancário atual somado
 * aos títulos a receber e a pagar em aberto nas janelas solicitadas pela gestão:
 *   - Vencidos (anteriores à data de referência)
 *   - D+7  (hoje até +7 dias)
 *   - D+15 (hoje até +15 dias)
 *   - D+30 (hoje até +30 dias)
 *   - D+60 (hoje até +60 dias)
 *
 * Gera alerta explícito quando qualquer janela projeta saldo negativo.
 */
import type { ReceivableTitle } from "./reconciliation";

export type CashFlowHorizonDays = 7 | 15 | 30 | 60;

export interface PayableTitleInput {
  id: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  status: "pendente" | "pago" | "cancelado";
  supplierName?: string;
}

export interface CashFlowHorizonBucket {
  days: CashFlowHorizonDays;
  label: string;
  /** Entradas previstas na janela (0..days), sem incluir vencidos */
  receivablesInWindow: number;
  /** Saídas previstas na janela (0..days), sem incluir vencidos */
  payablesInWindow: number;
  /** Saldo projetado ao final da janela (saldo atual + entradas - saídas da janela) */
  projectedBalance: number;
  /** Saldo projetado considerando também títulos vencidos a receber/pagar */
  projectedBalanceWithOverdue: number;
  /** Alerta de saldo negativo previsto */
  negativeAlert: boolean;
}

export interface CashFlowProjection {
  referenceDate: string;
  currentBalance: number;
  overdueReceivables: number;
  overdueReceivablesCount: number;
  overduePayables: number;
  overduePayablesCount: number;
  hasPayablesData: boolean;
  horizons: CashFlowHorizonBucket[];
  /** Verdadeiro se alguma janela (7, 15, 30 ou 60d) projetar saldo negativo */
  hasNegativeBalanceRisk: boolean;
  /** Primeira janela em que o saldo fica negativo, se houver */
  firstNegativeHorizonDays: CashFlowHorizonDays | null;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseIsoDayMs(isoDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const ms = Date.parse(`${isoDate}T00:00:00Z`);
  return Number.isFinite(ms) ? ms : null;
}

function diffCalendarDays(targetIso: string, referenceIso: string): number | null {
  const targetMs = parseIsoDayMs(targetIso);
  const refMs = parseIsoDayMs(referenceIso);
  if (targetMs === null || refMs === null) return null;
  return Math.round((targetMs - refMs) / (1000 * 60 * 60 * 24));
}

export function computeCashFlowProjection(params: {
  currentBalance: number;
  titles: ReceivableTitle[];
  payables?: PayableTitleInput[];
  referenceDate?: string;
}): CashFlowProjection {
  const referenceDate = params.referenceDate ?? new Date().toISOString().slice(0, 10);
  const currentBalance = roundCents(Number.isFinite(params.currentBalance) ? params.currentBalance : 0);
  const payables = params.payables ?? [];

  let overdueReceivables = 0;
  let overdueReceivablesCount = 0;
  const pendingReceivables: Array<{ days: number; amount: number }> = [];

  for (const t of params.titles) {
    if (t.status !== "pendente" || !Number.isFinite(t.amount) || t.amount <= 0) continue;
    const d = diffCalendarDays(t.dueDate, referenceDate);
    if (d === null) continue;
    if (d < 0) {
      overdueReceivables += t.amount;
      overdueReceivablesCount += 1;
    } else {
      pendingReceivables.push({ days: d, amount: t.amount });
    }
  }

  let overduePayables = 0;
  let overduePayablesCount = 0;
  const pendingPayables: Array<{ days: number; amount: number }> = [];

  for (const p of payables) {
    if (p.status !== "pendente" || !Number.isFinite(p.amount) || p.amount <= 0) continue;
    const d = diffCalendarDays(p.dueDate, referenceDate);
    if (d === null) continue;
    if (d < 0) {
      overduePayables += p.amount;
      overduePayablesCount += 1;
    } else {
      pendingPayables.push({ days: d, amount: p.amount });
    }
  }

  overdueReceivables = roundCents(overdueReceivables);
  overduePayables = roundCents(overduePayables);

  const horizonDays: CashFlowHorizonDays[] = [7, 15, 30, 60];
  let firstNegativeHorizonDays: CashFlowHorizonDays | null = null;

  const horizons: CashFlowHorizonBucket[] = horizonDays.map((days) => {
    const recInWindow = roundCents(
      pendingReceivables.filter((r) => r.days <= days).reduce((sum, r) => sum + r.amount, 0)
    );
    const payInWindow = roundCents(
      pendingPayables.filter((p) => p.days <= days).reduce((sum, p) => sum + p.amount, 0)
    );
    const projectedBalance = roundCents(currentBalance + recInWindow - payInWindow);
    const projectedBalanceWithOverdue = roundCents(
      projectedBalance + overdueReceivables - overduePayables
    );
    const negativeAlert = projectedBalance < 0;
    if (negativeAlert && firstNegativeHorizonDays === null) {
      firstNegativeHorizonDays = days;
    }

    return {
      days,
      label: `${days} dias`,
      receivablesInWindow: recInWindow,
      payablesInWindow: payInWindow,
      projectedBalance,
      projectedBalanceWithOverdue,
      negativeAlert
    };
  });

  return {
    referenceDate,
    currentBalance,
    overdueReceivables,
    overdueReceivablesCount,
    overduePayables,
    overduePayablesCount,
    hasPayablesData: payables.length > 0,
    horizons,
    hasNegativeBalanceRisk: firstNegativeHorizonDays !== null,
    firstNegativeHorizonDays
  };
}
