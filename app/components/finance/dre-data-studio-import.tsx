"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/finance";

type StructuredRow = {
  date: string;
  description: string;
  amount: number;
  direction: "entrada" | "saída";
  category: string;
  sourceIndex: number;
};
type Field = "date" | "description" | "amount" | "direction" | "category";
type Mapping = Record<Field, string>;

const ALIASES: Record<Field, string[]> = {
  date: ["data", "date", "transaction_date", "data_movimento", "data_movimentacao"],
  description: ["descricao", "description", "historico", "memo", "detail", "nome"],
  amount: ["valor", "amount", "value", "valor_total", "montante"],
  direction: ["natureza", "direcao", "direction", "tipo", "type", "movimento"],
  category: ["categoria", "category", "classificacao", "classification", "rubrica"]
};
const normalizeKey = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
function parseCsv(text: string): Record<string, unknown>[] {
  const delimiter = (text.split(/\r?\n/, 1)[0].match(/;/g) ?? []).length > (text.split(/\r?\n/, 1)[0].match(/,/g) ?? []).length ? ";" : ",";
  const matrix: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); if (row.some(value => value.trim())) matrix.push(row); row = []; cell = "";
    } else cell += char;
  }
  row.push(cell); if (row.some(value => value.trim())) matrix.push(row);
  if (matrix.length < 2) throw new Error("O CSV precisa ter cabeçalho e pelo menos uma linha.");
  const headers = matrix[0].map(value => value.trim().replace(/^\uFEFF/, ""));
  return matrix.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}
function parseAmount(value: unknown): number {
  if (typeof value === "number") return value;
  const raw = String(value ?? "").trim().replace(/R\$\s?/gi, "").replace(/\s/g, "");
  if (!raw) return Number.NaN;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  return Number(normalized);
}
function parseDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const br = raw.match(/^(\d{2})[/.](\d{2})[/.](\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return "";
}
function csvCell(value: unknown) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }

export function DreDataStudioImport() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Mapping>({ date: "", description: "", amount: "", direction: "", category: "" });
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const mapped = useMemo(() => rawRows.map((raw, index) => {
    const get = (field: Field) => mapping[field] ? raw[mapping[field]] : "";
    const date = parseDate(get("date"));
    const description = String(get("description") ?? "").trim();
    const amount = parseAmount(get("amount"));
    const rawDirection = String(get("direction") ?? "").trim().toLowerCase();
    const direction = /^(entrada|credito|crédito|receita|credit|in|income)$/.test(rawDirection) ? "entrada" : /^(saida|saída|debito|débito|despesa|debit|out|expense)$/.test(rawDirection) ? "saída" : amount < 0 ? "saída" : "entrada";
    const category = String(get("category") ?? "").trim();
    const issues = [!date ? "data inválida" : "", !description ? "descrição ausente" : "", !Number.isFinite(amount) ? "valor inválido" : "", !rawDirection && !Number.isFinite(amount) ? "natureza não identificada" : ""].filter(Boolean);
    return { date, description, amount: Math.abs(amount), direction: direction as "entrada" | "saída", category, sourceIndex: index + 1, issues };
  }), [rawRows, mapping]);

  const validRows = mapped.filter(row => row.issues.length === 0);
  const invalidRows = mapped.filter(row => row.issues.length > 0);
  const totals = validRows.reduce((acc, row) => { if (row.direction === "entrada") acc.incoming += row.amount; else acc.outgoing += row.amount; return acc; }, { incoming: 0, outgoing: 0 });

  async function loadFile(file?: File) {
    if (!file) return;
    setError(""); setNotice("");
    try {
      const text = await file.text();
      let rows: Record<string, unknown>[];
      if (file.name.toLowerCase().endsWith(".json")) {
        const parsed = JSON.parse(text);
        const list = Array.isArray(parsed) ? parsed : parsed?.records;
        if (!Array.isArray(list) || !list.every(item => item && typeof item === "object" && !Array.isArray(item))) throw new Error("JSON deve conter uma lista de objetos ou uma propriedade records com essa lista.");
        rows = list as Record<string, unknown>[];
      } else if (file.name.toLowerCase().endsWith(".csv")) rows = parseCsv(text);
      else throw new Error("Formato ainda não suportado nesta etapa. Utilize CSV ou JSON.");
      if (!rows.length) throw new Error("O arquivo não contém registros.");
      const cols = [...new Set(rows.flatMap(row => Object.keys(row)))];
      const next = {} as Mapping;
      (Object.keys(ALIASES) as Field[]).forEach(field => { next[field] = cols.find(col => ALIASES[field].includes(normalizeKey(col))) ?? ""; });
      setHeaders(cols); setRawRows(rows); setMapping(next); setFileName(file.name);
      setNotice(`${rows.length.toLocaleString("pt-BR")} registros carregados para validação local. Nenhum dado foi gravado no financeiro.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível ler o arquivo."); setHeaders([]); setRawRows([]); }
  }

  function exportNormalized() {
    const rows = [["data", "descricao", "valor", "natureza", "categoria"], ...validRows.map(row => [row.date, row.description, row.amount.toFixed(2), row.direction, row.category])];
    const csv = rows.map(row => row.map(csvCell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "dre-dataset-normalizado.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  return <section className="panel dre-import-panel" style={{ marginTop: 18 }}>
    <div className="panel-heading"><div><span className="dre-section-kicker">DRE STUDIO · DATA INTAKE</span><h2>Importar dados estruturados</h2><p>Traga conjuntos CSV ou JSON, mapeie os campos e valide a qualidade antes de compor relatórios.</p></div><span className="subtle-tag">Processamento local</span></div>
    <label className="dre-upload-zone">
      <input type="file" accept=".csv,.json,text/csv,application/json" onChange={event => loadFile(event.target.files?.[0])} />
      <span className="dre-upload-symbol">↥</span><strong>{fileName || "Selecionar arquivo CSV ou JSON"}</strong>
      <small>O arquivo é analisado no navegador. A importação não altera os lançamentos financeiros.</small>
    </label>
    {error && <p className="dre-import-error" role="alert">{error}</p>}
    {notice && <p className="dre-import-notice" role="status">{notice}</p>}
    {headers.length > 0 && <>
      <div className="dre-mapping-grid">{(Object.keys(ALIASES) as Field[]).map(field => <label key={field}><span>{({date:"Data",description:"Descrição",amount:"Valor",direction:"Natureza",category:"Categoria"})[field]}</span><select className="filter-select" value={mapping[field]} onChange={event => setMapping(current => ({ ...current, [field]: event.target.value }))}><option value="">Não mapeado</option>{headers.map(header => <option key={header} value={header}>{header}</option>)}</select></label>)}</div>
      <div className="dre-import-summary"><div><small>Válidos</small><strong>{validRows.length}</strong></div><div><small>Com inconsistências</small><strong>{invalidRows.length}</strong></div><div><small>Entradas válidas</small><strong className="positive">{formatCurrency(totals.incoming)}</strong></div><div><small>Saídas válidas</small><strong className="negative">{formatCurrency(totals.outgoing)}</strong></div></div>
      <div className="panel-heading" style={{ marginTop: 18 }}><div><h3 style={{ margin: 0, fontSize: 13 }}>Prévia do conjunto</h3><p>Até 8 registros · {fileName}</p></div><button type="button" className="secondary-button" onClick={exportNormalized} disabled={!validRows.length}>Exportar normalizado</button></div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Data</th><th>Descrição</th><th>Natureza</th><th>Categoria</th><th style={{textAlign:"right"}}>Valor</th><th>Validação</th></tr></thead><tbody>{mapped.slice(0,8).map(row=><tr key={row.sourceIndex}><td>{row.date || "—"}</td><td>{row.description || "—"}</td><td>{row.direction}</td><td>{row.category || "—"}</td><td style={{textAlign:"right"}}>{Number.isFinite(row.amount) ? formatCurrency(row.amount) : "—"}</td><td>{row.issues.length ? row.issues.join(", ") : "Válido"}</td></tr>)}</tbody></table></div>
      <p className="quality-footnote">O conjunto importado permanece isolado da base financeira. Nesta primeira entrega, a saída normalizada pode ser exportada para análise; persistência, histórico de datasets e templates de relatórios serão etapas seguintes.</p>
    </>}
  </section>;
}
