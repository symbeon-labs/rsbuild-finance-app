"use client";

import { useState } from "react";
import { NavSection } from "@/app/types/workspace";

interface TourStep {
  step: number;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  bullets: { icon: string; title: string; desc: string }[];
  targetSection?: NavSection;
  actionLabel?: string;
  tag: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    step: 1,
    badge: "VISÃO EXECUTIVA",
    title: "Torre de Controle da Holding",
    subtitle: "Consolidação em tempo real de todas as operações e empresas",
    description:
      "O RSBUILD OS foi construído para dar visibilidade executiva sem misturar dados. A diretoria acompanha o faturamento, caixas diários e indicadores consolidados em uma visão única.",
    bullets: [
      {
        icon: "🏛️",
        title: "Isolamento Multi-Tenant com RLS",
        desc: "Cada empresa opera em silo fechado; a holding enxerga tudo consolidado sem risco de vazamento."
      },
      {
        icon: "👑",
        title: "Matriz de Alçadas (RBAC)",
        desc: "4 níveis de permissão (Proprietário, Diretoria, Operador e Auditoria) com travas de segurança."
      },
      {
        icon: "📊",
        title: "Gestão por Indicadores",
        desc: "Acompanhamento reativo de entradas, saídas, resultado líquido e cobertura operacional."
      }
    ],
    targetSection: "visao-geral",
    actionLabel: "Explorar Torre de Controle",
    tag: "Holding & Governança"
  },
  {
    step: 2,
    badge: "MÓDULO 01 · ENTREGUE",
    title: "Finanças & Ingestão Multibanco",
    subtitle: "Normalização inteligente de extratos OFX e CSV",
    description:
      "Elimine a digitação manual de extratos. O motor financeiro reconhece layouts bancários nacionais, detecta duplicidades e recalcula o fluxo de caixa com precisão em centavos.",
    bullets: [
      {
        icon: "💳",
        title: "Leitor Inteligente OFX/CSV",
        desc: "Ingestão transacional com hash SHA-256 de lote, garantindo rastreabilidade e idempotência."
      },
      {
        icon: "📅",
        title: "Seletor Contábil Reativo",
        desc: "Filtros rápidos (Mês Atual, Mês Anterior, Ano) ou períodos customizados de conferência."
      },
      {
        icon: "📈",
        title: "Demonstrativo DRE Gerencial",
        desc: "Visão estruturada de receitas, custos e margem operacional por unidade de negócio."
      }
    ],
    targetSection: "movimentacoes",
    actionLabel: "Ver Movimentações & Extratos",
    tag: "Finanças & Tesouraria"
  },
  {
    step: 3,
    badge: "MÓDULO 02 · ENTREGUE",
    title: "Reconciliação & Baixas no ERP",
    subtitle: "Cruzamento algorítmico assistido e baixas em lote sem erro humano",
    description:
      "A solução para a fragilidade operacional: cruze as entradas bancárias com os títulos a receber do sistema de gestão, apure juros/multas e gere o arquivo oficial de baixa em lote.",
    bullets: [
      {
        icon: "🔄",
        title: "Motor de Matching Assistido",
        desc: "Cruzamento automático por valor exato, CNPJ/CPF e documento fiscal com sugestão de correspondência."
      },
      {
        icon: "⚖️",
        title: "Cálculo Automático de Encargos",
        desc: "Apuração precisa de juros, multas e abatimentos para pagamentos fora do vencimento."
      },
      {
        icon: "📦",
        title: "Remessa de Baixa em Lote",
        desc: "Exportação em lote padronizada para o ERP, com aprovação restrita à diretoria."
      }
    ],
    targetSection: "conciliacao",
    actionLabel: "Abrir Central de Reconciliação",
    tag: "Reconciliação ERP"
  },
  {
    step: 4,
    badge: "MÓDULO 03 · OPERACIONAL",
    title: "Logística & Blindagem de Canhotos",
    subtitle: "Protocolo digital de entregas e parser de pedidos de mensageria",
    description:
      "Proteja a operação contra perdas e cobranças indevidas: digitalize os canhotos assinados, monitore o risco de protesto e converta pedidos informais de clientes em registros estruturados.",
    bullets: [
      {
        icon: "📜",
        title: "Custódia Digital de Canhotos",
        desc: "Upload e vinculação de comprovantes de entrega às notas fiscais para resguardo jurídico."
      },
      {
        icon: "⚠️",
        title: "Alerta de Risco de Protesto",
        desc: "Identificação proativa de títulos faturados sem comprovante de entrega anexado."
      },
      {
        icon: "💬",
        title: "Parser NLP de Pedidos",
        desc: "Interpretação automática de mensagens de WhatsApp e geração de pedido formatado."
      }
    ],
    targetSection: "canhotos",
    actionLabel: "Conferir Canhotos de Entrega",
    tag: "Expedição & Logística"
  },
  {
    step: 5,
    badge: "MÓDULO 04 · GOVERNANÇA",
    title: "Auditoria Pericial & O RS Guardião",
    subtitle: "Governança Cognitiva com Supervisão Humana (HITL)",
    description:
      "O RS Guardião atua como uma sentinela pericial contínua: diagnostica a integridade dos processos, audita cada ação de usuário e garante que decisões críticas permaneçam sob alçada humana.",
    bullets: [
      {
        icon: "🛡️",
        title: "Sentinela de Integridade",
        desc: "Score pericial e diagnóstico contínuo de conformidade contábil, fiscal e processual."
      },
      {
        icon: "👁️",
        title: "Trilha Imutável de Eventos (Audit Trail)",
        desc: "Registro forense com ator, data, hora e metadados de toda importação, baixa e exclusão."
      },
      {
        icon: "🤝",
        title: "Human-in-the-Loop (HITL)",
        desc: "A inteligência apoia e audita, mas a validação de crédito e baixas é sempre da diretoria."
      }
    ],
    targetSection: "torre-controle",
    actionLabel: "Ver Diagnóstico do RS Guardião",
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
                  fontSize: "9.5px",
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
              <span style={{ fontSize: "11px", color: "var(--muted, #9B9A97)" }}>
                Passo {currentStep.step} de {TOUR_STEPS.length} · {currentStep.tag}
              </span>
            </div>
            <h2
              id="tour-modal-title"
              style={{
                margin: 0,
                fontSize: "19px",
                fontWeight: 600,
                color: "var(--ink, #F4F1EA)",
                letterSpacing: "-0.01em"
              }}
            >
              {currentStep.title}
            </h2>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "12.5px",
                color: "var(--muted, #9B9A97)",
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
            style={{
              fontSize: "13px",
              lineHeight: "1.55",
              color: "var(--ink-secondary, #D5D2CB)",
              margin: "0 0 16px"
            }}
          >
            {currentStep.description}
          </p>

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
              <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "16px", marginTop: "1px" }}>{b.icon}</span>
                <div style={{ fontSize: "12px", lineHeight: "1.4" }}>
                  <strong style={{ color: "var(--ink, #F4F1EA)", display: "block" }}>
                    {b.title}
                  </strong>
                  <span style={{ color: "var(--muted, #9B9A97)" }}>{b.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer com Navegação e Ações */}
        <div
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
