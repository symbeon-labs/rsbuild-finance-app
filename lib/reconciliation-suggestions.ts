import type { Direction, FinancialRecord, OmieRecord } from "./finance";

export type OmieCandidate = {
  omieRecord: OmieRecord;
  score: number;
  amountDifference: number;
  dateDistanceDays: number;
  evidence: string[];
};

export type SuggestOmieCandidatesOptions = {
  maxDaysTolerance?: number;
  limit?: number;
};

const STOPWORDS = new Set([
  "para", "com", "uma", "dos", "das", "por", "mais", "como", "mas", "foi",
  "ao", "aos", "à", "às", "de", "do", "da", "em", "no", "na", "os", "as",
  "um", "uma", "se", "ou", "que", "the", "and", "pix", "boleto", "ted",
  "doc", "pagamento", "recebimento", "transferencia", "transferência",
]);

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();


function meaningfulTokens(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(" ")
      .filter((token) => token.length > 3 && !STOPWORDS.has(token))
  );
}

function parseIsoDate(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(value + "T00:00:00Z");
  if (!Number.isFinite(timestamp)) return null;
  return timestamp;
}

function dayDistance(a: string, b: string): number | null {
  const left = parseIsoDate(a);
  const right = parseIsoDate(b);
  if (left === null || right === null) return null;
  return Math.abs(Math.round((left - right) / 86_400_000));
}

/**
 * Sugere os melhores lançamentos Omie candidatos para um movimento bancário.
 * Apenas propõe — nunca confirma conciliação. Pesos alinhados ao motor
 * bidirecional (reconciliation-engine): documento 55, contraparte/descrição
 * 35, valor exato 30, mesma data 10. Divergência de valor limita o score.
 */
export function suggestOmieCandidates(
  bankRecord: FinancialRecord,
  omieRecords: OmieRecord[],
  options: SuggestOmieCandidatesOptions = {}
): OmieCandidate[] {
  const maxDays = options.maxDaysTolerance ?? 5;
  const limit = options.limit ?? 3;
  const bankTokens = meaningfulTokens(bankRecord.description);
  const bankText = normalize(bankRecord.description);

  const candidates: OmieCandidate[] = [];

  for (const omieRecord of omieRecords) {
    if (bankRecord.direction !== omieRecord.direction) continue;

    const distance = dayDistance(bankRecord.date, omieRecord.date);
    if (distance === null || distance > maxDays) continue;

    const omieText = normalize(omieRecord.description);
    const doc = normalize(omieRecord.documentNumber ?? "");
    const docMatch = doc.length >= 3 && bankText.includes(doc);

    const omieTokens = meaningfulTokens(omieRecord.description);
    let shared = 0;
    for (const token of bankTokens) {
      if (omieTokens.has(token)) shared += 1;
    }
    const descriptionMatch = shared >= 2;

    const differenceCents = Math.round((bankRecord.amount - omieRecord.amount) * 100);
    const exactAmount = Math.abs(differenceCents) <= 1;
    const amountDifference = differenceCents / 100;

    const evidence: string[] = [];
    let score = 0;
    if (docMatch) {
      score += 55;
      evidence.push("documento");
    }
    if (descriptionMatch) {
      score += 35;
      evidence.push(`descrição (${shared} termos)`);
    }
    if (exactAmount) {
      score += 30;
      evidence.push("valor exato");
    }
    if (distance === 0) {
      score += 10;
      evidence.push("mesma data");
    } else {
      score += Math.max(0, 5 - distance);
      evidence.push(`data ±${distance}d`);
    }
    if (!exactAmount && (docMatch || descriptionMatch)) score = Math.min(score, 65);

    // Sem evidência de valor, documento ou descrição, a proximidade de data
    // sozinha gera ruído — não vale exibir como candidato.
    if (score > 0 && (docMatch || descriptionMatch || exactAmount)) {
      candidates.push({ omieRecord, score, amountDifference, dateDistanceDays: distance, evidence });
    }
  }

  candidates.sort(
    (a, b) => b.score - a.score || Math.abs(a.amountDifference) - Math.abs(b.amountDifference) || a.omieRecord.id.localeCompare(b.omieRecord.id)
  );
  return candidates.slice(0, limit);
}
