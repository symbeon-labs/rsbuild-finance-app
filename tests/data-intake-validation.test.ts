import test from "node:test";
import assert from "node:assert/strict";
import {
  DATA_INTAKE_TYPES,
  MAX_DATA_INTAKE_FILE_BYTES,
  getDataIntakeMediaType,
  validateDataIntakeFile
} from "../lib/data-intake-validation";


function makeStoredZip(files: Array<{ name: string; content: string }>): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const local = new Uint8Array(30 + name.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    locals.push(local);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length;
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const all = new Uint8Array(offset + centralSize + end.length);
  let cursor = 0;
  for (const part of locals) { all.set(part, cursor); cursor += part.length; }
  for (const part of centrals) { all.set(part, cursor); cursor += part.length; }
  all.set(end, cursor);
  return all;
}

function validXlsxFixture(): Uint8Array {
  return makeStoredZip([
    { name: "[Content_Types].xml", content: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>' },
    { name: "_rels/.rels", content: '<Relationships/>' },
    { name: "xl/workbook.xml", content: '<workbook/>' }
  ]);
}

function validDocxFixture(): Uint8Array {
  return makeStoredZip([
    { name: "[Content_Types].xml", content: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: "_rels/.rels", content: '<Relationships/>' },
    { name: "word/document.xml", content: '<document/>' }
  ]);
}

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

test("accepts structurally valid XLSX and DOCX packages", () => {
  const xlsx = validXlsxFixture();
  const docx = validDocxFixture();
  assert.equal(validateDataIntakeFile({ name: "base.xlsx", size: xlsx.length }, xlsx), null);
  assert.equal(validateDataIntakeFile({ name: "contrato.docx", size: docx.length }, docx), null);
});

test("rejects arbitrary ZIP files renamed as Office documents", () => {
  const bytes = makeStoredZip([{ name: "payload.txt", content: "not an Office document" }]);
  assert.match(validateDataIntakeFile({ name: "base.xlsx", size: bytes.length }, bytes) ?? "", /planilha XLSX válida/);
  assert.match(validateDataIntakeFile({ name: "contrato.docx", size: bytes.length }, bytes) ?? "", /documento DOCX válido/);
});

test("does not accept a DOCX package as XLSX or vice versa", () => {
  const docx = validDocxFixture();
  const xlsx = validXlsxFixture();
  assert.match(validateDataIntakeFile({ name: "base.xlsx", size: docx.length }, docx) ?? "", /planilha XLSX válida/);
  assert.match(validateDataIntakeFile({ name: "contrato.docx", size: xlsx.length }, xlsx) ?? "", /documento DOCX válido/);
});

test("rejects unsupported formats", () => {
  const bytes = new TextEncoder().encode("payload");
  assert.match(validateDataIntakeFile({ name: "arquivo.zip", size: bytes.length }, bytes) ?? "", /Formato não suportado/);
});

test("rejects invalid and oversized files", () => {
  const bytes = new TextEncoder().encode("x");
  assert.match(validateDataIntakeFile({ name: "a.txt", size: 0 }, new Uint8Array()) ?? "", /tamanho inválido/);
  assert.match(validateDataIntakeFile({ name: "a.txt", size: MAX_DATA_INTAKE_FILE_BYTES + 1 }, new Uint8Array(MAX_DATA_INTAKE_FILE_BYTES + 1)) ?? "", /20 MiB/);
  assert.match(validateDataIntakeFile({ name: "a.txt", size: 2 }, bytes) ?? "", /tamanho inválido/);
});

test("rejects binary payloads disguised as UTF-8 text", () => {
  const bytes = new Uint8Array([0x7b, 0x00, 0x7d]);
  assert.match(validateDataIntakeFile({ name: "data.json", size: bytes.length }, bytes) ?? "", /codificação UTF-8 válida/);
});
