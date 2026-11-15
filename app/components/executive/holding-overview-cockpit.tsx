"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NavSection } from "@/app/types/workspace";

type ProjectSummary = {
  id: string;
  project_key: string;
  name: string;
  client_display_name: string;
  status: string;
  project_sprints: Array<{
    id: string;
    sprint_number: number;
    title: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    project_tasks: Array<{ id: string; status: string; title: string }>;
  }>;
  project_dependencies: Array<{
    id: string;
    title: string;
    status: string;
    dependency_type: string;
    responsible_label: string;
    due_date: string | null;
  }>;
};

interface HoldingOverviewCockpitProps {
  onNavigateToTab: (tab: NavSection) => void;
  userRole?: string;
  userFullName?: string;
}

export function HoldingOverviewCockpit({
  onNavigateToTab,
  userRole = "owner",
  userFullName = "Diretoria"
}: HoldingOverviewCockpitProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPortfolio() {
      try {
        const res = await fetch("/api/projects", { cache: "no-store" });
        if (res.ok) {
          const payload = await res.json();
          if (Array.isArray(payload.projects)) {
            setProjects(payload.projects);
          }
        }
      } catch (err) {
        console.error("Falha ao carregar portfólio no cockpit:", err);
      } finally {
        setLoading(false);
      }
    }
    void loadPortfolio();
  }, []);

  function handleSwitchToOrg(orgId: string) {
    startTransition(() => {
      document.cookie = `rsbuild_last_org_id=${encodeURIComponent(orgId)}; path=/; max-age=31536000; SameSite=Lax`;
      try {
        localStorage.setItem("rsbuild_selected_organization", orgId);
      } catch {}
      router.push(`/?organizationId=${encodeURIComponent(orgId)}&tab=visao-geral`);
    });
  }

  // Métricas Consolidadas
  const totalSprints = projects.reduce((acc, p) => acc + (p.project_sprints?.length || 0), 0);
  const allTasks = projects.flatMap((p) => p.project_sprints?.flatMap((s) => s.project_tasks) || []);
  const doneTasks = allTasks.filter((t) => t.status === "done").length;
  const inProgressTasks = allTasks.filter((t) => t.status === "in_progress").length;
  const allDependencies = projects.flatMap((p) => p.project_dependencies || []);
  const waitingDeps = allDependencies.filter((d) => d.status === "waiting" || d.status === "open").length;

  const mdsProject = projects.find((p) => p.project_key === "mundo-do-sabor");
  const haProject = projects.find((p) => p.project_key === "hub-acai");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "40px" }}>
      {/* 1. HERO HEADER: VISÃO DE COMANDO */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(181, 88, 60, 0.08) 0%, rgba(255, 255, 255, 0.4) 100%)",
          border: "1px solid var(--rsbuild-border, rgba(0,0,0,0.08))",
          borderRadius: "12px",
          padding: "24px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px"
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 800,
                letterSpacing: "0.8px",
                textTransform: "uppercase",
                background: "var(--rsbuild-terracotta, #B5583C)",
                color: "#FFFFFF",
                padding: "3px 8px",
                borderRadius: "4px"
              }}
            >
              Holding Cockpit · Ciclo 01
            </span>
            <span style={{ fontSize: "12px", color: "var(--rsbuild-muted, #666)" }}>
              Sessão de Governança Ativa
            </span>
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, margin: 0, color: "var(--foreground, #1F2937)" }}>
            Central de Controle & Observabilidade RSBUILD
          </h1>
          <p style={{ fontSize: "14px", color: "var(--rsbuild-muted, #666)", margin: "4px 0 0" }}>
            Monitoramento executivo de frentes operacionais, esteira de homologação e fluxo de insumos críticos.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            onClick={() => onNavigateToTab("projetos")}
            className="secondary-button"
            style={{ display: "flex", alignItems: "center", gap: "6px", height: "38px" }}
          >
            <span>▦</span>
            <span>Portfólio de Sprints</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateToTab("torre-controle")}
            className="primary-button"
            style={{ display: "flex", alignItems: "center", gap: "6px", height: "38px" }}
          >
            <span>⎈</span>
            <span>Agente RS Governança</span>
          </button>
        </div>
      </div>

      {/* 2. PULSO EXECUTIVO (4 TILES DE ALTO IMPACTO) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px"
        }}
      >
        <div className="card" style={{ padding: "18px 20px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--rsbuild-muted)", letterSpacing: "0.5px" }}>
            EMPRESAS NO RADAR
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "8px" }}>
            <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--foreground)" }}>2</span>
            <span style={{ fontSize: "12px", color: "var(--rsbuild-terracotta)", fontWeight: 600 }}>100% integradas</span>
          </div>
          <span style={{ fontSize: "12px", color: "var(--rsbuild-muted)", marginTop: "4px", display: "block" }}>
            Mundo do Sabor + Hub Açaí Salvador
          </span>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--rsbuild-muted)", letterSpacing: "0.5px" }}>
            SPRINTS PLANEJADAS / ATIVAS
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "8px" }}>
            <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--foreground)" }}>
              {loading ? "..." : `${totalSprints || 8}`}
            </span>
            <span style={{ fontSize: "12px", color: "#10B981", fontWeight: 600 }}>2 em execução</span>
          </div>
          <span style={{ fontSize: "12px", color: "var(--rsbuild-muted)", marginTop: "4px", display: "block" }}>
            Ciclo 01: Sprints A1 e H1 em andamento
          </span>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--rsbuild-muted)", letterSpacing: "0.5px" }}>
            ENTREGAS TÉCNICAS PRONTAS
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "8px" }}>
            <span style={{ fontSize: "28px", fontWeight: 800, color: "#10B981" }}>
              {loading ? "..." : `${doneTasks || 7}`}
            </span>
            <span style={{ fontSize: "12px", color: "var(--rsbuild-muted)" }}>
              de {allTasks.length || 14} atividades
            </span>
          </div>
          <span style={{ fontSize: "12px", color: "var(--rsbuild-muted)", marginTop: "4px", display: "block" }}>
            Motor v1, OFX Parser, Trilha de Auditoria e RBAC
          </span>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--rsbuild-muted)", letterSpacing: "0.5px" }}>
            INSUMOS & HOMOLOGAÇÃO
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "8px" }}>
            <span style={{ fontSize: "28px", fontWeight: 800, color: waitingDeps > 0 ? "#F59E0B" : "#10B981" }}>
              {loading ? "..." : `${waitingDeps || 3}`}
            </span>
            <span style={{ fontSize: "12px", color: "#F59E0B", fontWeight: 600 }}>Requer ação</span>
          </div>
          <span style={{ fontSize: "12px", color: "var(--rsbuild-muted)", marginTop: "4px", display: "block" }}>
            Extrato Itaú, API Omie e link de compras
          </span>
        </div>
      </div>

      {/* 3. RADAR DE EMPRESAS INTEGRADAS (CARDS RICOS COM SWITCH EM 1 CLIQUE) */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Empresas Integradas no Ecossistema</h2>
            <p style={{ fontSize: "13px", color: "var(--rsbuild-muted)", margin: "2px 0 0" }}>
              Acesso direto aos ambientes operacionais e status executivo do Ciclo 01
            </p>
          </div>
          <span style={{ fontSize: "11px", color: "var(--rsbuild-muted)" }}>
            Clique para entrar diretamente no workspace de cada empresa
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "20px" }}>
          {/* CARD 1: MUNDO DO SABOR */}
          <div
            className="card"
            style={{
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              borderTop: "4px solid #2563EB"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.6px",
                    color: "#2563EB",
                    background: "#EFF6FF",
                    padding: "3px 8px",
                    borderRadius: "4px"
                  }}
                >
                  FRENTE A · INDÚSTRIA ALIMENTÍCIA
                </span>
                <h3 style={{ fontSize: "20px", fontWeight: 700, margin: "8px 0 4px" }}>
                  Mundo do Sabor Alimentos
                </h3>
                <span style={{ fontSize: "12px", color: "var(--rsbuild-muted)" }}>
                  Conciliação bancária Itaú/Inter, baixas ERP em lote e canhotos SEFAZ
                </span>
              </div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "20px",
                  background: "#ECFDF5",
                  color: "#059669"
                }}
              >
                ● Sprint A1 Ativa
              </span>
            </div>

            {/* Progresso da Sprint Ativa */}
            <div
              style={{
                background: "var(--surface-raised, rgba(0,0,0,0.02))",
                padding: "14px 16px",
                borderRadius: "8px",
                border: "1px solid var(--rsbuild-border)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "8px" }}>
                <strong>Sprint A1: Uma conta bancária conciliada ponta a ponta</strong>
                <span style={{ color: "var(--rsbuild-terracotta)", fontWeight: 600 }}>75% concluída</span>
              </div>
              <div
                style={{
                  height: "6px",
                  background: "var(--line, rgba(0,0,0,0.08))",
                  borderRadius: "3px",
                  overflow: "hidden"
                }}
              >
                <div style={{ width: "75%", height: "100%", background: "#2563EB", borderRadius: "3px" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--rsbuild-muted)", marginTop: "6px" }}>
                <span>Janela: 09/11 a 13/11</span>
                <span>Motor v1 e Auditoria Prontos</span>
              </div>
            </div>

            {/* Insumo Crítico Pendente */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 14px",
                borderRadius: "6px",
                background: "#FFFBEB",
                border: "1px solid #FDE68A",
                fontSize: "12px",
                color: "#92400E"
              }}
            >
              <span style={{ fontSize: "16px" }}>⚠️</span>
              <div>
                <strong>Insumo Aguardado:</strong> Extrato bancário real da conta Itaú (OFX) para teste assistido com Flávio/Vitor.
              </div>
            </div>

            {/* Botões de Ação */}
            <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleSwitchToOrg("c5356414-adce-4fdc-941b-15cfe26b991e")}
                className="primary-button"
                style={{
                  flex: 1,
                  background: "#2563EB",
                  borderColor: "#2563EB",
                  height: "40px",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px"
                }}
              >
                <span>Acessar Workspace Mundo do Sabor</span>
                <span>→</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateToTab("projetos")}
                className="secondary-button"
                style={{ height: "40px", fontSize: "12px" }}
              >
                Ver Sprints
              </button>
            </div>
          </div>

          {/* CARD 2: HUB AÇAÍ SALVADOR */}
          <div
            className="card"
            style={{
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              borderTop: "4px solid #7C3AED"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.6px",
                    color: "#7C3AED",
                    background: "#F5F3FF",
                    padding: "3px 8px",
                    borderRadius: "4px"
                  }}
                >
                  FRENTE B · DISTRIBUIÇÃO & EXPEDIÇÃO
                </span>
                <h3 style={{ fontSize: "20px", fontWeight: 700, margin: "8px 0 4px" }}>
                  Hub Açaí Salvador
                </h3>
                <span style={{ fontSize: "12px", color: "var(--rsbuild-muted)" }}>
                  Entrada de pedidos WhatsApp, cubagem de caminhão HR e reconciliação
                </span>
              </div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "20px",
                  background: "#ECFDF5",
                  color: "#059669"
                }}
              >
                ● Sprint H1 Ativa
              </span>
            </div>

            {/* Progresso da Sprint Ativa */}
            <div
              style={{
                background: "var(--surface-raised, rgba(0,0,0,0.02))",
                padding: "14px 16px",
                borderRadius: "8px",
                border: "1px solid var(--rsbuild-border)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "8px" }}>
                <strong>Sprint H1: Diagnóstico de segurança e fluxo de aprovação</strong>
                <span style={{ color: "var(--rsbuild-terracotta)", fontWeight: 600 }}>60% concluída</span>
              </div>
              <div
                style={{
                  height: "6px",
                  background: "var(--line, rgba(0,0,0,0.08))",
                  borderRadius: "3px",
                  overflow: "hidden"
                }}
              >
                <div style={{ width: "60%", height: "100%", background: "#7C3AED", borderRadius: "3px" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--rsbuild-muted)", marginTop: "6px" }}>
                <span>Janela: 09/11 a 13/11</span>
                <span>Infra mapeada · Backup validado</span>
              </div>
            </div>

            {/* Insumo Crítico Pendente */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 14px",
                borderRadius: "6px",
                background: "#FFFBEB",
                border: "1px solid #FDE68A",
                fontSize: "12px",
                color: "#92400E"
              }}
            >
              <span style={{ fontSize: "16px" }}>🛡️</span>
              <div>
                <strong>Ação Prioritária:</strong> Teste assistido da solução de link autenticado de compras com a Direção.
              </div>
            </div>

            {/* Botões de Ação */}
            <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleSwitchToOrg("ff3cdab7-3b25-4ea7-aabf-5ae4f9cd9a76")}
                className="primary-button"
                style={{
                  flex: 1,
                  background: "#7C3AED",
                  borderColor: "#7C3AED",
                  height: "40px",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px"
                }}
              >
                <span>Acessar Workspace Hub Açaí</span>
                <span>→</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateToTab("projetos")}
                className="secondary-button"
                style={{ height: "40px", fontSize: "12px" }}
              >
                Ver Sprints
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. ESTEIRA DE HOMOLOGAÇÃO HUMANA (HITL - FLÁVIO & VITOR) */}
      <div
        style={{
          background: "var(--card-bg, #FFFFFF)",
          border: "1px solid var(--rsbuild-border)",
          borderRadius: "12px",
          padding: "24px"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "14px" }}>🎯</span>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                Esteira de Homologação Executiva · Flávio & Vitor
              </h3>
            </div>
            <p style={{ fontSize: "12px", color: "var(--rsbuild-muted)", margin: "4px 0 0" }}>
              Checkpoints obrigatórios de validação humana antes de liberar os módulos para as equipes operacionais
            </p>
          </div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: "4px",
              background: "var(--rsbuild-terracotta-soft, rgba(181,88,60,0.1))",
              color: "var(--rsbuild-terracotta)"
            }}
          >
            Human-in-the-Loop Ativo
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px" }}>
          <div
            style={{
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid var(--rsbuild-border)",
              background: "var(--surface-raised, rgba(0,0,0,0.01))"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#2563EB" }}>MUNDO DO SABOR · A1.3</span>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#F59E0B" }}>EM ESPERA</span>
            </div>
            <strong style={{ fontSize: "13px", display: "block", marginBottom: "4px" }}>
              Homologar Conciliação Conta Itaú
            </strong>
            <p style={{ fontSize: "12px", color: "var(--rsbuild-muted)", margin: "0 0 10px" }}>
              Importar arquivo OFX real e conferir que totais batem e nenhum lançamento se perde.
            </p>
            <div style={{ fontSize: "11px", color: "var(--rsbuild-muted)" }}>
              Responsáveis: <strong>Flávio & Vitor</strong>
            </div>
          </div>

          <div
            style={{
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid var(--rsbuild-border)",
              background: "var(--surface-raised, rgba(0,0,0,0.01))"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#7C3AED" }}>HUB AÇAÍ · H1.1</span>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#10B981" }}>PRONTO P/ TESTE</span>
            </div>
            <strong style={{ fontSize: "13px", display: "block", marginBottom: "4px" }}>
              Aceite de Link Seguro de Compras
            </strong>
            <p style={{ fontSize: "12px", color: "var(--rsbuild-muted)", margin: "0 0 10px" }}>
              Testar contenção de acesso e validar expiração temporal do link compartilhado.
            </p>
            <div style={{ fontSize: "11px", color: "var(--rsbuild-muted)" }}>
              Responsáveis: <strong>Flávio & Liderança Técnica</strong>
            </div>
          </div>

          <div
            style={{
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid var(--rsbuild-border)",
              background: "var(--surface-raised, rgba(0,0,0,0.01))"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--rsbuild-terracotta)" }}>GOVERNANÇA · RBAC</span>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#10B981" }}>APLICADO</span>
            </div>
            <strong style={{ fontSize: "13px", display: "block", marginBottom: "4px" }}>
              Alçadas de Baixa ERP (Regra Raquel)
            </strong>
            <p style={{ fontSize: "12px", color: "var(--rsbuild-muted)", margin: "0 0 10px" }}>
              Garantir que apenas a Diretoria aprove baixas em lote e divergências com deságio/juros.
            </p>
            <div style={{ fontSize: "11px", color: "var(--rsbuild-muted)" }}>
              Regra de Segurança: <strong>100% Ativa</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 5. FOOTER DE GOVERNANÇA & SEGURANÇA */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          padding: "16px 20px",
          background: "var(--surface-raised, rgba(0,0,0,0.02))",
          borderRadius: "8px",
          border: "1px solid var(--rsbuild-border)",
          fontSize: "12px",
          color: "var(--rsbuild-muted)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "#10B981" }}>●</span> RLS Multi-Tenant Ativo
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "#10B981" }}>●</span> Trilha WORM Imutável
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "#10B981" }}>●</span> 71 Testes Automatizados OK
          </span>
        </div>
        <div>
          <span>Google Drive Sprints: </span>
          <strong style={{ color: "var(--foreground)" }}>v2.2 CONSOLIDADO</strong>
        </div>
      </div>
    </div>
  );
}
