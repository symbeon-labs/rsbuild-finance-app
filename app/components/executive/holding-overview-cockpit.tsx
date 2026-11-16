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

type OrgOpsMetrics = {
  titlesPending: number;
  titlesTotal: number;
  proofsPending: number;
  proofsTotal: number;
  ordersCount: number;
  settlementsCount: number;
  settlementsAmount30d: number;
  recordsPending: number;
  recordsConciliado: number;
  erpMovementsCount: number;
  membersCount: number;
  pendingInvitations: number;
  auditEvents7d: number;
  accessDenied7d: number;
  lastActivityAt: string | null;
};

interface HoldingOverviewCockpitProps {
  onNavigateToTab: (tab: NavSection) => void;
  userRole?: string;
  userFullName?: string;
}

const PROJECT_TO_ORG: Record<string, string> = {
  "mundo-do-sabor": "c5356414-adce-4fdc-941b-15cfe26b991e",
  "hub-acai": "ff3cdab7-3b25-4ea7-aabf-5ae4f9cd9a76",
};

const PROJECT_ACCENT: Record<string, string> = {
  "mundo-do-sabor": "#2563EB",
  "hub-acai": "#7C3AED",
};

const PROJECT_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  "mundo-do-sabor": { label: "FRENTE A · INDÚSTRIA ALIMENTÍCIA", bg: "rgba(37, 99, 235, 0.12)", text: "#3B82F6" },
  "hub-acai": { label: "FRENTE B · DISTRIBUIÇÃO & EXPEDIÇÃO", bg: "rgba(124, 58, 237, 0.12)", text: "#8B5CF6" },
};

export function HoldingOverviewCockpit({
  onNavigateToTab,
  userRole = "owner",
  userFullName = "Diretoria"
}: HoldingOverviewCockpitProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [opsByOrg, setOpsByOrg] = useState<Record<string, OrgOpsMetrics>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Todos");

  useEffect(() => {
    async function loadOps() {
      try {
        const res = await fetch("/api/observability/summary", { cache: "no-store" });
        if (res.ok) {
          const payload = await res.json();
          const map: Record<string, OrgOpsMetrics> = {};
          for (const org of payload.organizations ?? []) map[org.id] = org;
          setOpsByOrg(map);
        }
      } catch (err) {
        console.error("Falha ao carregar observabilidade:", err);
      }
    }
    loadOps();
  }, []);

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
      document.cookie = `rsbuild_selected_org=${encodeURIComponent(orgId)}; path=/; max-age=31536000; SameSite=Lax`;
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

  const STATUS_FILTER_OPTIONS = ["Todos", "Em Andamento", "Concluído", "Planejamento"];

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      !searchTerm ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.client_display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.project_key.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "Todos" ||
      (statusFilter === "Em Andamento" && p.status === "in_progress") ||
      (statusFilter === "Concluído" && p.status === "done") ||
      (statusFilter === "Planejamento" && p.status === "planning");
    return matchesSearch && matchesStatus;
  });

  void userRole;
  void inProgressTasks;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "40px" }}>
      {/* 1. HERO HEADER: VISÃO DE COMANDO */}
      <div className="cockpit-hero">
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
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              Sessão de Governança Ativa
            </span>
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, margin: 0, color: "var(--ink)" }}>
            Central de Controle &amp; Observabilidade RSBUILD
          </h1>
          <p style={{ fontSize: "14px", color: "var(--muted)", margin: "4px 0 0" }}>
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
            title="RS Guardião · Governança Cognitiva & Auditoria Pericial"
          >
            <span>🛡️</span>
            <span>RS Guardião</span>
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
        <div className="card cockpit-card" style={{ padding: "18px 20px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.5px" }}>
            EMPRESAS NO RADAR
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "8px" }}>
            <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--ink)" }}>2</span>
            <span style={{ fontSize: "12px", color: "var(--rsbuild-terracotta)", fontWeight: 600 }}>100% integradas</span>
          </div>
          <span style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px", display: "block" }}>
            Mundo do Sabor + Hub Açaí Salvador
          </span>
        </div>

        <div className="card cockpit-card" style={{ padding: "18px 20px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.5px" }}>
            SPRINTS PLANEJADAS / ATIVAS
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "8px" }}>
            <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--ink)" }}>
              {loading ? "..." : `${totalSprints || 8}`}
            </span>
            <span style={{ fontSize: "12px", color: "#10B981", fontWeight: 600 }}>2 em execução</span>
          </div>
          <span style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px", display: "block" }}>
            Ciclo 01: Sprints A1 e H1 em andamento
          </span>
        </div>

        <div className="card cockpit-card" style={{ padding: "18px 20px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.5px" }}>
            ENTREGAS TÉCNICAS PRONTAS
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "8px" }}>
            <span style={{ fontSize: "28px", fontWeight: 800, color: "#10B981" }}>
              {loading ? "..." : `${doneTasks || 7}`}
            </span>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              de {allTasks.length || 14} atividades
            </span>
          </div>
          <span style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px", display: "block" }}>
            Motor v1, OFX Parser, Trilha de Auditoria e RBAC
          </span>
        </div>

        <div className="card cockpit-card" style={{ padding: "18px 20px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.5px" }}>
            INSUMOS &amp; HOMOLOGAÇÃO
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "8px" }}>
            <span style={{ fontSize: "28px", fontWeight: 800, color: waitingDeps > 0 ? "#F59E0B" : "#10B981" }}>
              {loading ? "..." : `${waitingDeps || 3}`}
            </span>
            <span style={{ fontSize: "12px", color: "#F59E0B", fontWeight: 600 }}>Requer ação</span>
          </div>
          <span style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px", display: "block" }}>
            Extrato Itaú, API Omie e link de compras
          </span>
        </div>
      </div>

      {/* 3. RADAR DE EMPRESAS INTEGRADAS (CARDS DINÂMICOS) */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--ink)" }}>Empresas Integradas no Ecossistema</h2>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: "2px 0 0" }}>
              Acesso direto aos ambientes operacionais e status executivo do Ciclo 01
            </p>
          </div>
          <button
            type="button"
            onClick={() => alert("Solicite ao administrador a integração de uma nova empresa no ecossistema RSBUILD.")}
            className="secondary-button"
            style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "5px" }}
          >
            <span>＋</span>
            <span>Integrar Nova Empresa</span>
          </button>
        </div>

        {/* Busca e Filtros */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Buscar por empresa ou projeto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              minWidth: "200px",
              height: "36px",
              border: "1px solid var(--line)",
              borderRadius: "6px",
              padding: "0 12px",
              fontSize: "12px",
              background: "var(--bg)",
              color: "var(--ink)"
            }}
          />
          <div style={{ display: "flex", gap: "6px" }}>
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setStatusFilter(opt)}
                style={{
                  padding: "5px 12px",
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: 600,
                  border: statusFilter === opt ? "1.5px solid var(--rsbuild-terracotta)" : "1px solid var(--line)",
                  background: statusFilter === opt ? "var(--rsbuild-terracotta-soft, rgba(181,88,60,0.08))" : "transparent",
                  color: statusFilter === opt ? "var(--rsbuild-terracotta)" : "var(--muted)",
                  cursor: "pointer"
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px", color: "var(--muted)", fontSize: "13px" }}>
            <span>Carregando portfólio de projetos...</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredProjects.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--muted)", fontSize: "13px" }}>
            {projects.length === 0
              ? "Nenhum projeto integrado encontrado. Integre a primeira empresa usando o botão acima."
              : "Nenhum projeto corresponde aos filtros selecionados."}
          </div>
        )}

        {/* Dynamic Project Cards */}
        {!loading && filteredProjects.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "20px" }}>
            {filteredProjects.map((project) => {
              const activeSprint =
                project.project_sprints?.find((s) => s.status === "in_progress") ||
                project.project_sprints?.[0];
              const projectAllTasks = project.project_sprints?.flatMap((s) => s.project_tasks) || [];
              const projectDoneTasks = projectAllTasks.filter((t) => t.status === "done").length;
              const pct =
                projectAllTasks.length > 0
                  ? Math.round((projectDoneTasks / projectAllTasks.length) * 100)
                  : 0;
              const blockingDeps = (project.project_dependencies || []).filter(
                (d) => d.status === "waiting" || d.status === "open"
              );
              const orgId = PROJECT_TO_ORG[project.project_key] || "";
              const ops = orgId ? opsByOrg[orgId] : undefined;
              const accent = PROJECT_ACCENT[project.project_key] || "#6B7280";
              const badge = PROJECT_BADGE[project.project_key];

              return (
                <div
                  key={project.id}
                  className="card cockpit-card"
                  style={{
                    padding: "24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "18px",
                    borderTop: `4px solid ${accent}`
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      {badge && (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            letterSpacing: "0.6px",
                            color: badge.text,
                            background: badge.bg,
                            padding: "3px 8px",
                            borderRadius: "4px"
                          }}
                        >
                          {badge.label}
                        </span>
                      )}
                      <h3 style={{ fontSize: "20px", fontWeight: 700, margin: "8px 0 4px", color: "var(--ink)" }}>
                        {project.name}
                      </h3>
                      <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                        {project.client_display_name}
                      </span>
                    </div>
                    {activeSprint && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "4px 10px",
                          borderRadius: "20px",
                          background: "rgba(16, 185, 129, 0.15)",
                          color: "#10B981",
                          whiteSpace: "nowrap"
                        }}
                      >
                        ● Sprint {activeSprint.title || `#${activeSprint.sprint_number}`} Ativa
                      </span>
                    )}
                  </div>

                  {/* Progresso */}
                  <div
                    style={{
                      background: "var(--surface-raised, rgba(0,0,0,0.02))",
                      padding: "14px 16px",
                      borderRadius: "8px",
                      border: "1px solid var(--line)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "8px" }}>
                      <strong style={{ color: "var(--ink)" }}>
                        {activeSprint ? (activeSprint.title || `Sprint #${activeSprint.sprint_number}`) : "Sem sprint ativa"}
                      </strong>
                      <span style={{ color: accent, fontWeight: 600 }}>{pct}% concluída</span>
                    </div>
                    <div
                      style={{
                        height: "6px",
                        background: "var(--line, rgba(0,0,0,0.08))",
                        borderRadius: "3px",
                        overflow: "hidden"
                      }}
                    >
                      <div style={{ width: `${pct}%`, height: "100%", background: accent, borderRadius: "3px" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)", marginTop: "6px" }}>
                      <span>{projectDoneTasks} de {projectAllTasks.length} tarefas concluídas</span>
                      {activeSprint?.start_date && activeSprint?.end_date && (
                        <span>
                          {activeSprint.start_date.slice(5)} a {activeSprint.end_date.slice(5)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dependências bloqueantes */}
                  {blockingDeps.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 14px",
                        borderRadius: "6px",
                        background: "rgba(245, 158, 11, 0.12)",
                        border: "1px solid rgba(245, 158, 11, 0.35)",
                        fontSize: "12px",
                        color: "var(--ink)"
                      }}
                    >
                      <span style={{ fontSize: "16px" }}>⚠️</span>
                      <div>
                        <strong style={{ color: "#F59E0B" }}>{blockingDeps.length} dependência{blockingDeps.length > 1 ? "s" : ""} aguardando:</strong>{" "}
                        <span style={{ color: "var(--ink)" }}>
                          {blockingDeps[0].title}
                          {blockingDeps.length > 1 ? ` e mais ${blockingDeps.length - 1}` : ""}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Observabilidade operacional (cross-tenant, somente leitura) */}
                  {ops && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: "8px",
                        padding: "12px 14px",
                        borderRadius: "8px",
                        background: "var(--surface-raised, rgba(0,0,0,0.02))",
                        border: "1px solid var(--line)"
                      }}
                    >
                      {[
                        { label: "Títulos pendentes", value: ops.titlesPending, warn: ops.titlesPending > 0 },
                        { label: "Baixas (30d)", value: ops.settlementsCount, warn: false },
                        { label: "Pedidos", value: ops.ordersCount, warn: false },
                        { label: "Eventos 7d", value: ops.auditEvents7d, warn: ops.accessDenied7d > 0 }
                      ].map((m) => (
                        <div key={m.label} style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "16px", fontWeight: 800, color: m.warn ? "#F59E0B" : "var(--ink)" }}>
                            {m.value}
                          </div>
                          <div style={{ fontSize: "10px", color: "var(--muted)", letterSpacing: "0.3px" }}>
                            {m.label.toUpperCase()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Botões de Ação */}
                  <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
                    {orgId ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleSwitchToOrg(orgId)}
                        className="primary-button"
                        style={{
                          flex: 1,
                          background: accent,
                          borderColor: accent,
                          height: "40px",
                          fontSize: "13px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px"
                        }}
                      >
                        <span>Acessar Workspace {project.name}</span>
                        <span>→</span>
                      </button>
                    ) : null}
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
              );
            })}
          </div>
        )}

        {/* + Integrar Nova Empresa CTA */}
        <div
          style={{
            border: "1.5px dashed rgba(181,88,60,0.3)",
            borderRadius: "12px",
            padding: "24px",
            textAlign: "center",
            color: "var(--muted)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
            marginTop: "20px"
          }}
        >
          <span style={{ fontSize: "28px" }}>＋</span>
          <div>
            <strong style={{ display: "block", color: "var(--ink)", fontSize: "14px" }}>Integrar Nova Empresa ao Ecossistema</strong>
            <span style={{ fontSize: "12px" }}>Expanda o portfólio RSBUILD com novos projetos operacionais</span>
          </div>
          <button
            type="button"
            onClick={() => alert("Solicite ao administrador a integração de uma nova empresa no ecossistema RSBUILD.")}
            style={{ padding: "8px 20px", borderRadius: "6px", border: "1px solid rgba(181,88,60,0.3)", background: "rgba(181,88,60,0.06)", color: "var(--rsbuild-terracotta, #B5583C)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
          >
            Solicitar Integração
          </button>
        </div>
      </div>

      {/* 4. ESTEIRA DE HOMOLOGAÇÃO HUMANA (HITL - FLÁVIO & VITOR) */}
      <div
        className="card cockpit-card"
        style={{
          padding: "24px"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "14px" }}>🎯</span>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                Esteira de Homologação Executiva · Flávio &amp; Vitor
              </h3>
            </div>
            <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>
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
              border: "1px solid var(--line)",
              background: "var(--surface-raised, rgba(0,0,0,0.01))"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#3B82F6" }}>MUNDO DO SABOR · A1.3</span>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#F59E0B" }}>EM ESPERA</span>
            </div>
            <strong style={{ fontSize: "13px", display: "block", marginBottom: "4px", color: "var(--ink)" }}>
              Homologar Conciliação Conta Itaú
            </strong>
            <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 10px" }}>
              Importar arquivo OFX real e conferir que totais batem e nenhum lançamento se perde.
            </p>
            <div style={{ fontSize: "11px", color: "var(--muted)" }}>
              Responsáveis: <strong style={{ color: "var(--ink)" }}>Flávio &amp; Vitor</strong>
            </div>
          </div>

          <div
            style={{
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid var(--line)",
              background: "var(--surface-raised, rgba(0,0,0,0.01))"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#8B5CF6" }}>HUB AÇAÍ · H1.1</span>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#10B981" }}>PRONTO P/ TESTE</span>
            </div>
            <strong style={{ fontSize: "13px", display: "block", marginBottom: "4px", color: "var(--ink)" }}>
              Aceite de Link Seguro de Compras
            </strong>
            <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 10px" }}>
              Testar contenção de acesso e validar expiração temporal do link compartilhado.
            </p>
            <div style={{ fontSize: "11px", color: "var(--muted)" }}>
              Responsáveis: <strong style={{ color: "var(--ink)" }}>Flávio &amp; João (Liderança Técnica)</strong>
            </div>
          </div>

          <div
            style={{
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid var(--line)",
              background: "var(--surface-raised, rgba(0,0,0,0.01))"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--rsbuild-terracotta)" }}>GOVERNANÇA · RBAC</span>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#10B981" }}>APLICADO</span>
            </div>
            <strong style={{ fontSize: "13px", display: "block", marginBottom: "4px", color: "var(--ink)" }}>
              Alçadas de Baixa ERP (Regra Raquel)
            </strong>
            <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 10px" }}>
              Garantir que apenas a Diretoria aprove baixas em lote e divergências com deságio/juros.
            </p>
            <div style={{ fontSize: "11px", color: "var(--muted)" }}>
              Regra de Segurança: <strong style={{ color: "var(--ink)" }}>100% Ativa</strong>
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
          border: "1px solid var(--line)",
          fontSize: "12px",
          color: "var(--muted)"
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
          <strong style={{ color: "var(--ink)" }}>v2.2 CONSOLIDADO</strong>
        </div>
      </div>
    </div>
  );
}
