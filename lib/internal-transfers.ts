import type { FinancialRecord } from "./finance";

export type InternalTransferStatus = "suggested" | "ambiguous";

export type InternalTransferSuggestion = {
  id: string;
  outgoing: FinancialRecord;
  incoming: FinancialRecord;
  status: InternalTransferStatus;
  confidence: "high" | "review";
  dateDifferenceDays: number;
  amountDifference: number;
  reasons: string[];
};

const TRANSFER_TERMS = /\b(transfer|transferencia|transf|ted|doc|pix|entre contas|mesma titularidade)\b/i;

function dateDistanceDays(left: string, right: string): number {
  const a = new Date(`${left}T00:00:00Z`).getTime();
  const b = new Date(`${right}T00:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((a - b) / 86_400_000));
}

function accountKey(record: FinancialRecord): string {
  return [record.bankCode ?? "", record.branchId ?? "", record.accountId ?? ""].join(":");
}

/**
 * Suggests possible transfers between accounts belonging to the same workspace.
 * Suggestions are deliberately non-mutating: callers must obtain human approval
 * before reclassifying either movement or excluding it from income/expense totals.
 */
export function detectInternalTransfers(
  records: FinancialRecord[],
  options: { dateToleranceDays?: number } = {}
): InternalTransferSuggestion[] {
  const tolerance = options.dateToleranceDays ?? 2;
  const outgoing = records.filter((record) =>
    record.direction === "saída" && record.status === "pendente" &&
    Boolean(record.accountId) && Number.isFinite(record.amount) && record.amount > 0
  );
  const incoming = records.filter((record) =>
    record.direction === "entrada" && record.status === "pendente" &&
    Boolean(record.accountId) && Number.isFinite(record.amount) && record.amount > 0
  );

  const candidates: InternalTransferSuggestion[] = [];
  for (const debit of outgoing) {
    for (const credit of incoming) {
      if (debit.id === credit.id || accountKey(debit) === accountKey(credit)) continue;
      const amountDifference = Math.round(Math.abs(debit.amount - credit.amount) * 100) / 100;
      if (amountDifference > 0.01) continue;
      const dateDifferenceDays = dateDistanceDays(debit.date, credit.date);
      if (dateDifferenceDays > tolerance) continue;

      const transferLanguage = TRANSFER_TERMS.test(debit.description) || TRANSFER_TERMS.test(credit.description);
      candidates.push({
        id: `transfer:${debit.id}:${credit.id}`,
        outgoing: debit,
        incoming: credit,
        status: "suggested",
        confidence: dateDifferenceDays <= 1 && transferLanguage ? "high" : "review",
        dateDifferenceDays,
        amountDifference,
        reasons: [
          "Valores de saída e entrada compatíveis",
          `Movimentações em contas diferentes, com ${dateDifferenceDays} dia(s) de diferença`,
          ...(transferLanguage ? ["Descrição contém indicação de transferência"] : ["Descrição não confirma, isoladamente, uma transferência"])
        ]
      });
    }
  }

  // A movement with multiple plausible counterparts must never be auto-selected.
  const outgoingCounts = new Map<string, number>();
  const incomingCounts = new Map<string, number>();
  for (const candidate of candidates) {
    outgoingCounts.set(candidate.outgoing.id, (outgoingCounts.get(candidate.outgoing.id) ?? 0) + 1);
    incomingCounts.set(candidate.incoming.id, (incomingCounts.get(candidate.incoming.id) ?? 0) + 1);
  }
  return candidates
    .map((candidate) => ({
      ...candidate,
      status: (outgoingCounts.get(candidate.outgoing.id)! > 1 || incomingCounts.get(candidate.incoming.id)! > 1)
        ? "ambiguous" as const
        : "suggested" as const
    }))
    .sort((a, b) => a.dateDifferenceDays - b.dateDifferenceDays || a.amountDifference - b.amountDifference);
}
