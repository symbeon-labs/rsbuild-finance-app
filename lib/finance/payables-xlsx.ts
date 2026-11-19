import { inflateRawSync } from "node:zlib";
import { previewPayablesGrid, type PayableCsvPreview } from "./payables-import";

const MAX_ENTRIES = 2000;
const MAX_ENTRY_BYTES = 12 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED = 30 * 1024 * 1024;

type ZipEntry = { name: string; method: number; compressedSize: number; size: number; localOffset: number };

function readZipDirectory(bytes: Buffer): Map<string, Buffer> {
  let eocd = -1;
  for (let i = Math.max(0, bytes.length - 65557); i <= bytes.length - 22; i++) {
    if (bytes.readUInt32LE(i) === 0x06054b50) eocd = i;
  }
  if (eocd < 0) throw new Error("Arquivo XLSX inválido: diretório ZIP não encontrado.");
  const disk = bytes.readUInt16LE(eocd + 4), centralDisk = bytes.readUInt16LE(eocd + 6);
  const count = bytes.readUInt16LE(eocd + 10), centralSize = bytes.readUInt32LE(eocd + 12), centralOffset = bytes.readUInt32LE(eocd + 16);
  if (disk !== 0 || centralDisk !== 0 || count === 0xffff || centralOffset === 0xffffffff) throw new Error("XLSX multi-disco ou ZIP64 não é suportado.");
  if (count > MAX_ENTRIES || centralOffset + centralSize > bytes.length) throw new Error("Estrutura XLSX excede os limites permitidos.");

  const entries: ZipEntry[] = [];
  let cursor = centralOffset, total = 0;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > bytes.length || bytes.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Diretório ZIP XLSX corrompido.");
    const flags = bytes.readUInt16LE(cursor + 8), method = bytes.readUInt16LE(cursor + 10);
    const compressedSize = bytes.readUInt32LE(cursor + 20), size = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28), extraLength = bytes.readUInt16LE(cursor + 30), commentLength = bytes.readUInt16LE(cursor + 32);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8").replace(/\\/g, "/");
    if ((flags & 1) !== 0 || ![0, 8].includes(method)) throw new Error("XLSX criptografado ou com compressão não suportada.");
    if (size > MAX_ENTRY_BYTES) throw new Error("Uma parte interna do XLSX excede o limite permitido.");
    total += size;
    if (total > MAX_TOTAL_UNCOMPRESSED) throw new Error("O XLSX excede o limite de descompressão.");
    entries.push({ name, method, compressedSize, size, localOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  const files = new Map<string, Buffer>();
  for (const entry of entries) {
    if (entry.name.startsWith("/") || entry.name.split("/").includes("..")) throw new Error("Caminho interno inválido no XLSX.");
    const offset = entry.localOffset;
    if (offset + 30 > bytes.length || bytes.readUInt32LE(offset) !== 0x04034b50) throw new Error("Entrada ZIP XLSX corrompida.");
    const nameLength = bytes.readUInt16LE(offset + 26), extraLength = bytes.readUInt16LE(offset + 28);
    const start = offset + 30 + nameLength + extraLength, end = start + entry.compressedSize;
    if (end > bytes.length) throw new Error("Conteúdo ZIP XLSX truncado.");
    const compressed = bytes.subarray(start, end);
    const data = entry.method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: MAX_ENTRY_BYTES });
    if (data.length !== entry.size) throw new Error("Tamanho descompactado XLSX inconsistente.");
    files.set(entry.name, data);
  }
  return files;
}

function xmlText(value: string): string {
  return value.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function attr(source: string, name: string): string | undefined {
  return source.match(new RegExp("(?:^|\\s)" + name + "=\"([^\"]*)\""))?.[1];
}

function columnIndex(reference: string): number {
  const letters = /^([A-Z]+)/i.exec(reference)?.[1]?.toUpperCase();
  if (!letters) return 0;
  let value = 0;
  for (const char of letters) value = value * 26 + char.charCodeAt(0) - 64;
  return value - 1;
}

function sharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) =>
    [...(match[1] ?? "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => xmlText(part[1] ?? "")).join("")
  );
}

function dateStyleIndexes(xml: string | undefined): Set<number> {
  if (!xml) return new Set();
  const custom = new Map<number, string>();
  for (const match of xml.matchAll(/<numFmt\b([^>]*)\/?\s*>/g)) {
    const id = Number(attr(match[1] ?? "", "numFmtId"));
    const code = attr(match[1] ?? "", "formatCode") ?? "";
    if (Number.isFinite(id)) custom.set(id, code);
  }
  const xfs = xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? "";
  const result = new Set<number>();
  let index = 0;
  for (const match of xfs.matchAll(/<xf\b([^>]*)\/?\s*>/g)) {
    const id = Number(attr(match[1] ?? "", "numFmtId") ?? 0);
    const code = custom.get(id) ?? "";
    if ((id >= 14 && id <= 22) || /[dmy]/i.test(code.replace(/"[^"]*"/g, ""))) result.add(index);
    index++;
  }
  return result;
}

function excelSerialToIso(value: number, date1904 = false): string {
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const date = new Date(epoch + Math.floor(value) * 86400000);
  return `${date.getUTCFullYear().toString().padStart(4, "0")}-${(date.getUTCMonth() + 1).toString().padStart(2, "0")}-${date.getUTCDate().toString().padStart(2, "0")}`;
}

function resolveSheetPath(target: string): string {
  const clean = target.replace(/\\/g, "/");
  const parts = (clean.startsWith("/") ? clean.slice(1) : `xl/${clean}`).split("/");
  const normalized: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") normalized.pop();
    else normalized.push(part);
  }
  return normalized.join("/");
}

export type PayablesWorkbookPreview = PayableCsvPreview & { sheetName: string; availableSheets: string[] };

export function previewPayablesXlsx(bytes: Uint8Array, requestedSheetName?: string): PayablesWorkbookPreview {
  const files = readZipDirectory(Buffer.from(bytes));
  const workbook = files.get("xl/workbook.xml")?.toString("utf8");
  const rels = files.get("xl/_rels/workbook.xml.rels")?.toString("utf8");
  if (!workbook || !rels) throw new Error("Arquivo XLSX não contém workbook e relacionamentos válidos.");

  const relationshipTargets = new Map<string, string>();
  for (const match of rels.matchAll(/<Relationship\b([^>]*)\/?\s*>/g)) {
    const id = attr(match[1] ?? "", "Id"), target = attr(match[1] ?? "", "Target");
    if (id && target) relationshipTargets.set(id, resolveSheetPath(target));
  }
  const sheets = [...workbook.matchAll(/<sheet\b([^>]*)\/?\s*>/g)].map((match) => {
    const attrs = match[1] ?? "";
    return {
      name: xmlText(attr(attrs, "name") ?? ""),
      state: attr(attrs, "state") ?? "visible",
      path: relationshipTargets.get(attr(attrs, "r:id") ?? "") ?? ""
    };
  }).filter((sheet) => sheet.name && sheet.path && files.has(sheet.path) && sheet.state === "visible");
  if (!sheets.length) throw new Error("O XLSX não contém planilhas legíveis.");
  const availableSheets = sheets.map((sheet) => sheet.name);
  const selected = requestedSheetName ? sheets.find((sheet) => sheet.name === requestedSheetName) : sheets[0];
  if (!selected) throw new Error("Planilha solicitada não encontrada no arquivo XLSX.");

  const date1904 = /<workbookPr\b[^>]*date1904="1"/.test(workbook);
  const strings = sharedStrings(files.get("xl/sharedStrings.xml")?.toString("utf8"));
  const dateStyles = dateStyleIndexes(files.get("xl/styles.xml")?.toString("utf8"));
  const sheetXml = files.get(selected.path)!.toString("utf8");
  const rows: string[][] = [], rowNumbers: number[] = [];

  for (const rowMatch of sheetXml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g)) {
    const rowAttrs = rowMatch[1] ?? rowMatch[3] ?? "";
    const rowNumber = Number(attr(rowAttrs, "r") ?? rows.length + 1);
    if (!Number.isSafeInteger(rowNumber) || rowNumber < 1 || rowNumber > 100000) throw new Error("Número de linha XLSX inválido.");
    const rowXml = rowMatch[2] ?? "";
    const cells: string[] = [];
    for (const cellMatch of rowXml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g)) {
      const cellAttrs = cellMatch[1] ?? cellMatch[3] ?? "";
      const body = cellMatch[2] ?? "";
      const reference = attr(cellAttrs, "r") ?? "";
      const index = columnIndex(reference);
      if (index > 255) throw new Error("A planilha excede o limite de 256 colunas.");
      const type = attr(cellAttrs, "t") ?? "n";
      const style = Number(attr(cellAttrs, "s") ?? -1);
      let value = "";
      if (type === "inlineStr") {
        value = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => xmlText(part[1] ?? "")).join("");
      } else {
        const raw = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1];
        if (raw !== undefined) {
          const decoded = xmlText(raw);
          if (type === "s") value = strings[Number(decoded)] ?? "";
          else if (type === "b") value = decoded === "1" ? "TRUE" : "FALSE";
          else if (dateStyles.has(style) && Number.isFinite(Number(decoded))) value = excelSerialToIso(Number(decoded), date1904);
          else value = decoded;
        }
      }
      cells[index] = value;
    }
    rows[rowNumber - 1] = cells.map((cell) => cell ?? "");
    rowNumbers[rowNumber - 1] = rowNumber;
  }

  const sourceRows = rows.map((cells, index) => ({ rowNumber: rowNumbers[index] ?? index + 1, cells })).filter((row) => row.cells.some((cell) => cell.trim() !== ""));
  return { ...previewPayablesGrid(sourceRows), sheetName: selected.name, availableSheets };
}
