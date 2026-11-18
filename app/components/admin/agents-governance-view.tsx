"use client";

import { formatDateTimePtBr } from "@/lib/date-format";

import { useCallback, useEffect, useState } from "react";

type Agent = {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  kind: string;
  status: string;
  version: string;
  capabilities: string[];
  protocol: string;
  createdAt: string;
};

type Grant = {
  id: string;
  agentId: string;
  agentName: string | null;
  organizationId: string;
  organizationName: string | null;
  capabilities: string[];
  status: string;
  createdAt: string;
};

type Proposal = {
  id: string;
  agentId: string;
  agentName: string | null;
  organizationId: string;
  organizationName: string | null;
  actionType: string;
  title: string;
  summary: string | null;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "expired" | "executed";
  requestedAt: string;
  decidedAt: string | null;
  decisionReason: string | null;
};

type AgentsData = {
  agents: Agent[];
  grants: Grant[];
  proposals: Proposal[];
  role: string;
};

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "Ativo", color: "#059669", bg: "rgba(16,185,129,0.12)" },
  suspended: { label: "Suspenso", color: "#D97706", bg: "rgba(245,158,11,0.12)" },
  retired: { label: "Aposentado", color: "#6B7280", bg: "rgba(107,114,128,0.12)" },
  pending: { label: "Pendente", color: "#7C3AED", bg: "rgba(124,58,237,0.12)" },
  approved: { label: "Aprovado", color: "#059669", bg: "rgba(16,185,129,0.12)" },
  rejected: { label: "Rejeitado", color: "#DC2626", bg: "rgba(220,38,38,0.12)" },
  expired: { label: "Expirado", color: "#6B7280", bg: "rgba(107,114,128,0.12)" },
  executed: { label: "Executado", color: "#2563EB", bg: "rgba(37,99,235,0.12)" },
  revoked: { label: "Revogado", color: "#DC2626", bg: "rgba(220,38,38,0.12)" }
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, color: "#6B7280", bg: "rgba(107,114,128,0.12)" };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export function AgentsGovernanceView({ canDecide }: { canDecide: boolean }) {
  const [data, setData] = useState<AgentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/agents", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar governança de agentes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function decide(proposalId: string, decision: "approved" | "rejected") {
    setBusyId(proposalId);
    setNotice("");
    try {
      const res = await fetch(`/api/agent-proposals/${proposalId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
      setNotice(decision === "approved" ? "Proposta aprovada." : "Proposta rejeitada.");
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha ao registrar decisão.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="card cockpit-card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
        Carregando governança de agentes…
      </div>
    );
  }

  if (error) {
    return (
      <div className="card cockpit-card" style={{ padding: 24, borderLeft: "4px solid #DC2626" }}>
        <div style={{ fontWeight: 700, color: "#DC2626", marginBottom: 8 }}>Agentes indisponíveis</div>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const pending = data.proposals.filter((p) => p.status === "pending");
  const decided = data.proposals.filter((p) => p.status !== "pending");
  const activeAgents = data.agents.filter((a) => a.status === "active");
  const activeGrants = data.grants.filter((g) => g.status === "active");

  return (
    <section style={{ display: "grid", gap: 20 }}>
      {/* Header */}
      <div className="card cockpit-card" style={{ padding: "20px 24px", borderLeft: "4px solid #7C3AED" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24 }}>🤖</span>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
                Agentes de IA & Governança
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)", maxWidth: 720 }}>
                Plano de controle RSBUILD: agentes propõem ações sobre os tenants; nenhuma execução ocorre sem decisão humana (HITL). Agentes não possuem membership — atuam via escopo explícito e auditável.
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, background: "rgba(124,58,237,0.12)", color: "#7C3AED" }}>
              {activeAgents.length} agente(s) ativo(s)
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, background: "rgba(37,99,235,0.12)", color: "#2563EB" }}>
              {activeGrants.length} concessão(ões) ativa(s)
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, background: pending.length ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.12)", color: pending.length ? "#D97706" : "#059669" }}>
              {pending.length} proposta(s) pendente(s)
            </span>
          </div>
        </div>
      </div>

      {notice && (
        <div className="notice" role="status" style={{ margin: 0 }}>
          {notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}

      {/* Registry */}
      <div className="card cockpit-card" style={{ padding: "20px 24px" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
          Registro de Agentes
        </h3>
        <div style={{ display: "grid", gap: 12 }}>
          {data.agents.map((agent) => (
            <div key={agent.id} style={{ padding: "14px 16px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-raised)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 14, color: "var(--ink)" }}>{agent.displayName}</strong>
                    <StatusBadge status={agent.status} />
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(124,58,237,0.1)", color: "#7C3AED", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                      {agent.kind}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--muted)" }}>v{agent.version} · {agent.protocol.toUpperCase()}</span>
                  </div>
                  {agent.description && (
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{agent.description}</p>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {agent.capabilities.map((cap) => (
                  <code key={cap} style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 4, background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)" }}>
                    {cap}
                  </code>
                ))}
              </div>
            </div>
          ))}
          {data.agents.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Nenhum agente registrado.</p>
          )}
        </div>
      </div>

      {/* Grants */}
      <div className="card cockpit-card" style={{ padding: "20px 24px" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
          Escopo por Organização
        </h3>
        <div style={{ display: "grid", gap: 10 }}>
          {data.grants.map((grant) => (
            <div key={grant.id} style={{ padding: "12px 16px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-raised)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <strong style={{ fontSize: 13, color: "var(--ink)" }}>{grant.agentName ?? "—"}</strong>
                <span style={{ margin: "0 8px", color: "var(--muted)" }}>→</span>
                <strong style={{ fontSize: 13, color: "var(--ink)" }}>{grant.organizationName ?? "—"}</strong>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                  {grant.capabilities.map((cap) => (
                    <code key={cap} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "var(--surface)", border: "1px solid var(--line)", color: "var(--muted)" }}>
                      {cap}
                    </code>
                  ))}
                </div>
              </div>
              <StatusBadge status={grant.status} />
            </div>
          ))}
          {data.grants.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Nenhuma concessão de agente registrada.</p>
          )}
        </div>
      </div>

      {/* HITL Queue */}
      <div className="card cockpit-card" style={{ padding: "20px 24px", borderLeft: "4px solid #F59E0B" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
          Fila de Aprovação Humana (HITL)
        </h3>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--muted)" }}>
          Ações propostas por agentes aguardando decisão. Aprovar não executa a ação — registra a autorização para a camada de execução.
        </p>
        <div style={{ display: "grid", gap: 12 }}>
          {pending.map((p) => (
            <div key={p.id} style={{ padding: "14px 16px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-raised)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 13.5, color: "var(--ink)" }}>{p.title}</strong>
                    <StatusBadge status={p.status} />
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
                    {p.agentName ?? "Agente"} → {p.organizationName ?? "—"} · {p.actionType} · {formatDateTimePtBr(p.requestedAt)}
                  </div>
                  {p.summary && (
                    <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--ink)", lineHeight: 1.55 }}>{p.summary}</p>
                  )}
                </div>
                {canDecide && (
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button
                      className="secondary-button"
                      disabled={busyId === p.id}
                      onClick={() => decide(p.id, "approved")}
                      style={{ borderColor: "#059669", color: "#059669", fontSize: 12, padding: "6px 12px" }}
                    >
                      Aprovar
                    </button>
                    <button
                      className="secondary-button"
                      disabled={busyId === p.id}
                      onClick={() => decide(p.id, "rejected")}
                      style={{ borderColor: "#DC2626", color: "#DC2626", fontSize: 12, padding: "6px 12px" }}
                    >
                      Rejeitar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {pending.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Nenhuma proposta pendente.</p>
          )}
        </div>
      </div>

      {/* History */}
      {decided.length > 0 && (
        <div className="card cockpit-card" style={{ padding: "20px 24px" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
            Decisões Recentes
          </h3>
          <div style={{ display: "grid", gap: 10 }}>
            {decided.slice(0, 10).map((p) => (
              <div key={p.id} style={{ padding: "10px 14px", borderRadius: 6, background: "var(--surface)", border: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{p.title}</span>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    {p.agentName ?? "Agente"} → {p.organizationName ?? "—"}
                    {p.decisionReason ? ` · Motivo: ${p.decisionReason}` : ""}
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
