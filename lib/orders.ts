/**
 * ENG-HA-01: Padronizador de Entrada de Pedidos (WhatsApp → Pedido Estruturado)
 * Hub Açaí Salvador (ORG-002)
 * 
 * Resolve o gargalo C1 do laudo técnico operacional da RS2BUILD:
 * - Elimina a redigitação manual item a item e a contagem manual de caixas pelas atendentes.
 * - Reconhece linguagem coloquial, variações de sabores e tamanhos (10L, 5L, baldes, caixas).
 * - Calcula a volumetria total de caixas para o carregamento dos veículos (HR: 300-350 caixas).
 * - Prepara o payload canônico para importação de pedidos de venda no Omie ERP.
 */

export interface ProductCatalogItem {
  sku: string;
  name: string;
  flavor: string;
  packaging: string;    // Ex: "Caixa 10L", "Balde 10L", "Caixa 5L"
  unitVolumeLiters: number;
  boxesCount: number;   // Fator de conversão em caixas físicas para a doca
  unitPrice: number;    // Preço base de atacado
  synonyms: string[];   // Variações de texto no WhatsApp
}

export interface ParsedOrderItem {
  sku: string;
  productName: string;
  flavor: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  boxesTotal: number;
  rawText: string;
  confidence: "alta" | "media" | "baixa";
}

export type OrderPaymentMethod = "boleto_7d" | "boleto_14d" | "pix" | "a_vista" | "a_combinar";

export interface ParsedWhatsAppOrder {
  id: string;
  rawMessage: string;
  customerName: string;
  deliveryDate?: string;
  paymentMethod: OrderPaymentMethod;
  notes?: string;
  items: ParsedOrderItem[];
  totalBoxes: number;
  totalAmount: number;
  confidence: "alta" | "media" | "baixa";
  unrecognizedLines: string[];
  createdAt: string;
  status: "rascunho" | "confirmado" | "enviado_omie";
}

/**
 * Catálogo Canônico de Produtos e Sabores do Hub Açaí Salvador
 */
export const HUB_ACAI_CATALOG: ProductCatalogItem[] = [
  {
    sku: "ACAI-TRAD-10L",
    name: "Açaí Tradicional Especial 10L",
    flavor: "Tradicional",
    packaging: "Caixa 10L",
    unitVolumeLiters: 10,
    boxesCount: 1,
    unitPrice: 120.0,
    synonyms: ["tradicional", "puro", "normal", "comum", "especial", "acai", "açaí"]
  },
  {
    sku: "ACAI-BAN-10L",
    name: "Açaí com Banana 10L",
    flavor: "Banana",
    packaging: "Caixa 10L",
    unitVolumeLiters: 10,
    boxesCount: 1,
    unitPrice: 125.0,
    synonyms: ["banana", "com banana"]
  },
  {
    sku: "ACAI-MOR-10L",
    name: "Açaí com Morango 10L",
    flavor: "Morango",
    packaging: "Caixa 10L",
    unitVolumeLiters: 10,
    boxesCount: 1,
    unitPrice: 125.0,
    synonyms: ["morango", "com morango"]
  },
  {
    sku: "ACAI-CUPU-10L",
    name: "Açaí com Cupuaçu 10L",
    flavor: "Cupuaçu",
    packaging: "Caixa 10L",
    unitVolumeLiters: 10,
    boxesCount: 1,
    unitPrice: 130.0,
    synonyms: ["cupuaçu", "cupuacu", "cupu"]
  },
  {
    sku: "CREME-CUPU-10L",
    name: "Creme Puro de Cupuaçu 10L",
    flavor: "Creme Cupuaçu",
    packaging: "Caixa 10L",
    unitVolumeLiters: 10,
    boxesCount: 1,
    unitPrice: 135.0,
    synonyms: ["creme de cupuacu", "creme cupu", "creme cupuaçu", "puro cupuacu"]
  },
  {
    sku: "ACAI-TRUF-10L",
    name: "Açaí Trufado Leite Ninho 10L",
    flavor: "Trufado Ninho",
    packaging: "Caixa 10L",
    unitVolumeLiters: 10,
    boxesCount: 1,
    unitPrice: 145.0,
    synonyms: ["trufado", "ninho", "leite ninho", "trufado ninho", "leiteninho"]
  },
  {
    sku: "ACAI-ZERO-10L",
    name: "Açaí Zero Adição de Açúcar 10L",
    flavor: "Zero Açúcar",
    packaging: "Caixa 10L",
    unitVolumeLiters: 10,
    boxesCount: 1,
    unitPrice: 135.0,
    synonyms: ["zero", "diet", "sem acucar", "sem açúcar", "zero acucar"]
  },
  {
    sku: "ACAI-TRAD-5L",
    name: "Açaí Tradicional 5L",
    flavor: "Tradicional 5L",
    packaging: "Balde 5L",
    unitVolumeLiters: 5,
    boxesCount: 0.5,
    unitPrice: 65.0,
    synonyms: ["5l", "5 litros", "balde 5", "5 l"]
  }
];

const NUMERAL_MAP: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  três: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  meia: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  quinze: 15,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50
};

/**
 * Extrai a quantidade numérica de uma linha (ex: "10 caixas", "5 cx", "duas de banana")
 */
function extractQuantity(text: string): { quantity: number; textWithoutQty: string } {
  // Procura dígitos explícitos: 10, 10cx, 10 caixas, 10x
  const digitMatch = text.match(/(\d+)\s*(?:cx|caixas?|baldes?|un|unidades?|x)?\b/i);
  if (digitMatch) {
    const qty = parseInt(digitMatch[1], 10);
    const textWithoutQty = text.replace(digitMatch[0], "").trim();
    return { quantity: qty, textWithoutQty };
  }

  // Procura números por extenso em português
  const words = text.toLowerCase().split(/\s+/);
  for (const word of words) {
    if (NUMERAL_MAP[word]) {
      const qty = NUMERAL_MAP[word];
      const textWithoutQty = text.replace(new RegExp(`\\b${word}\\b`, "i"), "").trim();
      return { quantity: qty, textWithoutQty };
    }
  }

  return { quantity: 1, textWithoutQty: text };
}

/**
 * Encontra o melhor produto do catálogo para um trecho de texto
 */
function matchProduct(text: string): { product: ProductCatalogItem; confidence: "alta" | "media" | "baixa" } | null {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // 1. Checagem direta de sinônimos mais longos e específicos primeiro
  for (const prod of HUB_ACAI_CATALOG) {
    for (const syn of prod.synonyms) {
      const normSyn = syn
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      
      const regex = new RegExp(`\\b${normSyn}\\b`, "i");
      if (regex.test(normalized)) {
        // Se bateu especificamente com sabores definidos (tradicional, trufado, cupuaçu, banana, morango, zero)
        const isCompound = ["tradicional", "banana", "morango", "cupuaçu", "cupuacu", "cupu", "trufado", "ninho", "zero", "5l"].some((s) =>
          normSyn.includes(s)
        );
        return { product: prod, confidence: isCompound ? "alta" : "media" };
      }
    }
  }

  // 2. Se mencionou apenas "acai", "açaí" ou "caixas" sem especificar sabor, assume Tradicional Especial 10L
  if (normalized.includes("acai") || normalized.includes("caixa") || normalized.includes("cx") || normalized.includes("balde")) {
    const defaultProd = HUB_ACAI_CATALOG.find((p) => p.sku === "ACAI-TRAD-10L")!;
    return { product: defaultProd, confidence: "media" };
  }

  return null;
}

/**
 * Extrai o nome do cliente / sacado da mensagem
 */
function extractCustomerName(lines: string[]): { name: string; customerLineIndex: number } {
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const matchIntro = line.match(/(?:aqui\s+[eé]|sou\s+o|sou\s+a|cliente:?|nome:?)\s+([A-Za-z0-9À-ÿ\s–\-]{3,60})/i);
    if (matchIntro) {
      const cleaned = matchIntro[1].replace(/(?:do\s+whatsapp|mandar|favor|bom\s+dia|boa\s+tarde|segue|ola|olá).*/i, "").trim();
      return { name: cleaned, customerLineIndex: idx };
    }
  }

  // Se a primeira linha contiver nome curto
  const firstLine = lines[0];
  if (firstLine && !firstLine.match(/\d+/) && firstLine.length < 40 && !firstLine.match(/bom dia|boa tarde|ola|olá/i)) {
    return { name: firstLine.trim(), customerLineIndex: 0 };
  }

  return { name: "Cliente WhatsApp (Aguardando Identificação)", customerLineIndex: -1 };
}

/**
 * Extrai a forma de pagamento mencionada
 */
function extractPaymentMethod(text: string): OrderPaymentMethod {
  const norm = text.toLowerCase();
  if (norm.includes("pix")) return "pix";
  if (norm.includes("14 dias") || norm.includes("14d")) return "boleto_14d";
  if (norm.includes("7 dias") || norm.includes("7d") || norm.includes("boleto")) return "boleto_7d";
  if (norm.includes("a vista") || norm.includes("à vista") || norm.includes("dinheiro")) return "a_vista";
  return "a_combinar";
}

/**
 * Parser de mensagem única de pedido de WhatsApp (ENG-HA-01)
 */
export function parseWhatsAppOrderMessage(rawMessage: string): ParsedWhatsAppOrder {
  const lines = rawMessage
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const { name: customerName, customerLineIndex } = extractCustomerName(lines);
  const paymentMethod = extractPaymentMethod(rawMessage);

  const items: ParsedOrderItem[] = [];
  const unrecognizedLines: string[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // Ignora linha de identificação do cliente
    if (idx === customerLineIndex) {
      continue;
    }

    // Ignora linhas de introdução, cabeçalho ou despedida
    if (
      line.match(/^(?:bom dia|boa tarde|boa noite|olá|ola|tudo bem|pedido|segue o nosso pedido|segue o pedido|valeu|obrigado|blz|ok|abcs|abraço)/i) &&
      !line.match(/\d+/)
    ) {
      continue;
    }

    // Ignora linhas que mencionam apenas condições comerciais / prazos
    if (line.match(/(?:pagamento|pagar|boleto|pix|a vista|à vista|amanhã|hoje|entregar)/i) && !line.match(/(?:caixa|balde|sabor|tradicional|banana|morango|cupu|trufado|ninho|zero|\d+\s*cx)/i)) {
      continue;
    }

    // Se uma linha contiver múltiplos itens unidos por " e " (ex: "duas de cupuaçu e cinco de trufado ninho")
    const subParts = line.split(/\s+(?:e|,)\s+/i).filter((p) => p.trim().length > 0);
    const partsToProcess = subParts.length > 1 && subParts.every((p) => matchProduct(p) !== null) ? subParts : [line];

    for (const part of partsToProcess) {
      const { quantity, textWithoutQty } = extractQuantity(part);
      const match = matchProduct(textWithoutQty);

      if (match && quantity > 0) {
        const { product, confidence } = match;
        const totalAmount = quantity * product.unitPrice;
        const boxesTotal = quantity * product.boxesCount;

        // Se já existe o mesmo SKU na lista, agrega
        const existing = items.find((i) => i.sku === product.sku);
        if (existing) {
          existing.quantity += quantity;
          existing.totalAmount += totalAmount;
          existing.boxesTotal += boxesTotal;
        } else {
          items.push({
            sku: product.sku,
            productName: product.name,
            flavor: product.flavor,
            quantity,
            unitPrice: product.unitPrice,
            totalAmount,
            boxesTotal,
            rawText: part,
            confidence
          });
        }
      } else {
        if (!part.match(/^(?:pix|boleto|entrega|obrigado|blz|ok|abcs|abraço)/i) && !line.match(/(?:pagamento|pagar)/i)) {
          unrecognizedLines.push(part);
        }
      }
    }
  }

  const totalBoxes = items.reduce((sum, item) => sum + item.boxesTotal, 0);
  const totalAmount = items.reduce((sum, item) => sum + item.totalAmount, 0);

  // Confiança global do pedido
  let orderConfidence: "alta" | "media" | "baixa" = "alta";
  if (items.length === 0 || unrecognizedLines.length > items.length) {
    orderConfidence = "baixa";
  } else if (items.some((i) => i.confidence === "media") || unrecognizedLines.length > 0) {
    orderConfidence = "media";
  }

  return {
    id: `ord-ha-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    rawMessage,
    customerName,
    paymentMethod,
    items,
    totalBoxes,
    totalAmount,
    confidence: orderConfidence,
    unrecognizedLines,
    createdAt: new Date().toISOString(),
    status: "confirmado"
  };
}

/**
 * Gera CSV de Pedidos de Venda formatado para o Omie ERP
 */
export function generateOmieSalesOrderCsv(orders: ParsedWhatsAppOrder[]): string {
  const header = [
    "Codigo_Pedido",
    "Cliente",
    "Data_Previsao",
    "Forma_Pagamento",
    "SKU",
    "Produto_Descricao",
    "Sabor",
    "Quantidade",
    "Caixas_Fisicas",
    "Valor_Unitario",
    "Valor_Total",
    "Status"
  ].join(";");

  const rows: string[] = [];

  for (const order of orders) {
    for (const item of order.items) {
      const unitPriceStr = item.unitPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const totalAmountStr = item.totalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      
      rows.push([
        `"${order.id}"`,
        `"${order.customerName.replace(/"/g, '""')}"`,
        `"${new Date().toISOString().slice(0, 10)}"`,
        `"${order.paymentMethod}"`,
        `"${item.sku}"`,
        `"${item.productName}"`,
        `"${item.flavor}"`,
        item.quantity,
        item.boxesTotal,
        unitPriceStr,
        totalAmountStr,
        `"${order.status}"`
      ].join(";"));
    }
  }

  return [header, ...rows].join("\r\n");
}
