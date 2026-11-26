/**
 * Utilitários para rastreabilidade de importação/exportação reversa.
 * Permite identificar quando um arquivo foi exportado pelo RSBUILD OS
 * e importar de volta com proveniência preservada.
 */

export const RSBUILD_EXPORT_MARKER = "RSBUILD_OS_EXPORT";
export const RSBUILD_EXPORT_VERSION = "1.0";

export interface ExportMetadata {
  marker: string;
  version: string;
  organizationId: string;
  organizationName: string;
  exportDate: string;
  exportType: "movimentacoes" | "dre" | "baixas";
  recordCount: number;
  checksum: string;
}

/**
 * Gera checksum simples para validação.
 */
function generateChecksum(orgId: string, date: string, count: number): string {
  const str = `${orgId}-${date}-${count}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Gera metadata de exportação para incluir no arquivo.
 */
export function generateExportMetadata(
  organizationId: string,
  organizationName: string,
  exportType: "movimentacoes" | "dre" | "baixas",
  recordCount: number
): ExportMetadata {
  const exportDate = new Date().toISOString();
  const metadata: ExportMetadata = {
    marker: RSBUILD_EXPORT_MARKER,
    version: RSBUILD_EXPORT_VERSION,
    organizationId,
    organizationName,
    exportDate,
    exportType,
    recordCount,
    checksum: generateChecksum(organizationId, exportDate, recordCount)
  };
  return metadata;
}

/**
 * Detecta se um arquivo CSV/Excel foi exportado pelo RSBUILD OS.
 */
export function detectRsbuildExport(content: string): ExportMetadata | null {
  try {
    // Procurar por comentário HTML ou linha de metadata
    const lines = content.split("\n");
    for (const line of lines.slice(0, 10)) { // Verificar primeiras 10 linhas
      if (line.includes(RSBUILD_EXPORT_MARKER)) {
        // Tentar extrair JSON da linha
        const jsonMatch = line.match(/\{[^}]+\}/);
        if (jsonMatch) {
          const metadata = JSON.parse(jsonMatch[0]) as ExportMetadata;
          if (metadata.marker === RSBUILD_EXPORT_MARKER) {
            return metadata;
          }
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Adiciona metadata de exportação ao conteúdo CSV.
 */
export function addExportMetadataToCsv(csv: string, metadata: ExportMetadata): string {
  const metadataLine = `# ${RSBUILD_EXPORT_MARKER} ${JSON.stringify(metadata)}`;
  return `${metadataLine}\n${csv}`;
}

/**
 * Remove metadata de exportação do conteúdo CSV.
 */
export function removeExportMetadataFromCsv(csv: string): string {
  const lines = csv.split("\n");
  const filtered = lines.filter((line) => !line.startsWith(`# ${RSBUILD_EXPORT_MARKER}`));
  return filtered.join("\n");
}

/**
 * Valida se a metadata é válida e não foi adulterada.
 */
export function validateExportMetadata(metadata: ExportMetadata): boolean {
  if (!metadata.marker || metadata.marker !== RSBUILD_EXPORT_MARKER) return false;
  if (!metadata.organizationId || !metadata.exportDate) return false;
  
  // Validar checksum
  const expectedChecksum = generateChecksum(
    metadata.organizationId,
    metadata.exportDate,
    metadata.recordCount
  );
  
  return metadata.checksum === expectedChecksum;
}

/**
 * Extrai informações de proveniência de um registro importado.
 */
export interface ProvenanceInfo {
  source: "rsbuild_export" | "manual_import" | "erp_direct";
  originalOrganizationId?: string;
  originalExportDate?: string;
  originalExportType?: string;
  isRoundTrip: boolean; // true se foi exportado e importado de volta
}

/**
 * Determina a proveniência de um registro baseado na metadata.
 */
export function determineProvenance(metadata: ExportMetadata | null): ProvenanceInfo {
  if (!metadata) {
    return {
      source: "manual_import",
      isRoundTrip: false
    };
  }

  const isValid = validateExportMetadata(metadata);
  
  return {
    source: isValid ? "rsbuild_export" : "manual_import",
    originalOrganizationId: metadata.organizationId,
    originalExportDate: metadata.exportDate,
    originalExportType: metadata.exportType,
    isRoundTrip: isValid
  };
}
