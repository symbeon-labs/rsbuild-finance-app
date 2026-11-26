"use client";

import { formatDateTimePtBr } from "@/lib/date-format";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { HoldingWorkspaceOrganization } from "@/app/components/executive/holding-workspace-management-view";

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
  activeSandboxOrganization?: { id: string; slug: string; display_name: string; status: string };
};
type PortfolioTask = { id: string; title: string; acceptance_criteria: string; status: string; priority: string };
type PortfolioSprint = { id: string; sprint_number: number; title: string; objective: string; completion_criteria: string; status: string; project_tasks: PortfolioTask[] };
type PortfolioProject = { id: string; project_key: string; name: string; client_display_name: string; status: string; project_sprints: PortfolioSprint[] };
type ManualStatus = "passed" | "failed" | "blocked";

const statusLabel: Record<string, string> = {
  passed: "APROVADO", failed: "REPROVADO", blocked: "BLOQUEADO", pending: "PENDENTE"
};
const statusColor: Record<string, string> = {
  passed: "#059669", failed: "#DC2626", blocked: "#B7791F", pending: "var(--muted)"
};

export function SandboxView({ organizationId, qaOrganizations = [], sandboxOrganizations = [] }: { organizationId: string; qaOrganizations?: HoldingWorkspaceOrganization[]; sandboxOrganizations?: HoldingWorkspaceOrganization[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sandboxOrganizationId = searchParams.get("sandboxOrganizationId");
  const sandboxQuery = sandboxOrganizationId ? `?sandboxOrganizationId=${encodeURIComponent(sandboxOrganizationId)}` : "";
  const [data, setData] = useState<SandboxData | null>(null);
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [section, setSection] = useState<"overview" | "cases" | "sprints" | "history">("overview");
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [manualStatus, setManualStatus] = useState<ManualStatus>("passed");
  const [summary, setSummary] = useState("");
  const [observed, setObserved] = useState("");
  const [evidenceRef, setEvidenceRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch(`/api/sandbox${sandboxQuery}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Falha ao carregar o ambiente.");
    setData(payload);
  }

  useEffect(() => {
    let active = true;
    setSection("overview");
    setSelectedCase(null);
    setFeedback(null);
    async function load() {
      try {
        const [sandboxResponse, portfolioResponse] = await Promise.all([
          fetch(`/api/sandbox${sandboxQuery}`, { cache: "no-store" }),
          fetch("/api/projects", { cache: "no-store" }).catch(() => null)
        ]);
        const sandboxPayload = await sandboxResponse.json();
        if (!sandboxResponse.ok) throw new Error(sandboxPayload.error || "Falha ao carregar o Sandbox.");
        if (!active) return;
        setData(sandboxPayload);

        if (sandboxPayload.activeSandboxOrganization?.slug === "mundo-sabor-sandbox") {
          if (!portfolioResponse || !portfolioResponse.ok) {
            setPortfolioError("O vínculo com as sprints está temporariamente indisponível.");
          } else {
            try {
              const portfolioPayload = await portfolioResponse.json();
              if (!active) return;
              const allProjects = Array.isArray(portfolioPayload.projects) ? portfolioPayload.projects : [];
              setProjects(allProjects.filter((project: PortfolioProject) => project.project_key === "mundo-do-sabor"));
            } catch {
              if (active) setPortfolioError("Não foi possível interpretar os dados do portfólio de sprints.");
            }
          }
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Falha ao carregar Sandbox.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [sandboxQuery]);

  const activeSandbox = data?.activeSandboxOrganization;
  const isMundoSaborSandbox = activeSandbox?.slug === "mundo-sabor-sandbox";
  const sandboxDisplayName = activeSandbox?.display_name ?? "Laboratório selecionado";
  const cases = useMemo(() => data?.validationCases ?? [], [data]);
  const latestByCase = useMemo(() => {
    const map = new Map<string, any>();
    for (const run of data?.validationRuns ?? []) {
      const previous = map.get(run.case_code);
      if (!previous || new Date(run.executed_at).getTime() > new Date(previous.executed_at).getTime()) {
        map.set(run.case_code, run);
      }
    }
    return map;
  }, [data]);
  const counts = useMemo(() => ({
    total: cases.length,
    passed: cases.filter((item: any) => latestByCase.get(item.case_code)?.status === "passed").length,
    failed: cases.filter((item: any) => latestByCase.get(item.case_code)?.status === "failed").length,
    blocked: cases.filter((item: any) => ["blocked", undefined].includes(latestByCase.get(item.case_code)?.status)).length
  }), [cases, latestByCase]);

  async function submitManualResult() {
    if (!selectedCase || summary.trim().length < 5) {
      setFeedback("Informe um resumo com pelo menos 5 caracteres.");
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "manual",
          sandboxOrganizationId,
          caseCode: selectedCase.case_code,
          status: manualStatus,
          summary: summary.trim(),
          observed: observed.trim(),
          evidenceRef: evidenceRef.trim()
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível registrar a homologação.");

      // The write is committed. Close/reset before refreshing so a refresh failure
      // cannot leave a retryable form that would create a duplicate validation run.
      setSelectedCase(null);
      setSummary("");
      setObserved("");
      setEvidenceRef("");
      setManualStatus("passed");
      setSection("history");
      try {
        await refresh();
        setFeedback("Resultado manual registrado com trilha de auditoria.");
      } catch {
        setFeedback("Resultado registrado. Não foi possível atualizar o histórico; recarregue a página para consultar o registro.");
      }
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : "Falha ao registrar resultado.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="card cockpit-card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Carregando ambiente de homologação…</div>;
  if (error) return <div className="card cockpit-card" style={{ padding: 24, borderLeft: "4px solid #DC2626" }}><strong style={{ color: "#DC2626" }}>Sandbox indisponível</strong><p style={{ color: "var(--muted)" }}>{error}</p></div>;
  if (!data) return null;

  const panel: React.CSSProperties = { padding: 18, border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-raised)" };
  const buttonStyle = (active: boolean): React.CSSProperties => ({
    border: "1px solid var(--line)", borderRadius: 8, padding: "9px 13px",
    background: active ? "var(--ink)" : "var(--surface-raised)",
    color: active ? "var(--surface)" : "var(--ink)", fontWeight: 700, cursor: "pointer", fontSize: 12
  });

  return (
    <section style={{ display: "grid", gap: 18 }}>
      <section className="card cockpit-card" style={{ padding: 18, display: "grid", gap: 14 }}>
        <div>
          <div className="eyebrow">AMBIENTES CONTROLADOS</div>
          <h2 style={{ margin: "4px 0", color: "var(--ink)", fontSize: 19 }}>Homologação & Sandbox</h2>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>Ambientes de teste e laboratórios isolados.</p>
        </div>
        {qaOrganizations.length > 0 && <>
          <strong style={{ color: "var(--ink)", fontSize: 13 }}>Homologação</strong>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            {qaOrganizations.map((org) => <article key={org.id} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 14, display: "grid", gap: 8 }}>
              <span style={{ color: "#B7791F", fontSize: 10, fontWeight: 800 }}>QA · HOMOLOGAÇÃO</span>
              <strong style={{ color: "var(--ink)", fontSize: 14 }}>{org.name}</strong>
              <button type="button" className="secondary-button" style={{ justifySelf: "start" }} onClick={() => router.push("/?organizationId=" + encodeURIComponent(org.id) + "&tab=workspace")}>Abrir ambiente →</button>
            </article>)}
          </div>
        </>}
        {sandboxOrganizations.length > 0 && <>
          <strong style={{ color: "var(--ink)", fontSize: 13 }}>Laboratórios isolados</strong>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            {sandboxOrganizations.map((org) => <article key={org.id} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 14, display: "grid", gap: 8 }}>
              <span style={{ color: "#7C3AED", fontSize: 10, fontWeight: 800 }}>SANDBOX</span>
              <strong style={{ color: "var(--ink)", fontSize: 14 }}>{org.name}</strong>
              <button type="button" className="secondary-button" style={{ justifySelf: "start" }} onClick={() => router.push("/?organizationId=" + encodeURIComponent(organizationId) + "&tab=sandbox&sandboxOrganizationId=" + encodeURIComponent(org.id))}>Abrir laboratório →</button>
            </article>)}
          </div>
        </>}
        {qaOrganizations.length === 0 && sandboxOrganizations.length === 0 && <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>Nenhum ambiente controlado concedido a esta conta.</p>}
      </section>
      <header className="card cockpit-card" style={{ padding: "22px 24px", borderLeft: "4px solid #7C3AED", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="eyebrow">RSBUILD OS · AMBIENTE CONTROLADO</div>
            <h2 style={{ margin: "5px 0", color: "var(--ink)", fontSize: 22 }}>Laboratório · {sandboxDisplayName}</h2>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>Validação funcional manual em dados sintéticos. Execuções não alteram o workspace operacional do cliente.</p>
          </div>
          <span style={{ borderRadius: 20, padding: "6px 11px", background: "rgba(16,185,129,.12)", color: "#059669", fontSize: 11, fontWeight: 800 }}>● SANDBOX ISOLADO</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["overview", "cases", ...(isMundoSaborSandbox ? ["sprints" as const] : []), "history"] as const).map((tab) => {
            const labels = { overview: "Visão geral", cases: "Casos de teste", sprints: "Vínculo com sprints", history: "Evidências e histórico" };
            return <button key={tab} type="button" style={buttonStyle(section === tab)} onClick={() => setSection(tab)}>{labels[tab]}</button>;
          })}
        </div>
      </header>

      {feedback && <div role="status" style={{ ...panel, borderLeft: "4px solid #7C3AED", color: "var(--ink)" }}>{feedback}</div>}

      {section === "overview" && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 12 }}>
          {[
            ["Casos no escopo", counts.total],
            ["Aprovados", counts.passed],
            ["Reprovados", counts.failed],
            ["Pendentes / bloqueados", counts.blocked]
          ].map(([label, value]) => <div key={label} className="card cockpit-card" style={{ padding: 16 }}><div style={{ color: "var(--muted)", fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>{label}</div><div style={{ color: "var(--ink)", fontSize: 27, fontWeight: 800 }}>{value}</div></div>)}
        </div>
        <div className="card cockpit-card" style={{ ...panel, display: "grid", gap: 12 }}>
          <div><div className="eyebrow">AMBIENTE SELECIONADO</div><h3 style={{ margin: "4px 0", color: "var(--ink)" }}>{sandboxDisplayName}</h3><span style={{ color: "var(--muted)", fontSize: 12 }}>{activeSandbox?.slug ?? "sandbox"} · dados sintéticos · ambiente isolado</span></div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: "var(--muted)" }}>
            <span>{data.financialAccounts.length} contas sintéticas</span><span>{data.financialRecords.length} lançamentos</span><span>{data.receivableTitles.length} títulos</span><span>{data.deliveryProofs.length} comprovantes</span>
          </div>
          <button type="button" className="primary-button" onClick={() => setSection("cases")} style={{ justifySelf: "start" }}>Abrir casos de homologação →</button>
        </div>
        <div className="card cockpit-card" style={panel}>
          <h3 style={{ marginTop: 0, color: "var(--ink)" }}>Fluxo de homologação</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
            {["Selecionar caso", "Executar validação manual", "Registrar resultado e evidência", "Consolidar aprovação"].map((step, index) => <div key={step} style={{ padding: 12, border: "1px solid var(--line)", borderRadius: 8 }}><strong style={{ color: "#7C3AED" }}>0{index + 1}</strong><div style={{ color: "var(--ink)", fontSize: 12, marginTop: 5 }}>{step}</div></div>)}
          </div>
        </div>
      </>}

      {section === "cases" && <div className="card cockpit-card" style={{ ...panel, display: "grid", gap: 12 }}>
        <div><div className="eyebrow">HOMOLOGAÇÃO · {sandboxDisplayName.toUpperCase()}</div><h3 style={{ margin: "4px 0", color: "var(--ink)" }}>Casos de teste manuais</h3><p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>Cada resultado é informado pelo homologador. Nenhum teste automatizado é disparado nesta interface.</p></div>
        {cases.map((item: any) => {
          const latest = latestByCase.get(item.case_code);
          return <article key={item.case_code} style={{ ...panel, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 220, flex: 1 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}><strong style={{ color: "var(--ink)", fontSize: 13 }}>{item.task_code} · {item.title}</strong><span style={{ color: statusColor[latest?.status ?? "pending"], fontSize: 10, fontWeight: 800 }}>{statusLabel[latest?.status ?? "pending"]}</span></div>
              <p style={{ color: "var(--muted)", fontSize: 12, margin: "5px 0" }}>{item.acceptance_criteria}</p>
              <span style={{ color: "var(--muted)", fontSize: 10 }}>Sprint {item.sprint_number} · {item.case_code}</span>
            </div>
            <button type="button" className="secondary-button" onClick={() => { setSelectedCase(item); setFeedback(null); }}>Registrar homologação</button>
          </article>;
        })}
        {cases.length === 0 && <p style={{ color: "var(--muted)" }}>{isMundoSaborSandbox ? "Não há casos de teste cadastrados para este laboratório." : "Este laboratório ainda não possui uma suíte de homologação manual vinculada. Os dados sintéticos e os controles de isolamento continuam disponíveis."}</p>}
      </div>}

      {section === "sprints" && <div className="card cockpit-card" style={{ ...panel, display: "grid", gap: 14 }}>
        <div><div className="eyebrow">RASTREABILIDADE DE ENTREGA</div><h3 style={{ margin: "4px 0", color: "var(--ink)" }}>Desenvolvimento e homologação por sprint</h3><p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>A visão consolida os casos de homologação por sprint. O vínculo individual entre cada caso e cada tarefa ainda precisa de reconciliação funcional; por isso, os estados não são atribuídos automaticamente às tarefas.</p></div>
        {portfolioError && <p role="status" style={{ color: "#B7791F" }}>{portfolioError}</p>}
        {projects.map(project => project.project_sprints.map(sprint => {
          const sprintCases = cases.filter((item: any) => item.sprint_number === sprint.sprint_number);
          const sprintRuns = sprintCases.map((item: any) => latestByCase.get(item.case_code));
          const passed = sprintRuns.filter((run: any) => run?.status === "passed").length;
          const failed = sprintRuns.filter((run: any) => run?.status === "failed").length;
          const blocked = sprintRuns.filter((run: any) => run?.status === "blocked").length;
          const pending = sprintCases.length - passed - failed - blocked;
          return <div key={sprint.id} style={{ ...panel, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><strong style={{ color: "var(--ink)" }}>Sprint {sprint.sprint_number} · {sprint.title}</strong><span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 800 }}>DESENVOLVIMENTO: {sprint.status.toUpperCase()}</span></div>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>{sprint.objective}</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11 }}>
              <span style={{ color: statusColor.passed }}>{passed} aprovados</span>
              <span style={{ color: statusColor.failed }}>{failed} reprovados</span>
              <span style={{ color: statusColor.blocked }}>{blocked} bloqueados</span>
              <span style={{ color: statusColor.pending }}>{pending} pendentes</span>
            </div>
            <div style={{ display: "grid", gap: 7, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
              <strong style={{ color: "var(--ink)", fontSize: 11 }}>Tarefas de desenvolvimento ({sprint.project_tasks.length})</strong>
              {sprint.project_tasks.map(task => <div key={task.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 7 }}>
                <span style={{ color: "var(--ink)", fontSize: 11 }}>{task.title}</span>
              </div>)}
            </div>
            <div style={{ display: "grid", gap: 6, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
              <strong style={{ color: "var(--ink)", fontSize: 11 }}>Casos de homologação ({sprintCases.length})</strong>
              {sprintCases.map((item: any) => {
                const latest = latestByCase.get(item.case_code);
                const status = latest?.status ?? "pending";
                return <div key={item.case_code} style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ color: "var(--muted)", fontSize: 11 }}>{item.case_code} · {item.title}</span>
                  <strong style={{ color: statusColor[status], fontSize: 10 }}>{statusLabel[status]}</strong>
                </div>;
              })}
            </div>
          </div>;
        }))}
        {projects.length === 0 && !portfolioError && <p style={{ color: "var(--muted)" }}>{isMundoSaborSandbox ? "Projeto Mundo do Sabor não encontrado no portfólio desta sessão." : "O vínculo com sprints é específico do laboratório Mundo do Sabor e não se aplica a este ambiente."}</p>}
      </div>}

      {section === "history" && <div className="card cockpit-card" style={{ ...panel, display: "grid", gap: 10 }}>
        <div><div className="eyebrow">REGISTRO DE EVIDÊNCIAS</div><h3 style={{ margin: "4px 0", color: "var(--ink)" }}>Histórico de homologações</h3><p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>Registro cronológico de resultados, responsável e evidências informadas.</p></div>
        {(data.validationRuns ?? []).length === 0 ? <p style={{ color: "var(--muted)" }}>Nenhuma homologação registrada.</p> : [...data.validationRuns].map((run: any) => <article key={run.id} style={{ ...panel, display: "grid", gap: 5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><strong style={{ color: "var(--ink)", fontSize: 12 }}>{run.case_code}</strong><strong style={{ color: statusColor[run.status], fontSize: 10 }}>{statusLabel[run.status] ?? run.status.toUpperCase()}</strong></div>
          <p style={{ margin: 0, color: "var(--ink)", fontSize: 12 }}>{run.summary}</p>
          <span style={{ color: "var(--muted)", fontSize: 10 }}>{run.actor_email ?? "Homologador"} · {formatDateTimePtBr(run.executed_at)}</span>
          {run.result?.observed && <p style={{ margin: 0, color: "var(--muted)", fontSize: 11 }}>Observado: {run.result.observed}</p>}
          {run.result?.evidenceRef && <p style={{ margin: 0, color: "var(--muted)", fontSize: 11 }}>Referência: {run.result.evidenceRef}</p>}
        </article>)}
      </div>}

      {selectedCase && <div role="dialog" aria-modal="true" aria-labelledby="homologation-title" className="card cockpit-card" style={{ ...panel, border: "2px solid #7C3AED", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><div><div className="eyebrow">REGISTRO MANUAL</div><h3 id="homologation-title" style={{ margin: "4px 0", color: "var(--ink)" }}>{selectedCase.task_code} · {selectedCase.title}</h3></div><button type="button" className="secondary-button" onClick={() => setSelectedCase(null)} disabled={saving}>Fechar</button></div>
        <div style={{ padding: 12, borderRadius: 8, background: "var(--surface)", color: "var(--muted)", fontSize: 12 }}><strong style={{ color: "var(--ink)" }}>Critério de aceite:</strong> {selectedCase.acceptance_criteria}</div>
        <label style={{ display: "grid", gap: 5, color: "var(--ink)", fontSize: 12, fontWeight: 700 }}>Resultado da validação
          <select value={manualStatus} onChange={event => setManualStatus(event.target.value as ManualStatus)} style={{ padding: 10, borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-raised)", color: "var(--ink)" }}>
            <option value="passed">Aprovado</option><option value="failed">Reprovado</option><option value="blocked">Bloqueado / não foi possível validar</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 5, color: "var(--ink)", fontSize: 12, fontWeight: 700 }}>Resumo e justificativa *
          <textarea value={summary} onChange={event => setSummary(event.target.value)} rows={3} maxLength={1000} placeholder="Descreva o que foi validado e por que o resultado foi aprovado, reprovado ou bloqueado." style={{ padding: 10, borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-raised)", color: "var(--ink)" }} />
        </label>
        <label style={{ display: "grid", gap: 5, color: "var(--ink)", fontSize: 12, fontWeight: 700 }}>Resultado observado
          <textarea value={observed} onChange={event => setObserved(event.target.value)} rows={2} maxLength={2000} placeholder="Comportamento observado, valores conferidos, divergências…" style={{ padding: 10, borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-raised)", color: "var(--ink)" }} />
        </label>
        <label style={{ display: "grid", gap: 5, color: "var(--ink)", fontSize: 12, fontWeight: 700 }}>Referência da evidência (opcional)
          <input value={evidenceRef} onChange={event => setEvidenceRef(event.target.value)} maxLength={500} placeholder="ID do arquivo, URL interna ou referência do registro" style={{ padding: 10, borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-raised)", color: "var(--ink)" }} />
        </label>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 10 }}>A declaração do resultado é manual. Registre evidências verificáveis; não marque como aprovado sem executar o procedimento de teste.</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}><button type="button" className="secondary-button" onClick={() => setSelectedCase(null)} disabled={saving}>Cancelar</button><button type="button" className="primary-button" onClick={submitManualResult} disabled={saving || summary.trim().length < 5}>{saving ? "Registrando…" : "Salvar resultado de homologação"}</button></div>
      </div>}
    </section>
  );
}
