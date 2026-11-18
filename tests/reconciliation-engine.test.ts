import test from "node:test";
import assert from "node:assert/strict";
import type { FinancialRecord } from "../lib/finance";
import { matchFinancialTitlesWithRecords, type FinancialTitle } from "../lib/reconciliation-engine";

const title = (overrides: Partial<FinancialTitle> = {}): FinancialTitle => ({
  id: "title-1", documentNumber: "NF-9001", counterpartyName: "Fornecedor Alfa",
  amount: 1250, dueDate: "2026-11-17", direction: "saída", status: "pendente", ...overrides
});
const record = (overrides: Partial<FinancialRecord> = {}): FinancialRecord => ({
  id: "bank-1", date: "2026-11-17", description: "PAGAMENTO NF-9001 FORNECEDOR ALFA",
  amount: 1250, direction: "saída", category: "Não classificado", source: "OFX",
  status: "pendente", ...overrides
});

test("A1: supports payable matching against bank debits", () => {
  const result = matchFinancialTitlesWithRecords([title()], [record()]);
  assert.equal(result[0].status, "matched");
  assert.equal(result[0].record?.id, "bank-1");
  assert.equal(result[0].confidence, "high");
});

test("A1: supports receivable matching against bank credits", () => {
  const result = matchFinancialTitlesWithRecords(
    [title({ direction: "entrada" })],
    [record({ direction: "entrada" })]
  );
  assert.equal(result[0].status, "matched");
});

test("A1: never matches opposite bank direction", () => {
  const result = matchFinancialTitlesWithRecords([title()], [record({ direction: "entrada" })]);
  assert.equal(result[0].status, "no_match");
});

test("A1: amount mismatch with matching document is sent to review, not auto-settled", () => {
  const result = matchFinancialTitlesWithRecords([title()], [record({ amount: 1300 })]);
  assert.equal(result[0].status, "pending_review");
  assert.equal(result[0].amountDifference, 50);
  assert.ok(result[0].reasons.some((reason) => reason.includes("never auto-settle")));
});

test("A1: equal-score competition remains pending review", () => {
  const result = matchFinancialTitlesWithRecords(
    [title(), title({ id: "title-2", documentNumber: "NF-9001" })],
    [record()]
  );
  assert.ok(result.every((item) => item.status === "pending_review"));
});

test("A1: does not consume one bank movement more than once", () => {
  const result = matchFinancialTitlesWithRecords(
    [title(), title({ id: "title-2", documentNumber: "NF-9002", counterpartyName: "Fornecedor Beta" })],
    [record()]
  );
  assert.equal(result.filter((item) => item.status === "matched").length, 1);
});

test("A1: settled or cancelled titles and already reconciled records are excluded", () => {
  const result = matchFinancialTitlesWithRecords(
    [title({ status: "baixado" }), title({ id: "title-2", status: "cancelado" })],
    [record({ status: "conciliado" })]
  );
  assert.equal(result.length, 0);
});

test("A1: invalid amounts cannot produce a match", () => {
  const result = matchFinancialTitlesWithRecords([title({ amount: NaN })], [record()]);
  assert.equal(result[0].status, "no_match");
});
