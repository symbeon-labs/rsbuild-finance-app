import { ReceivableTitle } from "../../lib/reconciliation";
import { DeliveryProof } from "../../lib/delivery";
import { ParsedWhatsAppOrder } from "../../lib/orders";

export type ModuleType = "finance" | "logistics";

export type OrganizationId = "rsbuild" | "hub_acai" | "mundo_sabor";

export interface EnabledModulesConfig {
  finance: boolean;
  logistics: boolean;
}

export interface OrganizationPreset {
  id: OrganizationId;
  name: string;
  tagline: string;
  logoUrl: string;
  badge: string;
  defaultModule: ModuleType;
  enabledModules: EnabledModulesConfig;
  hasExecutiveTower: boolean;
  description: string;
}

export function orgHasExecutiveTower(orgId?: OrganizationId): boolean {
  return orgId === "hub_acai";
}

export const ORGANIZATION_PRESETS: OrganizationPreset[] = [
  {
    id: "rsbuild",
    name: "RSBUILD Inovação",
    tagline: "Holding & Obras Corporativas",
    logoUrl: "",
    badge: "🏢 HOLDING",
    defaultModule: "finance",
    enabledModules: { finance: true, logistics: false },
    hasExecutiveTower: false,
    description: "Holding corporativa e obras. Foco em conciliação financeira multibanco (Itaú/XP/BNB/Inter) e fluxo de caixa."
  },
  {
    id: "hub_acai",
    name: "Hub Açaí Salvador",
    tagline: "Distribuição de Polpas & Sorvetes",
    logoUrl: "",
    badge: "🍨 DISTRIBUIÇÃO",
    defaultModule: "logistics",
    enabledModules: { finance: true, logistics: true },
    hasExecutiveTower: true,
    description: "Distribuição expressa com pedidos WhatsApp, cubagem do caminhão HR (350 cx), cruzamento de canhotos e Torre de Controle de Operações."
  },
  {
    id: "mundo_sabor",
    name: "Mundo do Sabor Alimentos",
    tagline: "Indústria & Atacado de Alimentos",
    logoUrl: "",
    badge: "🏭 INDÚSTRIA",
    defaultModule: "finance",
    enabledModules: { finance: true, logistics: true },
    hasExecutiveTower: false,
    description: "Indústria alimentícia com conciliação multibanco, liquidação de recebíveis Omie e canhotos SEFAZ."
  }
];

export type NavSection =
  | "visao-geral"
  | "torre-controle"
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
  // Visões Globais da Empresa
  { id: "visao-geral", label: "Visão Geral", icon: "◫", module: "all" },
  { id: "torre-controle", label: "Torre de Controle", icon: "⎈", module: "all" },

  // Módulo Financeiro
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
    customerName: "Mercado e Açougue Bom Preço",
    amount: 2100.0,
    dueDate: "2026-04-18",
    bankAccount: "XP Investimentos",
    status: "pendente"
  },
  {
    id: "tit-105",
    documentNumber: "NF-4584",
    customerName: "Cantina Sabor Central",
    amount: 2400.0,
    dueDate: "2026-04-20",
    bankAccount: "Itaú Unibanco",
    status: "pendente"
  }
];

export const INITIAL_SAMPLE_PROOFS: DeliveryProof[] = [
  {
    id: "prf-4580",
    nfeNumber: "4580",
    nfeKey: "29260400000000000191550010000045801000045801",
    customerName: "Supermercado Real Salvador",
    nfeAmount: 1500.0,
    issueDate: "2026-04-01",
    deliveryDate: "2026-04-02",
    status: "comprovado",
    receiverName: "Marcos Vinicius Santos",
    receiverDocument: "RG 12.345.678-SSP/BA",
    driverName: "Carlos Eduardo Frota 1",
    notes: "Canhoto digitalizado e conferido na doca."
  },
  {
    id: "prf-4581",
    nfeNumber: "4581",
    customerName: "Distribuidora Alimentos Bahia",
    nfeAmount: 3200.5,
    issueDate: "2026-04-03",
    deliveryDate: "2026-04-04",
    status: "comprovado",
    receiverName: "Ana Paula Ribeiro (Doca 2)",
    receiverDocument: "CPF 012.345.678-99",
    driverName: "Carlos Eduardo Frota 1",
    notes: "Assinatura e carimbo da empresa conferidos."
  },
  {
    id: "prf-4582",
    nfeNumber: "4582",
    customerName: "Padaria e Lanchonete Estrela",
    nfeAmount: 850.0,
    issueDate: "2026-04-05",
    status: "pendente_entrega",
    driverName: "Roberto Lima Frota 2",
    notes: "Mercadoria em rota de entrega no caminhão HR."
  },
  {
    id: "prf-4583",
    nfeNumber: "4583",
    customerName: "Mercado e Açougue Bom Preço",
    nfeAmount: 2100.0,
    issueDate: "2026-03-20",
    status: "recusa_devolucao",
    driverName: "Roberto Lima Frota 2",
    notes: "Mercadoria recusada por divergência de pedido (Avaria)."
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
