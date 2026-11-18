import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/qa/library");
const manifestPath = resolve(root, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const writeHashes = process.argv.includes("--write-hashes");
const failures = [];
const inventory = [];

function parseCsv(file) {
  const text = readFileSync(resolve(root, file), "utf8").replace(/^\uFEFF/, "").trimEnd();
  const lines = text.split(/\r?\n/);
  function parseLine(line) {
    const fields = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"' && quoted && line[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { fields.push(field); field = ""; }
      else field += char;
    }
    if (quoted) throw new Error(`Unclosed quoted field in ${file}`);
    fields.push(field);
    return fields;
  }
  const headers = parseLine(lines[0]);
  return lines.slice(1).filter(line => line.length > 0).map((line, index) => {
    const values = parseLine(line);
    if (values.length !== headers.length) throw new Error(`${file}: row ${index + 2} has ${values.length} columns; expected ${headers.length}`);
    return Object.fromEntries(headers.map((header, i) => [header, values[i]]));
  });
}
function assert(condition, message) { if (!condition) failures.push(message); }
function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Invalid monetary value: ${value}`);
  return Math.round(number * 100);
}
function countBy(rows, field) {
  return rows.reduce((counts, row) => {
    counts[row[field]] = (counts[row[field]] ?? 0) + 1;
    return counts;
  }, {});
}

assert(manifest.production_allowed === false, "manifest must prohibit Production");
assert(manifest.raw_customer_data_included === false, "manifest must declare no raw customer data");
assert(manifest.environment_allowlist?.includes("MUNDO_DO_SABOR_QA"), "Mundo do Sabor QA must be allowlisted");
assert(manifest.environment_allowlist?.includes("SANDBOX"), "Sandbox must be allowlisted");
assert(!manifest.environment_allowlist?.includes("PRODUCTION"), "Production must not be allowlisted");

for (const dataset of manifest.datasets) {
  const raw = readFileSync(resolve(root, dataset.file));
  const digest = createHash("sha256").update(raw).digest("hex");
  const rows = parseCsv(dataset.file);
  assert(rows.length === dataset.records, `${dataset.id}: expected ${dataset.records} records, got ${rows.length}`);
  if (writeHashes) dataset.sha256 = digest;
  else assert(dataset.sha256 === digest, `${dataset.id}: SHA-256 mismatch (manifest=${dataset.sha256 ?? "null"}, actual=${digest})`);
  inventory.push({ id: dataset.id, version: dataset.version, file: dataset.file, records: rows.length, sha256: digest });
}

const datasets = Object.fromEntries(manifest.datasets.map(dataset => [dataset.id, dataset]));
const expectedFor = id => datasets[id]?.expected ?? {};
const bank = parseCsv(datasets["MS-QA-BANK-001"].file);
const bankExpected = expectedFor("MS-QA-BANK-001");
const credits = bank.filter(row => row.Tipo === "Entrada").reduce((sum, row) => sum + money(row.Valor), 0);
const debits = bank.filter(row => row.Tipo === "Saída").reduce((sum, row) => sum + Math.abs(money(row.Valor)), 0);
const divisions = [...new Set(bank.map(row => row.Divisao))].sort();
assert(bank.filter(row => row.Tipo === "Entrada").length === bankExpected.credits, "bank credit count mismatch");
assert(bank.filter(row => row.Tipo === "Saída").length === bankExpected.debits, "bank debit count mismatch");
assert((credits - debits) === money(bankExpected.net_total), "bank net total mismatch");
assert(JSON.stringify(divisions) === JSON.stringify([...bankExpected.divisions].sort()), "bank division aliases mismatch");

const ar = parseCsv(datasets["MS-QA-AR-001"].file);
const arExpected = expectedFor("MS-QA-AR-001");
const arTotal = ar.reduce((sum, row) => sum + money(row.amount_brl), 0);
assert(arTotal === money(arExpected.gross_total), "receivables gross total mismatch");
assert((countBy(ar, "status").OPEN ?? 0) === arExpected.open_items, "receivables open count mismatch");
assert((countBy(ar, "status").OVERDUE ?? 0) === arExpected.overdue_items, "receivables overdue count mismatch");

const reconciliation = parseCsv(datasets["MS-QA-REC-001"].file);
const recExpected = expectedFor("MS-QA-REC-001");
const recCounts = countBy(reconciliation, "expected_classification");
for (const [classification, expectedCount] of Object.entries({
  EXACT_MATCH: recExpected.exact_matches,
  PARTIAL_MATCH: recExpected.partial_matches,
  UNMATCHED: recExpected.unmatched,
  DUPLICATE: recExpected.duplicate,
  MANUAL_REVIEW: recExpected.manual_review
})) assert((recCounts[classification] ?? 0) === expectedCount, `reconciliation ${classification} count mismatch`);
const partial = reconciliation.find(row => row.expected_classification === "PARTIAL_MATCH");
assert(Boolean(partial?.expected_reason?.includes("R$ 600,00") && partial.expected_reason.includes("R$ 920,00") && partial.expected_reason.includes("R$ 320,00")), "partial-payment explanation must state paid, title and remaining amounts");

const batch = parseCsv(datasets["MS-QA-BATCH-001"].file);
const batchExpected = expectedFor("MS-QA-BATCH-001");
const batchCounts = countBy(batch, "expected_status");
assert(batch.length === batchExpected.items, "batch item count mismatch");
assert((batchCounts.PREPARABLE ?? 0) === batchExpected.preparable, "batch preparable count mismatch");
assert(((batchCounts.REVIEW ?? 0) + (batchCounts.REJECTED ?? 0)) === batchExpected.rejected_or_review, "batch review/rejected count mismatch");
assert(batch.every(row => row.payment_authorized === "false"), "batch contains an authorized payment");
assert(batchExpected.payment_executed === false, "manifest must declare payment_executed=false");

const pod = parseCsv(datasets["MS-QA-POD-001"].file);
const podExpected = expectedFor("MS-QA-POD-001");
const podCounts = countBy(pod, "document_status");
assert((podCounts.INDEXED ?? 0) === podExpected.indexed, "proof-of-delivery indexed count mismatch");
assert((podCounts.MISSING_DOCUMENT ?? 0) === podExpected.missing_document, "proof-of-delivery missing count mismatch");

if (writeHashes) writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const report = {
  library: manifest.library,
  version: manifest.version,
  mode: writeHashes ? "hashes-written" : "verification",
  inventory,
  checks: {
    bankCreditsBRL: credits / 100,
    bankDebitsBRL: debits / 100,
    bankNetBRL: (credits - debits) / 100,
    receivablesBRL: arTotal / 100,
    reconciliationCounts: recCounts,
    batchCounts,
    podCounts
  },
  failures
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
