import test from "node:test";
import assert from "node:assert/strict";
import { computeCashFlowProjection } from "../lib/cash-flow";
import { buildControllershipSummary } from "../lib/controllership";
import type { ReceivableTitle, ReconciliationMatch } from "../lib/reconciliation";

const title = (overrides: Partial<ReceivableTitle> = {}): ReceivableTitle => ({
  id: "tit-1",
  documentNumber: "NF-100",
  customerName: "Cliente Teste",
  amount: 1000,
  dueDate: "2026-11-26",
  status: "pendente",
  ...overrides
});

test("computeCashFlowProjection buckets receivables and payables across 7, 15, 30, 60 days", () => {
  const result = computeCashFlowProjection({
    referenceDate: "2026-11-24",
    currentBalance: 5000,
    titles: [
      title({ id: "overdue", dueDate: "2026-11-20", amount: 800 }),
      title({ id: "d2", dueDate: "2026-11-26", amount: 1200 }),
      title({ id: "d12", dueDate: "2026-12-06", amount: 2000 }),
      title({ id: "d25", dueDate: "2026-12-19", amount: 1500 }),
      title({ id: "d45", dueDate: "2027-01-08", amount: 3000 }),
      title({ id: "paid", dueDate: "2026-11-26", amount: 9999, status: "baixado" })
    ],
    payables: [
      { id: "p1", dueDate: "2026-11-25", amount: 7000, status: "pendente" },
      { id: "p2", dueDate: "2026-12-10", amount: 1000, status: "pendente" }
    ]
  });

  assert.equal(result.overdueReceivables, 800);
  assert.equal(result.overdueReceivablesCount, 1);
  assert.equal(result.hasPayablesData, true);
  assert.equal(result.hasNegativeBalanceRisk, true);
  assert.equal(result.firstNegativeHorizonDays, 7);

  const d7 = result.horizons.find((h) => h.days === 7)!;
  assert.equal(d7.receivablesInWindow, 1200);
  assert.equal(d7.payablesInWindow, 7000);
  assert.equal(d7.projectedBalance, -800);
  assert.equal(d7.negativeAlert, true);

  const d30 = result.horizons.find((h) => h.days === 30)!;
  assert.equal(d30.receivablesInWindow, 4700);
  assert.equal(d30.payablesInWindow, 8000);
  assert.equal(d30.projectedBalance, 1700);
  assert.equal(d30.negativeAlert, false);

  const d60 = result.horizons.find((h) => h.days === 60)!;
  assert.equal(d60.receivablesInWindow, 7700);
});

test("buildControllershipSummary classifies access denials, manual settlements, and discounts", () => {
  const matches: ReconciliationMatch[] = [
    {
      title: title({ id: "t-disc", documentNumber: "NF-200", customerName: "Mercado Sul", amount: 1000 }),
      statementRecord: {
        id: "rec-1",
        date: "2026-11-24",
        description: "PIX MERCADO SUL",
        amount: 920,
        direction: "entrada",
        category: "Vendas",
        source: "Itau",
        status: "pendente"
      },
      confidence: "aproximado",
      amountDifference: -80,
      suggestedStatus: "divergente",
      notes: ["Possível desconto concedido de R$ 80,00"]
    }
  ];

  const summary = buildControllershipSummary({
    auditEvents: [
      {
        id: 1,
        actorEmail: "operador@mundodosabor.com.br",
        eventType: "access.denied",
        entityType: "settlement",
        entityId: "batch-1",
        occurredAt: "2026-11-24T12:00:00Z",
        metadata: { action: "approve_batch_settlement", requiredRole: "owner" }
      },
      {
        id: 2,
        actorEmail: "vitor@mundodosabor.com.br",
        eventType: "reconciliation.decision",
        entityType: "reconciliation_decision",
        entityId: "dec-1",
        occurredAt: "2026-11-24T13:00:00Z",
        metadata: { decisionType: "manual_match", justification: "Comprovante conferido" }
      }
    ],
    matches
  });

  assert.equal(summary.countsByCategory.fora_de_alcada, 1);
  assert.equal(summary.countsByCategory.baixa_manual_estorno, 1);
  assert.equal(summary.countsByCategory.desconto_abatimento, 1);
  assert.equal(summary.totalDiscountsGranted, 80);
  assert.equal(summary.totalAlerts, 3);
});
