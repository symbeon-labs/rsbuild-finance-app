/**
 * Parser para importação reversa de arquivos exportados pelo RSBUILD OS.
 * Detecta metadata de exportação e extrai proveniência dos dados.
 */

import { detectRsbuildExport, determineProvenance, type ExportMetadata, type ProvenanceInfo } from "./import-export-traceability";
import { type FinancialRecord } from "./finance";

export interface ReverseImportResult {
  records: FinancialRecord[];
  provenance: ProvenanceInfo;
  metadata: ExportMetadata | null;
  isRoundTrip: boolean;
  warnings: string[];
}

/**
 * Processa arquivo CSV importado para detectar se foi exportado pelo RSBUILD.
 */
export function processReverseImport(csvContent: string): ReverseImportResult {
  const warnings: string[] = [];
  
  // Detectar metadata de exportação
  const metadata = detectRsbuildExport(csvContent);
  const provenance = determineProvenance(metadata);
  
  if (metadata) {
    warnings.push(`Arquivo exportado pelo RSBUILD OS em ${metadata.exportDate}`);
    warnings.push(`Organização original: ${metadata.organizationName}`);
    warnings.push(`Tipo de exportação: ${metadata.exportType}`);
    warnings.push(`${metadata.recordCount} registros exportados originalmente`);
    
    if (provenance.isRoundTrip) {
      warnings.push("⚠️ IMPORTAÇÃO REVERSA: Este arquivo foi exportado pelo RSBUILD e está sendo importado de volta.");
      warnings.push("Os registros manterão proveniência rastreável.");
    }
  } else {
    warnings.push("Arquivo não contém metadata de exportação RSBUILD.");
  }

  // Remover metadata do conteúdo antes de parsear
  const cleanContent = removeExportMetadata(csvContent);
  
  // Parsear registros (usando parser existente)
  const records = parseRecordsFromCsv(cleanContent);
  
  // Adicionar proveniência aos registros
  const recordsWithProvenance = records.map((record) => ({
    ...record,
    importProvenance: provenance,
    isRoundTrip: provenance.isRoundTrip
  }));

  return {
    records: recordsWithProvenance,
    provenance,
    metadata,
    isRoundTrip: provenance.isRoundTrip,
    warnings
  };
}

/**
 * Remove metadata de exportação do CSV.
 */
function removeExportMetadata(csv: string): string {
  const lines = csv.split("\n");
  const filtered = lines.filter((line) => !line.startsWith(`# RSBUILD_OS_EXPORT`));
  return filtered.join("\n");
}

/**
 * Parser básico de CSV para registros financeiros.
 * TODO: Integrar com parser existente em lib/finance.ts
 */
function parseRecordsFromCsv(csv: string): FinancialRecord[] {
  const lines = csv.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(";").map((h) => h.trim().toLowerCase());
  const records: FinancialRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(";").map((v) => v.trim());
    if (values.length < headers.length) continue;

    const record: Partial<FinancialRecord> & { documentNumber?: string } = {};

    headers.forEach((header, index) => {
      const value = values[index];
      switch (header) {
        case "data":
        case "date":
          record.date = value;
          break;
        case "descrição":
        case "description":
          record.description = value;
          break;
        case "valor":
        case "amount":
          record.amount = parseFloat(value.replace(",", "."));
          break;
        case "direção":
        case "direction":
        case "tipo":
        case "natureza":
          record.direction = value.toLowerCase().includes("entrada") || value.toLowerCase().includes("crédito") ? "entrada" : "saída";
          break;
        case "categoria":
        case "category":
          record.category = value;
          break;
        case "conta":
        case "conta corrente":
        case "bankaccount":
          record.bankName = value;
          break;
        case "documento":
        case "document":
          record.documentNumber = value;
          break;
        case "status":
          record.status = value as "pendente" | "conciliado";
          break;
      }
    });

    if (record.date && record.description && record.amount !== undefined) {
      records.push(record as FinancialRecord);
    }
  }

  return records;
}

/**
 * Gera relatório de proveniência para exibição na UI.
 */
export function generateProvenanceReport(result: ReverseImportResult): string {
  const lines: string[] = [
    "=== RELATÓRIO DE PROVENIÊNCIA ===",
    "",
    `Fonte: ${result.provenance.source}`,
    `Round-trip: ${result.provenance.isRoundTrip ? "SIM" : "NÃO"}`,
    ""
  ];

  if (result.metadata) {
    lines.push("Metadata de Exportação:");
    lines.push(`  Organização: ${result.metadata.organizationName}`);
    lines.push(`  Data exportação: ${result.metadata.exportDate}`);
    lines.push(`  Tipo: ${result.metadata.exportType}`);
    lines.push(`  Registros: ${result.metadata.recordCount}`);
    lines.push(`  Checksum: ${result.metadata.checksum}`);
    lines.push("");
  }

  lines.push(`Total de registros importados: ${result.records.length}`);
  lines.push("");
  lines.push("Avisos:");
  result.warnings.forEach((warning) => lines.push(`  - ${warning}`));

  return lines.join("\n");
}
