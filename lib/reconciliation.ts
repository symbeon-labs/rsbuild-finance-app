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

  // Entradas para contas a receber; saídas para contas a pagar
  const incomingRecords = statementRecords.filter((r) => r.direction === "entrada");
  const outgoingRecords = statementRecords.filter((r) => r.direction === "saída");
  const matchedRecordIds = new Set<string>();
  const results: ReconciliationMatch[] = [];

  for (const title of titles) {
    const candidatePool = title.category === "payable" ? outgoingRecords : incomingRecords;
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

    for (const record of candidatePool) {
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
        notes.push("Correspondência exata de valor e nome/razão social");
        break;
      }
    }

    // 2. Prioridade 2: Match por Valor Exato + Proximidade de Data
    if (!bestMatch) {
      for (const record of candidatePool) {
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
      for (const record of candidatePool) {
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
 * Parser de Títulos a Receber e a Pagar (CSV exportado do Omie ou planilha de controle).
 */
export function parseReceivablesCsv(text: string): { titles: ReceivableTitle[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return { titles: [], errors: ["O arquivo de títulos está vazio."] };

  // Detecta delimitador na linha mais longa das primeiras 10 linhas (ignora linha título "Contas a Pagar,,,")
  const sampleLine = lines.slice(0, 10).reduce((a, b) => (b.length > a.length ? b : a), lines[0]);
  const delimiter = (sampleLine.match(/;/g)?.length ?? 0) >= (sampleLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  let headerIdx = -1;
  for (let i = 0; i < Math.min(30, lines.length); i++) {
    const cells = lines[i].split(delimiter).map((h) => cleanString(h.replace(/^"|"$/g, "")));
    const hasValue = cells.some((h) => h.includes("valor") || h.includes("total") || h.includes("saldo"));
    const hasDate = cells.some((h) => h.includes("vencimento") || h.includes("venc") || h.includes("data"));
    if (hasValue && hasDate && cells.filter((c) => c.length > 0).length >= 3) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    return {
      titles: [],
      errors: ["Não foi possível identificar as colunas de Valor e Vencimento no arquivo de títulos."]
    };
  }

  const header = lines[headerIdx].split(delimiter).map((h) => cleanString(h.replace(/^"|"$/g, "")));

  const docIdx = header.findIndex((h) => h.includes("documento") || h.includes("nf") || h.includes("nota fiscal") || h.includes("numero") || h.includes("titulo") || h.includes("parcela") || h.includes("duplicata"));
  const clientIdx = header.findIndex((h) => (h.includes("cliente") || h.includes("sacado") || h.includes("fornecedor") || h.includes("favorecido") || h.includes("beneficiario")) && !h.includes("minha empresa"));
  const fallbackClientIdx = clientIdx >= 0 ? clientIdx : header.findIndex((h) => (h.includes("razao") || h.includes("nome")) && !h.includes("minha empresa"));
  const effectiveClientIdx = fallbackClientIdx >= 0 ? fallbackClientIdx : clientIdx;
  const valueIdx = header.findIndex((h) => h.includes("valor da conta") || h.includes("valor total") || h.includes("valor liquido") || h.includes("valor"));
  const dateIdx = header.findIndex((h) => h.includes("vencimento") || h.includes("data"));
  const emissionIdx = header.findIndex((h) => h.includes("emissao") || h.includes("emiss"));
  const exactAccountIdx = header.findIndex((h) => h === "conta corrente" || h.includes("conta corrente"));
  const accountIdx = exactAccountIdx >= 0
    ? exactAccountIdx
    : header.findIndex((h) => (h.includes("conta") && !h.includes("valor") && !h.includes("categoria")) || h.includes("banco"));
  const paidIdx = header.findIndex((h) => h.includes("pago ou recebido") || h === "pago" || h === "recebido");
  const balanceIdx = header.findIndex((h) => h.includes("a pagar ou receber") || h.includes("saldo"));
  const cnpjIdx = header.findIndex((h) => h.includes("cnpj") || h.includes("cpf"));
  const originIdx = header.findIndex((h) => h === "origem" || h.includes("origem"));
  const isPayableHeader = header.some((h) => (h.includes("fornecedor") && !h.includes("cliente")) || h === "a pagar" || h.includes("credor"));

  const titles: ReceivableTitle[] = [];
  const errors: string[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.replace(/^"|"$/g, "").trim());
    if (cols.length < 2) continue;

    const rawCustomer = effectiveClientIdx >= 0 ? cols[effectiveClientIdx] : "";
    const rawDoc = docIdx >= 0 && cols[docIdx] ? cols[docIdx] : `TIT-${i}`;
    // Ignora linha de totais (ex: ",,,,,-19318.67,,0,-19318.67,,,")
    if (!rawCustomer && (!cols[dateIdx] || !cols[dateIdx].trim())) continue;
    if (rawCustomer.toLowerCase().includes("total")) continue;

    const rawAmount = parseExcelNumber(cols[valueIdx]);
    const amount = Math.abs(rawAmount);
    const originStr = originIdx >= 0 && cols[originIdx] ? cleanString(cols[originIdx]) : "";
    const isPayable = rawAmount < 0 ||
      originStr.includes("pagar") ||
      originStr.includes("pagamento") ||
      (!originStr.includes("receber") && !originStr.includes("recebimento") && isPayableHeader);
    const customer = rawCustomer || (isPayable ? "Fornecedor Não Identificado" : "Cliente Não Identificado");

    const dueDate = parseExcelDate(cols[dateIdx]);
    if (!dueDate || !Number.isFinite(amount) || amount <= 0) {
      errors.push(`Linha ${i + 1}: título com data (${cols[dateIdx]}) ou valor (${cols[valueIdx]}) inválido.`);
      continue;
    }

    const issueDate = emissionIdx >= 0 ? parseExcelDate(cols[emissionIdx]) || undefined : undefined;
    const paidAmount = paidIdx >= 0 ? Math.abs(parseExcelNumber(cols[paidIdx])) : 0;
    const balance = balanceIdx >= 0 ? Math.abs(parseExcelNumber(cols[balanceIdx])) : undefined;
    const rawDocId = cnpjIdx >= 0 && cols[cnpjIdx] ? cols[cnpjIdx] : "";
    const customerDoc = rawDocId && rawDocId.toUpperCase() !== "N/D" ? rawDocId : undefined;
    const isSettled = paidAmount >= amount && amount > 0;

    titles.push({
      id: `omie-tit-${i}`,
      documentNumber: rawDoc,
      customerName: customer,
      customerDoc,
      amount: Math.round(amount * 100) / 100,
      dueDate,
      issueDate,
      bankAccount: accountIdx >= 0 && cols[accountIdx] ? cols[accountIdx] : undefined,
      paidAmount,
      balance,
      category: isPayable ? "payable" : "receivable",
      status: isSettled ? "baixado" : "pendente"
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
 * Parser inteligente de Títulos a Receber e a Pagar a partir de planilhas Excel (.xlsx, .xls) de qualquer ERP (Omie, Bling, Tiny, ContaAzul ou planilha própria).
 * Varre todas as abas da planilha e utiliza a primeira aba que contiver títulos válidos.
 */
export function parseReceivablesExcel(buffer: ArrayBuffer | Uint8Array): { titles: ReceivableTitle[]; errors: string[] } {
  try {
    const wb = XLSX.read(buffer, { type: "array" });
    if (!wb.SheetNames.length) return { titles: [], errors: ["Planilha Excel vazia ou ilegível."] };

    let lastError = "Não foi possível identificar o cabeçalho na planilha.";
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      if (rows.length < 2) continue;

      const parsed = parseExcelSheetRows(rows, sheetName);
      if (parsed.titles.length > 0) {
        return parsed;
      }
      if (parsed.errors.length > 0) {
        lastError = parsed.errors[0];
      }
    }

    return { titles: [], errors: [lastError] };
  } catch (err) {
    return { titles: [], errors: [`Falha ao processar arquivo Excel: ${err instanceof Error ? err.message : String(err)}`] };
  }
}

function parseExcelSheetRows(rows: any[][], sheetName: string): { titles: ReceivableTitle[]; errors: string[] } {
  let headerIdx = -1;
  // Varredura estendida até 30 linhas para suportar relatórios de qualquer ERP com metadados e logos no topo.
  for (let i = 0; i < Math.min(30, rows.length); i++) {
    const cells = (rows[i] || []).map((c: unknown) => cleanString(String(c ?? "")));
    const rowStr = cells.join(" ");

    const hasEntity = cells.some((c) =>
      c.includes("cliente") || c.includes("fornecedor") || c.includes("sacado") ||
      c.includes("favorecido") || c.includes("beneficiario") || c.includes("razao") ||
      c.includes("razao social") || c.includes("nome") || c.includes("credor") ||
      c.includes("devedor") || c.includes("contraparte") || c.includes("participante") ||
      c.includes("parceiro") || c.includes("pessoa") || c.includes("descricao") || c.includes("historico")
    );
    const hasDoc = cells.some((c) =>
      c.includes("documento") || c.includes("nota") || c.includes("nf") ||
      c.includes("titulo") || c.includes("parcela") || c.includes("duplicata") ||
      c.includes("numero") || c.includes("cod") || c.includes("lancamento") ||
      c.includes("pedido") || c.includes("fatura") || c.includes("boleto")
    );
    const hasValue = cells.some((c) => c.includes("valor") || c.includes("vlr") || c.includes("saldo") || c.includes("montante") || c.includes("total"));
    const hasDate = cells.some((c) =>
      c.includes("vencimento") || c.includes("venc") ||
      c.includes("data") || c.includes("dt") || c.includes("prazo")
    );

    if ((hasEntity || hasDoc) && (hasValue || hasDate)) {
      const nonEmptyCells = cells.filter((c) => c.length > 0);
      const textCells = cells.filter((c) => c.length > 0 && isNaN(Number(c.replace(/[,./\-]/g, ""))));
      if (nonEmptyCells.length >= 3 && textCells.length >= 2) {
        headerIdx = i;
        break;
      }
    }
    const erpKeywords = ["valor", "vlr", "vencimento", "venc", "data", "razao", "nome", "fornecedor",
      "cliente", "documento", "titulo", "parcela", "saldo", "pagar", "receber", "cod", "lancamento", "descricao"];
    const matchCount = erpKeywords.filter((kw) => rowStr.includes(kw)).length;
    if (matchCount >= 3) {
      const nonEmptyCells = cells.filter((c) => c.length > 0);
      const textCells = cells.filter((c) => c.length > 0 && isNaN(Number(c.replace(/[,./\-]/g, ""))));
      if (nonEmptyCells.length >= 3 && textCells.length >= 2) {
        headerIdx = i;
        break;
      }
    }
  }

  if (headerIdx === -1) {
    return { titles: [], errors: ["Não foi possível identificar o cabeçalho na planilha. Use o mapeamento manual de colunas ou verifique as colunas de Valor e Vencimento."] };
  }

  const header = (rows[headerIdx] || []).map((h) => cleanString(String(h || "")));
  const docIdx = header.findIndex((h) =>
    h.includes("documento") || h.includes("nota fiscal") || h.includes("nf") ||
    h.includes("titulo") || h.includes("parcela") || h.includes("duplicata") ||
    h === "numero" || h.includes("num. titulo") || h.includes("nr titulo") ||
    h.includes("nr. titulo") || h.includes("cod. lancamento") || h.includes("lancamento") ||
    h.includes("fatura") || h.includes("boleto") ||
    (h.includes("cod") && !h.includes("conta") && !h.includes("categoria"))
  );
  const clientIdx = header.findIndex((h) =>
    (h.includes("cliente") || h.includes("sacado") || h.includes("fornecedor") ||
    h.includes("favorecido") || h.includes("beneficiario") || h.includes("credor") ||
    h.includes("devedor") || h.includes("contraparte") || h.includes("participante") ||
    h.includes("parceiro") || h.includes("pessoa")) && !h.includes("minha empresa")
  );
  const fallbackClientIdx = clientIdx >= 0 ? clientIdx : header.findIndex((h) =>
    (h.includes("razao social") || h.includes("razao") || h === "nome" || h.includes("nome fantasia") ||
     h.includes("descricao") || h.includes("historico")) &&
    !h.includes("minha empresa")
  );
  const effectiveClientIdx = fallbackClientIdx >= 0 ? fallbackClientIdx : clientIdx;
  const valueIdx = header.findIndex((h) =>
    h.includes("val. doc") || h.includes("val doc") || h === "valor doc" ||
    h.includes("valor do documento") || h.includes("valor da conta") ||
    h.includes("valor total") || h.includes("valor liquido") || h.includes("valor bruto") ||
    h.includes("valor original") || h === "valor" || h === "vlr"
  );
  const effectiveValueIdx = valueIdx >= 0 ? valueIdx : header.findIndex((h) => h.includes("valor") || h.includes("vlr") || h.includes("montante") || h === "total");
  const dueDateIdx = header.findIndex((h) =>
    h.includes("vencimento") || h.includes("dt venc") || h.includes("data venc") ||
    h.includes("dt. venc") || h === "venc" || h.includes("prazo") || h === "data"
  );
  const emissionDateIdx = header.findIndex((h) => h.includes("emissao") || h.includes("emiss") || (h.includes("lancamento") && h.includes("data")));
  const settlementDateIdx = header.findIndex((h) =>
    h.includes("pagto") || h.includes("recbto") || h.includes("liquidacao") ||
    h.includes("pagamento") || h.includes("dt pag") || h.includes("data pag") ||
    h.includes("data rec") || h.includes("baixa")
  );
  const exactAccountIdx = header.findIndex((h) => h === "conta corrente" || h.includes("conta corrente"));
  const accountIdx = exactAccountIdx >= 0 ? exactAccountIdx : header.findIndex((h) =>
    (h.includes("conta") && !h.includes("valor") && !h.includes("categoria") && !h.includes("contabil")) ||
    h.includes("banco") || h.includes("cc ")
  );
  const paidIdx = header.findIndex((h) => h.includes("pago ou recebido") || h.includes("val pago") || h === "pago" || h === "recebido" || h.includes("val. pago"));
  const balanceIdx = header.findIndex((h) => h.includes("a pagar ou receber") || h.includes("saldo") || h.includes("val. saldo") || h.includes("valor saldo"));
  const discountIdx = header.findIndex((h) => h.includes("desconto"));
  const interestIdx = header.findIndex((h) => h.includes("juros"));
  const fineIdx = header.findIndex((h) => h.includes("multa"));
  const cnpjIdx = header.findIndex((h) => h.includes("cnpj") || h.includes("cpf"));
  const originIdx = header.findIndex((h) => h === "origem" || h.includes("origem"));
  const typeIdx = header.findIndex((h) => h === "tipo" || h.includes("natureza") || h.includes("operacao") || h.includes("movimento") || h === "d/c" || h === "c/p");

  const sheetLower = cleanString(sheetName);
  const isPayableSheet = sheetLower.includes("pagar") ||
    sheetLower.includes("pagamento") ||
    sheetLower.includes("despesa") ||
    header.some((h) => (h === "fornecedor" || (h.includes("fornecedor") && !h.includes("cliente"))) || h.includes("credor"));

  const titles: ReceivableTitle[] = [];
  const errors: string[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 2) continue;

    const rawDoc = docIdx >= 0 && r[docIdx] !== undefined ? String(r[docIdx]).trim() : `TIT-${i}`;
    const customer = effectiveClientIdx >= 0 && r[effectiveClientIdx] ? String(r[effectiveClientIdx]).trim() : "";
    if (!customer && !rawDoc) continue;
    if (customer.toLowerCase().includes("total") || (!customer && rawDoc.toLowerCase().includes("total"))) continue;

    const rawAmount = effectiveValueIdx >= 0 ? parseExcelNumber(r[effectiveValueIdx]) : 0;
    const amount = Math.abs(rawAmount);
    const dueDate = dueDateIdx >= 0 ? parseExcelDate(r[dueDateIdx]) : null;
    if (!dueDate || amount <= 0) continue;

    const issueDate = emissionDateIdx >= 0 ? parseExcelDate(r[emissionDateIdx]) || undefined : undefined;
    const settlementDate = settlementDateIdx >= 0 ? parseExcelDate(r[settlementDateIdx]) || undefined : undefined;
    const bankAccount = accountIdx >= 0 && r[accountIdx] ? String(r[accountIdx]).trim() : undefined;
    const paidAmount = paidIdx >= 0 ? Math.abs(parseExcelNumber(r[paidIdx])) : 0;
    const balance = balanceIdx >= 0 ? Math.abs(parseExcelNumber(r[balanceIdx])) : undefined;
    const discount = discountIdx >= 0 ? Math.abs(parseExcelNumber(r[discountIdx])) : undefined;
    const interest = interestIdx >= 0 ? Math.abs(parseExcelNumber(r[interestIdx])) : undefined;
    const fine = fineIdx >= 0 ? Math.abs(parseExcelNumber(r[fineIdx])) : undefined;
    const rawDocId = cnpjIdx >= 0 && r[cnpjIdx] ? String(r[cnpjIdx]).trim() : "";
    const customerDoc = rawDocId && rawDocId.toUpperCase() !== "N/D" ? rawDocId : undefined;
    const originStr = originIdx >= 0 && r[originIdx] ? cleanString(String(r[originIdx])) : "";
    const typeStr = typeIdx >= 0 && r[typeIdx] ? cleanString(String(r[typeIdx])) : "";

    const typeIndicatesPayable = typeStr === "p" || typeStr === "d" || typeStr === "-" ||
      typeStr.includes("pagar") || typeStr.includes("despesa") || typeStr.includes("saida") || typeStr.includes("debito");
    const typeIndicatesReceivable = typeStr === "r" || typeStr === "c" || typeStr === "+" ||
      typeStr.includes("receber") || typeStr.includes("receita") || typeStr.includes("entrada") || typeStr.includes("credito");

    const isPayable = rawAmount < 0 ||
      typeIndicatesPayable ||
      originStr.includes("pagar") ||
      originStr.includes("pagamento") ||
      (!typeIndicatesReceivable && !originStr.includes("receber") && !originStr.includes("recebimento") && isPayableSheet);

    const isSettled = (settlementDate !== undefined && settlementDate !== "") || (paidAmount >= amount && amount > 0);

    titles.push({
      id: `tit-imp-${i}-${Date.now().toString(36)}`,
      documentNumber: rawDoc || `TIT-${i}`,
      customerName: customer || (isPayable ? "Fornecedor Não Identificado" : "Cliente Não Identificado"),
      customerDoc,
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
      category: isPayable ? "payable" : "receivable",
      status: isSettled ? "baixado" : "pendente"
    });
  }

  return { titles, errors };
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

export type SpreadsheetSheetPreview = {
  name: string;
  rows: string[][];
};

export type TitleColumnMapping = {
  sheetIndex?: number;
  headerRowIndex: number; // -1 se não houver cabeçalho
  valueCol: number;
  dueDateCol: number;
  customerCol?: number;
  documentCol?: number;
  bankAccountCol?: number;
  customerDocCol?: number;
  typeCol?: number;
  paidCol?: number;
  directionMode: "auto" | "receivable" | "payable";
};

/**
 * Extrai abas e linhas de qualquer planilha (.xlsx, .xls, .csv) para pré-visualização e mapeamento universal.
 */
export async function extractSpreadsheetPreview(file: File): Promise<SpreadsheetSheetPreview[]> {
  const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls") || file.type.includes("sheet") || file.type.includes("excel");
  if (isExcel) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    return wb.SheetNames.map((name) => {
      const sheet = wb.Sheets[name];
      const rawRows = sheet ? XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 }) : [];
      const rows = rawRows
        .filter((r) => Array.isArray(r) && r.some((c) => c !== null && c !== undefined && String(c).trim() !== ""))
        .map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c).trim())));
      return { name, rows };
    });
  }

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return [{ name: file.name, rows: [] }];
  const sampleLine = lines.slice(0, 10).reduce((a, b) => (b.length > a.length ? b : a), lines[0]);
  const delimiter = (sampleLine.match(/;/g)?.length ?? 0) >= (sampleLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows = lines.map((l) => l.split(delimiter).map((c) => c.replace(/^"|"$/g, "").trim()));
  return [{ name: file.name, rows }];
}

/**
 * Infere automaticamente o melhor mapeamento de colunas a partir do cabeçalho ou conteúdo das células.
 */
export function suggestTitleColumnMapping(sheet: SpreadsheetSheetPreview): TitleColumnMapping {
  const rows = sheet.rows;
  let headerRowIndex = 0;
  let valueCol = -1;
  let dueDateCol = -1;
  let customerCol: number | undefined;
  let documentCol: number | undefined;
  let bankAccountCol: number | undefined;
  let typeCol: number | undefined;

  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const cells = rows[i].map((c) => cleanString(c));
    const vIdx = cells.findIndex((c) => c.includes("valor") || c.includes("vlr") || c.includes("total") || c.includes("montante") || c.includes("saldo"));
    const dIdx = cells.findIndex((c) => c.includes("vencimento") || c.includes("venc") || c.includes("data") || c.includes("prazo"));
    if (vIdx >= 0 || dIdx >= 0) {
      headerRowIndex = i;
      if (vIdx >= 0) valueCol = vIdx;
      if (dIdx >= 0) dueDateCol = dIdx;
      const cIdx = cells.findIndex((c) => (c.includes("cliente") || c.includes("fornecedor") || c.includes("razao") || c.includes("nome") || c.includes("descricao") || c.includes("historico")) && !c.includes("minha empresa"));
      if (cIdx >= 0) customerCol = cIdx;
      const docIdx = cells.findIndex((c) => c.includes("documento") || c.includes("nf") || c.includes("nota") || c.includes("titulo") || c.includes("numero") || c.includes("codigo"));
      if (docIdx >= 0) documentCol = docIdx;
      const accIdx = cells.findIndex((c) => c.includes("conta corrente") || c.includes("banco") || (c.includes("conta") && !c.includes("valor")));
      if (accIdx >= 0) bankAccountCol = accIdx;
      const tIdx = cells.findIndex((c) => c === "tipo" || c.includes("natureza") || c.includes("operacao") || c.includes("origem"));
      if (tIdx >= 0) typeCol = tIdx;
      break;
    }
  }

  // Fallback por conteúdo caso o arquivo não tenha nomes de coluna reconhecíveis
  const dataSample = rows.slice(headerRowIndex + 1, headerRowIndex + 11);
  if (dataSample.length > 0) {
    const colCount = Math.max(...dataSample.map((r) => r.length), 0);
    if (dueDateCol === -1) {
      for (let col = 0; col < colCount; col++) {
        const hits = dataSample.filter((r) => parseExcelDate(r[col]) !== null).length;
        if (hits >= Math.ceil(dataSample.length * 0.5)) { dueDateCol = col; break; }
      }
    }
    if (valueCol === -1) {
      for (let col = 0; col < colCount; col++) {
        if (col === dueDateCol) continue;
        const hits = dataSample.filter((r) => {
          const n = parseExcelNumber(r[col]);
          return n !== 0 && !/^\d{4,5}$/.test((r[col] || "").trim()); // evita serial de data
        }).length;
        if (hits >= Math.ceil(dataSample.length * 0.5)) { valueCol = col; break; }
      }
    }
    if (customerCol === undefined) {
      for (let col = 0; col < colCount; col++) {
        if (col === dueDateCol || col === valueCol || col === documentCol) continue;
        const hits = dataSample.filter((r) => {
          const val = (r[col] || "").trim();
          return val.length >= 3 && isNaN(Number(val.replace(/[,./\-]/g, "")));
        }).length;
        if (hits >= Math.ceil(dataSample.length * 0.5)) { customerCol = col; break; }
      }
    }
  }

  const sheetLower = cleanString(sheet.name);
  const directionMode: "auto" | "receivable" | "payable" =
    sheetLower.includes("pagar") || sheetLower.includes("pagamento") || sheetLower.includes("despesa")
      ? "payable"
      : sheetLower.includes("receber") || sheetLower.includes("recebimento")
        ? "receivable"
        : "auto";

  return {
    sheetIndex: 0,
    headerRowIndex,
    valueCol: valueCol >= 0 ? valueCol : 0,
    dueDateCol: dueDateCol >= 0 ? dueDateCol : 0,
    customerCol,
    documentCol,
    bankAccountCol,
    typeCol,
    directionMode
  };
}

/**
 * Converte qualquer planilha (independente do ERP de origem) em ReceivableTitle[] usando o mapeamento escolhido.
 */
export function parseTitlesWithMapping(
  sheets: SpreadsheetSheetPreview[],
  mapping: TitleColumnMapping
): { titles: ReceivableTitle[]; errors: string[] } {
  const sheet = sheets[mapping.sheetIndex ?? 0];
  if (!sheet || !sheet.rows.length) {
    return { titles: [], errors: ["Aba selecionada está vazia."] };
  }

  const startRow = mapping.headerRowIndex >= 0 ? mapping.headerRowIndex + 1 : 0;
  const titles: ReceivableTitle[] = [];
  const errors: string[] = [];

  for (let i = startRow; i < sheet.rows.length; i++) {
    const r = sheet.rows[i];
    if (!r || !r.length) continue;

    const rawAmount = parseExcelNumber(r[mapping.valueCol]);
    const amount = Math.abs(rawAmount);
    const dueDate = parseExcelDate(r[mapping.dueDateCol]);
    if (!dueDate || amount <= 0) continue;

    const customer = mapping.customerCol !== undefined && mapping.customerCol >= 0 ? (r[mapping.customerCol] || "").trim() : "";
    if (customer.toLowerCase().includes("total")) continue;

    const rawDoc = mapping.documentCol !== undefined && mapping.documentCol >= 0 && r[mapping.documentCol]
      ? r[mapping.documentCol].trim()
      : `TIT-${i + 1}`;
    const bankAccount = mapping.bankAccountCol !== undefined && mapping.bankAccountCol >= 0 && r[mapping.bankAccountCol]
      ? r[mapping.bankAccountCol].trim()
      : undefined;
    const rawDocId = mapping.customerDocCol !== undefined && mapping.customerDocCol >= 0 && r[mapping.customerDocCol]
      ? r[mapping.customerDocCol].trim()
      : "";
    const customerDoc = rawDocId && rawDocId.toUpperCase() !== "N/D" ? rawDocId : undefined;
    const paidAmount = mapping.paidCol !== undefined && mapping.paidCol >= 0 ? Math.abs(parseExcelNumber(r[mapping.paidCol])) : 0;

    let isPayable = mapping.directionMode === "payable";
    if (mapping.directionMode === "auto") {
      const typeStr = mapping.typeCol !== undefined && mapping.typeCol >= 0 ? cleanString(r[mapping.typeCol] || "") : "";
      const typeIndicatesPayable = typeStr === "p" || typeStr === "d" || typeStr === "-" ||
        typeStr.includes("pagar") || typeStr.includes("despesa") || typeStr.includes("saida") || typeStr.includes("debito");
      isPayable = rawAmount < 0 || typeIndicatesPayable;
    }

    titles.push({
      id: `tit-map-${i}-${Date.now().toString(36)}`,
      documentNumber: rawDoc,
      customerName: customer || (isPayable ? "Fornecedor Não Identificado" : "Cliente Não Identificado"),
      customerDoc,
      amount: Math.round(amount * 100) / 100,
      dueDate,
      bankAccount,
      paidAmount,
      category: isPayable ? "payable" : "receivable",
      status: paidAmount >= amount && amount > 0 ? "baixado" : "pendente"
    });
  }

  return { titles, errors };
}


