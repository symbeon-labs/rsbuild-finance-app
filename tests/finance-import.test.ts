import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseOfx, formatCurrency, formatDate, identifyBank, generateOmieOfx, encodeWindows1252, filterRecordsByPeriod } from "../lib/finance";

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
  assert.equal(result.records[0].amount, 1234.56);
  assert.equal(result.records[0].direction, "entrada");
  assert.equal(result.records[0].category, "Vendas");
  assert.equal(result.records[1].amount, 250);
  assert.equal(result.records[1].direction, "saída");
});


test("CSV rejeita entrada positiva sem direção explícita", () => {
  const result = parseCsv([
    "Data;Descrição;Valor",
    "2026-05-01;Recebimento sem tipo;100,00"
  ].join("\n"));
  assert.equal(result.records.length, 0);
  assert.match(result.errors.join(" "), /direção.*ambíguo/i);
});

test("CSV infere saída pelo sinal negativo quando direção está ausente", () => {
  const result = parseCsv([
    "Data;Descrição;Valor",
    "2026-05-01;Pagamento identificado pelo sinal;-100,00"
  ].join("\n"));
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].direction, "saída");
});

test("CSV rejeita direção desconhecida e conflito entre sinal e direção", () => {
  const result = parseCsv([
    "Data;Descrição;Valor;Tipo",
    "2026-05-01;Tipo desconhecido;100,00;movimento",
    "2026-05-02;Conflito; -100,00;Entrada"
  ].join("\n"));
  assert.equal(result.records.length, 0);
  assert.equal(result.errors.length, 2);
});

test("CSV com BOM, delimitador vírgula e aspas escapadas", () => {
  const input = '\uFEFFdate,description,amount,direction\n2026-03-04,"Peças ""premium""",99.90,credit';
  const result = parseCsv(input);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].description, 'Peças "premium"');
  assert.equal(result.records[0].amount, 99.9);
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
  assert.equal(result.records[0].amount, 1250.75);
  assert.equal(result.records[0].direction, "entrada");
  assert.equal(result.records[0].sourceRecordId, "FIT-001");
  assert.equal(result.records[1].amount, 89.9);
  assert.equal(result.records[1].direction, "saída");
  assert.equal(result.records[1].description, "Tarifa bancária");
  assert.equal(result.records[1].sourceRecordId, "FIT-002");
});

test("OFX sem estrutura ou sem movimentos reconhecíveis retorna erro", () => {
  assert.match(parseOfx("arquivo inválido").errors.join(" "), /estrutura OFX/);
  assert.match(parseOfx("<OFX><BANKTRANLIST></BANKTRANLIST></OFX>").errors.join(" "), /não contém movimentos/);
});

test("OFX rejeita movimentos com data ou valor inválido sem perder os válidos", () => {
  const input = `<OFX><BANKTRANLIST>
<STMTTRN><DTPOSTED>20260227000000<TRNAMT>0.10<FITID>GOOD</STMTTRN>
<STMTTRN><DTPOSTED>20260230000000<TRNAMT>10.00<FITID>BAD-DATE</STMTTRN>
<STMTTRN><DTPOSTED>20260228000000<TRNAMT>abc<FITID>BAD-AMOUNT</STMTTRN>
</BANKTRANLIST></OFX>`;
  const result = parseOfx(input);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].amount, 0.1);
  // Invalid records are rejected
  assert.ok(result.errors.length > 0);
});

test("formatação monetária e de data usa padrão brasileiro", () => {
  assert.equal(formatCurrency(1234.5), "R$ 1.234,50");
  assert.equal(formatDate("2026-04-09"), "09/04/2026");
});

test("OFX: corrige header ENCODING:1252 (padrão Inter/Itaú)", () => {
  const input = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
ENCODING:1252

<OFX>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260401000000<TRNAMT>100.00<FITID>FIT-001<NAME>Teste</STMTTRN>
</BANKTRANLIST></OFX>`;
  const result = parseOfx(input);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].amount, 100);
  assert.deepEqual(result.errors, []);
});

test("OFX: preserva movimentos PIX distintos mesmo com prefixo FITID compartilhado", () => {
  const input = "<OFX><BANKTRANLIST>" +
    "<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260401000000<TRNAMT>50.00<FITID>PIX202401-A<NAME>PIX A</STMTTRN>" +
    "<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260401000000<TRNAMT>75.50<FITID>PIX202401-B<NAME>PIX B</STMTTRN>" +
    "<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260401000000<TRNAMT>25.00<FITID>PIX202401-C<NAME>PIX C</STMTTRN>" +
    "</BANKTRANLIST></OFX>";
  const result = parseOfx(input);
  assert.equal(result.records.length, 3);
  assert.deepEqual(result.records.map((record) => record.amount), [50, 75.5, 25]);
});

test("OFX: FITID repetido não autoriza fundir transações", () => {
  const input = "<OFX><BANKTRANLIST>" +
    "<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260401000000<TRNAMT>10.00<FITID>SAME<NAME>A</STMTTRN>" +
    "<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260401000000<TRNAMT>20.00<FITID>SAME<NAME>B</STMTTRN>" +
    "</BANKTRANLIST></OFX>";
  const result = parseOfx(input);
  assert.equal(result.records.length, 2);
  assert.deepEqual(result.records.map((record) => record.amount), [10, 20]);
});

test("OFX: rejeita TRNTYPE CREDIT com valor negativo", () => {
  const input = "<OFX><BANKTRANLIST><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260401000000<TRNAMT>-10.00<FITID>BAD</STMTTRN></BANKTRANLIST></OFX>";
  const result = parseOfx(input);
  assert.equal(result.records.length, 0);
  assert.match(result.errors.join(" "), /conflita com valor negativo/);
});
test("OFX: detecta ordenação de datas fora de ordem", () => {
  const input = `<OFX>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260403000000<TRNAMT>100.00<FITID>FIT-001<NAME>Mais recente</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260401000000<TRNAMT>50.00<FITID>FIT-002<NAME>Mais antigo</STMTTRN>
</BANKTRANLIST></OFX>`;
  const result = parseOfx(input);
  assert.equal(result.records.length, 2);
  assert.match(result.errors.join(" "), /ordem cronológica/);
});

test("OFX: usa TRNTYPE para determinar direção", () => {
  const input = `<OFX>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260401000000<TRNAMT>100.00<FITID>FIT-001<NAME>Crédito</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260402000000<TRNAMT>50.00<FITID>FIT-002<NAME>Débito</STMTTRN>
</BANKTRANLIST></OFX>`;
  const result = parseOfx(input);
  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].direction, "entrada");
  assert.equal(result.records[1].direction, "saída");
});

test("ENG-MS-01: identifica extrato Itaú (0341) com agência, conta e saldo", () => {
  const input = `<OFX>
<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS><DTSERVER>20260401120000</DTSERVER><LANGUAGE>POR</LANGUAGE><FI><ORG>ITAU UNIBANCO</ORG><FID>0341</FID></FI></SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1><STMTTRNRS><TRNUID>1</TRNUID><STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
<STMTRS><CURDEF>BRL</CURDEF>
<BANKACCTFROM><BANKID>0341</BANKID><BRANCHID>1234</BRANCHID><ACCTID>56789-0</ACCTID><ACCTTYPE>CHECKING</ACCTTYPE></BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260401000000</DTSTART><DTEND>20260402000000</DTEND>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260401000000<TRNAMT>1500.00<FITID>ITAU-001<NAME>TED Recebida - Cliente A</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260402000000<TRNAMT>-320.50<FITID>ITAU-002<NAME>Pgto Fornecedor B</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>45800.75</BALAMT><DTASOF>20260402000000</DTASOF></LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

  const result = parseOfx(input);
  assert.equal(result.records.length, 2);
  assert.equal(result.metadata?.bankId, "0341");
  assert.equal(result.metadata?.bankName, "Itaú Unibanco");
  assert.equal(result.metadata?.branchId, "1234");
  assert.equal(result.metadata?.accountId, "56789-0");
  assert.equal(result.metadata?.balance, 45800.75);
  assert.equal(result.records[0].bankCode, "0341");
  assert.equal(result.records[0].bankName, "Itaú Unibanco");
  assert.equal(result.records[0].source, "Itaú Unibanco - C/C 56789-0");
});

test("ENG-MS-01: identifica extrato Banco Inter (0077)", () => {
  const input = `OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nENCODING:1252\n<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKACCTFROM><BANKID>0077</BANKID><ACCTID>987654-3</ACCTID></BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260401000000<TRNAMT>850.00<FITID>INTER-01<NAME>PIX Recebido</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

  const result = parseOfx(input);
  assert.equal(result.records.length, 1);
  assert.equal(result.metadata?.bankId, "0077");
  assert.equal(result.metadata?.bankName, "Banco Inter");
  assert.equal(result.records[0].source, "Banco Inter - C/C 987654-3");
});

test("ENG-MS-01: identifica extrato BNB Banco do Nordeste (0004)", () => {
  const input = `<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKACCTFROM><BANKID>0004</BANKID><ACCTID>112233-4</ACCTID></BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260405000000<TRNAMT>-12500.00<FITID>BNB-99<MEMO>Parcela Financiamento BNB</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

  const result = parseOfx(input);
  assert.equal(result.records.length, 1);
  assert.equal(result.metadata?.bankId, "0004");
  assert.equal(result.metadata?.bankName, "Banco do Nordeste (BNB)");
  assert.equal(result.records[0].amount, 12500);
  assert.equal(result.records[0].direction, "saída");
});

test("ENG-MS-01: identifica extrato XP Investimentos (0102)", () => {
  const input = `<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKACCTFROM><BANKID>0102</BANKID><ACCTID>445566</ACCTID></BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260410000000<TRNAMT>3420.15<FITID>XP-777<MEMO>Rendimento Aplicação CDI</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

  const result = parseOfx(input);
  assert.equal(result.records.length, 1);
  assert.equal(result.metadata?.bankId, "0102");
  assert.equal(result.metadata?.bankName, "XP Investimentos");
  assert.equal(result.records[0].amount, 3420.15);
});

test("ENG-MS-01: generateOmieOfx gera OFX canônico, ordenado cronologicamente e pronto para Omie", () => {
  const records = [
    {
      id: "rec-2",
      date: "2026-04-15",
      description: "Pagamento Fornecedor Farinha <Lote 10>",
      amount: 4500.5,
      direction: "saída" as const,
      category: "Insumos",
      source: "Itaú",
      status: "pendente" as const,
      sourceRecordId: "ITAU-999", bankCode: "0341", accountId: "56789-0", accountType: "CHECKING"
    },
    {
      id: "rec-1",
      date: "2026-04-10",
      description: "Recebimento Cliente Supermercado & Cia",
      amount: 8200,
      direction: "entrada" as const,
      category: "Vendas",
      source: "Itaú",
      status: "pendente" as const,
      sourceRecordId: "ITAU-888", bankCode: "0341", accountId: "56789-0", accountType: "CHECKING"
    }
  ];

  const metadata = { bankId: "0341", accountId: "56789-0", accountType: "CHECKING" };
  const generatedOfx = generateOmieOfx(records, metadata);

  // Valida cabeçalho SGML padrão Omie
  assert.match(generatedOfx, /OFXHEADER:100/);
  assert.match(generatedOfx, /ENCODING:1252/);
  assert.match(generatedOfx, /CHARSET:1252/);
  assert.match(generatedOfx, /<BANKID>0341<\/BANKID>/);
  assert.match(generatedOfx, /<ACCTID>56789-0<\/ACCTID>/);

  // Valida ordenação cronológica estrita: rec-1 (2026-04-10) DEVE vir ANTES de rec-2 (2026-04-15)
  const idxRec1 = generatedOfx.indexOf("20260410120000");
  const idxRec2 = generatedOfx.indexOf("20260415120000");
  assert.ok(idxRec1 < idxRec2, "Datas devem estar ordenadas cronologicamente");

  // Valida sinais e tipos
  assert.match(generatedOfx, /<TRNTYPE>CREDIT<\/TRNTYPE>[\s\S]*?<TRNAMT>8200\.00<\/TRNAMT>/);
  assert.match(generatedOfx, /<TRNTYPE>DEBIT<\/TRNTYPE>[\s\S]*?<TRNAMT>-4500\.50<\/TRNAMT>/);

  // Valida que caracteres especiais foram sanitizados
  assert.ok(!generatedOfx.includes("<Lote 10>"));
  assert.ok(!generatedOfx.includes("& Cia"));
  assert.match(generatedOfx, /Supermercado   Cia/);
});

test("ENG-MS-01: bloqueia exportação de contas misturadas ou sem identidade bancária", () => {
  const sample = { id: "x", date: "2026-04-10", description: "X", amount: 10, direction: "entrada" as const, category: "X", source: "CSV", status: "pendente" as const };
  assert.throws(() => generateOmieOfx([sample]), /instituição e conta bancária/);
  const one = { ...sample, bankCode: "0341", accountId: "111", accountType: "CHECKING" };
  const two = { ...sample, id: "y", bankCode: "0341", accountId: "222", accountType: "CHECKING" };
  assert.throws(() => generateOmieOfx([one, two]), /única conta bancária/);
});

test("ENG-MS-01: codifica texto em bytes Windows-1252", () => {
  assert.deepEqual([...encodeWindows1252("Ação, café")], [65, 231, 227, 111, 44, 32, 99, 97, 102, 233]);
  assert.throws(() => encodeWindows1252("漢"), /não pode ser representado/);
});

test("DASH-01: período de 30 dias inclui hoje e os 29 dias anteriores", () => {
  const records = [{ date: "2026-04-01", value: 1 }, { date: "2026-04-02", value: 2 }, { date: "2026-05-01", value: 3 }, { date: "2026-05-02", value: 4 }];
  const result = filterRecordsByPeriod(records, 30, new Date(2026, 4, 2, 12));
  assert.deepEqual(result.map((record) => record.value), [3, 4]);
});