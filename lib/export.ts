import * as XLSX from "xlsx";
import { FinancialRecord, formatDate, formatCurrency } from "./finance";
import { DRE_ACCOUNTS, type DreClassification, type DreUnit } from "./dre-engine";

/**
 * Exporta DRE classificado em formato Excel com múltiplas abas por unidade.
 * Estrutura similar ao modelo DRE_SOURCE_MODEL.
 */
export function generateDreExcel(
  classifications: DreClassification[],
  organizationName: string,
  periodLabel: string
): Uint8Array {
  const workbook = XLSX.utils.book_new();

  // Agrupar por unidade
  const byUnit = new Map<DreUnit, DreClassification[]>();
  for (const c of classifications) {
    if (c.status !== "overridden" && c.status !== "suggested") continue;
    for (const alloc of c.allocations) {
      const unit = alloc.unit;
      if (!byUnit.has(unit)) byUnit.set(unit, []);
      byUnit.get(unit)!.push(c);
    }
  }

  // Criar aba por unidade
  for (const [unit, items] of byUnit) {
    const rows = [
      ["RUBRICA", "GRUPO", "REGISTROS", "VALOR", "TRATAMENTO", "CONFIANÇA", "RAZÃO"]
    ];

    for (const c of items) {
      const account = c.account || DRE_ACCOUNTS.find((a) => a.code === c.account?.code);
      const totalAmount = c.allocations
        .filter((a) => a.unit === unit)
        .reduce((sum, a) => sum + a.amountMinor / 100, 0);
      
      rows.push([
        account?.label || "Não classificado",
        account?.group || "Outros",
        "1",
        formatCurrency(totalAmount),
        account?.treatment || "review",
        String(c.confidence),
        c.reason || ""
      ]);
    }

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, unit.slice(0, 31));
  }

  // Aba consolidada
  const consolidatedRows = [
    ["UNIDADE", "RUBRICA", "GRUPO", "REGISTROS", "VALOR", "TRATAMENTO"]
  ];
  for (const c of classifications) {
    if (c.status !== "overridden" && c.status !== "suggested") continue;
    const account = c.account || DRE_ACCOUNTS.find((a) => a.code === c.account?.code);
    for (const alloc of c.allocations) {
      consolidatedRows.push([
        alloc.unit,
        account?.label || "Não classificado",
        account?.group || "Outros",
        "1",
        formatCurrency(alloc.amountMinor / 100),
        account?.treatment || "review"
      ]);
    }
  }
  const consolidatedSheet = XLSX.utils.aoa_to_sheet(consolidatedRows);
  XLSX.utils.book_append_sheet(workbook, consolidatedSheet, "Consolidado");

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as Uint8Array;
}

/**
 * Exporta movimentações financeiras em formato Excel com múltiplas abas por conta bancária.
 */
export function generateFinancialRecordsExcel(
  records: FinancialRecord[],
  organizationName: string,
  periodLabel: string
): Uint8Array {
  const workbook = XLSX.utils.book_new();

  // Agrupar por conta bancária
  const byAccount = new Map<string, FinancialRecord[]>();
  for (const r of records) {
    const account = r.bankName || r.source || "Outros";
    if (!byAccount.has(account)) byAccount.set(account, []);
    byAccount.get(account)!.push(r);
  }

  // Criar aba por conta
  for (const [account, items] of byAccount) {
    const rows = [
      ["DATA", "DESCRIÇÃO", "VALOR", "DIREÇÃO", "CATEGORIA", "CONTA", "DOCUMENTO", "STATUS", "FITID"]
    ];

    for (const r of items) {
      rows.push([
        formatDate(r.date),
        r.description,
        String(r.amount),
        r.direction,
        r.category || "",
        r.bankName || r.source || "",
        (r as any).documentNumber || "",
        r.status || "",
        r.sourceRecordId || ""
      ]);
    }

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, account.slice(0, 31));
  }

  // Aba consolidada
  const consolidatedRows = [
    ["DATA", "DESCRIÇÃO", "VALOR", "DIREÇÃO", "CATEGORIA", "CONTA", "STATUS"]
  ];
  for (const r of records) {
    consolidatedRows.push([
      formatDate(r.date),
      r.description,
      String(r.amount),
      r.direction,
      r.category || "",
      r.bankName || r.source || "",
      r.status || ""
    ]);
  }
  const consolidatedSheet = XLSX.utils.aoa_to_sheet(consolidatedRows);
  XLSX.utils.book_append_sheet(workbook, consolidatedSheet, "Consolidado");

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as Uint8Array;
}

/**
 * Wrapper para download do arquivo Excel no navegador.
 */
export function downloadExcelFile(data: Uint8Array, filename: string): void {
  const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
