import test from "node:test";
import assert from "node:assert/strict";
import type { FinancialRecord, OmieRecord } from "../lib/finance";
import { suggestOmieCandidates } from "../lib/reconciliation-suggestions";

const bank = (overrides: Partial<FinancialRecord> = {}): FinancialRecord => ({
  id: "bank-1", date: "2026-11-17", description: "PIX RECEBIDO KANONA ALIMENTOS",
  amount: 1849.43, direction: "entrada", category: "Não classificado", source: "OFX",
  status: "pendente", ...overrides
});
const omie = (overrides: Partial<OmieRecord> = {}): OmieRecord => ({
  id: "omie-1", date: "2026-11-17", description: "Kanona Alimentos — NF 00055104",
  amount: 1849.43, direction: "entrada", documentNumber: "00055104", ...overrides
});

test("S1: ranks exact value+date+description candidate first", () => {
  const result = suggestOmieCandidates(bank(), [omie(), omie({ id: "omie-2", description: "Outro", amount: 10 })]);
  assert.equal(result[0].omieRecord.id, "omie-1");
  assert.ok(result[0].score >= 75);
  assert.ok(result[0].evidence.includes("valor exato"));
});

test("S2: document in bank description produces top evidence", () => {
  const rec = bank({ description: "TED NF-00055104 KANONA" });
  const result = suggestOmieCandidates(rec, [omie({ documentNumber: "00055104" })]);
  assert.ok(result[0].evidence.includes("documento"));
  assert.ok(result[0].score >= 55);
});

test("S3: never suggests opposite direction", () => {
  const result = suggestOmieCandidates(bank(), [omie({ direction: "saída" })]);
  assert.equal(result.length, 0);
});

test("S4: date beyond tolerance is excluded", () => {
  const result = suggestOmieCandidates(bank(), [omie({ date: "2026-11-30" })], { maxDaysTolerance: 5 });
  assert.equal(result.length, 0);
});

test("S5: amount mismatch caps score and surfaces difference", () => {
  const result = suggestOmieCandidates(bank(), [omie({ amount: 1900 })]);
  assert.ok(result.length > 0);
  assert.ok(result[0].score <= 65);
  assert.ok(Math.abs(result[0].amountDifference + 50.57) < 0.01);
});

test("S6: unrelated records produce no candidates", () => {
  const result = suggestOmieCandidates(
    bank({ description: "TARIFA PACOTE SERVICOS" }),
    [omie({ description: "Fornecedor XYZ-industria", amount: 50, documentNumber: "NF-1" })]
  );
  assert.equal(result.length, 0);
});

test("S7: returns at most `limit` candidates ordered by score", () => {
  const many = Array.from({ length: 10 }, (_, i) =>
    omie({ id: `omie-${i}`, amount: 1849.43 + i, description: `Kanona Alimentos ${i}` })
  );
  const result = suggestOmieCandidates(bank(), many, { limit: 3 });
  assert.equal(result.length, 3);
  for (let i = 1; i < result.length; i++) {
    assert.ok(result[i - 1].score >= result[i].score);
  }
});
