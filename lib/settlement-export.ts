import { type ErpFormat } from "./erp-export";
import { generateExportMetadata, addExportMetadataToCsv } from "./import-export-traceability";

export interface SettlementExportData {
  titleId: string;
  documentNumber: string;
  customerName: string;
  settlementDate: string;
  amountPaid: number;
  amountOriginal: number;
  interest: number;
  discount: number;
  bankAccount: string;
  category: string;
  sourceRecordId: string;
  observation: string;
}

export interface SettlementExportConfig {
  erpFormat: ErpFormat;
  organizationId: string;
  organizationName: string;
}

/**
 * Gera CSV de baixas no formato específico de cada ERP.
 * Inclui metadata de exportação para rastreabilidade.
 */
export function generateSettlementErpCsv(
  settlements: SettlementExportData[],
  config: SettlementExportConfig
): string {
  let csv: string;
  
  switch (config.erpFormat) {
    case "omie":
      csv = generateOmieSettlementCsv(settlements);
      break;
    case "bling":
      csv = generateBlingSettlementCsv(settlements);
      break;
    case "tiny":
      csv = generateTinySettlementCsv(settlements);
      break;
    case "contaazul":
      csv = generateContaAzulSettlementCsv(settlements);
      break;
    default:
      csv = generateGenericSettlementCsv(settlements);
  }

  // Adicionar metadata de exportação
  const metadata = generateExportMetadata(
    config.organizationId,
    config.organizationName,
    "baixas",
    settlements.length
  );
  
  return addExportMetadataToCsv(csv, metadata);
}

function generateOmieSettlementCsv(settlements: SettlementExportData[]): string {
  const headers = [
    "Identificador_Titulo",
    "Numero_Documento",
    "Cliente",
    "Data_Recebimento",
    "Valor_Recebido",
    "Valor_Original",
    "Juros_Multa",
    "Desconto",
    "Conta_Corrente",
    "Categoria",
    "Codigo_Transacao_FITID",
    "Observacao"
  ];
  const rows = settlements.map((s) => [
    s.titleId,
    s.documentNumber,
    `"${s.customerName.replace(/"/g, '""')}"`,
    s.settlementDate,
    s.amountPaid.toFixed(2).replace(".", ","),
    s.amountOriginal.toFixed(2).replace(".", ","),
    s.interest.toFixed(2).replace(".", ","),
    s.discount.toFixed(2).replace(".", ","),
    s.bankAccount || "Conta Principal",
    `"${(s.category || 'Receita de Vendas').replace(/"/g, '""')}"`,
    s.sourceRecordId || "",
    `"${(s.observation || '').replace(/"/g, '""')}"`
  ]);
  return [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
}

function generateBlingSettlementCsv(settlements: SettlementExportData[]): string {
  const headers = [
    "Data",
    "Descrição",
    "Valor",
    "Tipo",
    "Categoria",
    "Conta"
  ];
  const rows = settlements.map((s) => [
    s.settlementDate,
    `Recebimento - ${s.customerName} - Doc ${s.documentNumber}`,
    s.amountPaid.toFixed(2).replace(".", ","),
    "Receita",
    s.category || "Vendas",
    s.bankAccount || "Conta Principal"
  ]);
  return [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
}

function generateTinySettlementCsv(settlements: SettlementExportData[]): string {
  const headers = [
    "Data",
    "Descrição",
    "Valor",
    "Natureza",
    "Categoria",
    "Conta"
  ];
  const rows = settlements.map((s) => [
    s.settlementDate,
    `Recebimento - ${s.customerName}`,
    s.amountPaid.toFixed(2).replace(".", ","),
    "Entrada",
    s.category || "Vendas",
    s.bankAccount || "Conta Principal"
  ]);
  return [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
}

function generateContaAzulSettlementCsv(settlements: SettlementExportData[]): string {
  const headers = [
    "Data",
    "Descrição",
    "Valor",
    "Tipo",
    "Categoria",
    "Conta"
  ];
  const rows = settlements.map((s) => [
    s.settlementDate,
    `Recebimento - ${s.customerName} - ${s.documentNumber}`,
    s.amountPaid.toFixed(2).replace(".", ","),
    "Crédito",
    s.category || "Receita",
    s.bankAccount || "Conta Principal"
  ]);
  return [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
}

function generateGenericSettlementCsv(settlements: SettlementExportData[]): string {
  const headers = [
    "Data",
    "Descrição",
    "Valor",
    "Tipo",
    "Categoria",
    "Conta",
    "Documento",
    "Status"
  ];
  const rows = settlements.map((s) => [
    s.settlementDate,
    `Recebimento - ${s.customerName}`,
    s.amountPaid.toFixed(2).replace(".", ","),
    "Entrada",
    s.category || "",
    s.bankAccount || "",
    s.documentNumber || "",
    "Baixado"
  ]);
  return [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
}
