export type Direction = "entrada" | "saída";

export type FinancialRecord = {
  id: string;
  date: string;
  description: string;
  amountMinor: number;
  direction: Direction;
  category: string;
  source: string;
  status: "conciliado" | "pendente" | "ignorado";
  sourceRecordId?: string;
  importBatchId?: string;
};

export type ImportResult = { records: FinancialRecord[]; errors: string[] };

type Amount = { cents: number; negative: boolean };

function parseAmount(raw: string): Amount | null {
  let value = raw.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!value) return null;
  let negative = false;
  if (value.startsWith("(") && value.endsWith(")")) {
    negative = true;
    value = value.slice(1, -1);
  }
  if (value.startsWith("-")) { negative = !negative; value = value.slice(1); }
  else if (value.startsWith("+")) value = value.slice(1);
  if (!/^\d[\d.,]*$/.test(value)) return null;

  let integer = "";
  let decimals = "";
  if (value.includes(",") && value.includes(".")) {
    const decimal = value.lastIndexOf(",") > value.lastIndexOf(".") ? "," : ".";
    const group = decimal === "," ? "." : ",";
    const parts = value.split(decimal);
    const grouping = new RegExp("^\\d{1,3}(" + group.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\d{3})+$");
    if (parts.length !== 2 || !/^\d{1,2}$/.test(parts[1]) || !grouping.test(parts[0])) return null;
    integer = parts[0].split(group).join("");
    decimals = parts[1];
  } else if (value.includes(",")) {
    const parts = value.split(",");
    if (parts.length !== 2 || !/^\d{1,2}$/.test(parts[1])) return null;
    [integer, decimals] = parts;
  } else if (value.includes(".")) {
    const parts = value.split(".");
    if (parts.length !== 2 || (/^\d{1,3}$/.test(parts[0]) && parts[1].length === 3) || !/^\d{1,2}$/.test(parts[1])) return null;
    [integer, decimals] = parts;
  } else integer = value;

  if (!/^\d+$/.test(integer)) return null;
  const cents = Number(integer) * 100 + Number((decimals + "00").slice(0, 2));
  return Number.isSafeInteger(cents) ? { cents, negative } : null;
}

function parseDate(raw: string): string | null {
  const value = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const br = /^(\d{2})[/.](\d{2})[/.](\d{4})$/.exec(value);
  const year = Number(iso?.[1] ?? br?.[3]);
  const month = Number(iso?.[2] ?? br?.[2]);
  const day = Number(iso?.[3] ?? br?.[1]);
  if (!iso && !br) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function detectDelimiter(input: string): string | null {
  const first = input.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((delimiter) => {
    let quoted = false;
    let count = 0;
    for (let i = 0; i < first.length; i++) {
      if (first[i] === '"') {
        if (quoted && first[i + 1] === '"') i++;
        else quoted = !quoted;
      } else if (!quoted && first[i] === delimiter) count++;
    }
    return { delimiter, count };
  }).sort((a, b) => b.count - a.count);
  return counts[0].count > 0 && counts[0].count !== counts[1].count ? counts[0].delimiter : null;
}

function parseRows(input: string, delimiter: string): { rows: { line: number; cells: string[] }[]; errors: string[] } {
  const source = input.replace(/^\uFEFF/, "");
  const rows: { line: number; cells: string[] }[] = [];
  const errors: string[] = [];
  let cells: string[] = [], field = "", quoted = false, line = 1, rowLine = 1;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else { field += char; if (char === "\n") line++; }
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === delimiter) { cells.push(field.trim()); field = ""; }
    else if (char === "\n" || char === "\r") {
      cells.push(field.trim()); field = "";
      if (cells.some((v) => v !== "")) rows.push({ line: rowLine, cells });
      cells = [];
      if (char === "\r" && source[i + 1] === "\n") i++;
      line++; rowLine = line;
    } else if (char === '"') { errors.push(`Linha ${line}: aspas inesperadas.`); field += char; }
    else field += char;
  }
  if (quoted) errors.push(`Linha ${rowLine}: campo entre aspas não foi fechado.`);
  cells.push(field.trim());
  if (cells.some((v) => v !== "")) rows.push({ line: rowLine, cells });
  return { rows, errors };
}

const normalize = (value: string) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const batchId = () => `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function parseCsv(text: string): ImportResult {
  const delimiter = detectDelimiter(text);
  if (!delimiter) return { records: [], errors: ["Delimitador CSV ambíguo ou ausente; use cabeçalhos separados por vírgula, ponto e vírgula ou tabulação."] };
  const parsed = parseRows(text, delimiter);
  if (parsed.rows.length < 2) return { records: [], errors: [...parsed.errors, "O arquivo não contém linhas de dados."] };
  const headers = parsed.rows[0].cells.map(normalize);
  const find = (...names: string[]) => headers.findIndex((h) => names.includes(h));
  const dateIndex = find("data", "date", "data movimento", "data_movimento", "data lancamento");
  const descriptionIndex = find("descricao", "description", "historico", "memo", "lancamento", "name");
  const amountIndex = find("valor", "amount", "montante");
  const directionIndex = find("tipo", "direcao", "direction", "natureza");
  const categoryIndex = find("categoria", "category");
  const errors = [...parsed.errors];
  if ([dateIndex, descriptionIndex, amountIndex].some((i) => i < 0)) {
    return { records: [], errors: [...errors, "Cabeçalhos obrigatórios: Data, Descrição e Valor."] };
  }

  const importBatchId = batchId();
  const records: FinancialRecord[] = [];
  for (const row of parsed.rows.slice(1)) {
    const date = parseDate(row.cells[dateIndex] ?? "");
    const description = (row.cells[descriptionIndex] ?? "").trim();
    const amount = parseAmount(row.cells[amountIndex] ?? "");
    const directionText = normalize(row.cells[directionIndex] ?? "");
    const declaresOut = /^(saida|debito|debit|despesa|pagamento)$/.test(directionText);
    const declaresIn = /^(entrada|credito|credit|receita|recebimento)$/.test(directionText);
    const hasUnknownDirection = directionText.length > 0 && !declaresOut && !declaresIn;
    const directionConflict = (declaresOut && declaresIn) || (amount?.negative && declaresIn);
    const direction = declaresOut || (amount?.negative && !directionText)
      ? "saída"
      : declaresIn
        ? "entrada"
        : null;

    if (!date || !description || !amount || hasUnknownDirection || directionConflict || !direction) {
      errors.push(`Linha ${row.line}: data, descrição, direção ou valor inválido/ambíguo; registro rejeitado.`);
      continue;
    }
    records.push({
      id: `csv-${importBatchId}-${row.line}`, date, description,
      amountMinor: amount.cents, direction,
      category: categoryIndex >= 0 ? (row.cells[categoryIndex] || "Não classificado") : "Não classificado",
      source: "Importação CSV", status: "pendente", importBatchId
    });
  }
  return { records, errors };
}

export function parseOfx(text: string): ImportResult {
  if (!/<OFX[>\s]/i.test(text)) return { records: [], errors: ["O arquivo não possui uma estrutura OFX reconhecida."] };
  const blocks = [...text.matchAll(/<STMTTRN\b[^>]*>([\s\S]*?)(?=<\/STMTTRN\s*>|<STMTTRN\b|<\/BANKTRANLIST\s*>)/gi)];
  const records: FinancialRecord[] = [];
  const errors: string[] = [];
  const importBatchId = batchId();
  const get = (block: string, tag: string) => block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"))?.[1]?.trim() ?? "";
  blocks.forEach((match, index) => {
    const block = match[1] ?? "";
    const posted = get(block, "DTPOSTED").slice(0, 8);
    const date = /^\d{8}$/.test(posted) ? parseDate(`${posted.slice(0,4)}-${posted.slice(4,6)}-${posted.slice(6,8)}`) : null;
    const rawAmount = get(block, "TRNAMT");
    const parsedAmount = parseAmount(rawAmount);
    if (!date || !parsedAmount) { errors.push(`Movimento OFX ${index + 1}: data ou valor inválido.`); return; }
    records.push({
      id: `ofx-${importBatchId}-${index + 1}`,
      date, description: get(block, "NAME") || get(block, "MEMO") || "Movimento bancário",
      amountMinor: parsedAmount.cents,
      direction: parsedAmount.negative ? "saída" : "entrada",
      category: "Não classificado", source: "Importação OFX", status: "pendente",
      sourceRecordId: get(block, "FITID") || undefined, importBatchId
    });
  });
  if (!blocks.length) errors.push("O extrato OFX não contém movimentos reconhecíveis.");
  return { records, errors };
}

export function formatCurrency(amountMinor: number): string {
  if (!Number.isSafeInteger(amountMinor)) throw new Error("Valor monetário fora do intervalo seguro.");
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amountMinor / 100);
}

export function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
