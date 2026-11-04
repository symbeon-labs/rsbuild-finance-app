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
};

export type ImportResult = {
  records: FinancialRecord[];
  errors: string[];
};

function parseBrazilianAmount(value: string): number | null {
  const normalized = value.trim().replace(/R\$\s?/i, "").replace(/\s/g, "");
  if (!normalized) return null;
  const parsed = normalized.includes(",")
    ? Number(normalized.replace(/\./g, "").replace(",", "."))
    : Number(normalized);
  return Number.isFinite(parsed) ? Math.abs(parsed) : null;
}

function parseDate(value: string): string | null {
  const input = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const br = input.match(/^(\d{2})[/.](\d{2})[/.](\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

export function parseCsv(text: string): ImportResult {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { records: [], errors: ["O arquivo não contém linhas de dados."] };

  const first = lines[0] ?? "";
  const delimiter = [",", ";", "\t"].sort((a, b) => first.split(b).length - first.split(a).length)[0] ?? ";";
  const headers = splitCsvLine(first, delimiter).map((item) => item.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const find = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const dateIndex = find("data", "date", "data_movimento", "data lancamento");
  const descriptionIndex = find("descricao", "description", "historico", "memo", "lancamento");
  const amountIndex = find("valor", "amount", "montante");
  const directionIndex = find("tipo", "direcao", "direction", "natureza");
  const categoryIndex = find("categoria", "category");
  const errors: string[] = [];

  if (dateIndex < 0 || descriptionIndex < 0 || amountIndex < 0) {
    return {
      records: [],
      errors: ["Cabeçalhos obrigatórios não identificados. O CSV precisa conter Data, Descrição e Valor."]
    };
  }

  const records: FinancialRecord[] = [];
  lines.slice(1).forEach((line, index) => {
    const cells = splitCsvLine(line, delimiter);
    const date = parseDate(cells[dateIndex] ?? "");
    const description = (cells[descriptionIndex] ?? "").trim();
    const amount = parseBrazilianAmount(cells[amountIndex] ?? "");
    const directionRaw = (directionIndex >= 0 ? cells[directionIndex] : "")?.toLocaleLowerCase("pt-BR") ?? "";
    if (!date || !description || amount === null) {
      errors.push(`Linha ${index + 2}: data, descrição ou valor inválido.`);
      return;
    }
    const direction: Direction = /saida|saída|debito|débito|despesa|pagamento|debit/.test(directionRaw)
      ? "saída"
      : /entrada|credito|crédito|receita|recebimento|credit/.test(directionRaw)
        ? "entrada"
        : /-/.test(cells[amountIndex] ?? "") ? "saída" : "entrada";
    records.push({
      id: `csv-${Date.now()}-${index}`,
      date,
      description,
      amount,
      direction,
      category: categoryIndex >= 0 ? (cells[categoryIndex] || "Não classificado") : "Não classificado",
      source: "Importação CSV",
      status: "pendente"
    });
  });
  return { records, errors };
}

export function parseOfx(text: string): ImportResult {
  if (!/<OFX[>\s]/i.test(text)) return { records: [], errors: ["O arquivo não possui uma estrutura OFX reconhecida."] };
  const blocks = text.match(/<STMTTRN[>\s]([\s\S]*?)(?=<\/STMTTRN>|(?=<STMTTRN[>\s])|$)/gi) ?? [];
  const records: FinancialRecord[] = [];
  const errors: string[] = [];
  blocks.forEach((raw, index) => {
    const get = (tag: string) => raw.match(new RegExp(`<${tag}>\\s*([^<\\r\\n]*)`, "i"))?.[1]?.trim() ?? "";
    const posted = get("DTPOSTED").slice(0, 8);
    const date = /^\d{8}$/.test(posted) ? `${posted.slice(0, 4)}-${posted.slice(4, 6)}-${posted.slice(6, 8)}` : null;
    const amountRaw = get("TRNAMT");
    const amount = Number(amountRaw);
    const description = get("NAME") || get("MEMO") || "Movimento bancário";
    if (!date || !amountRaw || !Number.isFinite(amount)) {
      errors.push(`Movimento ${index + 1}: dados obrigatórios inválidos.`);
      return;
    }
    records.push({
      id: `ofx-${Date.now()}-${index}`,
      date,
      description,
      amount: Math.abs(amount),
      direction: amount < 0 ? "saída" : "entrada",
      category: "Não classificado",
      source: "Importação OFX",
      status: "pendente"
    });
  });
  if (!blocks.length) errors.push("O extrato OFX não contém movimentos reconhecíveis.");
  return { records, errors };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
