import test from "node:test";
import assert from "node:assert/strict";
import { previewPayablesCsv } from "../lib/finance/payables-import";

test("preview de contas a pagar interpreta CSV brasileiro e converte valor para centavos", () => {
  const result = previewPayablesCsv([
    "Fornecedor;CNPJ;Documento;Emissão;Vencimento;Valor;Categoria;Centro de Custo",
    'Distribuidora A;12.345.678/0001-90;NF-100;01/11/2026;15/11/2026;1.234,56;Insumos;Cozinha'
  ].join("\n"));
  assert.equal(result.rows.length, 1);
  assert.equal(result.errors.length, 0);
  assert.equal(result.rows[0].amountMinor, 123456);
  assert.equal(result.rows[0].dueDate, "2026-11-15");
  assert.equal(result.rows[0].issueDate, "2026-11-01");
  assert.equal(result.rows[0].supplierDocument, "12.345.678/0001-90");
  assert.equal(result.rows[0].category, "Insumos");
});

test("preview aceita CSV com vírgula e campos entre aspas", () => {
  const result = previewPayablesCsv([
    "Fornecedor,Documento,Vencimento,Valor,Categoria",
    '"Fornecedor, Matriz",NF-2,2026-12-01,"250.75","Serviços"'
  ].join("\n"));
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].supplierName, "Fornecedor, Matriz");
  assert.equal(result.rows[0].amountMinor, 25075);
});

test("preview rejeita datas impossíveis, valor negativo e campos obrigatórios ausentes por linha", () => {
  const result = previewPayablesCsv([
    "Fornecedor;Documento;Vencimento;Valor",
    "Fornecedor A;NF-1;31/02/2026;100,00",
    "Fornecedor B;NF-2;01/12/2026;-10,00",
    ";NF-3;01/12/2026;10,00"
  ].join("\n"));
  assert.equal(result.rows.length, 0);
  assert.deepEqual(result.errors.map((error) => error.code), ["invalid_due_date", "invalid_amount", "missing_supplier"]);
});

test("preview identifica duplicidade sem fundir títulos distintos", () => {
  const result = previewPayablesCsv([
    "Fornecedor;Documento;Vencimento;Valor",
    "Fornecedor A;NF-1;01/12/2026;100,00",
    "Fornecedor A;NF-1;01/12/2026;100,00",
    "Fornecedor A;NF-2;01/12/2026;100,00"
  ].join("\n"));
  assert.equal(result.rows.length, 2);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.errors[0].code, "duplicate_in_file");
  assert.notEqual(result.rows[0].deduplicationKey, result.rows[1].deduplicationKey);
});

test("preview exige fornecedor, documento, vencimento e valor no cabeçalho", () => {
  const result = previewPayablesCsv("Fornecedor;Valor\nFornecedor A;10,00");
  assert.equal(result.rows.length, 0);
  assert.equal(result.errors[0].code, "invalid_columns");
});

test("preview preserva o número físico da linha após linhas vazias", () => {
  const result = previewPayablesCsv([
    "Fornecedor;Documento;Vencimento;Valor",
    "",
    "Fornecedor A;NF-1;01/12/2026;10,00"
  ].join("\\n"));
  assert.equal(result.rows[0].rowNumber, 3);
});
