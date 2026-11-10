import { ReceivableTitle } from "../../lib/reconciliation";
import { DeliveryProof } from "../../lib/delivery";
import { ParsedWhatsAppOrder } from "../../lib/orders";

export type ModuleType = "finance" | "reconciliation" | "logistics" | "audit";

export type OrganizationId = "rsbuild" | "hub_acai" | "mundo_sabor";

export interface EnabledModulesConfig {
  finance: boolean;
  reconciliation: boolean;
  logistics: boolean;
  audit: boolean;
}

/** Contato de cliente ou fornecedor vinculado ao workspace */
export interface WorkspaceContact {
  id: string;
  type: "cliente" | "fornecedor";
  name: string;
  document: string; // CNPJ ou CPF formatado
  phone?: string;
  email?: string;
  city?: string;
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
  hasSprintZone?: boolean; // Zona das Sprints apenas para RSBUILD
  description: string;
  /** Cor de acento de marca do workspace (hex). Padrão global: #B5583C (terracotta) */
  brandColor?: string;
  /** Variante hover da brand color (~15% mais escura) */
  brandColorHover?: string;
  /** Variante soft da brand color (8% opacidade sobre branco — fundo de badge) */
  brandColorSoft?: string;
  /** Contatos pré-cadastrados (clientes e fornecedores) do workspace */
  contacts?: WorkspaceContact[];
}

export function orgHasExecutiveTower(_orgId?: OrganizationId): boolean {
  return true;
}

/** Contatos pré-cadastrados para o workspace Hub Açaí Salvador */
export const HUB_ACAI_CONTACTS: WorkspaceContact[] = [
  { id: "c-001", type: "cliente", name: "Supermercado Real Salvador", document: "12.345.678/0001-90", phone: "(71) 99999-0001", city: "Salvador - BA" },
  { id: "c-002", type: "cliente", name: "Distribuidora Alimentos Bahia", document: "23.456.789/0001-01", phone: "(71) 99999-0002", city: "Salvador - BA" },
  { id: "c-003", type: "cliente", name: "Padaria e Lanchonete Estrela", document: "34.567.890/0001-02", phone: "(71) 99999-0003", city: "Lauro de Freitas - BA" },
  { id: "c-004", type: "cliente", name: "Mercado e Açougue Bom Preço", document: "45.678.901/0001-03", phone: "(71) 99999-0004", city: "Camaçari - BA" },
  { id: "c-005", type: "cliente", name: "Cantina Sabor Central", document: "56.789.012/0001-04", phone: "(71) 99999-0005", city: "Simões Filho - BA" },
  { id: "c-006", type: "cliente", name: "Marcos do Açaí do Parque Salvador", document: "67.890.123/0001-05", phone: "(71) 99999-0006", city: "Salvador - BA" },
  { id: "c-007", type: "cliente", name: "Quiosque Orla Pituba", document: "78.901.234/0001-06", phone: "(71) 99999-0007", city: "Salvador - BA" },
  { id: "f-001", type: "fornecedor", name: "Polpas do Pará Ltda", document: "11.222.333/0001-11", phone: "(91) 98888-1111", city: "Belém - PA" },
  { id: "f-002", type: "fornecedor", name: "Distribuidora Frios Nordeste", document: "22.333.444/0001-22", phone: "(71) 97777-2222", city: "Feira de Santana - BA" }
];

export const ORGANIZATION_PRESETS: OrganizationPreset[] = [
  {
    id: "rsbuild",
    name: "RSBUILD Inovação",
    tagline: "Holding & Obras Corporativas",
    logoUrl: "",
    badge: "🏢 HOLDING",
    defaultModule: "finance",
    enabledModules: {
      finance: true,
      reconciliation: true,
      logistics: false,
      audit: true
    },
    hasExecutiveTower: true,
    hasSprintZone: true, // Zona das Sprints apenas para RSBUILD
    description: "Holding corporativa e obras. Foco em conciliação financeira multibanco (Itaú/XP/BNB/Inter), reconciliação de títulos e auditoria contínua.",
    // Cor padrão RSBUILD: terracotta laranja — cor global do sistema
    brandColor: "#B5583C",
    brandColorHover: "#9A4B33",
    brandColorSoft: "#F9F3F1"
  },
  {
    id: "hub_acai",
    name: "Hub Açaí Salvador",
    tagline: "Distribuição de Polpas & Sorvetes",
    logoUrl: "",
    badge: "🍨 DISTRIBUIÇÃO",
    defaultModule: "logistics",
    enabledModules: {
      finance: false,
      reconciliation: true,
      logistics: true,
      audit: true
    },
    hasExecutiveTower: true,
    description: "Distribuição expressa com pedidos WhatsApp, cubagem do caminhão HR (350 cx), reconciliação Omie e auditoria de canhotos com inteligência jurídica.",
    // Cor Hub Açaí: roxo vibrante
    brandColor: "#7C3AED",
    brandColorHover: "#6D28D9",
    brandColorSoft: "#F5F3FF",
    contacts: HUB_ACAI_CONTACTS
  },
  {
    id: "mundo_sabor",
    name: "Mundo do Sabor Alimentos",
    tagline: "Indústria & Atacado de Alimentos",
    logoUrl: "",
    badge: "🏭 INDÚSTRIA",
    defaultModule: "finance",
    enabledModules: {
      finance: true,
      reconciliation: true,
      logistics: true,
      audit: true
    },
    hasExecutiveTower: true,
    description: "Indústria alimentícia com conciliação multibanco, motor de reconciliação Omie, canhotos SEFAZ e auditoria de conformidade.",
    // Cor Mundo do Sabor: azul corporate
    brandColor: "#2563EB",
    brandColorHover: "#1D4ED8",
    brandColorSoft: "#EFF6FF"
  }
];

export type NavSection =
  | "visao-geral"
  | "torre-controle"
  | "movimentacoes"
  | "importacoes"
  | "conciliacao"
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
  // Visão Global
  { id: "visao-geral", label: "Visão Geral", icon: "◫", module: "all" },

  // 1. Módulo Financeiro
  { id: "movimentacoes", label: "Movimentações", icon: "⇄", module: "finance" },
  { id: "importacoes", label: "Importações Extratos", icon: "⇧", module: "finance" },
  { id: "relatorios", label: "Relatórios DRE", icon: "▥", module: "finance" },

  // 2. Módulo Reconciliação ERP (Independente)
  { id: "conciliacao", label: "Conciliação Bancária", icon: "⚖", module: "reconciliation" },
  { id: "baixas", label: "Reconciliação & Baixas", icon: "✓", module: "reconciliation" },

  // 3. Módulo Logística & Expedição
  { id: "pedidos-ha", label: "Entrada de Pedidos", icon: "📱", module: "logistics" },
  { id: "canhotos", label: "Comprovantes & Canhotos", icon: "📦", module: "logistics" },

  // 4. Módulo Auditoria & Inteligência Jurídica (Agente RS / JEV)
  { id: "torre-controle", label: "Auditoria & Torre RS", icon: "⎈", module: "audit" }
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
