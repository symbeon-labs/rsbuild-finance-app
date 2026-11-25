import * as XLSX from "xlsx";
import { FinancialRecord, formatCurrency, formatDate } from "./finance";

export type ReceivableTitle = {
  id: string;
  documentNumber: string; // Número da NF-e ou Pedido de Venda
  customerName: string;   // Razão Social ou Nome do Cliente
  customerDoc?: string;   // CNPJ ou CPF
  amount: number;         // Valor original do título em R$
  dueDate: string;        // Data de Vencimento YYYY-MM-DD
  issueDate?: string;     // Data de Emissão YYYY-MM-DD
  settlementDate?: string;// Data de liquidação/pagamento
  bankAccount?: string;   // Conta bancária de previsão (ex: "Itaú", "Safra")
  category?: string;      // Categoria no Omie (ex: "Venda de Mercadorias")
  ourNumber?: string;     // Nosso Número do Boleto
  balance?: number;       // Saldo remanescente em aberto
  paidAmount?: number;    // Valor liquidado
  discount?: number;      // Desconto concedido
  interest?: number;      // Juros
  fine?: number;          // Multa
  status: "pendente" | "baixado" | "parcial" | "cancelado";
  hasProof?: boolean;     // Comprovante/canhoto de entrega vinculado
};

export type MatchConfidence = "exato" | "documental" | "aproximado" | "sem_correspondencia";

export type ReconciliationMatch = {
  title: ReceivableTitle;
  statementRecord?: FinancialRecord;
  confidence: MatchConfidence;
  amountDifference: number; // > 0 juros/multa, < 0 desconto
  suggestedStatus: "pronto_para_baixa" | "divergente" | "nao_identificado";
  notes: string[];
};

export type BatchSettlementItem = {
  titleId: string;
  documentNumber: string;
  customerName: string;
  settlementDate: string; // YYYY-MM-DD da liquidação bancária
  amountOriginal: number;
  amountPaid: number;
  discount: number;
  interest: number;
  bankCode?: string;
  bankAccount?: string;
  sourceRecordId?: string; // FITID da transação bancária
  category?: string;
  observation?: string;
};

export type OmieReceiptPayload = {
  nCodTitulo?: number;
  cCodIntTitulo?: string;
  dDtReceb: string;       // DD/MM/AAAA
  nValorReceb: number;
  nDesconto?: number;
  nJuros?: number;
  nMulta?: number;
  nCodCC?: number;
  cContaCorrente?: string;
  cObs?: string;
};

/**
 * Normaliza strings para busca insensível a maiúsculas, espaços e acentos.
 */
function cleanString(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Calcula a diferença em dias entre duas datas YYYY-MM-DD.
 */
function daysDiff(d1: string, d2: string): number {
  const t1 = new Date(d1).getTime();
  const t2 = new Date(d2).getTime();
  return Math.abs(Math.round((t1 - t2) / (1000 * 60 * 60 * 24)));
}

/**
 * Algoritmo de Conciliação e Casamento Inteligente de Títulos a Receber com Extrato Bancário.
 * Separação estrita entre sugestão algorítmica e aprovação humana (Diretriz Omie Blueprint).
 */
export function matchTitlesWithRecords(
  titles: ReceivableTitle[],
  statementRecords: FinancialRecord[],
  options: { maxDaysTolerance?: number; interestDiscountTolerance?: number } = {}
): ReconciliationMatch[] {
  const maxDays = options.maxDaysTolerance ?? 5; // Janela bancária de compensação
  const tolerance = options.interestDiscountTolerance ?? 0.05; // 5% de tolerância para juros/desconto automático

  // Apenas entradas bancárias interessam para liquidação de contas a receber
  const incomingRecords = statementRecords.filter((r) => r.direction === "entrada");
  const matchedRecordIds = new Set<string>();
  const results: ReconciliationMatch[] = [];

  for (const title of titles) {
    if (title.status === "baixado") {
      results.push({
        title,
        confidence: "documental",
        amountDifference: 0,
        suggestedStatus: "pronto_para_baixa",
        notes: [title.settlementDate ? `Liquidado no ERP em ${formatDate(title.settlementDate)}` : "Título já liquidado no ERP"]
      });
      continue;
    }

    let bestMatch: FinancialRecord | null = null;
    let bestConfidence: MatchConfidence = "sem_correspondencia";
    let notes: string[] = [];

    // 1. Prioridade 1: Match por Nosso Número ou Número da NF-e explícito no memo/descrição
    const cleanDoc = cleanString(title.documentNumber).replace(/^0+/, "");
    const cleanOurNumber = title.ourNumber ? cleanString(title.ourNumber).replace(/^0+/, "") : null;
    const cleanCustomer = cleanString(title.customerName);
    const customerTokens = cleanCustomer
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !["ltda", "eireli", "alimentos", "comercio", "atacado", "varejo", "varejista", "distribuidora"].includes(w));

    for (const record of incomingRecords) {
      if (matchedRecordIds.has(record.id)) continue;

      const descClean = cleanString(record.description);
      const isDocMatch = cleanDoc.length >= 3 && descClean.includes(cleanDoc);
      const isOurNumberMatch = cleanOurNumber && cleanOurNumber.length >= 4 && descClean.includes(cleanOurNumber);
      const isCustomerMatch = customerTokens.length > 0 && customerTokens.some((t) => descClean.includes(t));

      if (isOurNumberMatch || isDocMatch) {
        bestMatch = record;
        bestConfidence = "documental";
        notes.push(isOurNumberMatch ? "Identificado pelo Nosso Número do boleto" : `Identificado pelo nº do documento NF-e ${title.documentNumber}`);
        break;
      }

      if (isCustomerMatch && Math.abs(record.amount - title.amount) < 0.01) {
        bestMatch = record;
        bestConfidence = "exato";
        notes.push("Correspondência exata de valor e nome/razão social do cliente");
        break;
      }
    }

    // 2. Prioridade 2: Match por Valor Exato + Proximidade de Data
    if (!bestMatch) {
      for (const record of incomingRecords) {
        if (matchedRecordIds.has(record.id)) continue;

        const valDiff = Math.abs(record.amount - title.amount);
        const dDiff = daysDiff(record.date, title.dueDate);

        if (valDiff < 0.01 && dDiff <= maxDays) {
          bestMatch = record;
          bestConfidence = "exato";
          notes.push(`Valor exato na janela de compensação (${dDiff} dia(s) do vencimento)`);
          break;
        }
      }
    }

    // 3. Prioridade 3: Match Aproximado com Juros de Mora ou Desconto Comercial
    if (!bestMatch) {
      for (const record of incomingRecords) {
        if (matchedRecordIds.has(record.id)) continue;

        const dDiff = daysDiff(record.date, title.dueDate);
        if (dDiff > maxDays) continue;

        const ratio = record.amount / title.amount;
        // Pagamento com até 5% de acréscimo (juros) ou até 10% de desconto comercial
        if (ratio >= (1 - tolerance * 2) && ratio <= (1 + tolerance)) {
          const diff = record.amount - title.amount;
          bestMatch = record;
          bestConfidence = "aproximado";
          if (diff > 0) {
            notes.push(`Possível acréscimo de juros/multa de ${formatCurrency(diff)}`);
          } else {
            notes.push(`Possível desconto concedido de ${formatCurrency(Math.abs(diff))}`);
          }
          break;
        }
      }
    }

    if (bestMatch) {
      matchedRecordIds.add(bestMatch.id);
      const diff = Math.round((bestMatch.amount - title.amount) * 100) / 100;
      const suggestedStatus = Math.abs(diff) < 0.01 || bestConfidence === "documental"
        ? "pronto_para_baixa"
        : "divergente";

      results.push({
        title,
        statementRecord: bestMatch,
        confidence: bestConfidence,
        amountDifference: diff,
        suggestedStatus,
        notes
      });
    } else {
      results.push({
        title,
        confidence: "sem_correspondencia",
        amountDifference: 0,
        suggestedStatus: "nao_identificado",
        notes: ["Nenhuma entrada bancária compatível localizada no extrato importado"]
      });
    }
  }

  return results;
}

/**
 * Converte conciliações aprovadas em itens estruturados de liquidação em lote.
 */
export function buildSettlementItems(matches: ReconciliationMatch[]): BatchSettlementItem[] {
  const settlements: BatchSettlementItem[] = [];

  for (const m of matches) {
    if (!m.statementRecord) continue;
    const diff = m.amountDifference;
    const interest = diff > 0 ? diff : 0;
    const discount = diff < 0 ? Math.abs(diff) : 0;

    settlements.push({
      titleId: m.title.id,
      documentNumber: m.title.documentNumber,
      customerName: m.title.customerName,
      settlementDate: m.statementRecord.date,
      amountOriginal: m.title.amount,
      amountPaid: m.statementRecord.amount,
      interest,
      discount,
      bankCode: m.statementRecord.bankCode,
      bankAccount: m.statementRecord.accountId || m.title.bankAccount,
      sourceRecordId: m.statementRecord.sourceRecordId,
      category: m.title.category || "Receita de Vendas",
      observation: `Baixa automatizada RSBUILD Finance · FITID: ${m.statementRecord.sourceRecordId || "N/A"}`
    });
  }

  return settlements;
}

/**
 * Gera o CSV oficial de Baixa em Lote pronto para importação direta no Omie.
 * Elimina a necessidade de arrastar cards manualmente no kanban de contas a receber.
 */
export function generateOmieBatchSettlementCsv(settlements: BatchSettlementItem[]): string {
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
    formatDate(s.settlementDate),
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

/**
 * Constrói o payload oficial para a API `Financas.Recebimento.Lancar` do Omie.
 */
export function buildOmieReceiptPayload(item: BatchSettlementItem, codCcNumeric?: number): OmieReceiptPayload {
  const [year, month, day] = item.settlementDate.split("-");
  return {
    cCodIntTitulo: item.titleId,
    dDtReceb: `${day}/${month}/${year}`,
    nValorReceb: item.amountPaid,
    nDesconto: item.discount > 0 ? item.discount : undefined,
    nJuros: item.interest > 0 ? item.interest : undefined,
    nCodCC: codCcNumeric,
    cContaCorrente: item.bankAccount,
    cObs: item.observation
  };
}

/**
 * Parser de Títulos a Receber (CSV exportado do Omie ou planilha de controle).
 */
export function parseReceivablesCsv(text: string): { titles: ReceivableTitle[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return { titles: [], errors: ["O arquivo de títulos a receber está vazio."] };

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const header = lines[0].split(delimiter).map((h) => cleanString(h));

  const docIdx = header.findIndex((h) => h.includes("documento") || h.includes("nf") || h.includes("numero") || h.includes("titulo"));
  const clientIdx = header.findIndex((h) => h.includes("cliente") || h.includes("razao") || h.includes("sacado"));
  const valueIdx = header.findIndex((h) => h.includes("valor") || h.includes("total") || h.includes("saldo"));
  const dateIdx = header.findIndex((h) => h.includes("vencimento") || h.includes("data"));
  const accountIdx = header.findIndex((h) => h.includes("conta") || h.includes("banco"));

  if (valueIdx === -1 || dateIdx === -1) {
    return {
      titles: [],
      errors: ["Não foi possível identificar as colunas de Valor e Vencimento no arquivo de títulos."]
    };
  }

  const titles: ReceivableTitle[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.replace(/^"|"$/g, "").trim());
    if (cols.length < 2) continue;

    const rawDoc = docIdx >= 0 ? cols[docIdx] : `TIT-${i}`;
    const customer = clientIdx >= 0 && cols[clientIdx] ? cols[clientIdx] : "Cliente Não Identificado";
    const rawVal = cols[valueIdx].replace(/\./g, "").replace(",", ".");
    const amount = Number(rawVal);

    let rawDate = cols[dateIdx];
    let dueDate: string | null = null;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
      const [d, m, y] = rawDate.split("/");
      dueDate = `${y}-${m}-${d}`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      dueDate = rawDate;
    }

    if (!dueDate || !Number.isFinite(amount) || amount <= 0) {
      errors.push(`Linha ${i + 1}: título com data (${rawDate}) ou valor (${cols[valueIdx]}) inválido.`);
      continue;
    }

    titles.push({
      id: `omie-tit-${i}`,
      documentNumber: rawDoc,
      customerName: customer,
      amount: Math.abs(Math.round(amount * 100) / 100),
      dueDate,
      bankAccount: accountIdx >= 0 ? cols[accountIdx] : undefined,
      status: "pendente"
    });
  }

  return { titles, errors };
}

function parseExcelDate(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "number") {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(str)) {
    const parts = str.split("/");
    const d = parts[0].padStart(2, "0");
    const m = parts[1].padStart(2, "0");
    let y = parts[2];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m}-${d}`;
  }
  return null;
}

function parseExcelNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (!val) return 0;
  let s = String(val).replace(/R\$\s*/g, "").trim();
  if (s.includes(".") && s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

/**
 * Parser inteligente de Títulos a Receber a partir de planilhas Excel (.xlsx, .xls) exportadas do Omie.
 */
export function parseReceivablesExcel(buffer: ArrayBuffer | Uint8Array): { titles: ReceivableTitle[]; errors: string[] } {
  try {
    const wb = XLSX.read(buffer, { type: "array" });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    if (!sheet) return { titles: [], errors: ["Planilha Excel vazia ou ilegível."] };

    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    if (rows.length < 2) return { titles: [], errors: ["Planilha sem registros."] };

    let headerIdx = -1;
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const rowStr = (rows[i] || []).join(" ").toLowerCase();
      if ((rowStr.includes("nota") || rowStr.includes("documento") || rowStr.includes("cliente")) && 
          (rowStr.includes("vencimento") || rowStr.includes("valor"))) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx === -1) {
      return { titles: [], errors: ["Não foi possível identificar o cabeçalho de Títulos na planilha."] };
    }

    const header = (rows[headerIdx] || []).map((h) => cleanString(String(h || "")));
    const docIdx = header.findIndex((h) => h.includes("documento") || h.includes("nf") || h.includes("nota fiscal") || h.includes("numero") || h.includes("titulo"));
    const clientIdx = header.findIndex((h) => (h.includes("cliente") || h.includes("sacado") || h.includes("fornecedor")) && !h.includes("minha empresa"));
    const fallbackClientIdx = clientIdx >= 0 ? clientIdx : header.findIndex((h) => h.includes("razao") && !h.includes("minha empresa"));
    const effectiveClientIdx = fallbackClientIdx >= 0 ? fallbackClientIdx : clientIdx;
    const valueIdx = header.findIndex((h) => h.includes("valor da conta") || h.includes("valor total") || h.includes("valor"));
    const dueDateIdx = header.findIndex((h) => h.includes("vencimento"));
    const emissionDateIdx = header.findIndex((h) => h.includes("emissao") || h.includes("emiss"));
    const settlementDateIdx = header.findIndex((h) => h.includes("pagto") || h.includes("recbto") || h.includes("liquidacao"));
    const accountIdx = header.findIndex((h) => h.includes("conta corrente") || h.includes("conta") || h.includes("banco"));
    const paidIdx = header.findIndex((h) => h.includes("pago ou recebido") || h.includes("pago") || h.includes("recebido"));
    const balanceIdx = header.findIndex((h) => h.includes("a pagar ou receber") || h.includes("saldo"));
    const discountIdx = header.findIndex((h) => h.includes("desconto"));
    const interestIdx = header.findIndex((h) => h.includes("juros"));
    const fineIdx = header.findIndex((h) => h.includes("multa"));

    const titles: ReceivableTitle[] = [];
    const errors: string[] = [];

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length < 2) continue;

      const rawDoc = docIdx >= 0 && r[docIdx] !== undefined ? String(r[docIdx]).trim() : `TIT-${i}`;
      const customer = effectiveClientIdx >= 0 && r[effectiveClientIdx] ? String(r[effectiveClientIdx]).trim() : "";
      if (!customer && !rawDoc) continue;

      if (customer.toLowerCase().includes("total") || (!customer && rawDoc.toLowerCase().includes("total"))) continue;

      const amount = valueIdx >= 0 ? parseExcelNumber(r[valueIdx]) : 0;
      const dueDate = dueDateIdx >= 0 ? parseExcelDate(r[dueDateIdx]) : null;
      const issueDate = emissionDateIdx >= 0 ? parseExcelDate(r[emissionDateIdx]) || undefined : undefined;
      const settlementDate = settlementDateIdx >= 0 ? parseExcelDate(r[settlementDateIdx]) || undefined : undefined;
      const bankAccount = accountIdx >= 0 && r[accountIdx] ? String(r[accountIdx]).trim() : undefined;
      const paidAmount = paidIdx >= 0 ? parseExcelNumber(r[paidIdx]) : 0;
      const balance = balanceIdx >= 0 ? parseExcelNumber(r[balanceIdx]) : undefined;
      const discount = discountIdx >= 0 ? parseExcelNumber(r[discountIdx]) : undefined;
      const interest = interestIdx >= 0 ? parseExcelNumber(r[interestIdx]) : undefined;
      const fine = fineIdx >= 0 ? parseExcelNumber(r[fineIdx]) : undefined;

      if (!dueDate || amount <= 0) continue;

      const isSettled = (settlementDate !== undefined && settlementDate !== "") || (paidAmount >= amount && amount > 0);

      titles.push({
        id: `tit-imp-${i}-${Date.now().toString(36)}`,
        documentNumber: rawDoc,
        customerName: customer || "Cliente Não Identificado",
        amount: Math.round(amount * 100) / 100,
        dueDate,
        issueDate,
        settlementDate,
        bankAccount,
        paidAmount,
        balance,
        discount,
        interest,
        fine,
        status: isSettled ? "baixado" : "pendente"
      });
    }

    return { titles, errors };
  } catch (err) {
    return { titles: [], errors: [`Falha ao processar arquivo Excel: ${err instanceof Error ? err.message : String(err)}`] };
  }
}

/**
 * Identifica a extensão do arquivo e executa o parser correspondente (.xlsx, .xls ou .csv).
 */
export async function parseReceivablesFile(file: File): Promise<{ titles: ReceivableTitle[]; errors: string[] }> {
  const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls") || file.type.includes("sheet") || file.type.includes("excel");
  if (isExcel) {
    const buffer = await file.arrayBuffer();
    return parseReceivablesExcel(buffer);
  }
  const text = await file.text();
  return parseReceivablesCsv(text);
}


