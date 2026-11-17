"use client";

import { useEffect, useState } from "react";

type SandboxData = {
  organizations: any[];
  memberships: any[];
  financialAccounts: any[];
  financialRecords: any[];
  receivableTitles: any[];
  deliveryProofs: any[];
  auditEvents: any[];
  validationCases: any[];
  validationRuns: any[];
  isSandbox: boolean;
};

type PortfolioTask = { id: string; title: string; acceptance_criteria: string; status: string; priority: string };
type PortfolioSprint = { id: string; sprint_number: number; title: string; objective: string; completion_criteria: string; status: string; project_tasks: PortfolioTask[] };
type PortfolioProject = { id: string; project_key: string; name: string; client_display_name: string; status: string; project_sprints: PortfolioSprint[] };

export function SandboxView() {
  const [data, setData] = useState<SandboxData | null>(null);
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningCase, setRunningCase] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/sandbox", { cache: "no-store" });
        const text = await res.text();
        let json: any = {};
        try {
          json = text ? JSON.parse(text) : {};
        } catch {
          throw new Error(`Resposta inválida (HTTP ${res.status})`);
        }
        if (!res.ok) {
          throw new Error(json.error || json.message || `Erro ${res.status}`);
        }
        setData(json);
        const portfolioResponse = await fetch("/api/projects", { cache: "no-store" });
        const portfolioPayload = await portfolioResponse.json();
        if (portfolioResponse.ok) setProjects(Array.isArray(portfolioPayload.projects) ? portfolioPayload.projects : []);
        else setPortfolioError("Portfólio de sprints indisponível para esta sessão.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao carregar sandbox.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function runCase(caseCode: string) {
    setRunningCase(caseCode);
    setValidationMessage(null);
    try {
      const response = await fetch("/api/sandbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseCode }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Falha na execução.");
      setValidationMessage(`${caseCode}: ${payload.outcome.status.toUpperCase()} — ${payload.outcome.summary}`);
      const refreshed = await fetch("/api/sandbox", { cache: "no-store" });
      const refreshedData = await refreshed.json();
      if (refreshed.ok) setData(refreshedData);
    } catch (cause) {
      setValidationMessage(cause instanceof Error ? cause.message : "Falha na execução.");
    } finally {
      setRunningCase(null);
    }
  }

  if (loading) {
    return (
      <div className="card cockpit-card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
        Carregando sandbox…
      </div>
    );
  }

  if (error) {
    return (
      <div className="card cockpit-card" style={{ padding: 24, borderLeft: "4px solid #DC2626" }}>
        <div style={{ fontWeight: 700, color: "#DC2626", marginBottom: 8 }}>Sandbox indisponível</div>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <section style={{ display: "grid", gap: 20 }}>
      {/* Header */}
      <div className="card cockpit-card" style={{ padding: "20px 24px", borderLeft: "4px solid #7C3AED" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24 }}>🧪</span>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
                Sandbox - Ambiente de Testes
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                Dados sintéticos isolados para testes seguros. Nenhum dado real de clientes.
              </p>
            </div>
          </div>
          <div style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, background: "rgba(16, 185, 129, 0.12)", color: "#10B981", fontWeight: 600 }}>
            Schema isolado
          </div>
        </div>
      </div>

      {/* Sprint portfolio integration */}
      <div className="card cockpit-card" style={{ padding: "20px 24px", display: "grid", gap: 16, borderLeft: "4px solid #614943" }}>
        <div>
          <div className="eyebrow">CICLO 01 · PORTFÓLIO RSBUILD</div>
          <h3 style={{ margin: "5px 0", fontSize: 18, color: "var(--ink)" }}>Sprint Validation Environment</h3>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>Validação vinculada às sprints e tarefas do portfólio. A execução usa apenas fixtures sintéticas isoladas; tarefas sem cenário automatizado permanecem sem homologação.</p>
        </div>
        {portfolioError && <p role="status" style={{ color: "#B7791F", fontSize: 12 }}>{portfolioError}</p>}
        {projects.length === 0 && !portfolioError && <p style={{ color: "var(--muted)", fontSize: 12 }}>Nenhum projeto disponível no portfólio para esta sessão.</p>}
        {projects.map(project => <div key={project.id} style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
            <strong style={{ color: "var(--ink)", fontSize: 14 }}>{project.name}</strong>
            <span style={{ color: "var(--muted)", fontSize: 11 }}>{project.client_display_name} · {project.status}</span>
          </div>
          {project.project_sprints.map(sprint => {
            // Associação restrita ao projeto e à sprint do cenário.
            const sprintCases = (data.validationCases || []).filter(
              (item: any) => item.project_key === project.project_key && item.sprint_number === sprint.sprint_number
            );
            const matchesTaskCode = (title: string, code: string) =>
              title.split(/[\\s·:—-]+/).includes(code);
            const linkedCases = sprintCases.filter((item: any) =>
              sprint.project_tasks.some(task => matchesTaskCode(task.title, item.task_code))
            );
            // Mantém somente a execução mais recente de cada cenário.
            const latestRunByCase = new Map<string, any>();
            for (const run of data.validationRuns || []) {
              const previous = latestRunByCase.get(run.case_code);
              if (!previous || new Date(run.executed_at).getTime() > new Date(previous.executed_at).getTime()) {
                latestRunByCase.set(run.case_code, run);
              }
            }
            const passed = linkedCases.filter((item: any) => latestRunByCase.get(item.case_code)?.status === "passed").length;
            return <div key={sprint.id} style={{ padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface-raised)", display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ color: "var(--ink)", fontSize: 13 }}>Sprint {sprint.sprint_number} · {sprint.title}</strong>
                <span style={{ fontSize: 10, color: sprint.status === "active" ? "#059669" : "var(--muted)", fontWeight: 700 }}>{sprint.status.toUpperCase()}</span>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>{sprint.objective}</p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, color: "var(--muted)" }}>
                <span>{sprint.project_tasks.length} tarefas no portfólio</span>
                <span>{linkedCases.length} cenários vinculados</span>
                <span>{passed}/{linkedCases.length} cenários aprovados</span>
              </div>
              {sprint.project_tasks.map(task => {
                const linked = linkedCases.filter((item: any) =>
                  new RegExp(`(^|\\\\s)${item.task_code.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\              {sprint.project_tasks.map(task => {
                const linked = linkedCases.filter((item: any) => matchesTaskCode(task.title, item.task_code));
                const latest = linked
                  .map((item: any) => latestRunByCase.get(item.case_code))
                  .filter(Boolean)
                  .sort((a: any, b: any) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime())[0];")}(?=$|\\\\s|[:·-])`).test(task.title)
                );
                const latest = linked
                  .map((item: any) => latestRunByCase.get(item.case_code))
                  .filter(Boolean)
                  .sort((a: any, b: any) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime())[0];
                return <div key={task.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", paddingTop: 6, borderTop: "1px solid var(--line)" }}>
                  <span style={{ fontSize: 11, color: "var(--ink)" }}>{task.title}</span>
                  <span style={{ fontSize: 10, color: latest?.status === "passed" ? "#059669" : latest?.status === "failed" ? "#DC2626" : "#B7791F", fontWeight: 700 }}>{latest ? latest.status.toUpperCase() : linked.length ? "NÃO EXECUTADO" : "SEM CENÁRIO"}</span>
                </div>;
              })}
            </div>;
          })}
        </div>)}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
        <div className="card cockpit-card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Organizações</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>{data.organizations.length}</div>
        </div>
        <div className="card cockpit-card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Membros</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>{data.memberships.length}</div>
        </div>
        <div className="card cockpit-card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Contas</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>{data.financialAccounts.length}</div>
        </div>
        <div className="card cockpit-card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Registros</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>{data.financialRecords.length}</div>
        </div>
        <div className="card cockpit-card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Títulos</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>{data.receivableTitles.length}</div>
        </div>
        <div className="card cockpit-card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Provas</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>{data.deliveryProofs.length}</div>
        </div>
      </div>

      {/* Organizations */}
      <div className="card cockpit-card" style={{ padding: "20px 24px" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
          Organizações Sandbox
        </h3>
        <div style={{ display: "grid", gap: 10 }}>
          {data.organizations.map((org) => (
            <div
              key={org.id}
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--surface-raised)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <div>
                <strong style={{ fontSize: 14, color: "var(--ink)" }}>{org.display_name}</strong>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{org.slug}</div>
              </div>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(124, 58, 237, 0.12)", color: "#7C3AED" }}>
                {org.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Sprint validation laboratory */}
      <div className="card cockpit-card" style={{ padding: "20px 24px", borderLeft: "4px solid #B5583C", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="eyebrow">VALIDATION ENVIRONMENT · FINANCE</div>
            <h3 style={{ margin: "5px 0", fontSize: 18, color: "var(--ink)" }}>Validador das Sprints — Conciliação Bancária</h3>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>Executa fixtures sintéticas no código financeiro atual. Nenhum extrato ou dado de cliente é utilizado.</p>
          </div>
          <span style={{ fontSize: 11, padding: "5px 10px", borderRadius: 6, background: "rgba(16,185,129,.12)", color: "#059669", fontWeight: 700 }}>Execução isolada</span>
        </div>
        {validationMessage && <div role="status" style={{ padding: 12, borderRadius: 8, background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)", fontSize: 13 }}>{validationMessage}</div>}
        {[1,2].map((sprint) => {
          const cases = (data.validationCases || []).filter((item: any) => item.sprint_number === sprint);
          return <div key={sprint} style={{ display: "grid", gap: 9 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <strong style={{ color: "var(--ink)", fontSize: 14 }}>Sprint A{sprint} · {sprint === 1 ? "Uma conta bancária conciliada ponta a ponta" : "Leiautes, exceções e auditoria manual"}</strong>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>{cases.length} casos</span>
            </div>
            {cases.map((item: any) => {
              const latest = (data.validationRuns || []).find((run: any) => run.case_code === item.case_code);
              const label = latest?.status === "passed" ? "APROVADO" : latest?.status === "failed" ? "REPROVADO" : latest?.status === "blocked" ? "PENDENTE" : "NÃO EXECUTADO";
              const color = latest?.status === "passed" ? "#059669" : latest?.status === "failed" ? "#DC2626" : "#B7791F";
              return <div key={item.case_code} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface-raised)" }}>
                <div style={{ minWidth: 220, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ color: "var(--ink)", fontSize: 13 }}>{item.task_code} · {item.title}</strong>
                    <span style={{ color, fontSize: 10, fontWeight: 800, letterSpacing: ".04em" }}>{label}</span>
                  </div>
                  <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 11 }}>{item.acceptance_criteria}</p>
                  {latest && <small style={{ display: "block", marginTop: 4, color: "var(--muted)" }}>Última execução: {new Date(latest.executed_at).toLocaleString("pt-BR")} · {latest.summary}</small>}
                </div>
                <button type="button" className="secondary-button" disabled={runningCase !== null} onClick={() => runCase(item.case_code)} style={{ whiteSpace: "nowrap", opacity: runningCase && runningCase !== item.case_code ? .55 : 1 }}>
                  {runningCase === item.case_code ? "Executando…" : item.test_kind === "manual" ? "Registrar pendência" : item.test_kind === "blocked" ? "Ver bloqueio" : "Executar teste"}
                </button>
              </div>;
            })}
          </div>;
        })}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <strong style={{ color: "var(--ink)", fontSize: 13 }}>Histórico recente de validações</strong>
          {(data.validationRuns || []).length === 0 ? <p style={{ color: "var(--muted)", fontSize: 12 }}>Nenhuma execução registrada.</p> :
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {(data.validationRuns || []).slice(0, 8).map((run: any) => <div key={run.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: "var(--muted)" }}>
                <span>{run.case_code} · {run.summary}</span><strong style={{ color: run.status === "passed" ? "#059669" : run.status === "failed" ? "#DC2626" : "#B7791F" }}>{run.status.toUpperCase()}</strong>
              </div>)}
            </div>}
        </div>
      </div>

      {/* Sample Data Preview */}
      <div className="card cockpit-card" style={{ padding: "20px 24px" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
          Amostra de Dados Sintéticos
        </h3>
        <div style={{ display: "grid", gap: 16 }}>
          {data.financialRecords.slice(0, 3).map((record) => (
            <div key={record.id} style={{ padding: "10px 14px", borderRadius: 6, background: "var(--surface)", border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{record.description}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: record.direction === "entrada" ? "#059669" : "#DC2626" }}>
                  {record.direction === "entrada" ? "+" : "-"}R$ {(record.amount_cents / 100).toFixed(2)}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{record.transaction_date}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
