import test from "node:test";
import assert from "node:assert/strict";
import { parseOfx } from "../lib/finance";

test("OFX: saldo anterior em STMTTRN é excluído dos movimentos financeiros", () => {
  const input = `<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261109100000<TRNAMT>78371.49<FITID>OPENING-001<MEMO>SALDO ANTERIOR</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261110100000<TRNAMT>241.59<FITID>TX-001<MEMO>PIX RECEBIDO CLIENTE</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;
  const result = parseOfx(input);
  assert.deepEqual(result.errors, []);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].sourceRecordId, "TX-001");
  assert.equal(result.records[0].amount, 241.59);
  assert.equal(result.records[0].description, "PIX RECEBIDO CLIENTE");
});

test("OFX: variações textuais de saldo de abertura não são lançamentos", () => {
  const labels = ["SALDO INICIAL", "SALDO DE ABERTURA", "Saldo anterior"];
  const input = `<OFX><BANKTRANLIST>${labels.map((label, i) =>
    `<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>2026110${i + 1}100000<TRNAMT>100.00<FITID>OPEN-${i}<MEMO>${label}</STMTTRN>`
  ).join("")}
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261104100000<TRNAMT>-10.00<FITID>REAL-001<MEMO>Tarifa</STMTTRN>
</BANKTRANLIST></OFX>`;
  const result = parseOfx(input);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].sourceRecordId, "REAL-001");
});
