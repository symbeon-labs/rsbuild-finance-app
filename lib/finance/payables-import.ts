import { createHash } from "node:crypto";

export type PayableImportRow = {
  rowNumber: number;
  supplierName: string;
  supplierDocument?: string;
  documentNumber: string;
  issueDate?: string;
  dueDate: string;
  amountMinor: number;
  category?: string;
  costCenter?: string;
  bankAccount?: string;
  paymentMethod?: string;
  recurrenceReference?: string;
  deduplicationKey: string;
};

export type PayableImportIssue = {
  rowNumber: number;
  code: "invalid_columns" | "missing_supplier" | "missing_document" | "invalid_due_date" | "invalid_issue_date" | "invalid_amount" | "field_too_long" | "duplicate_in_file";
  message: string;
};

export type PayableCsvPreview = {
  rows: PayableImportRow[];
  errors: PayableImportIssue[];
  duplicateCount: number;
  parsedCount: number;
};

type Field = "supplier" | "supplier_document" | "document" | "issue_date" | "due_date" | "amount" | "category" | "cost_center" | "bank_account" | "payment_method" | "recurrence";

const aliases: Record<Field, string[]> = {
  supplier: ["fornecedor", "favorecido", "beneficiario", "razao social", "nome fornecedor", "supplier"],
  supplier_document: ["cnpj", "cpf cnpj", "documento fornecedor", "cpf/cnpj", "supplier document"],
  document: ["documento", "numero documento", "numero do documento", "n documento", "numero", "titulo", "document number"],
  issue_date: ["emissao", "data emissao", "data de emissao", "issue date"],
  due_date: ["vencimento", "data vencimento", "data de vencimento", "due date"],
  amount: ["valor", "valor original", "valor documento", "valor total", "amount"],
  category: ["categoria", "grupo", "classificacao", "category"],
  cost_center: ["centro de custo", "centro custo", "cost center"],
  bank_account: ["conta bancaria", "conta", "banco", "bank account"],
  payment_method: ["forma pagamento", "forma de pagamento", "meio pagamento", "payment method"],
  recurrence: ["recorrencia", "recorrente", "grupo recorrencia", "recurrence"]
};

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();

type ParsedGridRow = { rowNumber: number; cells: string[] };

function parseDelimited(text: string): { rows: ParsedGridRow[]; delimiter: string | null; malformed: boolean } {
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", ";", "\t"].map((delimiter) => {
    let quoted = false, count = 0;
    for (let i = 0; i < firstLine.length; i++) {
      if (firstLine[i] === '"') {
        if (quoted && firstLine[i + 1] === '"') i++;
        else quoted = !quoted;
      } else if (!quoted && firstLine[i] === delimiter) count++;
    }
    return { delimiter, count };
  }).sort((a, b) => b.count - a.count);
  const delimiter = candidates[0].count > 0 && candidates[0].count !== candidates[1].count ? candidates[0].delimiter : null;
  if (!delimiter) return { rows: [], delimiter: null, malformed: false };

  const rows: ParsedGridRow[] = [];
  let cells: string[] = [], field = "", quoted = false, malformed = false, line = 1, rowLine = 1;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else { field += char; if (char === "\n") line++; }
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === delimiter) { cells.push(field.trim()); field = ""; }
    else if (char === "\n" || char === "\r") {
      cells.push(field.trim()); field = "";
      if (cells.some((cell) => cell !== "")) rows.push({ rowNumber: rowLine, cells });
      cells = [];
      if (char === "\r" && source[i + 1] === "\n") i++;
      line++; rowLine = line;
    } else if (char === '"') malformed = true;
    else field += char;
  }
  if (quoted) malformed = true;
  cells.push(field.trim());
  if (cells.some((cell) => cell !== "")) rows.push({ rowNumber: rowLine, cells });
  return { rows, delimiter, malformed };
}

function parseDate(value: string): string | null {
  const raw = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const br = /^(\d{2})[/.](\d{2})[/.](\d{4})$/.exec(raw);
  if (!iso && !br) return null;
  const year = Number(iso?.[1] ?? br?.[3]);
  const month = Number(iso?.[2] ?? br?.[2]);
  const day = Number(iso?.[3] ?? br?.[1]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function parseAmountMinor(value: string): number | null {
  let raw = value.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!raw || raw.startsWith("-") || raw.startsWith("(")) return null;
  if (raw.includes(",") && raw.includes(".")) {
    if (raw.lastIndexOf(",") > raw.lastIndexOf(".")) raw = raw.replace(/\./g, "").replace(",", ".");
    else raw = raw.replace(/,/g, "");
  } else if (raw.includes(",")) raw = raw.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

function fingerprint(row: Pick<PayableImportRow, "supplierName" | "documentNumber" | "dueDate" | "amountMinor">): string {
  return createHash("sha256").update([normalize(row.supplierName), normalize(row.documentNumber), row.dueDate, row.amountMinor].join("|")).digest("hex");
}

/** Shared grid mapper for CSV and XLSX, preserving original source row numbers. */
export function previewPayablesGrid(sourceRows: ParsedGridRow[]): PayableCsvPreview {
  if (sourceRows.length < 2) return {
    rows: [], errors: [{ rowNumber: 1, code: "invalid_columns", message: "A planilha precisa conter cabeçalho e pelo menos uma linha de dados." }],
    duplicateCount: 0, parsedCount: 0
  };
  const headers = sourceRows[0].cells.map(normalize);
  const indexes = Object.fromEntries((Object.keys(aliases) as Field[]).map((field) => [
    field, headers.findIndex((header) => aliases[field].some((alias) => normalize(alias) === header))
  ])) as Record<Field, number>;
  if ([indexes.supplier, indexes.document, indexes.due_date, indexes.amount].some((index) => index < 0)) {
    return {
      rows: [], errors: [{ rowNumber: sourceRows[0].rowNumber, code: "invalid_columns", message: "Colunas obrigatórias: Fornecedor, Documento, Vencimento e Valor." }],
      duplicateCount: 0, parsedCount: sourceRows.length - 1
    };
  }

  const rows: PayableImportRow[] = [], errors: PayableImportIssue[] = [], seen = new Set<string>();
  for (const source of sourceRows.slice(1)) {
    const cell = (field: Field) => indexes[field] < 0 ? "" : (source.cells[indexes[field]] ?? "").trim();
    const supplierName = cell("supplier"), documentNumber = cell("document");
    const dueDate = parseDate(cell("due_date")), amountMinor = parseAmountMinor(cell("amount"));
    const issueDateRaw = cell("issue_date"), issueDate = issueDateRaw ? parseDate(issueDateRaw) : undefined;
    if (!supplierName) { errors.push({ rowNumber: source.rowNumber, code: "missing_supplier", message: "Fornecedor não informado." }); continue; }
    if (!documentNumber) { errors.push({ rowNumber: source.rowNumber, code: "missing_document", message: "Número do documento não informado." }); continue; }
    if (!dueDate) { errors.push({ rowNumber: source.rowNumber, code: "invalid_due_date", message: "Vencimento inválido; use DD/MM/AAAA ou AAAA-MM-DD." }); continue; }
    if (amountMinor === null) { errors.push({ rowNumber: source.rowNumber, code: "invalid_amount", message: "Valor inválido; informe um valor positivo com até duas casas decimais." }); continue; }
    const candidate: PayableImportRow = {
      rowNumber: source.rowNumber, supplierName,
      supplierDocument: cell("supplier_document") || undefined, documentNumber: documentNumber.slice(0, 100),
      issueDate: parseDate(cell("issue_date")) ?? undefined, dueDate, amountMinor,
      category: cell("category") || undefined, costCenter: cell("cost_center") || undefined,
      bankAccount: cell("bank_account") || undefined, paymentMethod: cell("payment_method") || undefined,
      recurrenceReference: cell("recurrence") || undefined, deduplicationKey: ""
    };
    candidate.deduplicationKey = fingerprint(candidate);
    if (seen.has(candidate.deduplicationKey)) {
      errors.push({ rowNumber: source.rowNumber, code: "duplicate_in_file", message: "Título duplicado neste arquivo; segunda ocorrência não será incluída." });
      continue;
    }
    seen.add(candidate.deduplicationKey);
    rows.push(candidate);
  }
  return { rows, errors, duplicateCount: errors.filter((error) => error.code === "duplicate_in_file").length, parsedCount: sourceRows.length - 1 };
}

export function previewPayablesCsv(text: string): PayableCsvPreview {
  const parsed = parseDelimited(text);
  if (!parsed.delimiter || parsed.rows.length < 2 || parsed.malformed) return {
    rows: [], errors: [{ rowNumber: 1, code: "invalid_columns", message: "CSV inválido: verifique delimitador, aspas e a presença de cabeçalho e linhas." }],
    duplicateCount: 0, parsedCount: 0
  };
  return previewPayablesGrid(parsed.rows);
}
