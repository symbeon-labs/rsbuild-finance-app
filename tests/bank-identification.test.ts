import test from "node:test";
import assert from "node:assert/strict";
import { resolveBankIdentity } from "../lib/bank-identification";

test("resolves known Brazilian bank codes without losing the original identifier", () => {
  const result = resolveBankIdentity({ bankId: "0341", accountId: "123", accountType: "CHECKING" });
  assert.equal(result.institutionName, "Itaú Unibanco");
  assert.equal(result.institutionCode, "0341");
  assert.equal(result.identificationStatus, "identified");
});

test("preserves unknown bank codes and never guesses the institution name", () => {
  const result = resolveBankIdentity({ bankId: "422", accountId: "00085887641", accountType: "CHECKING" });
  assert.equal(result.institutionCode, "422");
  assert.equal(result.institutionName, "Instituição não catalogada (código 422)");
  assert.equal(result.identificationStatus, "unrecognized");
  assert.equal(result.accountNumber, "00085887641");
});

test("keeps missing bank/account metadata explicit", () => {
  const result = resolveBankIdentity({});
  assert.equal(result.identificationStatus, "missing");
  assert.equal(result.institutionCode, null);
  assert.equal(result.accountNumber, null);
});
