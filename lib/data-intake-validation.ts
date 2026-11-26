import { inflateRawSync } from "node:zlib";

export const MAX_DATA_INTAKE_FILE_BYTES = 20 * 1024 * 1024;

export const DATA_INTAKE_TYPES = [
  "financial_support", "invoice", "boleto", "receipt", "contract", "spreadsheet", "other"
] as const;
export type DataIntakeDocumentType = typeof DATA_INTAKE_TYPES[number];

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
  json: "application/json",
  xml: "application/xml",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp"
};

export type IntakeFile = { name: string; size: number; type?: string };

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function isUtf8Text(bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

type ZipEntry = { name: string; method: number; compressedSize: number; uncompressedSize: number; localOffset: number };

function readZipEntries(bytes: Uint8Array): Map<string, { entry: ZipEntry; data: Uint8Array }> | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const min = Math.max(0, bytes.length - 65557);
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= min; offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0 || eocd + 22 > bytes.length) return null;
  const disk = view.getUint16(eocd + 4, true);
  const centralDisk = view.getUint16(eocd + 6, true);
  const diskEntries = view.getUint16(eocd + 8, true);
  const totalEntries = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (disk !== 0 || centralDisk !== 0 || diskEntries !== totalEntries || totalEntries < 2 || totalEntries > 4096) return null;
  if (centralOffset + centralSize > eocd || centralOffset > bytes.length) return null;

  const entries = new Map<string, { entry: ZipEntry; data: Uint8Array }>();
  let cursor = centralOffset;
  let totalUncompressed = 0;
  for (let index = 0; index < totalEntries; index++) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) return null;
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > bytes.length || (flags & 1) !== 0 || (method !== 0 && method !== 8)) return null;
    let name: string;
    try { name = new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(cursor + 46, cursor + 46 + nameLength)); }
    catch { return null; }
    if (name.startsWith("/") || name.split("/").includes("..") || entries.has(name)) return null;
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > 40 * 1024 * 1024 || (compressedSize === 0 && uncompressedSize > 0) ||
        (compressedSize > 0 && uncompressedSize / compressedSize > 100)) return null;

    if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50) return null;
    const localFlags = view.getUint16(localOffset + 6, true);
    const localMethod = view.getUint16(localOffset + 8, true);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    if (localFlags !== flags || localMethod !== method || localNameLength !== nameLength) return null;
    let localName: string;
    try { localName = new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(localOffset + 30, localOffset + 30 + localNameLength)); }
    catch { return null; }
    if (localName !== name) return null;
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) return null;
    const compressed = bytes.slice(dataStart, dataEnd);
    let data: Uint8Array;
    try {
      data = method === 0 ? compressed : new Uint8Array(inflateRawSync(compressed, { maxOutputLength: 40 * 1024 * 1024 }));
    } catch {
      return null;
    }
    if (data.byteLength !== uncompressedSize) return null;
    entries.set(name, { entry: { name, method, compressedSize, uncompressedSize, localOffset }, data });
    cursor = next;
  }
  return cursor === centralOffset + centralSize ? entries : null;
}

export function isValidOfficeOpenXml(bytes: Uint8Array, kind: "xlsx" | "docx"): boolean {
  const entries = readZipEntries(bytes);
  if (!entries) return false;
  const contentTypes = entries.get("[Content_Types].xml")?.data;
  if (!contentTypes) return false;
  let xml: string;
  try { xml = new TextDecoder("utf-8", { fatal: true }).decode(contentTypes); }
  catch { return false; }
  if (!xml.includes("application/vnd.openxmlformats-package")) return false;

  if (kind === "xlsx") {
    return entries.has("_rels/.rels") &&
      entries.has("xl/workbook.xml") &&
      xml.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml");
  }
  return entries.has("_rels/.rels") &&
    entries.has("word/document.xml") &&
    xml.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml");
}

export function getDataIntakeMediaType(name: string): string | null {
  const extension = name.trim().toLowerCase().split(".").pop() ?? "";
  return MIME_BY_EXTENSION[extension] ?? null;
}

/** Validate extension, size, signatures and OOXML package structure. */
export function validateDataIntakeFile(file: IntakeFile, bytes: Uint8Array): string | null {
  const mediaType = getDataIntakeMediaType(file.name);
  if (!mediaType) return "Formato não suportado. Aceitos: PDF, XLSX, XLS, DOCX, CSV, JSON, XML, TXT, PNG, JPG e WEBP.";
  if (!Number.isSafeInteger(file.size) || file.size < 1 || bytes.byteLength !== file.size) {
    return "O arquivo está vazio ou possui tamanho inválido.";
  }
  if (file.size > MAX_DATA_INTAKE_FILE_BYTES) return "O arquivo excede o limite de 20 MiB.";

  const ext = file.name.trim().toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf" && !startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "O conteúdo não corresponde a um PDF válido.";
  if (ext === "png" && !startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "O conteúdo não corresponde a uma imagem PNG.";
  if ((ext === "jpg" || ext === "jpeg") && !startsWith(bytes, [0xff, 0xd8, 0xff])) return "O conteúdo não corresponde a uma imagem JPEG.";
  if (ext === "webp" && !(startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP")) return "O conteúdo não corresponde a uma imagem WEBP.";
  if (ext === "xlsx" && !isValidOfficeOpenXml(bytes, "xlsx")) return "O conteúdo não corresponde a uma planilha XLSX válida.";
  if (ext === "docx" && !isValidOfficeOpenXml(bytes, "docx")) return "O conteúdo não corresponde a um documento DOCX válido.";
  if (ext === "xls" && !startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "O conteúdo não corresponde a uma planilha XLS.";
  if (["csv", "json", "xml", "txt"].includes(ext) && !isUtf8Text(bytes)) return "O arquivo de texto não possui codificação UTF-8 válida ou contém dados binários.";
  return null;
}
