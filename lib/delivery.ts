/**
 * ENG-MS-03: Protocolo Digital de Indexação de Canhotos e Blindagem de Cobrança
 * 
 * Regras de Negócio e Rastreabilidade para Mundo do Sabor (ORG-003):
 * - Vincula faturas/NF-e a comprovantes de entrega assinados (canhotos).
 * - Blindagem jurídica preventiva: impede protesto cartorário indevido de duplicatas
 *   sem prova documental de entrega (art. 15 da Lei nº 5.474/1968).
 * - Integração conceitual com dados do Omie ERP e frentes de expedição/motoristas.
 */

export type DeliveryStatus = "pendente_entrega" | "comprovado" | "recusa_devolucao" | "extraviado";

export type ProtestoRisk = "liberado" | "bloqueio_preventivo" | "atencao_prazo";

export interface DeliveryProof {
  id: string;
  nfeNumber: string;             // Ex: "4580" ou "NF-4580"
  nfeKey?: string;               // Chave de 44 dígitos da SEFAZ
  customerName: string;
  customerDocument?: string;     // CNPJ ou CPF
  nfeAmount: number;
  issueDate: string;             // YYYY-MM-DD
  deliveryDate?: string;          // YYYY-MM-DD
  status: DeliveryStatus;
  driverName?: string;           // Nome do motorista / transportador
  receiverName?: string;         // Nome legível de quem recebeu na doca
  receiverDocument?: string;     // RG ou CPF do recebedor
  proofFileUrl?: string;         // Nome do arquivo escaneado ou URL da imagem
  notes?: string;
  syncedToOmie?: boolean;
}

export interface ProtestoEvaluation {
  nfeNumber: string;
  customerName: string;
  nfeAmount: number;
  deliveryStatus: DeliveryStatus;
  risk: ProtestoRisk;
  reason: string;
  proofId?: string;
  hasSignedReceipt: boolean;
}

export interface DeliveryMetrics {
  totalInvoices: number;
  totalAmount: number;
  provenCount: number;
  provenAmount: number;
  pendingDeliveryCount: number;
  pendingDeliveryAmount: number;
  rejectedCount: number;
  rejectedAmount: number;
  lostCount: number;
  lostAmount: number;
  coverageRate: number; // Percentual 0-100%
  atRiskProtestAmount: number; // Valor sem canhoto comprovado
}

/**
 * Validação do dígito verificador da Chave de Acesso da NF-e (44 dígitos, SEFAZ).
 * Algoritmo oficial Módulo 11 (pesos de 2 a 9).
 */
export function isValidNfeKey(key: string): boolean {
  const cleaned = key.replace(/\D/g, "");
  if (cleaned.length !== 44) {
    return false;
  }

  const base = cleaned.slice(0, 43);
  const dv = parseInt(cleaned.slice(43), 10);

  let sum = 0;
  let weight = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    sum += parseInt(base[i], 10) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }

  const remainder = sum % 11;
  const calculatedDv = remainder === 0 || remainder === 1 ? 0 : 11 - remainder;

  return calculatedDv === dv;
}

/**
 * Avalia o risco jurídico de cobrança e protesto de uma fatura/título
 * com base na existência e integridade do canhoto de entrega.
 */
export function evaluateProtestoRisk(
  proof: DeliveryProof | undefined,
  context?: { dueDate?: string; isOverdue?: boolean }
): ProtestoEvaluation {
  if (!proof) {
    return {
      nfeNumber: "N/A",
      customerName: "Não identificado",
      nfeAmount: 0,
      deliveryStatus: "extraviado",
      risk: "bloqueio_preventivo",
      reason: "Nenhum registro de expedição ou canhoto encontrado para esta fatura. Protesto bloqueado.",
      hasSignedReceipt: false
    };
  }

  const hasSignedReceipt =
    proof.status === "comprovado" &&
    Boolean(proof.receiverName || proof.proofFileUrl);

  if (proof.status === "comprovado" && hasSignedReceipt) {
    return {
      nfeNumber: proof.nfeNumber,
      customerName: proof.customerName,
      nfeAmount: proof.nfeAmount,
      deliveryStatus: proof.status,
      risk: "liberado",
      reason: `Canhoto validado e assinado por ${proof.receiverName || "recebedor autorizado"} em ${proof.deliveryDate || "data confirmada"}. Apto para protesto legal.`,
      proofId: proof.id,
      hasSignedReceipt: true
    };
  }

  if (proof.status === "recusa_devolucao") {
    return {
      nfeNumber: proof.nfeNumber,
      customerName: proof.customerName,
      nfeAmount: proof.nfeAmount,
      deliveryStatus: proof.status,
      risk: "bloqueio_preventivo",
      reason: `Mercadoria com recusa ou devolução registrada (${proof.notes || "sem justificativa"}). Protesto vedado.`,
      proofId: proof.id,
      hasSignedReceipt: false
    };
  }

  if (proof.status === "extraviado") {
    return {
      nfeNumber: proof.nfeNumber,
      customerName: proof.customerName,
      nfeAmount: proof.nfeAmount,
      deliveryStatus: proof.status,
      risk: "bloqueio_preventivo",
      reason: "Canhoto físico extraviado ou ilegível. Necessário termo de recebimento ou acareação antes de cobrança.",
      proofId: proof.id,
      hasSignedReceipt: false
    };
  }

  // pendente_entrega
  return {
    nfeNumber: proof.nfeNumber,
    customerName: proof.customerName,
    nfeAmount: proof.nfeAmount,
    deliveryStatus: proof.status,
    risk: context?.isOverdue ? "bloqueio_preventivo" : "atencao_prazo",
    reason: context?.isOverdue
      ? "Título vencido mas mercadoria consta ainda em trânsito ou sem retorno da expedição. Não protestar."
      : "Mercadoria em trânsito com motorista. Aguardando retorno da carga com canhoto assinado.",
    proofId: proof.id,
    hasSignedReceipt: false
  };
}

/**
 * Calcula métricas executivas consolidadas da carteira de canhotos
 */
export function computeDeliveryMetrics(proofs: DeliveryProof[]): DeliveryMetrics {
  const totalInvoices = proofs.length;
  const totalAmount = proofs.reduce((sum, p) => sum + p.nfeAmount, 0);

  let provenCount = 0;
  let provenAmount = 0;
  let pendingDeliveryCount = 0;
  let pendingDeliveryAmount = 0;
  let rejectedCount = 0;
  let rejectedAmount = 0;
  let lostCount = 0;
  let lostAmount = 0;

  for (const p of proofs) {
    if (p.status === "comprovado") {
      provenCount++;
      provenAmount += p.nfeAmount;
    } else if (p.status === "pendente_entrega") {
      pendingDeliveryCount++;
      pendingDeliveryAmount += p.nfeAmount;
    } else if (p.status === "recusa_devolucao") {
      rejectedCount++;
      rejectedAmount += p.nfeAmount;
    } else if (p.status === "extraviado") {
      lostCount++;
      lostAmount += p.nfeAmount;
    }
  }

  const coverageRate = totalInvoices > 0 ? (provenCount / totalInvoices) * 100 : 0;
  const atRiskProtestAmount = totalAmount - provenAmount;

  return {
    totalInvoices,
    totalAmount,
    provenCount,
    provenAmount,
    pendingDeliveryCount,
    pendingDeliveryAmount,
    rejectedCount,
    rejectedAmount,
    lostCount,
    lostAmount,
    coverageRate: Math.round(coverageRate * 10) / 10,
    atRiskProtestAmount
  };
}

/**
 * Parser de CSV para importação de canhotos de entrega
 * Compatível com saídas de planilhas de expedição da Mundo do Sabor / transportadores
 */
export function parseDeliveryCsv(content: string): { proofs: DeliveryProof[]; errors: string[] } {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length <= 1) {
    return { proofs: [], errors: ["O arquivo CSV de canhotos está vazio ou contém apenas o cabeçalho."] };
  }

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const header = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());

  // Mapeamento de índices comuns
  const idxNfe = header.findIndex((h) => h.includes("nfe") || h.includes("nota") || h.includes("numero"));
  const idxCliente = header.findIndex((h) => h.includes("cliente") || h.includes("razao") || h.includes("destinatario"));
  const idxValor = header.findIndex((h) => h.includes("valor") || h.includes("total") || h.includes("montante"));
  const idxEmissao = header.findIndex((h) => h.includes("emissao") || h.includes("data_emissao"));
  const idxEntrega = header.findIndex((h) => h.includes("entrega") || h.includes("data_entrega"));
  const idxStatus = header.findIndex((h) => h.includes("status") || h.includes("situacao"));
  const idxMotorista = header.findIndex((h) => h.includes("motorista") || h.includes("condutor") || h.includes("rota"));
  const idxRecebedor = header.findIndex((h) => h.includes("recebedor") || h.includes("assinado_por"));
  const idxDocRecebedor = header.findIndex((h) => h.includes("doc_recebedor") || h.includes("rg") || h.includes("cpf"));
  const idxChave = header.findIndex((h) => h.includes("chave") || h.includes("chave_acesso"));
  const idxArquivo = header.findIndex((h) => h.includes("arquivo") || h.includes("comprovante") || h.includes("foto"));

  if (idxNfe === -1 || idxCliente === -1 || idxValor === -1) {
    return {
      proofs: [],
      errors: ["Cabeçalho inválido. É obrigatório conter ao menos colunas para 'nfe', 'cliente' e 'valor'."]
    };
  }

  const proofs: DeliveryProof[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(delimiter).map((col) => col.trim());
    if (row.length <= Math.max(idxNfe, idxCliente, idxValor)) continue;

    const nfeRaw = row[idxNfe];
    const customer = row[idxCliente];
    const valorRaw = row[idxValor];

    if (!nfeRaw || !customer || !valorRaw) {
      errors.push(`Linha ${i + 1}: dados essenciais (NF, cliente ou valor) incompletos.`);
      continue;
    }

    // Normaliza valor
    const cleanedVal = valorRaw.replace(/R\$\s?/, "").replace(/\./g, "").replace(",", ".");
    const parsedAmount = parseFloat(cleanedVal);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      errors.push(`Linha ${i + 1}: valor inválido '${valorRaw}'.`);
      continue;
    }

    // Normaliza status
    const statusRaw = (idxStatus !== -1 ? row[idxStatus] : "").toLowerCase();
    let status: DeliveryStatus = "pendente_entrega";
    if (statusRaw.includes("comprov") || statusRaw.includes("entregue") || statusRaw.includes("assinado")) {
      status = "comprovado";
    } else if (statusRaw.includes("recusa") || statusRaw.includes("devol")) {
      status = "recusa_devolucao";
    } else if (statusRaw.includes("extrav") || statusRaw.includes("perdid")) {
      status = "extraviado";
    }

    const nfeNumber = nfeRaw.replace(/^NF-?/i, "").trim();
    const chave = idxChave !== -1 ? row[idxChave]?.replace(/\D/g, "") : undefined;

    proofs.push({
      id: `proof-${Date.now()}-${i}`,
      nfeNumber,
      nfeKey: chave && chave.length === 44 ? chave : undefined,
      customerName: customer,
      nfeAmount: parsedAmount,
      issueDate: idxEmissao !== -1 && row[idxEmissao] ? row[idxEmissao] : new Date().toISOString().slice(0, 10),
      deliveryDate: idxEntrega !== -1 ? row[idxEntrega] : undefined,
      status,
      driverName: idxMotorista !== -1 ? row[idxMotorista] : undefined,
      receiverName: idxRecebedor !== -1 ? row[idxRecebedor] : undefined,
      receiverDocument: idxDocRecebedor !== -1 ? row[idxDocRecebedor] : undefined,
      proofFileUrl: idxArquivo !== -1 ? row[idxArquivo] : undefined
    });
  }

  return { proofs, errors };
}

/**
 * Gera relatório CSV do Protocolo de Blindagem de Cobrança e Protesto
 * Pronto para despacho executivo e jurídico da RS2BUILD / Mundo do Sabor.
 */
export function generateDeliveryBlindageCsv(
  proofs: DeliveryProof[],
  evaluations: ProtestoEvaluation[]
): string {
  const header = [
    "NF-e",
    "Cliente",
    "Valor NF (R$)",
    "Status Entrega",
    "Data Entrega",
    "Recebedor",
    "Doc Recebedor",
    "Risco Protesto",
    "Parecer Juridico Blindagem",
    "Chave NF-e"
  ].join(";");

  const rows = evaluations.map((ev) => {
    const proof = proofs.find((p) => p.nfeNumber === ev.nfeNumber || p.id === ev.proofId);
    const amountStr = ev.nfeAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const riskLabel =
      ev.risk === "liberado"
        ? "LIBERADO"
        : ev.risk === "bloqueio_preventivo"
        ? "BLOQUEIO PREVENTIVO"
        : "ATENCAO PRAZO";

    return [
      `"${ev.nfeNumber}"`,
      `"${ev.customerName.replace(/"/g, '""')}"`,
      amountStr,
      `"${ev.deliveryStatus}"`,
      `"${proof?.deliveryDate || ""}"`,
      `"${(proof?.receiverName || "").replace(/"/g, '""')}"`,
      `"${proof?.receiverDocument || ""}"`,
      `"${riskLabel}"`,
      `"${ev.reason.replace(/"/g, '""')}"`,
      `"${proof?.nfeKey || ""}"`
    ].join(";");
  });

  return [header, ...rows].join("\r\n");
}

