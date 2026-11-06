import test from "node:test";
import assert from "node:assert/strict";
import { MAX_IMPORT_FILE_BYTES, validateImportFile } from "../lib/import-validation";

test("accepts CSV and OFX extensions case-insensitively", () => {
  assert.equal(validateImportFile({ name: "extrato.CSV", size: 100 }), null);
  assert.equal(validateImportFile({ name: "banco.OfX", size: 100 }), null);
});

test("rejects unsupported or missing extensions", () => {
  assert.match(validateImportFile({ name: "extrato.xlsx", size: 100 }) ?? "", /CSV ou OFX/);
  assert.match(validateImportFile({ name: "extrato", size: 100 }) ?? "", /CSV ou OFX/);
});

test("accepts the exact 10 MiB boundary and rejects files above it", () => {
  assert.equal(validateImportFile({ name: "limite.csv", size: MAX_IMPORT_FILE_BYTES }), null);
  assert.match(validateImportFile({ name: "acima.csv", size: MAX_IMPORT_FILE_BYTES + 1 }) ?? "", /10 MiB/);
});

test("rejects empty files", () => {
  assert.match(validateImportFile({ name: "vazio.ofx", size: 0 }) ?? "", /vazio/);
});
