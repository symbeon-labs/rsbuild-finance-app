import test from "node:test";
import assert from "node:assert/strict";
import { resolveBankIdentity, resolveImportSourceIdentity } from "../lib/bank-identification";
import { parseOfx } from "../lib/finance";

test("resolves known Brazilian bank codes without losing the original identifier", () => {
  const result = resolveBankIdentity({ bankId: "0341", accountId: "123", accountType: "CHECKING" });
  assert.equal(result.institutionName, "Itaú Unibanco");
  assert.equal(result.institutionCode, "0341");
  assert.equal(result.identificationStatus, "identified");
});

test("resolves Safra from its Brazilian bank code", () => {
  const result = resolveBankIdentity({ bankId: "0422", accountId: "00085887641", accountType: "CHECKING" });
  assert.equal(result.institutionName, "Banco Safra");
  assert.equal(result.institutionCode, "0422");
  assert.equal(result.identificationStatus, "identified");
  assert.equal(result.accountNumber, "00085887641");
});

test("preserves unknown bank codes and never guesses the institution name", () => {
  const result = resolveBankIdentity({ bankId: "999", accountId: "00085887641", accountType: "CHECKING" });
  assert.equal(result.institutionCode, "999");
  assert.equal(result.institutionName, "Instituição não catalogada (código 999)");
  assert.equal(result.identificationStatus, "unrecognized");
  assert.equal(result.accountNumber, "00085887641");
});

test("keeps missing bank/account metadata explicit", () => {
  const result = resolveBankIdentity({});
  assert.equal(result.identificationStatus, "missing");
  assert.equal(result.institutionCode, null);
  assert.equal(result.accountNumber, null);
});


test("Mundo do Sabor: Itaú OFX 0341 mantém agência e conta para associação", () => {
  const parsed = parseOfx(`<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKACCTFROM><BANKID>0341</BANKID><BRANCHID>7421</BRANCHID><ACCTID>7421996567</ACCTID><ACCTTYPE>CHECKING</ACCTTYPE></BANKACCTFROM>
<BANKTRANLIST><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261110000000<TRNAMT>125.50<FITID>ITAU-QA-001<NAME>PIX RECEBIDO</STMTTRN></BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`);
  assert.equal(parsed.records.length, 1);
  const identity = resolveBankIdentity(parsed.metadata!);
  assert.equal(identity.institutionCode, "0341");
  assert.equal(identity.institutionName, "Itaú Unibanco");
  assert.equal(identity.branchId, "7421");
  assert.equal(identity.accountNumber, "7421996567");
  assert.equal(identity.identificationStatus, "identified");
});

test("Mundo do Sabor: Safra OFX 0422 preserva zeros da conta e agência ausente", () => {
  const parsed = parseOfx(`<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKACCTFROM><BANKID>0422</BANKID><ACCTID>00085887641</ACCTID><ACCTTYPE>CHECKING</ACCTTYPE></BANKACCTFROM>
<BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261111000000<TRNAMT>-90.25<FITID>SAFRA-QA-001<MEMO>PAGAMENTO</STMTTRN></BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`);
  assert.equal(parsed.records.length, 1);
  const identity = resolveBankIdentity(parsed.metadata!);
  assert.equal(identity.institutionCode, "0422");
  assert.equal(identity.institutionName, "Banco Safra");
  assert.equal(identity.identificationStatus, "identified");
  assert.equal(identity.accountNumber, "00085887641");
  assert.equal(identity.branchId, null);
});

test("CSV sem metadados bancários não fabrica identidade nem agência", () => {
  const identity = resolveBankIdentity({});
  assert.equal(identity.identificationStatus, "missing");
  assert.equal(identity.institutionCode, null);
  assert.equal(identity.accountNumber, null);
  assert.equal(identity.branchId, null);
});


test("import source identity always labels CSV without inventing bank details", () => {
  const result = resolveImportSourceIdentity(undefined, "movimentos.csv");
  assert.equal(result.institutionName, "Importação CSV");
  assert.equal(result.identificationStatus, "missing");
  assert.equal(result.institutionCode, null);
  assert.equal(result.accountNumber, null);
  assert.equal(result.branchId, null);
});

test("import source identity labels OFX without recognized bank metadata", () => {
  const result = resolveImportSourceIdentity(undefined, "extrato.ofx");
  assert.equal(result.institutionName, "OFX — instituição não identificada");
  assert.equal(result.identificationStatus, "missing");
  assert.equal(result.institutionCode, null);
  assert.equal(result.accountNumber, null);
  assert.equal(result.branchId, null);
});

test("import source identity preserves known bank metadata", () => {
  const result = resolveImportSourceIdentity(
    { bankId: "0422", accountId: "00085887641", accountType: "CHECKING" },
    "safra.ofx"
  );
  assert.equal(result.institutionName, "Banco Safra");
  assert.equal(result.institutionCode, "0422");
  assert.equal(result.accountNumber, "00085887641");
  assert.equal(result.identificationStatus, "identified");
});
