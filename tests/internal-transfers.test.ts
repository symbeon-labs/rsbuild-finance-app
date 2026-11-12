import test from "node:test";
import assert from "node:assert/strict";
import type { FinancialRecord } from "../lib/finance";
import { detectInternalTransfers } from "../lib/internal-transfers";

function record(overrides: Partial<FinancialRecord> & Pick<FinancialRecord, "id" | "direction" | "accountId">): FinancialRecord {
  return {
    date: "2026-11-10",
    description: "Transferência entre contas",
    amount: 1250,
    category: "Não classificado",
    source: "OFX",
    status: "pendente",
    bankCode: "341",
    ...overrides
  };
}

test("detecta par entre contas distintas sem alterar os registros", () => {
  const debit = record({ id: "debit-1", direction: "saída", accountId: "111" });
  const credit = record({ id: "credit-1", direction: "entrada", accountId: "222", bankCode: "077" });
  const result = detectInternalTransfers([debit, credit]);

  assert.equal(result.length, 1);
  assert.equal(result[0].outgoing.id, "debit-1");
  assert.equal(result[0].incoming.id, "credit-1");
  assert.equal(result[0].status, "suggested");
  assert.equal(debit.status, "pendente");
  assert.equal(credit.status, "pendente");
});

test("não sugere transferência na mesma conta nem com valores incompatíveis", () => {
  const debit = record({ id: "debit-1", direction: "saída", accountId: "111" });
  const sameAccount = record({ id: "credit-1", direction: "entrada", accountId: "111" });
  const differentAmount = record({ id: "credit-2", direction: "entrada", accountId: "222", amount: 900 });
  assert.deepEqual(detectInternalTransfers([debit, sameAccount, differentAmount]), []);
});

test("marca como ambíguos movimentos com mais de um par plausível", () => {
  const debit = record({ id: "debit-1", direction: "saída", accountId: "111" });
  const creditA = record({ id: "credit-a", direction: "entrada", accountId: "222" });
  const creditB = record({ id: "credit-b", direction: "entrada", accountId: "333" });
  const result = detectInternalTransfers([debit, creditA, creditB]);
  assert.equal(result.length, 2);
  assert.ok(result.every((item) => item.status === "ambiguous"));
});

test("respeita tolerância de data configurável", () => {
  const debit = record({ id: "debit-1", direction: "saída", accountId: "111", date: "2026-11-01" });
  const credit = record({ id: "credit-1", direction: "entrada", accountId: "222", date: "2026-11-05" });
  assert.equal(detectInternalTransfers([debit, credit]).length, 0);
  assert.equal(detectInternalTransfers([debit, credit], { dateToleranceDays: 4 }).length, 1);
});
