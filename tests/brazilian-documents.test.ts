import test from "node:test";
import assert from "node:assert/strict";
import { isValidBrazilianDocument, isValidCnpj, isValidCpf, normalizeDocument } from "../lib/brazilian-documents";

test("validates CPF check digits", () => {
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("111.111.111-11"), false);
  assert.equal(isValidCpf("52998224724"), false);
});

test("validates numeric CNPJ check digits", () => {
  assert.equal(isValidCnpj("04.252.011/0001-10"), true);
  assert.equal(isValidCnpj("11.111.111/1111-11"), false);
});

test("normalizes and validates alphanumeric CNPJ", () => {
  assert.equal(normalizeDocument("12.ABC.345/01DE-35"), "12ABC34501DE35");
  assert.equal(isValidBrazilianDocument("12.ABC.345/01DE-35"), true);
  assert.equal(isValidBrazilianDocument("12.ABC.345/01DE-36"), false);
});
