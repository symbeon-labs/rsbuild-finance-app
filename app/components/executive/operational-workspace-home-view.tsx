"use client";

import { RsbuildIcon } from "@/app/components/rsbuild-icons";
import { MODULE_CONFIGS } from "@/app/components/shell/sidebar";
import {
  type EnabledModulesConfig,
  type ModuleType,
  type NavSection,
  type OrganizationId,
  type WorkspaceIconName
} from "@/app/types/workspace";

type PillarItem = {
  number: string;
  title: string;
  description: string;
  icon: WorkspaceIconName;
};

type RealityProfile = {
  eyebrow: string;
  headline: string;
  summary: string;
  environmentBadge: string;
  statusLabel: string;
  orgSubtitle: string;
  sectionEyebrow: string;
  sectionTitle: string;
  sectionSubtitle: string;
  pillars: PillarItem[];
  footerTitle: string;
  footerBody: string;
};

function resolveRealityProfile(
  organizationSlug: OrganizationId,
  organizationName: string,
  description?: string
): RealityProfile {
  const isQa = organizationSlug.endsWith("_qa");

  if (organizationSlug === "mundo_do_sabor" || organizationSlug === "mundo_do_sabor_qa") {
    return {
      eyebrow: isQa
        ? "RSBUILD OS · INDÚSTRIA ALIMENTÍCIA · AMBIENTE QA"
        : "RSBUILD OS · INDÚSTRIA ALIMENTÍCIA",
      headline: "Operação financeira e conciliação multibanco conectadas.",
      summary:
        "Ambiente dedicado da Mundo do Sabor para ingestão de extratos bancários, conferência de títulos a pagar e receber do Omie e rastreabilidade operacional.",
      environmentBadge: isQa ? "HOMOLOGAÇÃO · AMBIENTE QA" : "AMBIENTE OPERACIONAL",
      statusLabel: isQa ? "● ESCOPO DE HOMOLOGAÇÃO QA" : "● OPERAÇÃO ATIVA",
      orgSubtitle: isQa
        ? "Ambiente isolado para homologação de extratos, títulos Omie e rotinas financeiras."
        : "Central operacional da indústria com conciliação multibanco e governança de caixa.",
      sectionEyebrow: `COMO A ${organizationName.toUpperCase()} OPERA`,
      sectionTitle: "Pilares da operação financeira",
      sectionSubtitle:
        "Frentes estruturadas para manter previsibilidade de caixa, conferência bancária e integridade documental.",
      pillars: [
        {
          number: "01",
          title: "Extratos & Movimentação Multibanco",
          description:
            "Importação padronizada de arquivos OFX e CSV (Itaú, Safra e demais instituições) com identificação automática de conta e agência.",
          icon: "import"
        },
        {
          number: "02",
          title: "Conciliação & Baixas ERP",
          description:
            "Cruzamento direcional entre movimentos bancários e títulos a receber ou pagar, com mapeamento flexível de planilhas e trilha auditável.",
          icon: "reconciliation"
        },
        {
          number: "03",
          title: "Controladoria & Conformidade",
          description:
            "Acompanhamento de vencimentos, exposição documental de canhotos e histórico imutável de decisões por usuário e alçada.",
          icon: "guardian"
        }
      ],
      footerTitle: "Isolamento organizacional e trilha auditável",
      footerBody:
        "Todos os extratos, títulos e decisões deste ambiente permanecem isolados à organização ativa, com registro de responsável, data e justificativa em cada conferência."
    };
  }

  if (organizationSlug === "hub_acai" || organizationSlug === "hub_acai_qa") {
    return {
      eyebrow: isQa
        ? "RSBUILD OS · DISTRIBUIÇÃO EXPRESSA · AMBIENTE QA"
        : "RSBUILD OS · DISTRIBUIÇÃO EXPRESSA",
      headline: "Pedidos rápidos, logística de frota e caixa em sincronia.",
      summary:
        "Ambiente operacional do Hub Açaí para estruturar pedidos recebidos por mensagem, acompanhar cubagem da frota HR e conferir recebimentos e canhotos.",
      environmentBadge: isQa ? "HOMOLOGAÇÃO · AMBIENTE QA" : "DISTRIBUIÇÃO ATIVA",
      statusLabel: isQa ? "● ESCOPO DE HOMOLOGAÇÃO QA" : "● OPERAÇÃO ATIVA",
      orgSubtitle: isQa
        ? "Ambiente isolado para testes de pedidos WhatsApp, logística HR e conciliação."
        : "Operação de distribuição expressa com roteirização, canhotos e conferência financeira.",
      sectionEyebrow: `COMO O ${organizationName.toUpperCase()} OPERA`,
      sectionTitle: "Pilares da distribuição expressa",
      sectionSubtitle:
        "Fluxo integrado do pedido comercial ao comprovante de entrega e fechamento financeiro diário.",
      pillars: [
        {
          number: "01",
          title: "Pedidos & Demanda Comercial",
          description:
            "Leitura estruturada de pedidos por sabor e volume de caixas com preparação padronizada para faturamento no ERP.",
          icon: "delivery"
        },
        {
          number: "02",
          title: "Frota HR & Protocolo de Canhotos",
          description:
            "Monitoramento da ocupação logística (capacidade de 350 caixas) e conferência documental de comprovantes de entrega.",
          icon: "logistics"
        },
        {
          number: "03",
          title: "Conciliação & Fluxo de Caixa",
          description:
            "Conferência entre boletos, recebimentos bancários e títulos em aberto com visibilidade diária de liquidez.",
          icon: "finance"
        }
      ],
      footerTitle: "Operação orientada por alçada e rastreabilidade",
      footerBody:
        "Pedidos, entregas e lançamentos financeiros respeitam as permissões de cada operador e ficam isolados neste workspace."
    };
  }

  return {
    eyebrow: isQa
      ? "RSBUILD OS · AMBIENTE DE HOMOLOGAÇÃO"
      : "RSBUILD OS · WORKSPACE OPERACIONAL",
    headline: "Operação conectada com visibilidade e controle.",
    summary:
      description ||
      "Ambiente estruturado para integrar movimentações financeiras, conferência de títulos e governança operacional em um único lugar.",
    environmentBadge: isQa ? "HOMOLOGAÇÃO · AMBIENTE QA" : "AMBIENTE OPERACIONAL",
    statusLabel: isQa ? "● CONTEXTO QA" : "● OPERAÇÃO ATIVA",
    orgSubtitle: "Espaço operacional dedicado da organização com acesso aos módulos contratados.",
    sectionEyebrow: `COMO A ${organizationName.toUpperCase()} OPERA`,
    sectionTitle: "Frentes do ambiente",
    sectionSubtitle:
      "Módulos organizados para dar ritmo à rotina diária sem misturar responsabilidades.",
    pillars: [
      {
        number: "01",
        title: "Gestão Financeira",
        description: "Importação de extratos bancários, acompanhamento de saldo e visão consolidada.",
        icon: "finance"
      },
      {
        number: "02",
        title: "Reconciliação ERP",
        description: "Conferência de títulos a receber e pagar contra movimentações reais de conta.",
        icon: "reconciliation"
      },
      {
        number: "03",
        title: "Auditoria & Governança",
        description: "Rastreabilidade completa de ações, responsáveis e evidências operacionais.",
        icon: "guardian"
      }
    ],
    footerTitle: "Acesso orientado por responsabilidade",
    footerBody:
      "Cada módulo e ação é liberado conforme o papel do usuário e as licenças ativas desta organização."
  };
}

const MODULE_DESTINATIONS: Record<ModuleType, NavSection> = {
  finance: "visao-geral",
  reconciliation: "baixas",
  logistics: "pedidos-ha",
  audit: "torre-controle"
};

const MODULE_DESCRIPTIONS: Record<ModuleType, string> = {
  finance: "Movimentações, importações e visão financeira",
  reconciliation: "Conferência de títulos, conciliação e baixas",
  logistics: "Pedidos, expedição e comprovantes de entrega",
  audit: "Governança, rastreabilidade e auditoria operacional"
};

type Props = {
  organizationSlug: OrganizationId;
  organizationName: string;
  organizationDescription?: string;
  enabledModules: EnabledModulesConfig;
  onNavigateToSection: (section: NavSection) => void;
};

export function OperationalWorkspaceHomeView({
  organizationSlug,
  organizationName,
  organizationDescription,
  enabledModules,
  onNavigateToSection
}: Props) {
  const profile = resolveRealityProfile(organizationSlug, organizationName, organizationDescription);
  const activeModules = MODULE_CONFIGS.filter((mod) => enabledModules[mod.id]);

  return (
    <section
      aria-labelledby="workspace-launcher-title"
      style={{ display: "grid", gap: 22, paddingBottom: 36, maxWidth: 1160, margin: "0 auto" }}
    >
      <header
        className="cockpit-hero"
        style={{
          padding: "clamp(24px, 4vw, 38px)",
          alignItems: "flex-start",
          background: "linear-gradient(120deg, var(--surface-raised), var(--surface))",
          borderLeft: "4px solid var(--rsbuild-terracotta, #B5583C)"
        }}
      >
        <div style={{ maxWidth: 760 }}>
          <div className="eyebrow">{profile.eyebrow}</div>
          <h1
            id="workspace-launcher-title"
            style={{
              margin: "10px 0 8px",
              color: "var(--ink)",
              fontSize: "clamp(25px, 3vw, 34px)",
              lineHeight: 1.14
            }}
          >
            {profile.headline}
          </h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14, lineHeight: 1.7 }}>
            {profile.summary}
          </p>
        </div>
        <span className="status-pill" style={{ fontSize: 10, whiteSpace: "nowrap" }}>
          {profile.environmentBadge}
        </span>
      </header>

      <article
        className="card cockpit-card"
        style={{
          padding: "18px 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              display: "grid",
              placeItems: "center",
              background: "var(--rsbuild-terracotta-soft, rgba(181,88,60,.10))"
            }}
          >
            <RsbuildIcon name="control-tower" size={25} tone="accent" />
          </div>
          <div>
            <div className="eyebrow">ORGANIZAÇÃO ATUAL</div>
            <strong style={{ color: "var(--ink)", fontSize: 16 }}>{organizationName}</strong>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>
              {profile.orgSubtitle}
            </p>
          </div>
        </div>
        <span
          style={{
            color: "var(--green, #059669)",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: ".5px"
          }}
        >
          {profile.statusLabel}
        </span>
      </article>

      {activeModules.length > 0 && (
        <section style={{ display: "grid", gap: 12 }}>
          <div>
            <div className="eyebrow">ACESSO RÁPIDO</div>
            <h2 style={{ color: "var(--ink)", margin: "5px 0", fontSize: 19 }}>
              Módulos habilitados
            </h2>
            <p style={{ color: "var(--muted)", margin: 0, fontSize: 13, lineHeight: 1.6 }}>
              Selecione uma frente para iniciar ou continuar as rotinas operacionais deste ambiente.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
              gap: 14
            }}
          >
            {activeModules.map((module) => (
              <button
                key={module.id}
                type="button"
                onClick={() => onNavigateToSection(MODULE_DESTINATIONS[module.id])}
                aria-label={`Abrir módulo ${module.label}`}
                className="card cockpit-card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  minHeight: 118,
                  padding: "20px",
                  textAlign: "left",
                  cursor: "pointer",
                  color: "var(--ink)"
                }}
              >
                <span
                  style={{
                    display: "grid",
                    placeItems: "center",
                    flex: "0 0 46px",
                    width: 46,
                    height: 46,
                    borderRadius: 10,
                    color: "var(--rsbuild-terracotta, #B5583C)",
                    background: "var(--rsbuild-terracotta-soft, rgba(181,88,60,.10))"
                  }}
                >
                  <RsbuildIcon name={module.icon} size={24} tone="accent" />
                </span>
                <span style={{ display: "grid", gap: 5, minWidth: 0 }}>
                  <strong style={{ fontSize: 15.5, fontWeight: 650 }}>{module.label}</strong>
                  <span style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>
                    {MODULE_DESCRIPTIONS[module.id]}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section style={{ display: "grid", gap: 12 }}>
        <div>
          <div className="eyebrow">{profile.sectionEyebrow}</div>
          <h2 style={{ color: "var(--ink)", margin: "5px 0", fontSize: 19 }}>
            {profile.sectionTitle}
          </h2>
          <p style={{ color: "var(--muted)", margin: 0, fontSize: 13, lineHeight: 1.6 }}>
            {profile.sectionSubtitle}
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 235px), 1fr))",
            gap: 14
          }}
        >
          {profile.pillars.map((item) => (
            <article
              key={item.number}
              className="card cockpit-card"
              style={{
                padding: 21,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                minHeight: 175
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <RsbuildIcon name={item.icon} size={23} tone="accent" />
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: "var(--muted)" }}>
                  {item.number}
                </span>
              </div>
              <div>
                <h3 style={{ color: "var(--ink)", margin: "0 0 7px", fontSize: 15 }}>{item.title}</h3>
                <p style={{ color: "var(--muted)", margin: 0, fontSize: 12.5, lineHeight: 1.65 }}>
                  {item.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        className="card cockpit-card"
        style={{
          padding: "20px 22px",
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: 14,
          alignItems: "start",
          borderLeft: "3px solid var(--rsbuild-terracotta, #B5583C)"
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 20, color: "var(--rsbuild-terracotta, #B5583C)" }}>
          ◈
        </span>
        <div>
          <strong style={{ display: "block", color: "var(--ink)", fontSize: 13 }}>
            {profile.footerTitle}
          </strong>
          <p style={{ color: "var(--muted)", margin: "5px 0 0", fontSize: 12, lineHeight: 1.65 }}>
            {profile.footerBody}
          </p>
        </div>
      </section>
    </section>
  );
}
