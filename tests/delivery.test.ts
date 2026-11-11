import test from "node:test";
import assert from "node:assert/strict";
import {
  DeliveryProof,
  computeDeliveryMetrics,
  evaluateProtestoRisk,
  generateDeliveryBlindageCsv,
  isValidNfeKey,
  parseDeliveryCsv
} from "../lib/delivery";

test("ENG-MS-03: isValidNfeKey valida chaves de NF-e com dígito verificador SEFAZ (Módulo 11)", () => {
  // Chave sintética válida de 44 dígitos com DV correto
  // Exemplo de chave real SEFAZ (44 dígitos):
  // 35200114380200000160550010000000011000000010
  // Teste com chave conhecida:
  const validKey = "35200114380200000160550010000000011000000010"; // calculando DV:
  // Vamos calcular o DV real para montar chave válida:
  // Se montarmos uma chave e testarmos se o algoritmo calcula e aceita
  const base43 = "2926040123456700019955001000004580100000001"; // Bahia (29) + Ano/Mes (2604)
  // Calcula DV esperado para esta base:
  let sum = 0;
  let weight = 2;
  for (let i = base43.length - 1; i >= 0; i--) {
    sum += parseInt(base43[i], 10) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rem = sum % 11;
  const dv = rem === 0 || rem === 1 ? 0 : 11 - rem;
  const expectedKey = `${base43}${dv}`;

  assert.equal(isValidNfeKey(expectedKey), true);
  assert.equal(isValidNfeKey(`${base43}${(dv + 1) % 10}`), false); // DV incorreto
  assert.equal(isValidNfeKey("123"), false); // tamanho menor
  assert.equal(isValidNfeKey(""), false);
});

test("ENG-MS-03: evaluateProtestoRisk reconhece metadados de evidência, sem afirmar legalidade", () => {
  const proofProven: DeliveryProof = {
    id: "p1",
    nfeNumber: "4580",
    customerName: "Supermercado Real",
    nfeAmount: 1500.0,
    issueDate: "2026-04-01",
    deliveryDate: "2026-04-03",
    status: "comprovado",
    receiverName: "Marcos Souza (Gerente)",
    receiverDocument: "RG 12.345.678-SSP/BA",
    proofFileUrl: "/evidence/receipt-4580.pdf"
  };

  const evalProven = evaluateProtestoRisk(proofProven);
  assert.equal(evalProven.risk, "metadata_complete");
  assert.equal(evalProven.hasCompleteEvidenceMetadata, true);
  assert.match(evalProven.reason, /autenticidade do arquivo e da assinatura não foi verificada/);
});

test("ENG-MS-03: evaluateProtestoRisk bloqueia protesto em caso de recusa/devolução ou extravio", () => {
  const proofDevolucao: DeliveryProof = {
    id: "p2",
    nfeNumber: "4581",
    customerName: "Distribuidora Bahia",
    nfeAmount: 3200.5,
    issueDate: "2026-04-02",
    status: "recusa_devolucao",
    notes: "Avaria no lote de polpa de frutas"
  };

  const evalDevolucao = evaluateProtestoRisk(proofDevolucao);
  assert.equal(evalDevolucao.risk, "priority_review");
  assert.equal(evalDevolucao.hasCompleteEvidenceMetadata, false);
  assert.match(evalDevolucao.reason, /recusa ou devolução/);

  const proofExtraviado: DeliveryProof = {
    id: "p3",
    nfeNumber: "4582",
    customerName: "Padaria Estrela",
    nfeAmount: 850.0,
    issueDate: "2026-04-03",
    status: "extraviado"
  };

  const evalExtraviado = evaluateProtestoRisk(proofExtraviado);
  assert.equal(evalExtraviado.risk, "priority_review");
  assert.match(evalExtraviado.reason, /extraviado/);
});

test("ENG-MS-03: evaluateProtestoRisk sinaliza atenção em mercadorias em trânsito e bloqueio se vencido", () => {
  const proofTransito: DeliveryProof = {
    id: "p4",
    nfeNumber: "4583",
    customerName: "Hotel Tropical",
    nfeAmount: 2100.0,
    issueDate: "2026-04-05",
    status: "pendente_entrega",
    driverName: "Carlos Alberto"
  };

  const evalEmPrazo = evaluateProtestoRisk(proofTransito, { isOverdue: false });
  assert.equal(evalEmPrazo.risk, "documentary_review");

  const evalVencido = evaluateProtestoRisk(proofTransito, { isOverdue: true });
  assert.equal(evalVencido.risk, "priority_review");
  assert.match(evalVencido.reason, /O título consta vencido/);
});

test("ENG-MS-03: computeDeliveryMetrics calcula cobertura e exposição financeira", () => {
  const proofs: DeliveryProof[] = [
    { id: "1", nfeNumber: "1", customerName: "A", nfeAmount: 1000, issueDate: "2026-04-01", deliveryDate: "2026-04-02", receiverName: "Recebedor A", receiverDocument: "DOC-A", proofFileUrl: "/evidence/a.pdf", status: "comprovado" },
    { id: "2", nfeNumber: "2", customerName: "B", nfeAmount: 2000, issueDate: "2026-04-01", deliveryDate: "2026-04-02", receiverName: "Recebedor B", receiverDocument: "DOC-B", proofFileUrl: "/evidence/b.pdf", status: "comprovado" },
    { id: "3", nfeNumber: "3", customerName: "C", nfeAmount: 1000, issueDate: "2026-04-01", status: "pendente_entrega" },
    { id: "4", nfeNumber: "4", customerName: "D", nfeAmount: 1000, issueDate: "2026-04-01", status: "extraviado" },
    { id: "5", nfeNumber: "5", customerName: "E", nfeAmount: 500, issueDate: "2026-04-01", deliveryDate: "2026-04-02", receiverName: "Recebedor E", receiverDocument: "DOC-E", status: "comprovado" }
  ];

  const metrics = computeDeliveryMetrics(proofs);
  assert.equal(metrics.totalInvoices, 5);
  assert.equal(metrics.totalAmount, 5500);
  assert.equal(metrics.provenCount, 2);
  assert.equal(metrics.provenAmount, 3000);
  assert.equal(metrics.pendingDeliveryCount, 2); // inclui status comprovado sem referência de evidência
  assert.equal(metrics.coverageRate, 40); // 2 de 5 = 40%
  assert.equal(metrics.atRiskProtestAmount, 2500); // 5500 - 3000
});

test("ENG-MS-03: parseDeliveryCsv processa CSV com separadores brasileiros e extrai status", () => {
  const csvContent = [
    "nfe;cliente;valor;data_emissao;data_entrega;status;motorista;recebedor",
    "NF-4580;Supermercado Real;1.500,00;2026-04-01;2026-04-03;Comprovado;João Motorista;Marcos Silva",
    "4581;Distribuidora Bahia;3.200,50;2026-04-02;;Pendente;Carlos Rota;",
    "4582;Restaurante Sol;450,00;2026-04-03;;Devolvido;Carlos Rota;"
  ].join("\r\n");

  const result = parseDeliveryCsv(csvContent);
  assert.equal(result.errors.length, 0);
  assert.equal(result.proofs.length, 3);

  assert.equal(result.proofs[0].nfeNumber, "4580");
  assert.equal(result.proofs[0].nfeAmount, 1500.0);
  assert.equal(result.proofs[0].status, "comprovado");
  assert.equal(result.proofs[0].receiverName, "Marcos Silva");

  assert.equal(result.proofs[1].nfeNumber, "4581");
  assert.equal(result.proofs[1].nfeAmount, 3200.5);
  assert.equal(result.proofs[1].status, "pendente_entrega");

  assert.equal(result.proofs[2].nfeNumber, "4582");
  assert.equal(result.proofs[2].status, "recusa_devolucao");
});

test("ENG-MS-03: generateDeliveryBlindageCsv emite CSV com observação operacional e revisão humana", () => {
  const proofs: DeliveryProof[] = [
    {
      id: "p1",
      nfeNumber: "4580",
      customerName: "Supermercado Real",
      nfeAmount: 1500,
      issueDate: "2026-04-01",
      deliveryDate: "2026-04-03",
      status: "comprovado",
      receiverName: "Marcos Silva",
      receiverDocument: "12345",
      proofFileUrl: "/evidence/receipt-4580.pdf"
    }
  ];

  const evaluations = [evaluateProtestoRisk(proofs[0])];
  const csv = generateDeliveryBlindageCsv(proofs, evaluations);

  assert.match(csv, /NF-e;Cliente;Valor NF/);
  assert.match(csv, /"4580"/);
  assert.match(csv, /"Supermercado Real"/);
  assert.match(csv, /METADADOS CADASTRADOS - AUTENTICIDADE NAO VERIFICADA/);
  assert.match(csv, /"Marcos Silva"/);
});

