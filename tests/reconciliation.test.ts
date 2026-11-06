import test from "node:test";
import assert from "node:assert/strict";
import { FinancialRecord } from "../lib/finance";
import {
  ReceivableTitle,
  matchTitlesWithRecords,
  buildSettlementItems,
  generateOmieBatchSettlementCsv,
  buildOmieReceiptPayload,
  parseReceivablesCsv
} from "../lib/reconciliation";

const sampleTitles: ReceivableTitle[] = [
  {
    id: "tit-001",
    documentNumber: "NF-4580",
    customerName: "Supermercado Bahia Real",
    amount: 1500.0,
    dueDate: "2026-04-10",
    bankAccount: "Itaú",
    ourNumber: "0341999888",
    status: "pendente"
  },
  {
    id: "tit-002",
    documentNumber: "NF-4581",
    customerName: "Distribuidora Alimentos Salvador",
    amount: 3200.5,
    dueDate: "2026-04-12",
    bankAccount: "BNB",
    status: "pendente"
  },
  {
    id: "tit-003",
    documentNumber: "NF-4582",
    customerName: "Padaria e Lanchonete Estrela",
    amount: 850.0,
    dueDate: "2026-04-15",
    bankAccount: "Inter",
    status: "pendente"
  },
  {
    id: "tit-004",
    documentNumber: "NF-4583",
    customerName: "Mercado Regional Lauro de Freitas",
    amount: 5000.0,
    dueDate: "2026-04-20",
    bankAccount: "Itaú",
    status: "pendente"
  }
];

const sampleRecords: FinancialRecord[] = [
  {
    id: "rec-1",
    date: "2026-04-11",
    description: "TED 0341999888 Supermercado Bahia",
    amount: 1500.0,
    direction: "entrada",
    category: "Recebimentos",
    source: "Itaú Unibanco",
    status: "pendente",
    sourceRecordId: "FIT-001",
    bankCode: "0341"
  },
  {
    id: "rec-2",
    date: "2026-04-12",
    description: "PIX Recebido NF-4581",
    amount: 3250.5, // 50 reais de juros de mora
    direction: "entrada",
    category: "Recebimentos",
    source: "Banco do Nordeste (BNB)",
    status: "pendente",
    sourceRecordId: "FIT-002",
    bankCode: "0004"
  },
  {
    id: "rec-3",
    date: "2026-04-15",
    description: "Depósito identificado",
    amount: 850.0, // Valor exato na data de vencimento
    direction: "entrada",
    category: "Recebimentos",
    source: "Banco Inter",
    status: "pendente",
    sourceRecordId: "FIT-003",
    bankCode: "0077"
  },
  {
    id: "rec-4",
    date: "2026-04-10",
    description: "Pagamento de Fornecedor Farinha",
    amount: 1500.0, // Mesmo valor de tit-001, mas é SAÍDA bancária!
    direction: "saída",
    category: "Fornecedores",
    source: "Itaú Unibanco",
    status: "pendente",
    sourceRecordId: "FIT-004"
  }
];

test("ENG-MS-02: matching exato e documental identifica títulos e ignora saídas", () => {
  const matches = matchTitlesWithRecords(sampleTitles, sampleRecords);
  assert.equal(matches.length, 4);

  // tit-001 match documental pelo Nosso Número
  const m1 = matches.find((m) => m.title.id === "tit-001");
  assert.ok(m1);
  assert.equal(m1.confidence, "documental");
  assert.equal(m1.statementRecord?.id, "rec-1");
  assert.equal(m1.suggestedStatus, "pronto_para_baixa");

  // tit-002 match documental pela NF-4581 com juros de 50 reais
  const m2 = matches.find((m) => m.title.id === "tit-002");
  assert.ok(m2);
  assert.equal(m2.statementRecord?.id, "rec-2");
  assert.equal(m2.amountDifference, 50.0);
  assert.ok(m2.notes[0].includes("NF-4581"));

  // tit-003 match exato por valor e janela de data
  const m3 = matches.find((m) => m.title.id === "tit-003");
  assert.ok(m3);
  assert.equal(m3.confidence, "exato");
  assert.equal(m3.statementRecord?.id, "rec-3");
  assert.equal(m3.suggestedStatus, "pronto_para_baixa");

  // tit-004 sem correspondência (rec-4 é saída, não pode casar com recebível)
  const m4 = matches.find((m) => m.title.id === "tit-004");
  assert.ok(m4);
  assert.equal(m4.confidence, "sem_correspondencia");
  assert.equal(m4.suggestedStatus, "nao_identificado");
});

test("ENG-MS-02: buildSettlementItems calcula juros e descontos com precisão", () => {
  const matches = matchTitlesWithRecords(sampleTitles, sampleRecords);
  const readyMatches = matches.filter((m) => m.statementRecord !== undefined);
  const settlements = buildSettlementItems(readyMatches);

  assert.equal(settlements.length, 3);

  // Título 1: valor exato sem juros nem desconto
  assert.equal(settlements[0].amountOriginal, 1500.0);
  assert.equal(settlements[0].amountPaid, 1500.0);
  assert.equal(settlements[0].interest, 0);
  assert.equal(settlements[0].discount, 0);

  // Título 2: pago com R$ 50 de juros
  assert.equal(settlements[1].amountOriginal, 3200.5);
  assert.equal(settlements[1].amountPaid, 3250.5);
  assert.equal(settlements[1].interest, 50.0);
  assert.equal(settlements[1].discount, 0);
});

test("ENG-MS-02: generateOmieBatchSettlementCsv formata CSV no padrão exigido pelo Omie", () => {
  const matches = matchTitlesWithRecords(sampleTitles, sampleRecords);
  const settlements = buildSettlementItems(matches.filter((m) => m.statementRecord !== undefined));
  const csv = generateOmieBatchSettlementCsv(settlements);

  // Verifica cabeçalhos oficiais
  assert.match(csv, /Identificador_Titulo;Numero_Documento;Cliente;Data_Recebimento;Valor_Recebido/);
  // Verifica formatação brasileira de valores (vírgula decimal)
  assert.match(csv, /1500,00/);
  assert.match(csv, /3250,50/);
  // Verifica formatação de datas (DD/MM/AAAA)
  assert.match(csv, /11\/04\/2026/);
  assert.match(csv, /12\/04\/2026/);
  // Verifica proveniência do FITID
  assert.match(csv, /FIT-001/);
});

test("ENG-MS-02: buildOmieReceiptPayload gera estrutura para a API Financas.Recebimento.Lancar", () => {
  const matches = matchTitlesWithRecords(sampleTitles, sampleRecords);
  const settlements = buildSettlementItems(matches.filter((m) => m.statementRecord !== undefined));
  const payload = buildOmieReceiptPayload(settlements[1], 102030);

  assert.equal(payload.cCodIntTitulo, "tit-002");
  assert.equal(payload.dDtReceb, "12/04/2026");
  assert.equal(payload.nValorReceb, 3250.5);
  assert.equal(payload.nJuros, 50.0);
  assert.equal(payload.nCodCC, 102030);
  assert.ok(payload.cObs?.includes("FITID: FIT-002"));
});

test("ENG-MS-02: parseReceivablesCsv importa títulos a receber do Omie", () => {
  const rawCsv = [
    "Numero_Documento;Cliente;Valor_Titulo;Data_Vencimento;Conta_Corrente",
    "NF-1001;Padaria Central;1200,50;20/04/2026;Itaú",
    "NF-1002;Restaurante Sabor da Bahia;850,00;22/04/2026;BNB"
  ].join("\n");

  const result = parseReceivablesCsv(rawCsv);
  assert.equal(result.titles.length, 2);
  assert.deepEqual(result.errors, []);
  assert.equal(result.titles[0].documentNumber, "NF-1001");
  assert.equal(result.titles[0].customerName, "Padaria Central");
  assert.equal(result.titles[0].amount, 1200.5);
  assert.equal(result.titles[0].dueDate, "2026-04-20");
  assert.equal(result.titles[1].amount, 850.0);
});

