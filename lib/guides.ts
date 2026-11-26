import { GuideStep } from "./guide-types";

export interface GuideConfig {
  id: string;
  title: string;
  description: string;
  steps: GuideStep[];
}

export const GUIDES: Record<string, GuideConfig> = {
  importacoes: {
    id: "importacoes",
    title: "Importações Financeiras",
    description: "Guia para importar extratos bancários e documentos",
    steps: [
      {
        id: "upload-zone",
        title: "Área de Upload",
        description: "Arraste arquivos aqui ou clique para selecionar. Aceitamos PDF, XLSX, CSV, OFX e mais.",
        targetSelector: ".upload-zone",
        position: "bottom"
      },
      {
        id: "file-types",
        title: "Formatos Suportados",
        description: "Extratos bancários (OFX, CSV), planilhas Excel, PDFs de documentos e arquivos de texto.",
        position: "center"
      },
      {
        id: "preview",
        title: "Pré-visualização",
        description: "Antes de confirmar, revise os dados detectados e ajuste o mapeamento de colunas se necessário.",
        targetSelector: ".import-preview",
        position: "top"
      },
      {
        id: "confirm",
        title: "Confirmar Importação",
        description: "Clique em 'Confirmar' para processar os dados. O sistema validará e registrará na auditoria.",
        targetSelector: ".import-actions",
        position: "top"
      }
    ]
  },

  movimentacoes: {
    id: "movimentacoes",
    title: "Movimentações Financeiras",
    description: "Guia para consultar e filtrar lançamentos",
    steps: [
      {
        id: "filters",
        title: "Filtros",
        description: "Use os filtros para buscar por data, valor, descrição, conta ou status.",
        targetSelector: ".movement-filters",
        position: "bottom"
      },
      {
        id: "table",
        title: "Tabela de Movimentações",
        description: "Visualize todos os lançamentos com badges de direção (entrada/saída) e status.",
        targetSelector: ".data-table",
        position: "top"
      },
      {
        id: "export",
        title: "Exportar Dados",
        description: "Exporte em Excel, CSV ou OFX. Configure o formato ERP nas configurações.",
        targetSelector: ".export-menu",
        position: "bottom"
      },
      {
        id: "erp-config",
        title: "Configurar ERP",
        description: "Defina o formato de exportação preferido (Omie, Bling, Tiny, ContaAzul).",
        targetSelector: ".erp-export-settings",
        position: "bottom"
      }
    ]
  },

  conciliacao: {
    id: "conciliacao",
    title: "Conciliação Bancária",
    description: "Guia para reconciliar extratos com títulos",
    steps: [
      {
        id: "accounts",
        title: "Contas Bancárias",
        description: "Selecione a conta para reconciliar. Cada card mostra o status e KPIs.",
        targetSelector: ".reconciliation-account-grid",
        position: "bottom"
      },
      {
        id: "titles",
        title: "Títulos a Receber/Pagar",
        description: "Importe títulos do ERP ou planilha para fazer o matching com extratos.",
        targetSelector: ".titles-import",
        position: "bottom"
      },
      {
        id: "matching",
        title: "Matching Automático",
        description: "O sistema sugere matches por valor, data e documento. Revise antes de confirmar.",
        targetSelector: ".match-results",
        position: "top"
      },
      {
        id: "settlement",
        title: "Baixa de Títulos",
        description: "Após conciliar, gere o lote de baixas para exportar ao ERP.",
        targetSelector: ".settlement-actions",
        position: "top"
      }
    ]
  },

  baixas: {
    id: "baixas",
    title: "Baixas e Liquidações",
    description: "Guia para gerenciar títulos e baixas",
    steps: [
      {
        id: "filters",
        title: "Filtros de Títulos",
        description: "Filtre por natureza (receber/pagar), status (aberto/pago) e período.",
        targetSelector: ".settlement-filter-panel",
        position: "bottom"
      },
      {
        id: "table",
        title: "Tabela de Títulos",
        description: "Visualize títulos com status de conciliação e valores.",
        targetSelector: ".data-table",
        position: "top"
      },
      {
        id: "batch-actions",
        title: "Ações em Lote",
        description: "Selecione múltiplos títulos para baixar, exportar ou classificar em massa.",
        targetSelector: ".bulk-selection-actions",
        position: "top"
      }
    ]
  },

  dre: {
    id: "dre",
    title: "DRE Gerencial",
    description: "Guia para classificação e análise gerencial",
    steps: [
      {
        id: "governance",
        title: "Indicadores de Governança",
        description: "Acompanhe a saúde da classificação: aprováveis, em revisão, fora da DRE.",
        targetSelector: ".dre-governance-grid",
        position: "bottom"
      },
      {
        id: "review",
        title: "Fila de Revisão",
        description: "Classificações que precisam de revisão humana aparecem aqui.",
        targetSelector: ".dre-review-table-wrap",
        position: "top"
      },
      {
        id: "export",
        title: "Exportar DRE",
        description: "Exporte o DRE classificado em Excel ou CSV para o ERP.",
        targetSelector: ".export-menu",
        position: "bottom"
      }
    ]
  },

  operacoes_lote: {
    id: "operacoes_lote",
    title: "Centro de Operações em Lote",
    description: "Guia para operações em massa",
    steps: [
      {
        id: "selection",
        title: "Seleção em Massa",
        description: "Selecione registros para aplicar ações em lote (classificar, exportar, excluir).",
        targetSelector: ".bulk-selection-bar",
        position: "bottom"
      },
      {
        id: "actions",
        title: "Ações Disponíveis",
        description: "Dependendo do contexto: exportar baixas, gerar OFX, classificar DRE.",
        targetSelector: ".bulk-selection-actions",
        position: "top"
      },
      {
        id: "audit",
        title: "Auditoria",
        description: "Todas as ações em lote são registradas na trilha de auditoria.",
        position: "center"
      }
    ]
  },

  erp_settings: {
    id: "erp_settings",
    title: "Configurações de Exportação ERP",
    description: "Guia para configurar formatos de exportação",
    steps: [
      {
        id: "erp-select",
        title: "Selecionar ERP",
        description: "Escolha o ERP de destino: Omie, Bling, Tiny, ContaAzul ou Genérico.",
        targetSelector: ".erp-options",
        position: "right"
      },
      {
        id: "field-mapping",
        title: "Mapeamento de Campos",
        description: "Ajuste como os campos do RSBUILD serão nomeados no arquivo exportado.",
        targetSelector: ".field-mapping",
        position: "left"
      },
      {
        id: "default",
        title: "Configuração Padrão",
        description: "Marque como padrão para usar automaticamente nas próximas exportações.",
        targetSelector: ".is-default",
        position: "bottom"
      },
      {
        id: "save",
        title: "Salvar",
        description: "Salve a configuração. Ela será usada em todas as exportações futuras.",
        targetSelector: ".save-button",
        position: "top"
      }
    ]
  }
};

export function getGuide(guideId: string): GuideConfig | undefined {
  return GUIDES[guideId];
}

export function getAllGuides(): GuideConfig[] {
  return Object.values(GUIDES);
}
