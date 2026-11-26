import * as XLSX from "xlsx";
import { FinancialRecord, formatDate, formatCurrency } from "./finance";
import { type DreClassification, type DreUnit } from "./dre-engine";

export type ErpFormat = "omie" | "bling" | "tiny" | "contaazul" | "generic";

export interface ErpExportConfig {
  format: ErpFormat;
  organizationId: string;
  periodLabel: string;
}

/**
 * Gera CSV no formato específico de cada ERP.
 * Cada ERP tem estrutura de colunas diferente.
 */
export function generateErpCsv(
  records: FinancialRecord[],
  config: ErpExportConfig
): string {
  switch (config.format) {
    case "omie":
      return generateOmieCsv(records);
    case "bling":
      return generateBlingCsv(records);
    case "tiny":
      return generateTinyCsv(records);
    case "contaazul":
      return generateContaAzulCsv(records);
    default:
      return generateGenericCsv(records);
  }
}

function generateOmieCsv(records: FinancialRecord[]): string {
  const headers = [
    "Data",
    "Descrição",
    "Valor",
    "Tipo",
    "Categoria",
    "Conta Corrente",
    "Documento"
  ];
  const rows = records.map((r) => [
    formatDate(r.date),
    r.description,
    r.amount.toFixed(2).replace(".", ","),
    r.direction === "entrada" ? "Crédito" : "Débito",
    r.category || "",
    r.bankName || r.source || "",
    (r as any).documentNumber || ""
  ]);
  return [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
}

function generateBlingCsv(records: FinancialRecord[]): string {
  const headers = [
    "Data",
    "Descrição",
    "Valor",
    "Tipo",
    "Categoria",
    "Conta"
  ];
  const rows = records.map((r) => [
    formatDate(r.date),
    r.description,
    r.amount.toFixed(2).replace(".", ","),
    r.direction === "entrada" ? "Receita" : "Despesa",
    r.category || "",
    r.bankName || r.source || ""
  ]);
  return [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
}

function generateTinyCsv(records: FinancialRecord[]): string {
  const headers = [
    "Data",
    "Descrição",
    "Valor",
    "Natureza",
    "Categoria",
    "Conta"
  ];
  const rows = records.map((r) => [
    formatDate(r.date),
    r.description,
    r.amount.toFixed(2).replace(".", ","),
    r.direction === "entrada" ? "Entrada" : "Saída",
    r.category || "",
    r.bankName || r.source || ""
  ]);
  return [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
}

function generateContaAzulCsv(records: FinancialRecord[]): string {
  const headers = [
    "Data",
    "Descrição",
    "Valor",
    "Tipo",
    "Categoria",
    "Conta"
  ];
  const rows = records.map((r) => [
    formatDate(r.date),
    r.description,
    r.amount.toFixed(2).replace(".", ","),
    r.direction === "entrada" ? "Crédito" : "Débito",
    r.category || "",
    r.bankName || r.source || ""
  ]);
  return [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
}

function generateGenericCsv(records: FinancialRecord[]): string {
  const headers = [
    "Data",
    "Descrição",
    "Valor",
    "Direção",
    "Categoria",
    "Conta",
    "Documento",
    "Status"
  ];
  const rows = records.map((r) => [
    formatDate(r.date),
    r.description,
    r.amount,
    r.direction,
    r.category || "",
    r.bankName || r.source || "",
    (r as any).documentNumber || "",
    r.status || ""
  ]);
  return [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
}

/**
 * Exporta DRE em formato CSV específico de ERP.
 */
export function generateDreErpCsv(
  classifications: DreClassification[],
  config: ErpExportConfig
): string {
  const headers = [
    "Unidade",
    "Rubrica",
    "Grupo",
    "Registros",
    "Valor",
    "Tratamento"
  ];
  const rows: string[][] = [];

  for (const c of classifications) {
    if (c.status !== "overridden" && c.status !== "suggested") continue;
    const account = c.account;
    for (const alloc of c.allocations) {
      rows.push([
        alloc.unit,
        account?.label || "Não classificado",
        account?.group || "Outros",
        "1",
        (alloc.amountMinor / 100).toFixed(2).replace(".", ","),
        account?.treatment || "review"
      ]);
    }
  }

  return [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
}
