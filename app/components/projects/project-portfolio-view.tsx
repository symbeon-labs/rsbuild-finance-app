"use client";

import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { formatDatePtBr } from "@/lib/date-format";

type ProjectTask = {
  id: string;
  title: string;
  description: string;
  acceptance_criteria: string;
  responsible_label: string;
  status: string;
  priority: string;
  due_date: string | null;
};

type ProjectSprint = {
  id: string;
  sprint_number: number;
  title: string;
  objective: string;
  completion_criteria: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  project_tasks: ProjectTask[];
  project_deliverables: {
    id: string;
    title: string;
    description: string;
    acceptance_criteria: string;
    version_label: string;
    status: string;
    resource_url: string | null;
  }[];
};

type ProjectDependency = {
  id: string;
  title: string;
  description: string;
  dependency_type: string;
  status: string;
  responsible_label: string;
  due_date: string | null;
  evidence_url: string | null;
};

type Project = {
  id: string;
  project_key: string;
  name: string;
  client_display_name: string;
  description: string;
  status: string;
  start_date: string | null;
  target_date: string | null;
  project_sprints: ProjectSprint[];
  project_dependencies: ProjectDependency[];
};

const dependencyTypeLabels: Record<string, string> = {
  client_input: "Insumo do cliente",
  access: "Acesso / credencial",
  decision: "Decisão / aprovação",
  external_service: "Fornecedor externo",
  technical: "Dependência técnica",
  other: "Outra"
};

const statusLabels: Record<string, string> = {
  planning: "Planejamento",
  active: "Em andamento",
  blocked: "Bloqueado",
  completed: "Concluído",
  archived: "Arquivado",
  planned: "Planejada",
  cancelled: "Cancelada",
  todo: "A fazer",
  in_progress: "Em andamento",
  review: "Em revisão",
  done: "Concluída",
  open: "Em aberto",
  waiting: "Aguardando",
  received: "Recebida",
  waived: "Dispensada",
  draft: "Rascunho",
  submitted: "Submetido",
  accepted: "Aceito",
  changes_requested: "Ajustes solicitados"
};

const priorityBadges: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: "Crítica", color: "#DC2626", bg: "#FEE2E2" },
  high: { label: "Alta", color: "#D97706", bg: "#FEF3C7" },
  normal: { label: "Normal", color: "#2563EB", bg: "#EFF6FF" },
  low: { label: "Baixa", color: "#6B7280", bg: "#F3F4F6" }
};

export function ProjectPortfolioView({ canManage }: { canManage: boolean }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"pipeline" | "list">("pipeline");

  // Formulários de Gestão
  const [creatingSprintFor, setCreatingSprintFor] = useState<string | null>(null);
  const [sprintTitle, setSprintTitle] = useState("");
  const [sprintObjective, setSprintObjective] = useState("");
  const [sprintCompletionCriteria, setSprintCompletionCriteria] = useState("");
  const [sprintStart, setSprintStart] = useState("");
  const [sprintEnd, setSprintEnd] = useState("");
  const [savingSprint, setSavingSprint] = useState(false);

  const [creatingTaskFor, setCreatingTaskFor] = useState<{ projectId: string; sprintId: string } | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAcceptanceCriteria, setTaskAcceptanceCriteria] = useState("");
  const [taskResponsibleLabel, setTaskResponsibleLabel] = useState("");
  const [taskPriority, setTaskPriority] = useState("normal");
  const [savingTask, setSavingTask] = useState(false);

  const [showDependencyForm, setShowDependencyForm] = useState(false);
  const [dependencyTitle, setDependencyTitle] = useState("");
  const [dependencyDescription, setDependencyDescription] = useState("");
  const [dependencyType, setDependencyType] = useState("client_input");
  const [dependencyResponsible, setDependencyResponsible] = useState("");
  const [dependencyDueDate, setDependencyDueDate] = useState("");
  const [savingDependency, setSavingDependency] = useState(false);

  const [creatingDeliverableFor, setCreatingDeliverableFor] = useState<{ projectId: string; sprintId: string } | null>(null);
  const [deliverableTitle, setDeliverableTitle] = useState("");
  const [deliverableDescription, setDeliverableDescription] = useState("");
  const [deliverableAcceptance, setDeliverableAcceptance] = useState("");
  const [deliverableVersion, setDeliverableVersion] = useState("");
  const [deliverableUrl, setDeliverableUrl] = useState("");
  const [savingDeliverable, setSavingDeliverable] = useState(false);

  const [statusUpdatingFor, setStatusUpdatingFor] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/projects", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível carregar os projetos.");
      setProjects(Array.isArray(payload.projects) ? payload.projects : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar o portfólio.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  // Seleciona a sprint ativa por padrão ao trocar de projeto
  useEffect(() => {
    if (selectedProject && selectedProject.project_sprints.length > 0) {
      const activeSprint = selectedProject.project_sprints.find((s) => s.status === "active");
      setSelectedSprintId((prev) => {
        if (prev && selectedProject.project_sprints.some((s) => s.id === prev)) return prev;
        return activeSprint ? activeSprint.id : selectedProject.project_sprints[0].id;
      });
    } else {
      setSelectedSprintId(null);
    }
  }, [selectedProject]);

  const selectedSprint = useMemo(() => {
    if (!selectedProject) return null;
    return selectedProject.project_sprints.find((s) => s.id === selectedSprintId) ?? selectedProject.project_sprints[0] ?? null;
  }, [selectedProject, selectedSprintId]);

  async function handleCreateSprint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!creatingSprintFor || !sprintTitle.trim()) return;
    const project = projects.find((item) => item.id === creatingSprintFor);
    if (!project) return;
    setSavingSprint(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${project.id}/sprints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: sprintTitle,
          objective: sprintObjective,
          completionCriteria: sprintCompletionCriteria,
          sprintNumber: Math.max(0, ...project.project_sprints.map((sprint) => sprint.sprint_number)) + 1,
          startDate: sprintStart || null,
          endDate: sprintEnd || null
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível criar a sprint.");
      setSprintTitle("");
      setSprintObjective("");
      setSprintCompletionCriteria("");
      setSprintStart("");
      setSprintEnd("");
      setCreatingSprintFor(null);
      await loadProjects();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao criar sprint.");
    } finally {
      setSavingSprint(false);
    }
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!creatingTaskFor || !taskTitle.trim()) return;
    setSavingTask(true);
    setError("");
    try {
      const response = await fetch(
        `/api/projects/${creatingTaskFor.projectId}/sprints/${creatingTaskFor.sprintId}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: taskTitle,
            description: taskDescription,
            acceptanceCriteria: taskAcceptanceCriteria,
            responsibleLabel: taskResponsibleLabel,
            priority: taskPriority
          })
        }
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível criar a atividade.");
      setTaskTitle("");
      setTaskDescription("");
      setTaskAcceptanceCriteria("");
      setTaskResponsibleLabel("");
      setTaskPriority("normal");
      setCreatingTaskFor(null);
      await loadProjects();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao criar atividade.");
    } finally {
      setSavingTask(false);
    }
  }

  async function updateSprintStatus(projectId: string, sprintId: string, status: string) {
    setStatusUpdatingFor(sprintId);
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/sprints`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sprintId, status })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível atualizar a sprint.");
      await loadProjects();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao atualizar sprint.");
    } finally {
      setStatusUpdatingFor(null);
    }
  }

  async function updateDependencyStatus(projectId: string, dependencyId: string, status: string) {
    setStatusUpdatingFor(dependencyId);
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/dependencies`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependencyId, status })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível atualizar o insumo/dependência.");
      await loadProjects();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao atualizar dependência.");
    } finally {
      setStatusUpdatingFor(null);
    }
  }

  async function updateTaskStatus(projectId: string, sprintId: string, taskId: string, status: string) {
    setStatusUpdatingFor(taskId);
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/sprints/${sprintId}/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível atualizar a atividade.");
      await loadProjects();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao atualizar atividade.");
    } finally {
      setStatusUpdatingFor(null);
    }
  }

  async function handleCreateDeliverable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!creatingDeliverableFor || !deliverableTitle.trim()) return;
    setSavingDeliverable(true);
    setError("");
    try {
      const response = await fetch(
        `/api/projects/${creatingDeliverableFor.projectId}/sprints/${creatingDeliverableFor.sprintId}/deliverables`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: deliverableTitle,
            description: deliverableDescription,
            acceptanceCriteria: deliverableAcceptance,
            versionLabel: deliverableVersion,
            resourceUrl: deliverableUrl || null
          })
        }
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível registrar o entregável.");
      setDeliverableTitle("");
      setDeliverableDescription("");
      setDeliverableAcceptance("");
      setDeliverableVersion("");
      setDeliverableUrl("");
      setCreatingDeliverableFor(null);
      await loadProjects();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao registrar entregável.");
    } finally {
      setSavingDeliverable(false);
    }
  }

  async function handleCreateDependency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject || !dependencyTitle.trim()) return;
    setSavingDependency(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${selectedProject.id}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: dependencyTitle,
          description: dependencyDescription,
          dependencyType,
          responsibleLabel: dependencyResponsible,
          dueDate: dependencyDueDate || null
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível registrar a dependência.");
      setDependencyTitle("");
      setDependencyDescription("");
      setDependencyType("client_input");
      setDependencyResponsible("");
      setDependencyDueDate("");
      setShowDependencyForm(false);
      await loadProjects();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao registrar dependência.");
    } finally {
      setSavingDependency(false);
    }
  }

  const totalSprints = projects.reduce((sum, project) => sum + project.project_sprints.length, 0);
  const totalTasks = projects.reduce(
    (sum, project) => sum + project.project_sprints.reduce((sprintSum, sprint) => sprintSum + sprint.project_tasks.length, 0),
    0
  );
  const completedTasks = projects.reduce(
    (sum, project) => sum + project.project_sprints.reduce((sprintSum, sprint) => sprintSum + sprint.project_tasks.filter((task) => task.status === "done").length, 0),
    0
  );
  const completionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <>
      {/* 1. CABEÇALHO DO PORTFÓLIO */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">PORTFÓLIO OPERACIONAL</div>
          <h1>Projetos e Sprints</h1>
          <p>Visão de execução conectada das frentes atendidas pelo ecossistema RSBUILD.</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <div
            style={{
              display: "inline-flex",
              borderRadius: "6px",
              border: "1px solid var(--line)",
              padding: "2px",
              background: "var(--surface-raised, rgba(0,0,0,0.02))"
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode("pipeline")}
              style={{
                border: "none",
                background: viewMode === "pipeline" ? "var(--surface)" : "transparent",
                color: viewMode === "pipeline" ? "var(--rsbuild-terracotta)" : "var(--muted)",
                fontWeight: viewMode === "pipeline" ? 700 : 500,
                fontSize: "12px",
                padding: "6px 12px",
                borderRadius: "4px",
                boxShadow: viewMode === "pipeline" ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
              }}
            >
              ☍ Fluxo de Sprints (Pipeline)
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              style={{
                border: "none",
                background: viewMode === "list" ? "var(--surface)" : "transparent",
                color: viewMode === "list" ? "var(--rsbuild-terracotta)" : "var(--muted)",
                fontWeight: viewMode === "list" ? 700 : 500,
                fontSize: "12px",
                padding: "6px 12px",
                borderRadius: "4px",
                boxShadow: viewMode === "list" ? "0 1px 3px rgba(0,0,0,0.08)" : "none"
              }}
            >
              ☰ Lista Detalhada
            </button>
          </div>
          <button className="secondary-button" type="button" onClick={() => void loadProjects()} disabled={loading}>
            Atualizar portfólio
          </button>
        </div>
      </div>

      {/* 2. MÉTRICAS CONSOLIDADAS */}
      <div className="metric-grid">
        <div className="panel">
          <div className="eyebrow">PROJETOS VISÍVEIS</div>
          <h2>{projects.length}</h2>
          <p className="muted">Conforme suas permissões</p>
        </div>
        <div className="panel">
          <div className="eyebrow">SPRINTS</div>
          <h2>{totalSprints}</h2>
          <p className="muted">Planejadas e em execução</p>
        </div>
        <div className="panel">
          <div className="eyebrow">ATIVIDADES</div>
          <h2>{totalTasks}</h2>
          <p className="muted">Registradas nas sprints</p>
        </div>
        <div className="panel">
          <div className="eyebrow">CONCLUSÃO</div>
          <h2>{totalTasks ? `${completionRate}%` : "—"}</h2>
          <p className="muted">{completedTasks}/{totalTasks} atividades concluídas</p>
        </div>
      </div>

      {error && <div className="notice" role="alert">{error}</div>}

      {loading ? (
        <div className="panel" role="status">Carregando portfólio autorizado...</div>
      ) : projects.length === 0 ? (
        <section className="panel">
          <h2>Nenhum projeto disponível</h2>
          <p>Este workspace ainda não possui projetos associados à sua conta. A RSBUILD administra o portfólio corporativo.</p>
        </section>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* 3. SELETOR DE PROJETO EM ABAS DE ALTO IMPACTO */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              borderBottom: "2px solid var(--line)",
              paddingBottom: "8px",
              overflowX: "auto"
            }}
          >
            {projects.map((project) => {
              const isSelected = selectedProjectId === project.id;
              const isMds = project.project_key === "mundo-do-sabor";
              const brandColor = isMds ? "#2563EB" : "#7C3AED";
              const pTasks = project.project_sprints.flatMap((s) => s.project_tasks);
              const pDone = pTasks.filter((t) => t.status === "done").length;
              const pRate = pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : 0;

              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setSelectedProjectId(project.id)}
                  style={{
                    background: isSelected ? "var(--surface)" : "transparent",
                    border: isSelected ? `2px solid ${brandColor}` : "1px solid var(--line)",
                    borderRadius: "10px",
                    padding: "12px 18px",
                    cursor: "pointer",
                    textAlign: "left",
                    minWidth: "260px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    boxShadow: isSelected ? "0 4px 14px rgba(0,0,0,0.06)" : "none",
                    position: "relative",
                    transition: "all 0.2s ease"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        color: brandColor,
                        background: `${brandColor}15`,
                        padding: "2px 7px",
                        borderRadius: "4px"
                      }}
                    >
                      {project.client_display_name}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: pRate === 100 ? "#10B981" : brandColor }}>
                      {pRate}%
                    </span>
                  </div>
                  <strong style={{ fontSize: "14px", color: "var(--foreground)" }}>{project.name}</strong>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)" }}>
                    <span>{project.project_sprints.length} Sprints</span>
                    <span>{pDone}/{pTasks.length} concluídas</span>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedProject && (
            <>
              {/* 4. VISÃO PIPELINE: BLOCOS CONECTADOS COM LINHAS ANIMADAS */}
              {viewMode === "pipeline" ? (
                <section
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: "14px",
                    padding: "24px 20px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <div>
                      <div className="eyebrow" style={{ color: "var(--rsbuild-terracotta)" }}>
                        {selectedProject.client_display_name} · ESTEIRA DE SPRINTS DO CICLO 01
                      </div>
                      <h2 style={{ fontSize: "20px", margin: "4px 0 0" }}>{selectedProject.name}</h2>
                      <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
                        {selectedProject.description}
                      </p>
                    </div>

                    {canManage && (
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => setCreatingSprintFor(selectedProject.id)}
                      >
                        ＋ Nova sprint
                      </button>
                    )}
                  </div>

                  {canManage && creatingSprintFor === selectedProject.id && (
                    <form className="panel" onSubmit={handleCreateSprint} style={{ display: "grid", gap: 10, margin: "16px 0" }}>
                      <h3>Nova sprint</h3>
                      <input required maxLength={140} value={sprintTitle} onChange={(event) => setSprintTitle(event.target.value)} placeholder="Nome da sprint" />
                      <textarea maxLength={3000} value={sprintObjective} onChange={(event) => setSprintObjective(event.target.value)} placeholder="Objetivo e resultado esperado" rows={3} />
                      <textarea maxLength={3000} value={sprintCompletionCriteria} onChange={(event) => setSprintCompletionCriteria(event.target.value)} placeholder="Critérios de conclusão da sprint" rows={2} />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <label>Início<input type="date" value={sprintStart} onChange={(event) => setSprintStart(event.target.value)} /></label>
                        <label>Fim<input type="date" value={sprintEnd} onChange={(event) => setSprintEnd(event.target.value)} /></label>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="primary-button" type="submit" disabled={savingSprint}>{savingSprint ? "Salvando..." : "Criar sprint"}</button>
                        <button className="secondary-button" type="button" onClick={() => setCreatingSprintFor(null)}>Cancelar</button>
                      </div>
                    </form>
                  )}

                  {/* FLUXO CONECTADO DE BLOCOS DAS SPRINTS */}
                  {selectedProject.project_sprints.length === 0 ? (
                    <div className="table-empty">Nenhuma sprint cadastrada para este projeto.</div>
                  ) : (
                    <>
                      <div className="sprint-pipeline-container">
                        {selectedProject.project_sprints.map((sprint, index) => {
                          const isSelected = sprint.id === selectedSprint?.id;
                          const isSprintActive = sprint.status === "active";
                          const isCompleted = sprint.status === "completed";
                          const isBlocked = sprint.status === "blocked";
                          const nextSprint = selectedProject.project_sprints[index + 1];

                          const sprintStatusClass = isSprintActive
                            ? "sprint-status-active"
                            : isCompleted
                            ? "sprint-status-completed"
                            : isBlocked
                            ? "sprint-status-blocked"
                            : "sprint-status-planned";

                          const sprintTasks = sprint.project_tasks;
                          const sDone = sprintTasks.filter((t) => t.status === "done").length;
                          const sTotal = sprintTasks.length;
                          const sProgress = sTotal > 0 ? Math.round((sDone / sTotal) * 100) : 0;

                          return (
                            <React.Fragment key={sprint.id}>
                              {/* BLOCO DA SPRINT */}
                              <div
                                className={`sprint-node-block ${sprintStatusClass} ${isSprintActive ? "active" : ""} ${isSelected ? "selected" : ""}`}
                                onClick={() => setSelectedSprintId(sprint.id)}
                                role="button"
                                tabIndex={0}
                              >
                                <div>
                                  {/* Topo do Bloco: Número e Badge de Status */}
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                    <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--rsbuild-terracotta)", letterSpacing: "0.5px" }}>
                                      SPRINT {String(sprint.sprint_number).padStart(2, "0")}
                                    </span>
                                    {isSprintActive ? (
                                      <span
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "5px",
                                          fontSize: "10px",
                                          fontWeight: 800,
                                          padding: "2px 8px",
                                          borderRadius: "12px",
                                          background: "var(--rsbuild-terracotta-soft, #FBF2EF)",
                                          color: "var(--rsbuild-terracotta, #B5583C)"
                                        }}
                                      >
                                        <span
                                          style={{
                                            width: 6,
                                            height: 6,
                                            borderRadius: "50%",
                                            background: "var(--rsbuild-terracotta, #B5583C)",
                                            animation: "glowPulse 1.2s infinite"
                                          }}
                                        />
                                        EM EXECUÇÃO
                                      </span>
                                    ) : isCompleted ? (
                                      <span
                                        style={{
                                          fontSize: "10px",
                                          fontWeight: 700,
                                          padding: "2px 8px",
                                          borderRadius: "12px",
                                          background: "rgba(16, 185, 129, 0.12)",
                                          color: "#059669",
                                          border: "1px solid rgba(16, 185, 129, 0.3)"
                                        }}
                                      >
                                        ✓ CONCLUÍDA
                                      </span>
                                    ) : isBlocked ? (
                                      <span
                                        style={{
                                          fontSize: "10px",
                                          fontWeight: 700,
                                          padding: "2px 8px",
                                          borderRadius: "12px",
                                          background: "rgba(245, 158, 11, 0.12)",
                                          color: "#D97706",
                                          border: "1px solid rgba(245, 158, 11, 0.3)"
                                        }}
                                      >
                                        ⚠️ BLOQUEADA
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          fontSize: "10px",
                                          fontWeight: 600,
                                          padding: "2px 8px",
                                          borderRadius: "12px",
                                          background: "rgba(99, 102, 241, 0.08)",
                                          color: "#4F46E5",
                                          border: "1px solid rgba(99, 102, 241, 0.2)"
                                        }}
                                      >
                                        PLANEJADA
                                      </span>
                                    )}
                                  </div>

                                  {/* Datas */}
                                  <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "6px" }}>
                                    {sprint.start_date && sprint.end_date
                                      ? `${formatDatePtBr(sprint.start_date)} → ${formatDatePtBr(sprint.end_date)}`
                                      : "Janela a definir"}
                                  </div>

                                  {/* Título Principal */}
                                  <h4
                                    style={{
                                      fontSize: "13px",
                                      fontWeight: 700,
                                      margin: "0 0 10px",
                                      lineHeight: 1.35,
                                      display: "-webkit-box",
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: "vertical",
                                      overflow: "hidden",
                                      minHeight: "36px"
                                    }}
                                    title={sprint.title}
                                  >
                                    {sprint.title}
                                  </h4>
                                </div>

                                {/* Barra de Progresso do Bloco */}
                                <div>
                                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                                    <span style={{ color: "var(--muted)" }}>{sDone}/{sTotal} tarefas</span>
                                    <span style={{ fontWeight: 700, color: isCompleted ? "#10B981" : isSprintActive ? "var(--rsbuild-terracotta)" : isBlocked ? "#F59E0B" : "var(--muted)" }}>
                                      {sProgress}%
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      height: "5px",
                                      background: "var(--line, rgba(0,0,0,0.08))",
                                      borderRadius: "3px",
                                      overflow: "hidden"
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: `${sProgress}%`,
                                        height: "100%",
                                        background: isCompleted ? "#10B981" : isSprintActive ? "var(--rsbuild-terracotta)" : isBlocked ? "#F59E0B" : "rgba(99, 102, 241, 0.4)",
                                        borderRadius: "3px"
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* LINHA CONECTORA ANIMADA ENTRE BLOCOS */}
                              {nextSprint && (
                                <div className="sprint-connector" title={isSprintActive ? "Fluxo em andamento para a próxima sprint" : "Sequência do cronograma"}>
                                  <svg width="44" height="28" viewBox="0 0 44 28" fill="none" style={{ overflow: "visible" }}>
                                    <defs>
                                      <linearGradient id={`stream-grad-${sprint.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="var(--rsbuild-terracotta, #B5583C)" />
                                        <stop offset="100%" stopColor="#D97706" />
                                      </linearGradient>
                                      <filter id={`glow-${sprint.id}`} x="-20%" y="-20%" width="140%" height="140%">
                                        <feGaussianBlur stdDeviation="1.5" result="blur" />
                                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                      </filter>
                                    </defs>

                                    {/* Linha base neutra */}
                                    <path
                                      d="M 2 14 L 34 14"
                                      stroke={isCompleted ? "#10B981" : isSprintActive ? "rgba(181,88,60,0.3)" : "var(--line, #E5E1D8)"}
                                      strokeWidth={isCompleted ? "2.5" : "2"}
                                      strokeDasharray={isCompleted || isSprintActive ? undefined : "3 3"}
                                    />

                                    {/* Linha com fluxo fluindo animado quando a sprint está ativa */}
                                    {isSprintActive && (
                                      <path
                                        d="M 2 14 L 34 14"
                                        stroke={`url(#stream-grad-${sprint.id})`}
                                        strokeWidth="3.5"
                                        className="sprint-flow-line-active"
                                        filter={`url(#glow-${sprint.id})`}
                                      />
                                    )}

                                    {/* Ponta da Flecha */}
                                    <polygon
                                      points="32,9 42,14 32,19"
                                      fill={isCompleted ? "#10B981" : isSprintActive ? "var(--rsbuild-terracotta, #B5583C)" : "var(--muted, #9CA3AF)"}
                                    />
                                  </svg>
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>

                      {/* 5. PAINEL DE INSPEÇÃO DA SPRINT SELECIONADA */}
                      {selectedSprint && (
                        <div
                          style={{
                            marginTop: "24px",
                            padding: "20px 24px",
                            borderRadius: "12px",
                            border: "1px solid var(--line)",
                            background: "var(--surface-raised, rgba(0,0,0,0.01))"
                          }}
                        >
                          {/* Header da Sprint em Foco */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--rsbuild-terracotta)", background: "var(--rsbuild-terracotta-soft)", padding: "2px 8px", borderRadius: "4px" }}>
                                  SPRINT {String(selectedSprint.sprint_number).padStart(2, "0")} EM FOCO
                                </span>
                                {(selectedSprint.start_date || selectedSprint.end_date) && (
                                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                                    Janela: {formatDatePtBr(selectedSprint.start_date)} até {formatDatePtBr(selectedSprint.end_date)}
                                  </span>
                                )}
                              </div>
                              <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "6px 0 0" }}>
                                {selectedSprint.title}
                              </h3>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              {canManage ? (
                                <select
                                  aria-label={`Status da sprint ${selectedSprint.title}`}
                                  value={selectedSprint.status}
                                  disabled={statusUpdatingFor === selectedSprint.id}
                                  onChange={(event) => void updateSprintStatus(selectedProject.id, selectedSprint.id, event.target.value)}
                                  style={{ height: "36px", padding: "0 10px", fontSize: "12px" }}
                                >
                                  <option value="planned">Planejada</option>
                                  <option value="active">Em andamento</option>
                                  <option value="blocked">Bloqueada</option>
                                  <option value="completed">Concluída</option>
                                  <option value="cancelled">Cancelada</option>
                                </select>
                              ) : (
                                <span className="subtle-tag">{statusLabels[selectedSprint.status] || selectedSprint.status}</span>
                              )}

                              {canManage && (
                                <button
                                  className="secondary-button"
                                  type="button"
                                  onClick={() => setCreatingTaskFor({ projectId: selectedProject.id, sprintId: selectedSprint.id })}
                                  style={{ height: "36px", fontSize: "12px" }}
                                >
                                  ＋ Atividade
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Caixa de Objetivo & Critérios de Conclusão */}
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                              gap: "14px",
                              margin: "16px 0",
                              padding: "14px",
                              background: "var(--surface)",
                              borderRadius: "8px",
                              border: "1px solid var(--line)"
                            }}
                          >
                            <div>
                              <strong style={{ fontSize: "12px", color: "var(--foreground)", display: "block", marginBottom: "4px" }}>
                                🎯 Objetivo da Sprint
                              </strong>
                              <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: 1.4 }}>
                                {selectedSprint.objective || "Objetivo não detalhado."}
                              </p>
                            </div>
                            {selectedSprint.completion_criteria && (
                              <div>
                                <strong style={{ fontSize: "12px", color: "var(--foreground)", display: "block", marginBottom: "4px" }}>
                                  ✓ Critérios de Homologação / Aceite
                                </strong>
                                <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: 1.4 }}>
                                  {selectedSprint.completion_criteria}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Formulário de Criação de Atividade */}
                          {canManage && creatingTaskFor?.sprintId === selectedSprint.id && (
                            <form onSubmit={handleCreateTask} style={{ display: "grid", gap: 10, margin: "14px 0", padding: 14, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8 }}>
                              <h4>Nova atividade para {selectedSprint.title}</h4>
                              <input required maxLength={180} value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Nome da atividade" />
                              <textarea maxLength={3000} value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} placeholder="Descrição / contexto técnico" rows={2} />
                              <textarea maxLength={3000} value={taskAcceptanceCriteria} onChange={(event) => setTaskAcceptanceCriteria(event.target.value)} placeholder="Critérios de conclusão / aceite" rows={2} />
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                <input maxLength={160} value={taskResponsibleLabel} onChange={(event) => setTaskResponsibleLabel(event.target.value)} placeholder="Responsável (ex: Vitor, Financeiro)" />
                                <select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)}>
                                  <option value="low">Baixa prioridade</option>
                                  <option value="normal">Normal</option>
                                  <option value="high">Alta prioridade</option>
                                  <option value="critical">Crítica</option>
                                </select>
                              </div>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button className="primary-button" type="submit" disabled={savingTask}>{savingTask ? "Salvando..." : "Salvar atividade"}</button>
                                <button className="secondary-button" type="button" onClick={() => setCreatingTaskFor(null)}>Cancelar</button>
                              </div>
                            </form>
                          )}

                          {/* Grid de Atividades da Sprint */}
                          <div style={{ marginTop: "14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                              <strong style={{ fontSize: "13px" }}>
                                Atividades ({selectedSprint.project_tasks.length})
                              </strong>
                              <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                                {selectedSprint.project_tasks.filter((t) => t.status === "done").length} concluídas
                              </span>
                            </div>

                            {selectedSprint.project_tasks.length === 0 ? (
                              <div className="table-empty">Nenhuma atividade cadastrada nesta sprint.</div>
                            ) : (
                              <div style={{ display: "grid", gap: "8px" }}>
                                {selectedSprint.project_tasks.map((task) => {
                                  const priorityInfo = priorityBadges[task.priority] || priorityBadges.normal;
                                  const isTaskDone = task.status === "done";

                                  return (
                                    <div
                                      key={task.id}
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                        gap: "10px",
                                        padding: "12px 16px",
                                        borderRadius: "8px",
                                        background: "var(--surface)",
                                        border: "1px solid var(--line)"
                                      }}
                                    >
                                      <div style={{ flex: 1, minWidth: "260px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                          <span
                                            style={{
                                              fontSize: "10px",
                                              fontWeight: 700,
                                              padding: "1px 6px",
                                              borderRadius: "4px",
                                              background: priorityInfo.bg,
                                              color: priorityInfo.color
                                            }}
                                          >
                                            {priorityInfo.label}
                                          </span>
                                          <strong style={{ fontSize: "13px", color: isTaskDone ? "var(--muted)" : "var(--foreground)", textDecoration: isTaskDone ? "line-through" : "none" }}>
                                            {task.title}
                                          </strong>
                                        </div>
                                        {task.acceptance_criteria && (
                                          <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                                            {task.acceptance_criteria}
                                          </div>
                                        )}
                                        {task.responsible_label && (
                                          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                                            Responsável: <strong>{task.responsible_label}</strong>
                                          </div>
                                        )}
                                      </div>

                                      <div>
                                        {canManage ? (
                                          <select
                                            aria-label={`Status da atividade ${task.title}`}
                                            value={task.status}
                                            disabled={statusUpdatingFor === task.id}
                                            onChange={(event) => void updateTaskStatus(selectedProject.id, selectedSprint.id, task.id, event.target.value)}
                                            style={{
                                              fontSize: "12px",
                                              padding: "4px 8px",
                                              borderRadius: "6px",
                                              border: "1px solid var(--line)",
                                              background: isTaskDone ? "#ECFDF5" : "var(--surface)",
                                              color: isTaskDone ? "#059669" : "inherit",
                                              fontWeight: isTaskDone ? 700 : 500
                                            }}
                                          >
                                            <option value="todo">A fazer</option>
                                            <option value="in_progress">Em andamento</option>
                                            <option value="blocked">Bloqueada</option>
                                            <option value="review">Em revisão</option>
                                            <option value="done">Concluída</option>
                                            <option value="cancelled">Cancelada</option>
                                          </select>
                                        ) : (
                                          <span className="subtle-tag">{statusLabels[task.status] || task.status}</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Entregáveis da Sprint */}
                          {selectedSprint.project_deliverables.length > 0 && (
                            <div style={{ marginTop: "16px" }}>
                              <strong style={{ fontSize: "12px" }}>Entregáveis Formalizados</strong>
                              <ul style={{ margin: "6px 0 0", paddingLeft: 18, display: "grid", gap: 5 }}>
                                {selectedSprint.project_deliverables.map((deliv) => (
                                  <li key={deliv.id} style={{ fontSize: "12px" }}>
                                    {deliv.resource_url ? (
                                      <a href={deliv.resource_url} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                                        {deliv.title}
                                      </a>
                                    ) : (
                                      <strong>{deliv.title}</strong>
                                    )}
                                    <span className="muted"> · {statusLabels[deliv.status] || deliv.status}{deliv.version_label ? ` · ${deliv.version_label}` : ""}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </section>
              ) : (
                /* VISÃO EM LISTA COMPACTA (LEGACY COMPATIBILITY) */
                <div style={{ display: "grid", gap: 12 }}>
                  {selectedProject.project_sprints.map((sprint) => (
                    <article key={sprint.id} className="panel" style={{ padding: 16 }}>
                      <div className="panel-heading">
                        <div>
                          <div className="eyebrow">SPRINT {String(sprint.sprint_number).padStart(2, "0")}</div>
                          <h3>{sprint.title}</h3>
                          <p>{sprint.objective}</p>
                        </div>
                        <span className="subtle-tag">{statusLabels[sprint.status] || sprint.status}</span>
                      </div>
                      <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
                        {sprint.project_tasks.map((task) => (
                          <li key={task.id} style={{ fontSize: "12px", marginBottom: "4px" }}>
                            <strong>{task.title}</strong> — {statusLabels[task.status] || task.status} ({task.responsible_label || "Não atribuído"})
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              )}

              {/* 6. DEPENDÊNCIAS E INSUMOS DO PROJETO */}
              <section className="panel" style={{ marginTop: "8px" }}>
                <div className="panel-heading">
                  <div>
                    <h3>Insumos Críticos & Dependências ({selectedProject.project_dependencies.length})</h3>
                    <p>Entradas externas, arquivos bancários e acessos que condicionam a evolução do projeto.</p>
                  </div>
                  {canManage && (
                    <button className="text-button" type="button" onClick={() => setShowDependencyForm((v) => !v)}>
                      ＋ Registrar Insumo
                    </button>
                  )}
                </div>

                {canManage && showDependencyForm && (
                  <form onSubmit={handleCreateDependency} style={{ display: "grid", gap: 8, margin: "12px 0", padding: 14, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8 }}>
                    <input required maxLength={180} value={dependencyTitle} onChange={(event) => setDependencyTitle(event.target.value)} placeholder="Insumo, acesso ou decisão necessária" />
                    <textarea maxLength={3000} value={dependencyDescription} onChange={(event) => setDependencyDescription(event.target.value)} placeholder="Descrição e impacto no cronograma" rows={2} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <select value={dependencyType} onChange={(event) => setDependencyType(event.target.value)}>
                        <option value="client_input">Insumo do cliente</option>
                        <option value="access">Acesso / credencial</option>
                        <option value="decision">Decisão / aprovação</option>
                        <option value="external_service">Fornecedor externo</option>
                        <option value="technical">Dependência técnica</option>
                        <option value="other">Outra</option>
                      </select>
                      <input maxLength={160} value={dependencyResponsible} onChange={(event) => setDependencyResponsible(event.target.value)} placeholder="Responsável" />
                    </div>
                    <label>Prazo necessário<input type="date" value={dependencyDueDate} onChange={(event) => setDependencyDueDate(event.target.value)} /></label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="primary-button" type="submit" disabled={savingDependency}>{savingDependency ? "Salvando..." : "Registrar dependência"}</button>
                      <button className="secondary-button" type="button" onClick={() => setShowDependencyForm(false)}>Cancelar</button>
                    </div>
                  </form>
                )}

                {selectedProject.project_dependencies.length === 0 ? (
                  <div className="table-empty">Nenhuma dependência registrada para este projeto.</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "10px", marginTop: "12px" }}>
                    {selectedProject.project_dependencies.map((dependency) => (
                      <div
                        key={dependency.id}
                        style={{
                          padding: "12px 14px",
                          borderRadius: "8px",
                          border: "1px solid var(--line)",
                          background: "var(--surface)"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                          <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--rsbuild-terracotta)", background: "var(--rsbuild-terracotta-soft)", padding: "1px 6px", borderRadius: "4px" }}>
                            {dependencyTypeLabels[dependency.dependency_type] || dependency.dependency_type}
                          </span>
                          {canManage ? (
                            <select
                              aria-label={`Status do insumo ${dependency.title}`}
                              value={dependency.status}
                              disabled={statusUpdatingFor === dependency.id}
                              onChange={(e) => void updateDependencyStatus(selectedProject.id, dependency.id, e.target.value)}
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                padding: "2px 6px",
                                borderRadius: "6px",
                                height: "24px",
                                border: "1px solid var(--line)",
                                background: dependency.status === "received" ? "rgba(16, 185, 129, 0.15)" : dependency.status === "waiting" ? "rgba(245, 158, 11, 0.15)" : "var(--surface)",
                                color: dependency.status === "received" ? "#059669" : dependency.status === "waiting" ? "#D97706" : "var(--ink)",
                                cursor: "pointer"
                              }}
                            >
                              <option value="waiting">⏳ Aguardando</option>
                              <option value="received">✓ Recebida</option>
                              <option value="blocked">⚠️ Bloqueada</option>
                              <option value="open">Aberto</option>
                              <option value="cancelled">Cancelada</option>
                            </select>
                          ) : (
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: "12px",
                                background: dependency.status === "received" ? "rgba(16, 185, 129, 0.12)" : dependency.status === "waiting" ? "rgba(245, 158, 11, 0.12)" : "var(--surface)",
                                color: dependency.status === "received" ? "#059669" : dependency.status === "waiting" ? "#D97706" : "var(--muted)",
                                border: dependency.status === "received" ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid var(--line)"
                              }}
                            >
                              {dependency.status === "received" ? "✓ Recebida" : (statusLabels[dependency.status] || dependency.status)}
                            </span>
                          )}
                        </div>
                        <strong style={{ fontSize: "13px", display: "block", margin: "4px 0" }}>
                          {dependency.title}
                        </strong>
                        {dependency.description && (
                          <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 6px" }}>
                            {dependency.description}
                          </p>
                        )}
                        <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                          Responsável: <strong>{dependency.responsible_label || "Não atribuído"}</strong>
                        </div>
                        {dependency.due_date && (
                          <div style={{ fontSize: "11px", color: "#D97706", marginTop: "2px" }}>
                            Prazo: {formatDatePtBr(dependency.due_date)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </>
  );
}
