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
    headline: "Operação fabril & distribuição de perecíveis",
    details: "Controle de remessas a granel, conferência de lotes e blindagem contra perdas em devolução.",
    metrics: "Mundo do Sabor & Frigoríficos · Validação em campo ativa"
  },
  {
    id: "logistica",
    name: "Distribuição & Logística",
    icon: "🚚",
    headline: "Canhotos digitais & comprovação de entrega",
    details: "Rastreio pericial de NF-e, upload de canhotos com OCR e trava automática de títulos a protestar.",
    metrics: "Hub Açaí & frotistas · Redução de 80% no prazo de auditoria"
  },
  {
    id: "holding",
    name: "Governança de Holding",
    icon: "🏛️",
    headline: "Visão consolidada multi-CNPJ & alçadas",
    details: "Aprovações hierárquicas (Regra Raquel), batimento de extratos com OFX e auditoria centralizada.",
    metrics: "Gestão patrimonial integrada · Trilhas rastreáveis de ponta a ponta"
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
              Frentes Ativas em Produção &amp; Validação Prática
            </strong>
            <span className="inst-frentes-sub">
              Operações pioneiras com validação em campo real no ecossistema RSBUILD OS.
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
