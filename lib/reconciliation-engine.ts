import type { Direction, FinancialRecord } from "./finance";

export type FinancialTitle = {
  id: string;
  documentNumber?: string;
  counterpartyName: string;
  amount: number;
  dueDate: string;
  direction: Direction;
  status: "pendente" | "baixado" | "cancelado";
};

export type ReconciliationCandidate = {
  titleId: string;
  recordId: string;
  score: number;
  amountDifference: number;
  evidence: string[];
};

export type FinancialMatchResult = {
  title: FinancialTitle;
  record?: FinancialRecord;
  status: "matched" | "pending_review" | "exception" | "no_match";
  confidence: "high" | "medium" | "none";
  amountDifference: number;
  candidates: ReconciliationCandidate[];
  reasons: string[];
};

export type BidirectionalMatchOptions = {
  maxDaysTolerance?: number;
  autoMatchMinimumScore?: number;
};

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\\u0300-\\u036f]/g, "")
  .toLocaleLowerCase("pt-BR")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const cents = (value: number) => Number.isFinite(value) ? Math.round(value * 100) : NaN;

function dayDistance(a: string, b: string): number | null {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(a) || !/^\\d{4}-\\d{2}-\\d{2}$/.test(b)) return null;
  const left = Date.parse(a + "T00:00:00Z");
  const right = Date.parse(b + "T00:00:00Z");
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return Math.abs(Math.round((left - right) / 86_400_000));
}

/**
 * Bidirectional, conservative matching proposal engine.
 * It never mutates records or authorizes a settlement.
 * Automatic matches require exact value, compatible direction, a unique
 * top-ranked candidate on both sides, and either a document or counterparty
 * identity signal. Amount differences are always routed to manual review.
 */
export function matchFinancialTitlesWithRecords(
  titles: FinancialTitle[],
  records: FinancialRecord[],
  options: BidirectionalMatchOptions = {}
): FinancialMatchResult[] {
  const maxDays = options.maxDaysTolerance ?? 5;
  const minimumScore = options.autoMatchMinimumScore ?? 90;
  if (!Number.isInteger(maxDays) || maxDays < 0) throw new Error("maxDaysTolerance must be a non-negative integer.");
  if (!Number.isInteger(minimumScore) || minimumScore < 1 || minimumScore > 100) throw new Error("autoMatchMinimumScore must be between 1 and 100.");

  const eligibleTitles = titles.filter((title) => title.status === "pendente");
  const eligibleRecords = records.filter((record) => record.status === "pendente");
  const candidatesByTitle = new Map<string, ReconciliationCandidate[]>();

  for (const title of eligibleTitles) {
    const titleAmount = cents(title.amount);
    const titleName = normalize(title.counterpartyName);
    const titleDoc = normalize(title.documentNumber ?? "");
    const candidates: ReconciliationCandidate[] = [];

    for (const record of eligibleRecords) {
      if (record.direction !== title.direction) continue;
      const recordAmount = cents(record.amount);
      if (!Number.isSafeInteger(titleAmount) || titleAmount <= 0 || !Number.isSafeInteger(recordAmount) || recordAmount < 0) continue;
      const distance = dayDistance(record.date, title.dueDate);
      if (distance === null || distance > maxDays) continue;

      const recordText = normalize(record.description);
      const docMatch = titleDoc.length >= 3 && recordText.includes(titleDoc);
      const nameMatch = titleName.length >= 5 && recordText.includes(titleName);
      const amountDifference = Math.round((recordAmount - titleAmount)) / 100;
      const exactAmount = recordAmount === titleAmount;
      const evidence: string[] = [];
      if (docMatch) evidence.push("document_reference");
      if (nameMatch) evidence.push("counterparty_name");
      if (exactAmount) evidence.push("exact_amount");
      if (distance === 0) evidence.push("same_date");
      else evidence.push("date_window");

      let score = 0;
      if (docMatch) score += 55;
      if (nameMatch) score += 35;
      if (exactAmount) score += 30;
      if (distance === 0) score += 10;
      else score += Math.max(0, 5 - distance);
      if (!exactAmount && (docMatch || nameMatch)) score = Math.min(score, 65);
      if (score > 0) candidates.push({ titleId: title.id, recordId: record.id, score, amountDifference, evidence });
    }

    candidates.sort((a, b) => b.score - a.score || a.recordId.localeCompare(b.recordId));
    candidatesByTitle.set(title.id, candidates);
  }

  const candidatesByRecord = new Map<string, ReconciliationCandidate[]>();
  for (const candidates of candidatesByTitle.values()) {
    for (const candidate of candidates) {
      const list = candidatesByRecord.get(candidate.recordId) ?? [];
      list.push(candidate);
      candidatesByRecord.set(candidate.recordId, list);
    }
  }

  const reservedTitles = new Set<string>();
  const reservedRecords = new Set<string>();
  const accepted: ReconciliationCandidate[] = [];
  const allCandidates = [...candidatesByTitle.values()].flat()
    .sort((a, b) => b.score - a.score || a.titleId.localeCompare(b.titleId) || a.recordId.localeCompare(b.recordId));

  for (const candidate of allCandidates) {
    if (candidate.score < minimumScore || candidate.amountDifference !== 0) continue;
    const titleCandidates = candidatesByTitle.get(candidate.titleId) ?? [];
    const recordCandidates = candidatesByRecord.get(candidate.recordId) ?? [];
    const titleTop = titleCandidates[0]?.score;
    const recordTop = Math.max(0, ...recordCandidates.map((item) => item.score));
    const titleTied = titleCandidates.filter((item) => item.score === titleTop).length !== 1;
    const recordTied = recordCandidates.filter((item) => item.score === recordTop).length !== 1;
    if (candidate.score !== titleTop || candidate.score !== recordTop || titleTied || recordTied) continue;
    if (reservedTitles.has(candidate.titleId) || reservedRecords.has(candidate.recordId)) continue;
    reservedTitles.add(candidate.titleId);
    reservedRecords.add(candidate.recordId);
    accepted.push(candidate);
  }

  const recordById = new Map(eligibleRecords.map((record) => [record.id, record]));
  return eligibleTitles.map((title) => {
    const candidates = candidatesByTitle.get(title.id) ?? [];
    const chosen = accepted.find((candidate) => candidate.titleId === title.id);
    if (chosen) {
      return {
        title, record: recordById.get(chosen.recordId), status: "matched" as const,
        confidence: "high" as const, amountDifference: 0, candidates,
        reasons: ["Unique high-confidence candidate.", ...chosen.evidence]
      };
    }
    if (!candidates.length) {
      return {
        title, status: "no_match" as const, confidence: "none" as const,
        amountDifference: 0, candidates, reasons: ["No compatible pending bank movement found."]
      };
    }
    const best = candidates[0];
    const bestTies = candidates.filter((candidate) => candidate.score === best.score);
    const contested = bestTies.length > 1 || (candidatesByRecord.get(best.recordId) ?? []).filter((candidate) => candidate.score === best.score).length > 1;
    const amountMismatch = best.amountDifference !== 0;
    return {
      title, status: "pending_review" as const, confidence: "medium" as const,
      amountDifference: best.amountDifference, candidates,
      reasons: [
        contested ? "Ambiguous candidate: competing title or movement." : "Candidate does not meet automatic matching rules.",
        ...(amountMismatch ? ["Amount mismatch: manual review required; never auto-settle."] : []),
        ...best.evidence
      ]
    };
  });
}
