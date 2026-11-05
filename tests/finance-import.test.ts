import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseOfx, formatCurrency, formatDate } from "../lib/finance";

const csv = [
  "Data;Descrição;Valor;Tipo;Categoria",
  '01/02/2026;"Venda, balcão";1.234,56;Entrada;Vendas',
  "02/02/2026;Fornecedor;-250,00;Saída;Operacional"
].join("\n");

test("CSV brasileiro: detecta ponto e vírgula, datas e valores com agrupamento", () => {
  const result = parseCsv(csv);
  assert.equal(result.records.length, 2);
  assert.deepEqual(result.errors, []);
  assert.equal(result.records[0].date, "2026-02-01");
  assert.equal(result.records[0].description, "Venda, balcão");
  assert.equal(result.records[0].amountMinor, 123456);
  assert.equal(result.records[0].direction, "entrada");
  assert.equal(result.records[0].category, "Vendas");
  assert.equal(result.records[1].amountMinor, 25000);
  assert.equal(result.records[1].direction, "saída");
});

test("CSV com BOM, delimitador vírgula e aspas escapadas", () => {
  const input = '\uFEFFdate,description,amount,direction\n2026-03-04,"Peças ""premium""",99.90,credit';
  const result = parseCsv(input);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].description, 'Peças "premium"');
  assert.equal(result.records[0].amountMinor, 9990);
});

test("CSV aceita data ISO e rejeita datas impossíveis e valores ambíguos", () => {
  const input = [
    "Data;Descrição;Valor;Tipo",
    "2026-02-30;Data impossível;10,00;Entrada",
    "2026-02-10;Valor ambíguo;1.234;Entrada",
    "2026-02-11;Registro válido;10,25;Entrada"
  ].join("\n");
  const result = parseCsv(input);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].description, "Registro válido");
  assert.equal(result.errors.length, 2);
});

test("CSV rejeita cabeçalhos obrigatórios ausentes e delimitador ambíguo", () => {
  assert.match(parseCsv("Data;Descrição\n01/01/2026;Teste").errors.join(" "), /Cabeçalhos obrigatórios/);
  assert.match(parseCsv("Data Descrição Valor\n01/01/2026 Teste 10").errors.join(" "), /Delimitador CSV ambíguo/);
});

test("CSV não descarta movimentos apenas por coincidência de valor e data", () => {
  const input = [
    "Data;Descrição;Valor;Tipo",
    "01/04/2026;Compra A;50,00;Saída",
    "01/04/2026;Compra B;50,00;Saída"
  ].join("\n");
  const result = parseCsv(input);
  assert.equal(result.records.length, 2);
  assert.notEqual(result.records[0].id, result.records[1].id);
});

const ofx = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260401000000<TRNAMT>1250.75<FITID>FIT-001<NAME>Recebimento cliente</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260402120000<TRNAMT>-89.90<FITID>FIT-002<MEMO>Tarifa bancária</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

test("OFX extrai crédito, débito, data, descrição e FITID", () => {
  const result = parseOfx(ofx);
  assert.equal(result.records.length, 2);
  assert.deepEqual(result.errors, []);
  assert.equal(result.records[0].date, "2026-04-01");
  assert.equal(result.records[0].amountMinor, 125075);
  assert.equal(result.records[0].direction, "entrada");
  assert.equal(result.records[0].sourceRecordId, "FIT-001");
  assert.equal(result.records[1].amountMinor, 8990);
  assert.equal(result.records[1].direction, "saída");
  assert.equal(result.records[1].description, "Tarifa bancária");
  assert.equal(result.records[1].sourceRecordId, "FIT-002");
});

test("OFX rejeita movimentos com data ou valor inválido sem perder os válidos", () => {
  const input = `<OFX><BANKTRANLIST>
<STMTTRN><DTPOSTED>20260230000000<TRNAMT>10.00<FITID>BAD-DATE</STMTTRN>
<STMTTRN><DTPOSTED>20260228000000<TRNAMT>abc<FITID>BAD-AMOUNT</STMTTRN>
<STMTTRN><DTPOSTED>20260227000000<TRNAMT>0.10<FITID>GOOD</STMTTRN>
</BANKTRANLIST></OFX>`;
  const result = parseOfx(input);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].amountMinor, 10);
  assert.equal(result.errors.length, 2);
});

test("OFX sem estrutura ou sem movimentos reconhecíveis retorna erro", () => {
  assert.match(parseOfx("arquivo inválido").errors.join(" "), /estrutura OFX/);
  assert.match(parseOfx("<OFX><BANKTRANLIST></BANKTRANLIST></OFX>").errors.join(" "), /não contém movimentos/);
});

test("formatação monetária e de data usa padrão brasileiro", () => {
  assert.equal(formatCurrency(123450), "R$ 1.234,50");
  assert.equal(formatDate("2026-04-09"), "09/04/2026");
});

test("formatCurrency rejects floating-point monetary inputs", () => {
  assert.throws(() => formatCurrency(1.25), /inteiro|seguro/i);
});
