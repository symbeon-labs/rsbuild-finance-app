"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type ProjectTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
};
type ProjectSprint = {
  id: string;
  sprint_number: number;
  title: string;
  objective: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  project_tasks: ProjectTask[];
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
  done: "Concluída"
};

export function ProjectPortfolioView({ canManage }: { canManage: boolean }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [creatingSprintFor, setCreatingSprintFor] = useState<string | null>(null);
  const [sprintTitle, setSprintTitle] = useState("");
  const [sprintObjective, setSprintObjective] = useState("");
  const [sprintStart, setSprintStart] = useState("");
  const [sprintEnd, setSprintEnd] = useState("");
  const [savingSprint, setSavingSprint] = useState(false);
  const [creatingTaskFor, setCreatingTaskFor] = useState<{ projectId: string; sprintId: string } | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriority, setTaskPriority] = useState("normal");
  const [savingTask, setSavingTask] = useState(false);

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

  useEffect(() => { void loadProjects(); }, [loadProjects]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

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
          sprintNumber: Math.max(0, ...project.project_sprints.map((sprint) => sprint.sprint_number)) + 1,
          startDate: sprintStart || null,
          endDate: sprintEnd || null
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível criar a sprint.");
      setSprintTitle("");
      setSprintObjective("");
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
          body: JSON.stringify({ title: taskTitle, description: taskDescription, priority: taskPriority })
        }
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível criar a atividade.");
      setTaskTitle("");
      setTaskDescription("");
      setTaskPriority("normal");
      setCreatingTaskFor(null);
      await loadProjects();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao criar atividade.");
    } finally {
      setSavingTask(false);
    }
  }

  const totalSprints = projects.reduce((sum, project) => sum + project.project_sprints.length, 0);
  const totalTasks = projects.reduce(
    (sum, project) => sum + project.project_sprints.reduce((sprintSum, sprint) => sprintSum + sprint.project_tasks.length, 0),
    0
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PORTFÓLIO OPERACIONAL</div>
          <h1>Projetos e sprints</h1>
          <p>Uma visão de execução dos projetos atendidos, com escopos organizacionais independentes.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => void loadProjects()} disabled={loading}>
          Atualizar portfólio
        </button>
      </div>

      <div className="metric-grid">
        <div className="panel"><div className="eyebrow">PROJETOS VISÍVEIS</div><h2>{projects.length}</h2><p className="muted">Conforme suas permissões</p></div>
        <div className="panel"><div className="eyebrow">SPRINTS</div><h2>{totalSprints}</h2><p className="muted">Planejadas e em execução</p></div>
        <div className="panel"><div className="eyebrow">ATIVIDADES</div><h2>{totalTasks}</h2><p className="muted">Registradas nas sprints</p></div>
      </div>

      {error && <div className="notice" role="alert">{error}</div>}
      {loading ? (
        <div className="panel" role="status">Carregando portfólio autorizado...</div>
      ) : projects.length === 0 ? (
        <section className="panel">
          <h2>Nenhum projeto disponível</h2>
          <p>Este workspace ainda não possui projetos associados à sua conta. A RSBUILD administra o portfólio; empresas clientes visualizam somente projetos liberados explicitamente.</p>
        </section>
      ) : (
        <div className="dashboard-grid">
          <section className="panel">
            <div className="panel-heading"><div><h2>Projetos</h2><p>Portfólio disponível neste workspace</p></div></div>
            <div style={{ display: "grid", gap: 10 }}>
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setSelectedProjectId(project.id)}
                  className="secondary-button"
                  style={{
                    display: "block", textAlign: "left", padding: 14,
                    borderColor: selectedProjectId === project.id ? "var(--rsbuild-terracotta)" : "var(--line)",
                    whiteSpace: "normal"
                  }}
                >
                  <span style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <strong>{project.client_display_name}</strong>
                    <span className="subtle-tag">{statusLabels[project.status] || project.status}</span>
                  </span>
                  <span style={{ display: "block", marginTop: 6 }}>{project.name}</span>
                  <span className="muted" style={{ display: "block", marginTop: 4, fontSize: 12 }}>
                    {project.project_sprints.length} sprint(s) · {project.project_sprints.reduce((sum, sprint) => sum + sprint.project_tasks.length, 0)} atividade(s)
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            {!selectedProject ? (
              <div className="table-empty">Selecione um projeto para consultar suas sprints e atividades.</div>
            ) : (
              <>
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">{selectedProject.client_display_name}</div>
                    <h2>{selectedProject.name}</h2>
                    <p>{selectedProject.description}</p>
                  </div>
                  <span className="subtle-tag">{statusLabels[selectedProject.status] || selectedProject.status}</span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, margin: "16px 0" }}>
                  <strong>Sprints do projeto</strong>
                  {canManage && <button className="primary-button" type="button" onClick={() => setCreatingSprintFor(selectedProject.id)}>＋ Nova sprint</button>}
                </div>

                {canManage && creatingSprintFor === selectedProject.id && (
                  <form className="panel" onSubmit={handleCreateSprint} style={{ display: "grid", gap: 10, marginBottom: 14 }}>
                    <h3>Nova sprint</h3>
                    <input required maxLength={140} value={sprintTitle} onChange={(event) => setSprintTitle(event.target.value)} placeholder="Nome da sprint" />
                    <textarea maxLength={3000} value={sprintObjective} onChange={(event) => setSprintObjective(event.target.value)} placeholder="Objetivo e resultado esperado" rows={3} />
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

                {selectedProject.project_sprints.length === 0 ? (
                  <div className="table-empty">Nenhuma sprint cadastrada. Importe ou cadastre o plano de trabalho aprovado para este projeto.</div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {selectedProject.project_sprints.map((sprint) => (
                      <article key={sprint.id} className="panel" style={{ padding: 14 }}>
                        <div className="panel-heading">
                          <div>
                            <div className="eyebrow">SPRINT {String(sprint.sprint_number).padStart(2, "0")}</div>
                            <h3>{sprint.title}</h3>
                            <p>{sprint.objective}</p>
                          </div>
                          <span className="subtle-tag">{statusLabels[sprint.status] || sprint.status}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 10 }}>
                          <span className="muted" style={{ fontSize: 12 }}>{sprint.project_tasks.length} atividade(s)</span>
                          {canManage && <button className="text-button" type="button" onClick={() => setCreatingTaskFor({ projectId: selectedProject.id, sprintId: sprint.id })}>＋ Atividade</button>}
                        </div>
                        {canManage && creatingTaskFor?.sprintId === sprint.id && (
                          <form onSubmit={handleCreateTask} style={{ display: "grid", gap: 8, marginTop: 10 }}>
                            <input required maxLength={180} value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Nome da atividade" />
                            <textarea maxLength={3000} value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} placeholder="Descrição / contexto" rows={2} />
                            <select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)}>
                              <option value="low">Baixa prioridade</option><option value="normal">Normal</option><option value="high">Alta prioridade</option><option value="critical">Crítica</option>
                            </select>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button className="primary-button" type="submit" disabled={savingTask}>{savingTask ? "Salvando..." : "Adicionar atividade"}</button>
                              <button className="secondary-button" type="button" onClick={() => setCreatingTaskFor(null)}>Cancelar</button>
                            </div>
                          </form>
                        )}
                        {sprint.project_tasks.length > 0 && (
                          <ul style={{ margin: "12px 0 0", paddingLeft: 18, display: "grid", gap: 6 }}>
                            {sprint.project_tasks.map((task) => (
                              <li key={task.id}>
                                <span>{task.title}</span> <span className="muted">· {statusLabels[task.status] || task.status}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
