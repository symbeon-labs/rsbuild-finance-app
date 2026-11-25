import test from "node:test";
import assert from "node:assert/strict";
import {
  DATA_INTAKE_TYPES,
  MAX_DATA_INTAKE_FILE_BYTES,
  getDataIntakeMediaType,
  validateDataIntakeFile
} from "../lib/data-intake-validation";

test("lists the supported document classifications", () => {
  assert.deepEqual(DATA_INTAKE_TYPES, [
    "financial_support", "invoice", "boleto", "receipt", "contract", "spreadsheet", "other"
  ]);
});

test("maps supported extensions to canonical media types", () => {
  assert.equal(getDataIntakeMediaType("nota.PDF"), "application/pdf");
  assert.equal(getDataIntakeMediaType("dados.xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(getDataIntakeMediaType("contrato.docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.equal(getDataIntakeMediaType("arquivo.exe"), null);
});

test("accepts a PDF with a matching signature", () => {
  const bytes = new TextEncoder().encode("%PDF-1.7\n");
  assert.equal(validateDataIntakeFile({ name: "nota.pdf", size: bytes.length }, bytes), null);
});

test("rejects a renamed executable or mismatched binary", () => {
  const bytes = new TextEncoder().encode("not a pdf");
  assert.match(validateDataIntakeFile({ name: "nota.pdf", size: bytes.length }, bytes) ?? "", /não corresponde a um PDF/);
});

test("accepts Office Open XML files by ZIP signature", () => {
  const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]);
  assert.equal(validateDataIntakeFile({ name: "base.xlsx", size: bytes.length }, bytes), null);
});

test("rejects unsupported formats", () => {
  const bytes = new TextEncoder().encode("payload");
  assert.match(validateDataIntakeFile({ name: "arquivo.zip", size: bytes.length }, bytes) ?? "", /Formato não suportado/);
});

test("rejects invalid and oversized files", () => {
  const bytes = new TextEncoder().encode("x");
  assert.match(validateDataIntakeFile({ name: "a.txt", size: 0 }, new Uint8Array()), /tamanho inválido/);
  assert.match(validateDataIntakeFile({ name: "a.txt", size: MAX_DATA_INTAKE_FILE_BYTES + 1 }, new Uint8Array(MAX_DATA_INTAKE_FILE_BYTES + 1)), /20 MiB/);
  assert.match(validateDataIntakeFile({ name: "a.txt", size: 2 }, bytes), /tamanho inválido/);
});

test("rejects binary payloads disguised as UTF-8 text", () => {
  const bytes = new Uint8Array([0x7b, 0x00, 0x7d]);
  assert.match(validateDataIntakeFile({ name: "data.json", size: bytes.length }, bytes) ?? "", /codificação UTF-8 válida/);
});
