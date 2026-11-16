"use client";

import { useState } from "react";
import { NavSection } from "@/app/types/workspace";
import { RsbuildIcon, type RsbuildIconName } from "@/app/components/rsbuild-icons";

type CapabilityStatus = "Disponível" | "Em validação" | "Em desenvolvimento" | "Planejado";

interface TourCapability {
  icon: RsbuildIconName;
  title: string;
  desc: string;
  status: CapabilityStatus;
}

interface TourStep {
  step: number;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  bullets: TourCapability[];
  userCanDo: string;
  operationalNote?: string;
  maturity: CapabilityStatus;
  targetSection?: NavSection;
  actionLabel?: string;
  tag: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    step: 1,
    badge: "VISÃO EXECUTIVA",
    title: "Torre de Controle da Holding",
    subtitle: "Visibilidade executiva por organização",
    description:
      "A Torre de Controle reúne indicadores e informações operacionais disponíveis no workspace para apoiar o acompanhamento da empresa. A consolidação entre diferentes organizações depende das fontes, dos acessos e das integrações habilitadas.",
    bullets: [
      {
        icon: "control-tower",
        title: "Visão por organização",
        desc: "Acompanhamento das informações disponíveis no workspace ativo.",
        status: "Em validação"
      },
      {
        icon: "users",
        title: "Papéis e alçadas de acesso",
        desc: "Ações e aprovações são condicionadas ao perfil e às permissões configuradas.",
        status: "Disponível"
      },
      {
        icon: "analytics",
        title: "Indicadores executivos",
        desc: "Leitura de indicadores financeiros e operacionais conforme a disponibilidade das fontes.",
        status: "Em validação"
      }
    ],
    userCanDo: "Explore os indicadores disponíveis e identifique quais fontes de dados ainda precisam ser importadas ou configuradas.",
    operationalNote:
      "A visão apresentada é limitada aos dados disponíveis no workspace. Não representa, por si só, consolidação automática em tempo real de todas as empresas da holding.",
    maturity: "Em validação",
    targetSection: "torre-controle",
    actionLabel: "Explorar Torre de Controle",
    tag: "Holding & Governança"
  },
  {
    step: 2,
    badge: "FINANÇAS",
    title: "Finanças & Ingestão de Extratos",
    subtitle: "Importação e organização de arquivos OFX e CSV",
    description:
      "O módulo permite carregar extratos bancários, revisar os registros reconhecidos e acompanhar as movimentações financeiras disponíveis no workspace.",
    bullets: [
      {
        icon: "finance",
        title: "Importação OFX/CSV",
        desc: "Leitura de arquivos e apresentação de uma prévia para conferência antes da confirmação.",
        status: "Disponível"
      },
      {
        icon: "search",
        title: "Consulta de movimentações",
        desc: "Busca e visualização dos registros carregados, com filtros e recortes por período.",
        status: "Disponível"
      },
      {
        icon: "analytics",
        title: "Visão gerencial",
        desc: "Acompanhamento de entradas, saídas e resultado com base nos registros disponíveis.",
        status: "Disponível"
      }
    ],
    userCanDo: "Selecione um arquivo OFX ou CSV, confira a prévia e confirme a importação para consultar as movimentações.",
    operationalNote:
      "A leitura depende da estrutura e da qualidade do arquivo recebido. Confira os registros antes de confirmar a importação.",
    maturity: "Disponível",
    targetSection: "importacoes",
    actionLabel: "Importar extrato",
    tag: "Finanças & Tesouraria"
  },
  {
    step: 3,
    badge: "RECONCILIAÇÃO",
    title: "Reconciliação & Baixas",
    subtitle: "Correspondência assistida entre extratos e títulos",
    description:
      "A área de reconciliação permite comparar movimentações bancárias com lançamentos e títulos importados, identificar possíveis correspondências e destacar divergências para revisão.",
    bullets: [
      {
        icon: "matching",
        title: "Correspondência assistida",
        desc: "Sugestões de relacionamento entre registros bancários e lançamentos disponíveis.",
        status: "Em validação"
      },
      {
        icon: "audit",
        title: "Análise de divergências",
        desc: "Visualização de diferenças e necessidade de revisão antes de confirmar uma correspondência.",
        status: "Em validação"
      },
      {
        icon: "document",
        title: "Exportação de lote",
        desc: "Geração de arquivo CSV para conferência e eventual utilização no sistema de origem.",
        status: "Em validação"
      }
    ],
    userCanDo: "Importe os lançamentos de referência, examine as correspondências sugeridas e revise divergências antes de qualquer decisão.",
    operationalNote:
      "O workspace não executa baixa diretamente no ERP nem sincroniza automaticamente com ele. A exportação gera um arquivo para conferência e eventual importação manual.",
    maturity: "Em validação",
    targetSection: "conciliacao",
    actionLabel: "Abrir Conciliação",
    tag: "Reconciliação ERP"
  },
  {
    step: 4,
    badge: "LOGÍSTICA",
    title: "Logística & Comprovantes de Entrega",
    subtitle: "Organização de pedidos, entregas e ocorrências",
    description:
      "As ferramentas logísticas ajudam a estruturar informações de pedidos e comprovantes, relacionar registros e acompanhar pendências documentais da operação.",
    bullets: [
      {
        icon: "delivery",
        title: "Comprovantes e canhotos",
        desc: "Importação e consulta de registros de entrega e seus dados associados.",
        status: "Em validação"
      },
      {
        icon: "alert",
        title: "Pendências documentais",
        desc: "Visualização de registros que precisam de conferência ou complemento.",
        status: "Em validação"
      },
      {
        icon: "document",
        title: "Interpretação de pedidos",
        desc: "Leitura assistida de mensagens e organização dos itens identificados em uma prévia.",
        status: "Em validação"
      }
    ],
    userCanDo: "Consulte os comprovantes ou experimente a interpretação de uma mensagem de pedido, revisando os dados estruturados antes de confirmar.",
    operationalNote:
      "Os registros de canhotos e pedidos deste ambiente são dados locais de demonstração e não representam persistência oficial no servidor.",
    maturity: "Em validação",
    targetSection: "canhotos",
    actionLabel: "Consultar Comprovantes",
    tag: "Expedição & Logística"
  },
  {
    step: 5,
    badge: "AUDITORIA & GOVERNANÇA",
    title: "RS Guardião",
    subtitle: "Apoio à análise, rastreabilidade e supervisão humana",
    description:
      "O RS Guardião representa a frente de governança do RSBUILD OS. No ambiente atual, o painel reúne informações disponíveis e apresenta análises experimentais para apoiar a identificação de pontos que exigem revisão humana.",
    bullets: [
      {
        icon: "guardian",
        title: "Diagnóstico operacional",
        desc: "Síntese calculada somente quando as fontes necessárias estão disponíveis; não equivale a certificação de conformidade.",
        status: "Em validação"
      },
      {
        icon: "audit",
        title: "Rastreabilidade de ações",
        desc: "Consulta dos registros e informações de auditoria efetivamente disponibilizados pelo workspace.",
        status: "Em validação"
      },
      {
        icon: "approval",
        title: "Supervisão humana",
        desc: "Correspondências, divergências e decisões críticas requerem revisão e permissões adequadas.",
        status: "Disponível"
      }
    ],
    userCanDo: "Explore o painel, verifique a suficiência das fontes e trate as recomendações como pontos de revisão — não como decisões automáticas.",
    operationalNote:
      "Os indicadores são experimentais e dependem da cobertura e da qualidade dos dados. O painel não certifica conformidade contábil, fiscal ou jurídica e não substitui auditoria profissional.",
    maturity: "Em validação",
    targetSection: "torre-controle",
    actionLabel: "Ver Painel de Governança",
    tag: "Auditoria & Governança"
  }
];
interface ProductTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToSection?: (section: NavSection) => void;
}

export function ProductTourModal({
  isOpen,
  onClose,
  onNavigateToSection
}: ProductTourModalProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  if (!isOpen) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === TOUR_STEPS.length - 1;

  function handleNext() {
    if (isLast) {
      handleComplete();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }

  function handlePrev() {
    if (!isFirst) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }

  function handleComplete() {
    try {
      localStorage.setItem("rsbuild_tour_completed_v1", "true");
    } catch {
      // Ignora erro de localStorage em modo privado
    }
    onClose();
  }

  function handleGoToSection() {
    if (currentStep.targetSection && onNavigateToSection) {
      onNavigateToSection(currentStep.targetSection);
    }
    handleComplete();
  }

  return (
    <div
      className="rsbuild-tour-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(10, 11, 14, 0.78)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px"
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-modal-title"
    >
      <div
        className="rsbuild-tour-dialog"
        style={{
          width: "100%",
          maxWidth: "680px",
          background: "var(--surface, #18191C)",
          border: "1px solid var(--line, #2E3036)",
          borderRadius: "14px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.45), 0 0 0 1px rgba(181, 88, 60, 0.25)",
          color: "var(--ink, #F4F1EA)",
          overflow: "hidden",
          animation: "tourModalFadeIn 0.22s ease-out"
        }}
      >
        {/* Barra de Progresso Superior */}
        <div style={{ height: "4px", background: "rgba(255,255,255,0.08)", width: "100%", display: "flex" }}>
          {TOUR_STEPS.map((s, idx) => (
            <div
              key={s.step}
              style={{
                flex: 1,
                background:
                  idx <= currentStepIndex
                    ? "var(--rsbuild-terracotta, #B5583C)"
                    : "transparent",
                transition: "background 0.3s ease"
              }}
            />
          ))}
        </div>

        {/* Header do Card */}
        <div
          className="rsbuild-tour-header"
          style={{
            padding: "20px 24px 14px",
            borderBottom: "1px solid var(--line, #2E3036)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "12px"
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "var(--rsbuild-terracotta, #B5583C)",
                  background: "rgba(181, 88, 60, 0.12)",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  border: "1px solid rgba(181, 88, 60, 0.3)"
                }}
              >
                {currentStep.badge}
              </span>
              <span style={{ fontSize: "12px", color: "var(--muted, #77716B)" }}>
                Passo {currentStep.step} de {TOUR_STEPS.length} · {currentStep.tag}
              </span>
            </div>
            <h2
              className="rsbuild-tour-title"
              id="tour-modal-title"
              style={{
                margin: 0,
                fontSize: "22px",
                fontWeight: 600,
                color: "var(--ink, #F4F1EA)",
                letterSpacing: "-0.01em"
              }}
            >
              {currentStep.title}
            </h2>
            <p
              className="rsbuild-tour-subtitle"
              style={{
                margin: "4px 0 0",
                fontSize: "14px",
                color: "var(--muted, #77716B)",
                lineHeight: "1.4"
              }}
            >
              {currentStep.subtitle}
            </p>
          </div>

          <button
            onClick={handleComplete}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--muted, #9B9A97)",
              fontSize: "18px",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "4px",
              lineHeight: 1
            }}
            title="Fechar guia"
            aria-label="Fechar guia"
          >
            ✕
          </button>
        </div>

        {/* Corpo do Conteúdo */}
        <div style={{ padding: "20px 24px" }}>
          <p
            className="rsbuild-tour-description"
            style={{
              fontSize: "14px",
              lineHeight: "1.6",
              color: "var(--ink, #2B2C2E)",
              margin: "0 0 16px"
            }}
          >
            {currentStep.description}
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", color: "var(--muted, #77716B)" }}>
              MATURIDADE DO MÓDULO
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                border: "1px solid rgba(181, 88, 60, 0.35)",
                background: "rgba(181, 88, 60, 0.10)",
                color: "var(--rsbuild-terracotta, #B5583C)",
                borderRadius: "999px",
                padding: "3px 9px",
                fontSize: "10px",
                fontWeight: 700
              }}
            >
              {currentStep.maturity}
            </span>
          </div>

          <div className="rsbuild-tour-guidance" style={{ marginBottom: "14px", padding: "11px 13px", borderRadius: "8px", background: "rgba(255,255,255,0.025)", border: "1px solid var(--line, #2E3036)" }}>
            <strong style={{ display: "block", fontSize: "12px", color: "var(--ink, #2B2C2E)", marginBottom: "4px" }}>
              O que você pode fazer
            </strong>
            <span style={{ fontSize: "13px", lineHeight: "1.55", color: "var(--muted, #77716B)" }}>
              {currentStep.userCanDo}
            </span>
          </div>

          {/* Grid de Destaques / Bullets */}
          <div
            style={{
              display: "grid",
              gap: "10px",
              background: "var(--surface-raised, rgba(255,255,255,0.03))",
              padding: "14px",
              borderRadius: "10px",
              border: "1px solid var(--line, #2E3036)"
            }}
          >
            {currentStep.bullets.map((b, i) => (
              <div key={i} className="rsbuild-tour-capability" style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span className="rsbuild-tour-capability-icon" style={{ display: "inline-flex", width: "30px", height: "30px", alignItems: "center", justifyContent: "center", marginTop: "1px" }}><RsbuildIcon name={b.icon} size={25} tone="primary" /></span>
                <div style={{ fontSize: "13px", lineHeight: "1.5" }}>
                  <div className="rsbuild-tour-capability-heading" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                    <strong className="rsbuild-tour-capability-title" style={{ color: "var(--ink, #F4F1EA)" }}>{b.title}</strong>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: "999px",
                        border: "1px solid var(--line, #2E3036)",
                        color: b.status === "Disponível" ? "var(--green, #16A34A)" : "var(--muted, #9B9A97)"
                      }}
                    >
                      {b.status.toUpperCase()}
                    </span>
                  </div>
                  <span className="rsbuild-tour-capability-description" style={{ color: "var(--muted, #9B9A97)" }}>{b.desc}</span>
                </div>
              </div>
            ))}
          </div>
          {currentStep.operationalNote && (
            <div
              role="note"
              className="rsbuild-tour-note"
              style={{
                marginTop: "12px",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(217, 204, 181, 0.18)",
                background: "rgba(217, 204, 181, 0.045)",
                color: "var(--muted, #B8B3AA)",
                fontSize: "11px",
                lineHeight: "1.45"
              }}
            >
              <strong style={{ color: "var(--ink-secondary, #D5D2CB)" }}>Nota operacional: </strong>
              {currentStep.operationalNote}
            </div>
          )}
        </div>

        {/* Footer com Navegação e Ações */}
        <div
          className="rsbuild-tour-footer"
          style={{
            padding: "14px 24px 18px",
            borderTop: "1px solid var(--line, #2E3036)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px"
          }}
        >
          <button
            type="button"
            onClick={handleComplete}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--muted, #9B9A97)",
              fontSize: "12px",
              cursor: "pointer",
              textDecoration: "underline"
            }}
          >
            Pular introdução
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {currentStep.actionLabel && currentStep.targetSection && (
              <button
                type="button"
                onClick={handleGoToSection}
                style={{
                  background: "transparent",
                  border: "1px solid var(--line, #2E3036)",
                  color: "var(--ink, #F4F1EA)",
                  padding: "7px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <span>🚀</span>
                <span>{currentStep.actionLabel}</span>
              </button>
            )}

            {!isFirst && (
              <button
                type="button"
                onClick={handlePrev}
                style={{
                  background: "var(--surface-raised, rgba(255,255,255,0.06))",
                  border: "1px solid var(--line, #2E3036)",
                  color: "var(--ink, #F4F1EA)",
                  padding: "7px 14px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  cursor: "pointer"
                }}
              >
                Anterior
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              style={{
                background: "var(--rsbuild-terracotta, #B5583C)",
                border: "none",
                color: "#FFFFFF",
                padding: "7px 18px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(181, 88, 60, 0.4)"
              }}
            >
              {isLast ? "Concluir Guia ✓" : "Próximo →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
