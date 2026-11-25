import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  ReceivableTitle,
  matchTitlesWithRecords,
  parseReceivablesExcel,
  parseReceivablesCsv
} from "../lib/reconciliation";
import { FinancialRecord } from "../lib/finance";
import {
  MUNDO_DO_SABOR_TITLES,
  MUNDO_DO_SABOR_BANK_RECORDS,
  MUNDO_DO_SABOR_DATASET
} from "../lib/operational-dataset";

test("Reconciliação de Títulos: MUNDO_DO_SABOR_DATASET contém insumos operacionais reais", () => {
  assert.ok(MUNDO_DO_SABOR_TITLES.length >= 400, "Deve carregar mais de 400 títulos operacionais");
  assert.ok(MUNDO_DO_SABOR_BANK_RECORDS.length >= 300, "Deve carregar mais de 300 lançamentos bancários");
  assert.equal(MUNDO_DO_SABOR_DATASET.organization.includes("ALS COMERCIO"), true);

  // Valida que títulos possuem campos críticos
  const first = MUNDO_DO_SABOR_TITLES[0];
  assert.ok(first.documentNumber, "Título deve conter número de documento");
  assert.ok(first.customerName, "Título deve conter razão social ou nome do cliente");
  assert.ok(first.amount > 0, "Valor do título deve ser positivo");
  assert.ok(first.dueDate, "Data de vencimento deve existir");
});

test("Reconciliação de Títulos: parseReceivablesExcel processa planilha padrão Omie Contas a Receber", () => {
  // Cria uma planilha sintética no formato padrão exportado pelo Omie
  const rows = [
    ["Contas a Receber", "", "", "", "", ""],
    ["Minha Empresa (Razão Social)", "Cliente ou Fornecedor (Nome Fantasia)", "Emissão", "Nota Fiscal", "Valor da Conta", "Vencimento", "Pago ou Recebido", "A Pagar ou Receber", "Conta Corrente"],
    ["ALS COMERCIO ATACADISTA", "TOTAL", "", "", "15000.00", "", "", ""], // Linha de total deve ser ignorada
    ["ALS COMERCIO ATACADISTA", "SUPERMERCADO REAL BAHIA", "2026-11-01", "00055120", "2500.50", "2026-11-20", "0", "2500.50", "Itaú Unibanco"],
    ["ALS COMERCIO ATACADISTA", "PADARIA DO VALE LTDA", "2026-11-02", "00055121", "1200.00", "2026-11-15", "1200.00", "0", "Banco Safra"]
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Contas a Receber");
  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });

  const result = parseReceivablesExcel(buffer);
  assert.equal(result.errors.length, 0);
  assert.equal(result.titles.length, 2, "Deve extrair exatamente os 2 títulos válidos, ignorando cabeçalhos e totais");

  const [t1, t2] = result.titles;
  assert.equal(t1.documentNumber, "00055120");
  assert.equal(t1.customerName, "SUPERMERCADO REAL BAHIA");
  assert.equal(t1.amount, 2500.50);
  assert.equal(t1.dueDate, "2026-11-20");
  assert.equal(t1.bankAccount, "Itaú Unibanco");
  assert.equal(t1.category, "receivable");
  assert.equal(t1.status, "pendente");

  assert.equal(t2.documentNumber, "00055121");
  assert.equal(t2.customerName, "PADARIA DO VALE LTDA");
  assert.equal(t2.amount, 1200.00);
  assert.equal(t2.status, "baixado", "Título com valor pago igual ao valor da conta deve ser baixado");
});

test("Reconciliação de Títulos: matchTitlesWithRecords casa títulos reais de Mundo do Sabor com extratos Itaú/Safra", () => {
  const titles: ReceivableTitle[] = [
    {
      id: "tit-1",
      documentNumber: "00054917",
      customerName: "JOSE DE SOUSA NETO",
      amount: 3384.03,
      dueDate: "2026-11-10",
      bankAccount: "Itaú Unibanco",
      status: "pendente"
    },
    {
      id: "tit-2",
      documentNumber: "00054929",
      customerName: "GELADOM SORVETES FABRICA",
      amount: 50.85,
      dueDate: "2026-11-10",
      bankAccount: "Itaú Unibanco",
      status: "pendente"
    },
    {
      id: "tit-3",
      documentNumber: "00099999",
      customerName: "CLIENTE SEM EXTRATO",
      amount: 9999.99,
      dueDate: "2026-11-10",
      bankAccount: "Itaú Unibanco",
      status: "pendente"
    }
  ];

  const bankRecords: FinancialRecord[] = [
    {
      id: "rec-1",
      date: "2026-11-10",
      amount: 3384.03,
      direction: "entrada",
      category: "Recebimento",
      status: "pendente",
      description: "PIX RECEBIDO JOSE DE10/11 JOSE DE SOUSA NETO 983.874.805-68",
      bankName: "Itaú Unibanco",
      source: "OFX Itaú"
    },
    {
      id: "rec-2",
      date: "2026-11-10",
      amount: 50.85,
      direction: "entrada",
      category: "Recebimento",
      status: "pendente",
      description: "PIX RECEBIDO GELADOM10/11 GELADOM SORVETES LTDA 22.884.269/0001-10",
      bankName: "Itaú Unibanco",
      source: "OFX Itaú"
    }
  ];

  const matches = matchTitlesWithRecords(titles, bankRecords);
  assert.equal(matches.length, 3);

  const m1 = matches.find((m) => m.title.documentNumber === "00054917");
  assert.ok(m1);
  assert.equal(m1.suggestedStatus, "pronto_para_baixa");
  assert.equal(m1.confidence, "exato");
  assert.equal(m1.statementRecord?.id, "rec-1");

  const m2 = matches.find((m) => m.title.documentNumber === "00054929");
  assert.ok(m2);
  assert.equal(m2.suggestedStatus, "pronto_para_baixa");
  assert.equal(m2.confidence, "exato");
  assert.equal(m2.statementRecord?.id, "rec-2");

  const m3 = matches.find((m) => m.title.documentNumber === "00099999");
  assert.ok(m3);
  assert.equal(m3.suggestedStatus, "nao_identificado");
  assert.equal(m3.statementRecord, undefined);
});

test("Reconciliação de Títulos: parseReceivablesExcel processa Contas a Pagar Omie com valores negativos e Pagamentos", () => {
  const openPayablesRows = [
    ["Contas a Pagar"],
    ["Minha Empresa (Razão Social)", "Cliente ou Fornecedor (Nome Fantasia)", "Emissão", "Nota Fiscal", "CNPJ/CPF", "Valor da Conta", "Vencimento", "Pago ou Recebido", "A Pagar ou Receber", "Conta Corrente", "Categoria", "Origem"],
    [null, null, null, null, null, -57041.6, null, 0, -57041.6],
    ["ALS COMERCIO ATACADISTA", "ALIBRA", 46294, "000171166", "03.645.657/0002-85", -16285.6, 46359, 0, -16285.6, "Itaú Unibanco", "Compras de Mercadorias para Revenda", "Conta a Pagar (de uma Compra)"],
    ["ALS COMERCIO ATACADISTA", "ADIANTAMENTO SALARIAL", 46379, "N/D", "N/D", -731, 46371, 0, -731, "Safra", "Adiantamentos", "Contas a Pagar (repetição)"]
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(openPayablesRows);
  const wb1 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb1, ws1, "Contas a Pagar");
  const res1 = parseReceivablesExcel(XLSX.write(wb1, { type: "array", bookType: "xlsx" }));

  assert.equal(res1.errors.length, 0);
  assert.equal(res1.titles.length, 2);
  assert.equal(res1.titles[0].category, "payable");
  assert.equal(res1.titles[0].amount, 16285.6);
  assert.equal(res1.titles[0].bankAccount, "Itaú Unibanco");
  assert.equal(res1.titles[0].customerDoc, "03.645.657/0002-85");
  assert.equal(res1.titles[0].status, "pendente");
  assert.equal(res1.titles[1].customerDoc, undefined);
  assert.equal(res1.titles[1].bankAccount, "Safra");

  const paidPayablesRows = [
    ["Pagamentos"],
    ["Minha Empresa (Razão Social)", "Fornecedor", "Categoria", "Nota Fiscal", "Emissão", "Vencimento", "Data de Pagto ou Recbto (completa)", "Valor da Conta", "Juros", "Multa", "Desconto", "Pago ou Recebido", "Conta Corrente", "Origem"],
    [null, null, null, null, null, null, null, -587, 0, 0, 0, -587],
    ["ALS COMERCIO ATACADISTA", "JOSIANE SILVA PIRES", "Prestação de Serviço", "N/D", 46282, 46269, 46269, -587, 0, 0, 0, -587, "Itaú Unibanco", "Pagamento de Conta a Pagar"]
  ];

  const ws2 = XLSX.utils.aoa_to_sheet(paidPayablesRows);
  const wb2 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb2, ws2, "Pagamentos");
  const res2 = parseReceivablesExcel(XLSX.write(wb2, { type: "array", bookType: "xlsx" }));

  assert.equal(res2.errors.length, 0);
  assert.equal(res2.titles.length, 1);
  assert.equal(res2.titles[0].category, "payable");
  assert.equal(res2.titles[0].amount, 587);
  assert.equal(res2.titles[0].paidAmount, 587);
  assert.equal(res2.titles[0].status, "baixado");
});

test("Reconciliação de Títulos: matchTitlesWithRecords casa títulos a pagar apenas com saídas bancárias", () => {
  const payableTitle: ReceivableTitle = {
    id: "pag-1",
    documentNumber: "000171166",
    customerName: "ALIBRA",
    amount: 16285.6,
    dueDate: "2026-12-03",
    category: "payable",
    status: "pendente"
  };

  const bankRecords: FinancialRecord[] = [
    {
      id: "in-1",
      date: "2026-12-03",
      amount: 16285.6,
      direction: "entrada",
      category: "Recebimento",
      status: "pendente",
      description: "PIX RECEBIDO ALIBRA 000171166",
      bankName: "Itaú Unibanco",
      source: "OFX Itaú"
    },
    {
      id: "out-1",
      date: "2026-12-03",
      amount: 16285.6,
      direction: "saída",
      category: "Pagamento",
      status: "pendente",
      description: "TED PAGO ALIBRA NF 000171166",
      bankName: "Itaú Unibanco",
      source: "OFX Itaú"
    }
  ];

  const matches = matchTitlesWithRecords([payableTitle], bankRecords);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].suggestedStatus, "pronto_para_baixa");
  assert.equal(matches[0].statementRecord?.id, "out-1");
});

test("Reconciliação de Títulos: parseReceivablesCsv processa CSV Omie Contas a Pagar Recorrentes com cabeçalho na linha 2", () => {
  const csv = [
    "Contas a Pagar,,,,,,,,,,,",
    "Minha Empresa (Razão Social),Cliente ou Fornecedor (Nome Fantasia),Emissão,Nota Fiscal,CNPJ/CPF,Valor da Conta,Vencimento,Pago ou Recebido,A Pagar ou Receber,Conta Corrente,Categoria,Origem",
    ",,,,,-19318.67,,0,-19318.67,,,",
    "ALS COMERCIO ATACADISTA,AMIL ASSISTENCIA MEDICA INTERNACIONAL S.A.,2026-10-28,N/D,29.309.127/0001-79,-4423.89,2026-11-23,0,-4423.89,Itaú Unibanco,Retirada Sócio,Contas a Pagar (repetição)",
    "ALS COMERCIO ATACADISTA,BOND FESTA LTDA,2026-12-01,NF 202626,44.146.172/0001-43,-875,2026-11-20,0,-875,Safra,Brindes/Eventos Funcionários,Contas a Pagar (repetição)"
  ].join("\n");

  const res = parseReceivablesCsv(csv);
  assert.equal(res.errors.length, 0);
  assert.equal(res.titles.length, 2);
  assert.equal(res.titles[0].category, "payable");
  assert.equal(res.titles[0].amount, 4423.89);
  assert.equal(res.titles[0].bankAccount, "Itaú Unibanco");
  assert.equal(res.titles[0].customerDoc, "29.309.127/0001-79");
  assert.equal(res.titles[1].documentNumber, "NF 202626");
  assert.equal(res.titles[1].amount, 875);
});
