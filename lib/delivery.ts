/**
 * ENG-MS-03: Registro de Evidências de Entrega
 * 
 * Regras de Negócio e Rastreabilidade para Mundo do Sabor (ORG-003):
 * - Vincula faturas/NF-e a comprovantes de entrega assinados (canhotos).
 * - Organiza metadados de entrega para revisão operacional e humana.
 * - Integração conceitual com dados do Omie ERP e frentes de expedição/motoristas.
 */

export type DeliveryStatus = "pendente_entrega" | "comprovado" | "recusa_devolucao" | "extraviado";

export type ProtestoRisk = "metadata_complete" | "priority_review" | "documentary_review";

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
  hasCompleteEvidenceMetadata: boolean;
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
 * Classifica pendências documentais para revisão humana.
 * Não determina legalidade, não autentica assinaturas e não autoriza protesto ou cobrança.
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
      risk: "priority_review",
      reason: "Nenhum registro de comprovante foi encontrado neste módulo. A situação exige revisão humana; o sistema não determina a legalidade de cobrança ou protesto.",
      hasCompleteEvidenceMetadata: false
    };
  }

  const hasCompleteEvidenceMetadata =
    proof.status === "comprovado" &&
    Boolean(proof.receiverName?.trim()) &&
    Boolean(proof.receiverDocument?.trim()) &&
    Boolean(proof.deliveryDate) &&
    Boolean(proof.proofFileUrl?.trim());

  if (proof.status === "comprovado" && hasCompleteEvidenceMetadata) {
    return {
      nfeNumber: proof.nfeNumber,
      customerName: proof.customerName,
      nfeAmount: proof.nfeAmount,
      deliveryStatus: proof.status,
      risk: "metadata_complete",
      reason: `Há referência de evidência e dados de recebedor (${proof.receiverName}) em ${proof.deliveryDate}. A autenticidade do arquivo e da assinatura não foi verificada; exige revisão humana/jurídica antes de qualquer decisão.`,
      proofId: proof.id,
      hasCompleteEvidenceMetadata: true
    };
  }

  if (proof.status === "comprovado" && !hasCompleteEvidenceMetadata) {
    return {
      nfeNumber: proof.nfeNumber,
      customerName: proof.customerName,
      nfeAmount: proof.nfeAmount,
      deliveryStatus: proof.status,
      risk: "documentary_review",
      reason: "O status foi marcado como comprovado, mas faltam data, identificação do recebedor ou referência do arquivo de evidência. Revisão humana necessária.",
      proofId: proof.id,
      hasCompleteEvidenceMetadata: false
    };
  }

  if (proof.status === "recusa_devolucao") {
    return {
      nfeNumber: proof.nfeNumber,
      customerName: proof.customerName,
      nfeAmount: proof.nfeAmount,
      deliveryStatus: proof.status,
      risk: "priority_review",
      reason: `Há registro de recusa ou devolução (${proof.notes || "sem justificativa"}). Revisar a documentação e o processo antes de qualquer decisão de cobrança.`,
      proofId: proof.id,
      hasCompleteEvidenceMetadata: false
    };
  }

  if (proof.status === "extraviado") {
    return {
      nfeNumber: proof.nfeNumber,
      customerName: proof.customerName,
      nfeAmount: proof.nfeAmount,
      deliveryStatus: proof.status,
      risk: "priority_review",
      reason: "O registro indica comprovante extraviado ou ilegível. É necessária revisão documental antes de qualquer decisão de cobrança.",
      proofId: proof.id,
      hasCompleteEvidenceMetadata: false
    };
  }

  // pendente_entrega
  return {
    nfeNumber: proof.nfeNumber,
    customerName: proof.customerName,
    nfeAmount: proof.nfeAmount,
    deliveryStatus: proof.status,
    risk: context?.isOverdue ? "priority_review" : "documentary_review",
    reason: context?.isOverdue
      ? "O título consta vencido enquanto a entrega aparece em trânsito ou sem retorno da expedição. Revisão humana necessária antes de qualquer decisão."
      : "A entrega consta em trânsito. Ainda não há evidência suficiente para concluir sobre cobrança ou protesto.",
    proofId: proof.id,
    hasCompleteEvidenceMetadata: false
  };
}

/**
 * Calcula métricas executivas consolidadas da carteira de canhotos
 */
function hasCompleteReceiptEvidence(proof: DeliveryProof): boolean {
  return Boolean(
    proof.status === "comprovado" &&
    proof.deliveryDate &&
    proof.receiverName?.trim() &&
    proof.receiverDocument?.trim() &&
    proof.proofFileUrl?.trim()
  );
}

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
    if (p.status === "comprovado" && hasCompleteReceiptEvidence(p)) {
      provenCount++;
      provenAmount += p.nfeAmount;
    } else if (p.status === "pendente_entrega" || p.status === "comprovado") {
      // Status manual sem metadados completos não conta como entrega comprovada.
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
 * Gera relatório CSV de evidências e pendências documentais para revisão humana.
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
    "Observacao Operacional - Revisao Humana",
    "Chave NF-e"
  ].join(";");

  const rows = evaluations.map((ev) => {
    const proof = proofs.find((p) => p.nfeNumber === ev.nfeNumber || p.id === ev.proofId);
    const amountStr = ev.nfeAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const riskLabel =
      ev.risk === "metadata_complete"
        ? "METADADOS CADASTRADOS - AUTENTICIDADE NAO VERIFICADA"
        : ev.risk === "priority_review"
        ? "REVISAO PRIORITARIA"
        : "REVISAO DOCUMENTAL";

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

