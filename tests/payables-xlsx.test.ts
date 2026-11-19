import test from "node:test";
import assert from "node:assert/strict";
import { previewPayablesXlsx } from "../lib/finance/payables-xlsx";

function zipStored(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [], centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, source] of Object.entries(files)) {
    const nameBytes = Buffer.from(name), data = Buffer.from(source);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); local.writeUInt32LE(0, 14); local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBytes.length, 26); local.writeUInt16LE(0, 28);
    locals.push(local, nameBytes, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8); central.writeUInt16LE(0, 10); central.writeUInt32LE(0, 16);
    central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28); central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36); central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const centralBytes = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6);
  end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralBytes.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralBytes, end]);
}

function workbookFixture(): Buffer {
  const shared = ["Fornecedor", "Documento", "Vencimento", "Valor", "Distribuidora A", "NF-2026-01"];
  const sharedXml = `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${shared.map((value) => `<si><t>${value}</t></si>`).join("")}</sst>`;
  const workbook = `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr date1904="${date1904 ? 1 : 0}"/><sheets><sheet name="Abertos" sheetId="1" r:id="rId1"/><sheet name="Pagos" sheetId="2" r:id="rId2"/></sheets></workbook>`;
  const rels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="worksheet"/><Relationship Id="rId2" Target="worksheets/sheet2.xml" Type="worksheet"/></Relationships>';
  const styles = '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>';
  const open = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row><row r="3"><c r="A3" t="s"><v>4</v></c><c r="B3" t="s"><v>5</v></c><c r="C3" s="1"><v>46336</v></c><c r="D3"><f>1000+234.56</f><v>1234.56</v></c></row></sheetData></worksheet>';
  const dateAdjustedOpen = date1904 ? open.replace("<v>46336</v>", "<v>1</v>") : open;
  const paid = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Arquivo de pagos</t></is></c></row></sheetData></worksheet>';
  return zipStored({
    "xl/workbook.xml": workbook,
    "xl/_rels/workbook.xml.rels": rels,
    "xl/sharedStrings.xml": sharedXml,
    "xl/styles.xml": styles,
    "xl/worksheets/sheet1.xml": dateAdjustedOpen,
    "xl/worksheets/sheet2.xml": paid
  });
}

test("XLSX interpreta shared strings, fórmula com valor em cache e serial de data", () => {
  const result = previewPayablesXlsx(workbookFixture());
  assert.equal(result.sheetName, "Abertos");
  assert.deepEqual(result.availableSheets, ["Abertos", "Pagos"]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].rowNumber, 3);
  assert.equal(result.rows[0].supplierName, "Distribuidora A");
  assert.equal(result.rows[0].documentNumber, "NF-2026-01");
  assert.equal(result.rows[0].dueDate, "2026-11-10");
  assert.equal(result.rows[0].amountMinor, 123456);
});

test("XLSX converte datas no sistema 1904", () => {
  const result = previewPayablesXlsx(workbookFixture(true));
  assert.equal(result.rows[0].dueDate, "1904-01-02");
});

test("XLSX permite selecionar planilha pelo nome e rejeita nome inexistente", () => {
  const bytes = workbookFixture();
  assert.equal(previewPayablesXlsx(bytes, "Pagos").sheetName, "Pagos");
  assert.throws(() => previewPayablesXlsx(bytes, "Não existe"), /Planilha solicitada não encontrada/);
});

test("XLSX rejeita arquivo que não é um contêiner ZIP", () => {
  assert.throws(() => previewPayablesXlsx(Buffer.from("not an xlsx")), /diretório ZIP não encontrado/);
});
