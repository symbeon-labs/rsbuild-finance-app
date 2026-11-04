export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

export function validateImportFile(file: { name: string; size: number }): string | null {
  const extension = file.name.trim().toLowerCase().split(".").pop();

  if (extension !== "csv" && extension !== "ofx") {
    return "Formato não suportado. Selecione um arquivo CSV ou OFX.";
  }
  if (!Number.isFinite(file.size) || file.size < 1) {
    return "O arquivo está vazio ou possui tamanho inválido.";
  }
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return "O arquivo excede o limite de 10 MiB.";
  }
  return null;
}
