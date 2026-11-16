"use client";

import { useState } from "react";

interface FrentesDetail {
  id: string;
  name: string;
  icon: string;
  headline: string;
  details: string;
  metrics: string;
}

const FRENTES_DATA: FrentesDetail[] = [
  {
    id: "alimentos",
    name: "Indústria Alimentícia",
    icon: "🏭",
    headline: "Controle de operações e movimentação de produtos",
    details: "Organização de informações de lotes, remessas, conferências e ocorrências, conforme o escopo definido para cada projeto.",
    metrics: "Contexto de aplicação · Exemplo ilustrativo"
  },
  {
    id: "logistica",
    name: "Distribuição & Logística",
    icon: "🚚",
    headline: "Acompanhamento de expedição e comprovantes",
    details: "Estruturação de registros de entrega, documentos associados e pendências para conferência operacional.",
    metrics: "Contexto de aplicação · Exemplo ilustrativo"
  },
  {
    id: "holding",
    name: "Governança Empresarial",
    icon: "🏛️",
    headline: "Organização de responsabilidades e informações",
    details: "Visibilidade de processos, permissões, aprovações e registros, respeitando os limites de cada ambiente integrado.",
    metrics: "Contexto de aplicação · Exemplo ilustrativo"
  }
];

export function FrentesBanner() {
  const [activeTab, setActiveTab] = useState<string>("alimentos");

  const current = FRENTES_DATA.find((f) => f.id === activeTab) || FRENTES_DATA[0];

  return (
    <div className="inst-frentes-banner-interactive">
      <div className="inst-frentes-header-row">
        <div className="inst-frentes-left">
          <div className="inst-frentes-icon-wrap">
            <span className="inst-frentes-icon-display">{current.icon}</span>
            <span className="inst-frentes-live-dot" aria-hidden="true" />
          </div>
          <div>
            <strong className="inst-frentes-title">
              Frentes de Aplicação
            </strong>
            <span className="inst-frentes-sub">
              Exemplos de contextos operacionais atendidos pela plataforma, sem identificação de clientes.
            </span>
          </div>
        </div>

        {/* Tabs interativas com microinterações */}
        <div className="inst-frentes-tabs" role="tablist" aria-label="Frentes de produção">
          {FRENTES_DATA.map((item) => {
            const isActive = item.id === activeTab;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(item.id)}
                className={`inst-frentes-tab-btn ${isActive ? "is-active" : ""}`}
              >
                <span className="inst-frentes-tab-dot" aria-hidden="true" />
                <span>{item.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Painel expansivo de detalhe contextual */}
      <div className="inst-frentes-detail-panel" key={current.id}>
        <div className="inst-frentes-detail-content">
          <div className="inst-frentes-detail-text">
            <span className="inst-frentes-detail-headline">{current.headline}</span>
            <p className="inst-frentes-detail-desc">{current.details}</p>
          </div>
          <div className="inst-frentes-detail-metric-badge">
            <span className="inst-frentes-metric-pulse" />
            <span className="inst-frentes-metric-label">{current.metrics}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
