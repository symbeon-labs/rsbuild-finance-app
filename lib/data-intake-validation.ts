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

export function getDataIntakeMediaType(name: string): string | null {
  const extension = name.trim().toLowerCase().split(".").pop() ?? "";
  return MIME_BY_EXTENSION[extension] ?? null;
}

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

/** Validate extension, size and file signature before any storage write. */
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
  if (["xlsx", "docx"].includes(ext) && !startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return "O conteúdo não corresponde a um documento Office Open XML.";
  if (ext === "xls" && !startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "O conteúdo não corresponde a uma planilha XLS.";
  if (["csv", "json", "xml", "txt"].includes(ext) && !isUtf8Text(bytes)) return "O arquivo de texto não possui codificação UTF-8 válida ou contém dados binários.";
  return null;
}
