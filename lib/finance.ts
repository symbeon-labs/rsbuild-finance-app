export type Direction = "entrada" | "saída";

export type FinancialRecord = {
  id: string;
  date: string;
  description: string;
  amount: number;
  direction: Direction;
  category: string;
  source: string;
  status: "conciliado" | "pendente";
  sourceRecordId?: string;
  importBatchId?: string;
  bankCode?: string;
  bankName?: string;
  accountId?: string;
  branchId?: string;
  accountType?: string;
};

export type BankMetadata = {
  bankId?: string;
  bankName?: string;
  branchId?: string;
  accountId?: string;
  accountType?: string;
  balance?: number;
  dateStart?: string;
  dateEnd?: string;
};

export type ImportResult = {
  records: FinancialRecord[];
  errors: string[];
  metadata?: BankMetadata;
};

export const KNOWN_BANKS: Record<string, string> = {
  "0341": "Itaú Unibanco",
  "341": "Itaú Unibanco",
  "0077": "Banco Inter",
  "77": "Banco Inter",
  "0004": "Banco do Nordeste (BNB)",
  "4": "Banco do Nordeste (BNB)",
  "0102": "XP Investimentos",
  "102": "XP Investimentos",
  "0001": "Banco do Brasil",
  "1": "Banco do Brasil",
  "0033": "Santander",
  "33": "Santander",
  "0104": "Caixa Econômica Federal",
  "104": "Caixa Econômica Federal",
  "0237": "Bradesco",
  "237": "Bradesco",
  "0260": "Nubank",
  "260": "Nubank",
  "0336": "C6 Bank",
  "336": "C6 Bank",
};

export function identifyBank(bankId?: string, orgName?: string): { code: string; name: string } {
  if (bankId) {
    const cleanId = bankId.trim().replace(/^0+/, "");
    for (const [code, name] of Object.entries(KNOWN_BANKS)) {
      if (code.replace(/^0+/, "") === cleanId) {
        return { code: bankId.trim(), name };
      }
    }
  }
  if (orgName) {
    const orgUpper = orgName.toUpperCase();
    if (orgUpper.includes("ITAU") || orgUpper.includes("ITAÚ")) return { code: "0341", name: "Itaú Unibanco" };
    if (orgUpper.includes("INTER")) return { code: "0077", name: "Banco Inter" };
    if (orgUpper.includes("NORDESTE") || orgUpper.includes("BNB")) return { code: "0004", name: "Banco do Nordeste (BNB)" };
    if (orgUpper.includes("XP")) return { code: "0102", name: "XP Investimentos" };
    if (orgUpper.includes("BRASIL") || orgUpper.includes("BB")) return { code: "0001", name: "Banco do Brasil" };
    if (orgUpper.includes("SANTANDER")) return { code: "0033", name: "Santander" };
    if (orgUpper.includes("BRADESCO")) return { code: "0237", name: "Bradesco" };
  }
  return { code: bankId?.trim() || "0000", name: orgName?.trim() || "Instituição Bancária" };
}

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
      amount: amount.cents / 100, direction,
      category: categoryIndex >= 0 ? (row.cells[categoryIndex] || "Não classificado") : "Não classificado",
      source: "Importação CSV", status: "pendente", importBatchId
    });
  }
  return { records, errors };
}

export function parseOfx(text: string): ImportResult {
  if (!/<OFX[>\s]/i.test(text)) return { records: [], errors: ["O arquivo não possui uma estrutura OFX reconhecida."] };

  // Fix encoding header for Brazilian banks (Inter, Itaú, etc.)
  // They declare ENCODING:1252 which is invalid; fix to USASCII before parsing
  let fixedText = text.replace(/ENCODING:\s*1252/gi, "ENCODING:USASCII");

  const get = (block: string, tag: string) => block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"))?.[1]?.trim() ?? "";

  // Extract bank account metadata from header / statement
  const rawBankId = get(fixedText, "BANKID");
  const branchId = get(fixedText, "BRANCHID") || undefined;
  const accountId = get(fixedText, "ACCTID") || undefined;
  const accountType = get(fixedText, "ACCTTYPE") || undefined;
  const org = get(fixedText, "ORG") || get(fixedText, "FID") || undefined;
  const rawBalance = get(fixedText, "BALAMT");
  const balanceNum = rawBalance ? Number(rawBalance) : undefined;
  const dtStart = get(fixedText, "DTSTART") || undefined;
  const dtEnd = get(fixedText, "DTEND") || undefined;

  const bankInfo = identifyBank(rawBankId, org);
  const metadata: BankMetadata = {
    bankId: bankInfo.code !== "0000" ? bankInfo.code : (rawBankId || undefined),
    bankName: bankInfo.name,
    branchId,
    accountId,
    accountType,
    balance: Number.isFinite(balanceNum) ? balanceNum : undefined,
    dateStart: dtStart ? dtStart.slice(0, 8) : undefined,
    dateEnd: dtEnd ? dtEnd.slice(0, 8) : undefined,
  };

  const blockMatches = [...fixedText.matchAll(/<STMTTRN\b[^>]*>([\s\S]*?)(?=<\/STMTTRN\s*>|<STMTTRN\b|<\/BANKTRANLIST\s*>)/gi)];
  const blocks = blockMatches.map(m => ({ block: m[1] ?? "", index: blockMatches.indexOf(m) }));
  const records: FinancialRecord[] = [];
  const errors: string[] = [];
  const importBatchId = batchId();

  const sourceLabel = bankInfo.name !== "Instituição Bancária"
    ? (accountId ? bankInfo.name + " - C/C " + accountId : bankInfo.name)
    : (accountId ? "Conta " + accountId : "Importação OFX");

  // Cada STMTTRN permanece independente. FITID é preservado como origem,
  // mas não autoriza fundir transações por prefixo ou coincidência de ID.
  blocks.forEach(({ block, index }) => {
    const fitid = get(block, "FITID");
    const posted = get(block, "DTPOSTED").slice(0, 8);
    const date = /^\d{8}$/.test(posted)
      ? parseDate(posted.slice(0, 4) + "-" + posted.slice(4, 6) + "-" + posted.slice(6, 8))
      : null;
    const rawAmount = get(block, "TRNAMT");
    const amountIsValid = /^[-+]?\d+(?:\.\d{1,2})?$/.test(rawAmount);
    const signedAmount = amountIsValid ? Number(rawAmount) : NaN;
    const trnType = get(block, "TRNTYPE").toUpperCase();
    if (!date || !amountIsValid || !Number.isSafeInteger(Math.round(Math.abs(signedAmount) * 100))) {
      errors.push("Movimento OFX " + (index + 1) + " (FITID: " + (fitid || "sem ID") + "): data ou valor inválido.");
      return;
    }
    if (trnType === "CREDIT" && signedAmount < 0) {
      errors.push("Movimento OFX " + (index + 1) + " (FITID: " + (fitid || "sem ID") + "): TRNTYPE CREDIT conflita com valor negativo.");
      return;
    }
    const direction: Direction = trnType === "DEBIT" ? "saída" : trnType === "CREDIT" ? "entrada" : signedAmount < 0 ? "saída" : "entrada";
    records.push({
      id: "ofx-" + importBatchId + "-" + (index + 1),
      date,
      description: get(block, "NAME") || get(block, "MEMO") || "Movimento bancário",
      amount: Math.abs(Math.round(signedAmount * 100) / 100),
      direction,
      category: "Não classificado",
      source: sourceLabel,
      status: "pendente",
      sourceRecordId: fitid || undefined,
      bankCode: bankInfo.code !== "0000" ? bankInfo.code : (rawBankId || undefined),
      bankName: bankInfo.name,
      accountId,
      branchId,
      accountType,
      importBatchId
    });
  });
  // Validate date ordering (should be chronological)
  for (let i = 1; i < records.length; i++) {
    if (records[i].date < records[i - 1].date) {
      errors.push("Os movimentos não estão em ordem cronológica crescente. Alguns sistemas exigem ordenação por data.");
      break;
    }
  }

  if (!blocks.length) errors.push("O extrato OFX não contém movimentos reconhecíveis.");
  return { records, errors, metadata };
}

export function generateOmieOfx(records: FinancialRecord[], metadata?: BankMetadata): string {
  if (!records.length) throw new Error("Não há movimentações para exportar.");
  const bankIds = [...new Set(records.map((record) => record.bankCode).filter(Boolean))];
  const accountIds = [...new Set(records.map((record) => record.accountId).filter(Boolean))];
  if (bankIds.length > 1 || accountIds.length > 1) {
    throw new Error("Exportação bloqueada: o arquivo deve conter registros de uma única conta bancária.");
  }
  const bankId = metadata?.bankId || (bankIds.length === 1 ? bankIds[0] : undefined);
  const acctId = metadata?.accountId || (accountIds.length === 1 ? accountIds[0] : undefined);
  if (!bankId || !acctId || bankIds.length !== 1 || accountIds.length !== 1) {
    throw new Error("Exportação bloqueada: instituição e conta bancária devem estar identificadas em todos os registros.");
  }
  if (records.some((record) => record.bankCode !== bankId || record.accountId !== acctId)) {
    throw new Error("Exportação bloqueada: os metadados bancários dos registros não são consistentes.");
  }
  const accountType = metadata?.accountType || records[0]?.accountType;
  if (!accountType || !["CHECKING", "SAVINGS", "MONEYMRKT", "CREDITLINE"].includes(accountType.toUpperCase())) {
    throw new Error("Exportação bloqueada: tipo de conta OFX não identificado ou inválido.");
  }
  if (records.some((record) => record.accountType && record.accountType !== accountType)) {
    throw new Error("Exportação bloqueada: os registros possuem tipos de conta diferentes.");
  }
  const now = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);

  // Ordenar cronologicamente para conformidade estrita com o leitor do Omie
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));

  const transactions = sorted.map((r, i) => {
    const trnType = r.direction === "entrada" ? "CREDIT" : "DEBIT";
    const sign = r.direction === "saída" ? "-" : "";
    const amtStr = `${sign}${r.amount.toFixed(2)}`;
    const dtPosted = r.date.replace(/-/g, "") + "120000[-03:EST]";
    const fitid = r.sourceRecordId || `OMIE-${r.id || i + 1}`;
    // Higienizar texto para evitar quebras no leitor XML/SGML do Omie
    const memo = r.description.replace(/[<>&]/g, " ").trim();

    return `          <STMTTRN>
            <TRNTYPE>${trnType}</TRNTYPE>
            <DTPOSTED>${dtPosted}</DTPOSTED>
            <TRNAMT>${amtStr}</TRNAMT>
            <FITID>${fitid}</FITID>
            <MEMO>${memo}</MEMO>
          </STMTTRN>`;
  }).join("\n");

  const dtStart = sorted[0]?.date.replace(/-/g, "") || now.slice(0, 8);
  const dtEnd = sorted[sorted.length - 1]?.date.replace(/-/g, "") || now.slice(0, 8);

  return `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:1252
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS>
        <CODE>0</CODE>
        <SEVERITY>INFO</SEVERITY>
      </STATUS>
      <DTSERVER>${now}</DTSERVER>
      <LANGUAGE>POR</LANGUAGE>
    </SONRS>
  </SIGNONMSGSRSV1>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <TRNUID>1</TRNUID>
      <STATUS>
        <CODE>0</CODE>
        <SEVERITY>INFO</SEVERITY>
      </STATUS>
      <STMTRS>
        <CURDEF>BRL</CURDEF>
        <BANKACCTFROM>
          <BANKID>${bankId}</BANKID>
          <ACCTID>${acctId}</ACCTID>
          <ACCTTYPE>${accountType.toUpperCase()}</ACCTTYPE>
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>${dtStart}120000</DTSTART>
          <DTEND>${dtEnd}120000</DTEND>
${transactions}
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;
}

/** Codifica bytes Windows-1252 compatíveis com o cabeçalho do arquivo OFX. */
export function encodeWindows1252(value: string): Uint8Array {
  const special: Record<string, number> = {
    "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86,
    "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c,
    "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95,
    "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b,
    "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f
  };
  const bytes: number[] = [];
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (codePoint <= 0x7f || (codePoint >= 0xa0 && codePoint <= 0xff)) bytes.push(codePoint);
    else if (special[character] !== undefined) bytes.push(special[character]);
    else throw new Error("O caractere \"" + character + "\" não pode ser representado em Windows-1252.");
  }
  return new Uint8Array(bytes);
}

export function filterRecordsByPeriod<T extends { date: string }>(records: T[], days: number, now: Date = new Date()): T[] {
  if (!Number.isInteger(days) || days < 1) throw new Error("O período deve ser um número inteiro positivo de dias.");
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(today);
  start.setDate(start.getDate() - days + 1);
  const from = start.getFullYear().toString().padStart(4, "0") + "-" + (start.getMonth() + 1).toString().padStart(2, "0") + "-" + start.getDate().toString().padStart(2, "0");
  const to = today.getFullYear().toString().padStart(4, "0") + "-" + (today.getMonth() + 1).toString().padStart(2, "0") + "-" + today.getDate().toString().padStart(2, "0");
  return records.filter((record) => record.date >= from && record.date <= to);
}

export type PeriodOption =
  | "all"
  | "current_month"
  | "last_month"
  | "30"
  | "90"
  | "365"
  | "year"
  | "custom";

export interface PeriodFilterState {
  option: PeriodOption;
  startDate?: string;
  endDate?: string;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear().toString().padStart(4, "0");
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function filterRecordsByPeriodOption<T extends { date: string }>(
  records: T[],
  filter: PeriodFilterState,
  referenceDate: Date = new Date()
): T[] {
  if (!filter || filter.option === "all") return records;

  const now = referenceDate;
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  if (filter.option === "current_month") {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const from = toIsoDate(firstDay);
    const to = toIsoDate(lastDay);
    return records.filter((r) => r.date >= from && r.date <= to);
  }

  if (filter.option === "last_month") {
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0);
    const from = toIsoDate(firstDay);
    const to = toIsoDate(lastDay);
    return records.filter((r) => r.date >= from && r.date <= to);
  }

  if (filter.option === "year") {
    const firstDay = new Date(currentYear, 0, 1);
    const lastDay = new Date(currentYear, 11, 31);
    const from = toIsoDate(firstDay);
    const to = toIsoDate(lastDay);
    return records.filter((r) => r.date >= from && r.date <= to);
  }

  if (filter.option === "30" || filter.option === "90" || filter.option === "365") {
    return filterRecordsByPeriod(records, parseInt(filter.option, 10), referenceDate);
  }

  if (filter.option === "custom") {
    const from = filter.startDate?.trim() || "";
    const to = filter.endDate?.trim() || "";
    return records.filter((r) => {
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      return true;
    });
  }

  return records;
}
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
