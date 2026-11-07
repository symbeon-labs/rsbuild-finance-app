import { ReceivableTitle } from "@/lib/reconciliation";
import { DeliveryProof } from "@/lib/delivery";
import { ParsedWhatsAppOrder } from "@/lib/orders";

export type ModuleType = "finance" | "logistics";

export type NavSection =
  | "visao-geral"
  | "movimentacoes"
  | "importacoes"
  | "baixas"
  | "canhotos"
  | "pedidos-ha"
  | "relatorios";

export interface NavItem {
  id: NavSection;
  label: string;
  icon: string;
  module: ModuleType | "all";
}

export const ALL_NAV_ITEMS: NavItem[] = [
  // Módulo Financeiro
  { id: "visao-geral", label: "Visão Geral", icon: "◫", module: "all" },
  { id: "movimentacoes", label: "Movimentações", icon: "⇄", module: "finance" },
  { id: "importacoes", label: "Importações", icon: "⇧", module: "finance" },
  { id: "baixas", label: "Baixas & Liquidações", icon: "✓", module: "finance" },
  { id: "relatorios", label: "Relatórios DRE", icon: "▥", module: "finance" },

  // Módulo Logística & Expedição
  { id: "pedidos-ha", label: "Entrada de Pedidos", icon: "📱", module: "logistics" },
  { id: "canhotos", label: "Comprovantes & Canhotos", icon: "📦", module: "logistics" }
];

export const INITIAL_SAMPLE_TITLES: ReceivableTitle[] = [
  {
    id: "tit-101",
    documentNumber: "NF-4580",
    customerName: "Supermercado Real Salvador",
    amount: 1500.0,
    dueDate: "2026-04-10",
    bankAccount: "Itaú Unibanco",
    ourNumber: "0341999888",
    status: "pendente"
  },
  {
    id: "tit-102",
    documentNumber: "NF-4581",
    customerName: "Distribuidora Alimentos Bahia",
    amount: 3200.5,
    dueDate: "2026-04-12",
    bankAccount: "Banco do Nordeste (BNB)",
    status: "pendente"
  },
  {
    id: "tit-103",
    documentNumber: "NF-4582",
    customerName: "Padaria e Lanchonete Estrela",
    amount: 850.0,
    dueDate: "2026-04-15",
    bankAccount: "Banco Inter",
    status: "pendente"
  },
  {
    id: "tit-104",
    documentNumber: "NF-4583",
    customerName: "Mercado Regional Lauro de Freitas",
    amount: 5000.0,
    dueDate: "2026-04-20",
    bankAccount: "Itaú Unibanco",
    status: "pendente"
  },
  {
    id: "tit-105",
    documentNumber: "NF-4584",
    customerName: "Cantina Sabor Central",
    amount: 2400.0,
    dueDate: "2026-04-22",
    bankAccount: "Itaú Unibanco",
    status: "pendente"
  }
];

export const INITIAL_SAMPLE_PROOFS: DeliveryProof[] = [
  {
    id: "prf-4580",
    nfeNumber: "4580",
    nfeKey: "29260401234567000199550010000045801000000010",
    customerName: "Supermercado Real Salvador",
    nfeAmount: 1500.0,
    issueDate: "2026-04-01",
    deliveryDate: "2026-04-03",
    status: "comprovado",
    driverName: "Carlos Rota Litoral",
    receiverName: "Marcos Souza (Doca 2)",
    receiverDocument: "RG 12.345.678-BA",
    proofFileUrl: "canhoto_nf_4580_assinado.pdf"
  },
  {
    id: "prf-4581",
    nfeNumber: "4581",
    customerName: "Distribuidora Alimentos Bahia",
    nfeAmount: 3200.5,
    issueDate: "2026-04-02",
    status: "recusa_devolucao",
    driverName: "Carlos Rota Litoral",
    notes: "Recusa parcial registrada: 4 caixas avariadas na descarga."
  },
  {
    id: "prf-4582",
    nfeNumber: "4582",
    customerName: "Padaria e Lanchonete Estrela",
    nfeAmount: 850.0,
    issueDate: "2026-04-03",
    status: "pendente_entrega",
    driverName: "Raimundo Entregas",
    notes: "Carga em trânsito com previsão hoje às 17h."
  },
  {
    id: "prf-4583",
    nfeNumber: "4583",
    customerName: "Mercado Regional Lauro de Freitas",
    nfeAmount: 5000.0,
    issueDate: "2026-04-04",
    deliveryDate: "2026-04-05",
    status: "comprovado",
    driverName: "Raimundo Entregas",
    receiverName: "Sueli Alcântara (Financeiro)",
    receiverDocument: "CPF 012.345.678-99",
    proofFileUrl: "canhoto_nf_4583_carimbado.jpg"
  },
  {
    id: "prf-4584",
    nfeNumber: "4584",
    customerName: "Cantina Sabor Central",
    nfeAmount: 2400.0,
    issueDate: "2026-03-25",
    status: "extraviado",
    driverName: "Terceirizado Rota 4",
    notes: "Motorista não retornou com canhoto físico assinado."
  }
];

export const INITIAL_SAMPLE_HA_ORDERS: ParsedWhatsAppOrder[] = [
  {
    id: "ord-ha-001",
    rawMessage: "Bom dia! Aqui é o Marcos do Açaí do Parque Salvador.\nManda 15 caixas do tradicional 10L e 5 de banana.\nBoleto 7 dias.",
    customerName: "Marcos do Açaí do Parque Salvador",
    paymentMethod: "boleto_7d",
    items: [
      {
        sku: "ACAI-TRAD-10L",
        productName: "Açaí Tradicional Especial 10L",
        flavor: "Tradicional",
        quantity: 15,
        unitPrice: 120.0,
        totalAmount: 1800.0,
        boxesTotal: 15,
        rawText: "15 caixas do tradicional 10L",
        confidence: "alta"
      },
      {
        sku: "ACAI-BAN-10L",
        productName: "Açaí com Banana 10L",
        flavor: "Banana",
        quantity: 5,
        unitPrice: 125.0,
        totalAmount: 625.0,
        boxesTotal: 5,
        rawText: "5 de banana",
        confidence: "alta"
      }
    ],
    totalBoxes: 20,
    totalAmount: 2425.0,
    confidence: "alta",
    unrecognizedLines: [],
    createdAt: new Date().toISOString(),
    status: "confirmado"
  },
  {
    id: "ord-ha-002",
    rawMessage: "Sou a Danielle do Quiosque Orla Pituba.\nPreciso de 4 de morango, 2 de cupuaçu e 4 de trufado ninho.\nPix na entrega.",
    customerName: "Danielle do Quiosque Orla Pituba",
    paymentMethod: "pix",
    items: [
      {
        sku: "ACAI-MOR-10L",
        productName: "Açaí com Morango 10L",
        flavor: "Morango",
        quantity: 4,
        unitPrice: 125.0,
        totalAmount: 500.0,
        boxesTotal: 4,
        rawText: "4 de morango",
        confidence: "alta"
      },
      {
        sku: "ACAI-CUPU-10L",
        productName: "Açaí com Cupuaçu 10L",
        flavor: "Cupuaçu",
        quantity: 2,
        unitPrice: 130.0,
        totalAmount: 260.0,
        boxesTotal: 2,
        rawText: "2 de cupuaçu",
        confidence: "alta"
      },
      {
        sku: "ACAI-TRUF-10L",
        productName: "Açaí Trufado Leite Ninho 10L",
        flavor: "Trufado Ninho",
        quantity: 4,
        unitPrice: 145.0,
        totalAmount: 580.0,
        boxesTotal: 4,
        rawText: "4 de trufado ninho",
        confidence: "alta"
      }
    ],
    totalBoxes: 10,
    totalAmount: 1340.0,
    confidence: "alta",
    unrecognizedLines: [],
    createdAt: new Date().toISOString(),
    status: "confirmado"
  }
];

