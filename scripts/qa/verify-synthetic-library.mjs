import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/qa/library");
const manifest = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8"));
const failures = [];
const inventory = [];

function rows(file) {
  return readFileSync(resolve(root, file), "utf8").trim().split(/\r?\n/).slice(1).map(line => line.split(","));
}
function money(value) { return Math.round(Number(value) * 100); }

for (const dataset of manifest.datasets) {
  const raw = readFileSync(resolve(root, dataset.file));
  const digest = createHash("sha256").update(raw).digest("hex");
  const records = raw.toString("utf8").trim().split(/\r?\n/).length - 1;
  if (records !== dataset.records) failures.push(`${dataset.id}: expected ${dataset.records} records, got ${records}`);
  inventory.push({ id: dataset.id, version: dataset.version, file: dataset.file, records, sha256: digest });
}

const bank = rows("bank-statements-synthetic.csv");
const credits = bank.filter(r => r[5] === "Entrada").reduce((sum, r) => sum + money(r[4]), 0);
const debits = bank.filter(r => r[5] === "Saída").reduce((sum, r) => sum + Math.abs(money(r[4])), 0);
if (credits !== 263000 || debits !== 163000 || credits - debits !== 100000) failures.push("bank statement totals mismatch");

const ar = rows("receivables-synthetic.csv");
const arTotal = ar.reduce((sum, r) => sum + money(r[6]), 0);
if (arTotal !== 515000 || ar.length !== 6) failures.push("receivables total/count mismatch");

const batch = rows("batch-settlement-synthetic.csv");
if (batch.length !== 5 || batch.some(r => r[6] !== "false")) failures.push("batch must contain 5 rows and payment_authorized=false for all");

const pod = rows("proof-of-delivery-index-synthetic.csv");
if (pod.filter(r => r[5] === "INDEXED").length !== 3 || pod.filter(r => r[5] === "MISSING_DOCUMENT").length !== 1) failures.push("proof-of-delivery expected statuses mismatch");

console.log(JSON.stringify({ library: manifest.library, version: manifest.version, inventory, checks: { bankCreditsBRL: credits / 100, bankDebitsBRL: debits / 100, bankNetBRL: (credits - debits) / 100, receivablesBRL: arTotal / 100, batchRows: batch.length, podIndexed: 3, podMissing: 1 }, failures }, null, 2));
if (failures.length) process.exitCode = 1;
