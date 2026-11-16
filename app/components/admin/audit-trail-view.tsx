"use client";

import { useEffect, useMemo, useState } from "react";

type AuditEvent = {
  id: number;
  actorId: string | null;
  actorEmail: string | null;
  eventType: string;
  entityType: string;
  entityId: string | null;
  occurredAt: string;
  metadata: Record<string, unknown>;
};

type Props = { organizationId: string; organizationName: string };

const EVENT_LABELS: Record<string, string> = {
  "access.denied": "Acesso negado",
  "import.committed": "Extrato importado",
  "titles.imported": "Títulos importados",
  "title.status_changed": "Status de título alterado",
  "proofs.imported": "Canhotos importados",
  "proof.updated": "Canhoto atualizado",
  "orders.created": "Pedidos registrados",
  "erp.snapshot_imported": "Movimentos ERP importados",
  "settlements.created": "Baixas registradas",
  "reconciliation.decision": "Decisão de conciliação",
  "invitation.sent": "Convite enviado",
  "session.login": "Login realizado",
  "session.logout": "Logout realizado",
  "project.access_granted": "Acesso a projeto concedido",
  "project.access_revoked": "Acesso a projeto revogado"
};

const ENTITY_LABELS: Record<string, string> = {
  organization: "Organização",
  receivable_title: "Título",
  delivery_proof: "Canhoto",
  whatsapp_order: "Pedido",
  erp_snapshot: "Snapshot ERP",
  settlement: "Baixa",
  reconciliation_decision: "Decisão",
  organization_invitation: "Convite",
  financial_record: "Registro financeiro",
  session: "Sessão",
  project: "Projeto"
};

function eventLabel(type: string) {
  return EVENT_LABELS[type] ?? type;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function summarizeMetadata(meta: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof meta.reason === "string") parts.push(`Motivo: ${meta.reason}`);
  if (typeof meta.actualRole === "string") parts.push(`Papel: ${meta.actualRole}`);
  if (typeof meta.requiredRoles !== "undefined") parts.push(`Exigido: ${(meta.requiredRoles as string[]).join("/")}`);
  if (typeof meta.insertedCount === "number") parts.push(`${meta.insertedCount} registro(s)`);
  if (typeof meta.receivedCount === "number") parts.push(`${meta.receivedCount} recebido(s)`);
  if (typeof meta.parsedCount === "number") parts.push(`${meta.parsedCount} parseado(s)`);
  if (typeof meta.status === "string") parts.push(`Status: ${meta.status}`);
  if (typeof meta.invitedEmail === "string") parts.push(`Para: ${meta.invitedEmail}`);
  if (typeof meta.role === "string") parts.push(`Papel: ${meta.role}`);
  if (typeof meta.path === "string") parts.push(meta.path);
  if (Array.isArray(meta.decisionTypes)) parts.push(`Tipos: ${(meta.decisionTypes as string[]).join(", ")}`);
  if (Array.isArray(meta.fields)) parts.push(`Campos: ${(meta.fields as string[]).join(", ")}`);
  return parts.join(" · ");
}

export function AuditTrailView({ organizationId, organizationName }: Props) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    fetch(`/api/audit-events?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "audit_fetch_failed");
        return data;
      })
      .then((data) => { if (active) setEvents(data.events ?? []); })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "audit_fetch_failed"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [organizationId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events.filter((e) => {
      if (filter === "denied" && e.eventType !== "access.denied") return false;
      if (filter !== "all" && filter !== "denied" && e.eventType !== filter) return false;
      if (!term) return true;
      return (e.actorEmail ?? "").toLowerCase().includes(term)
        || e.eventType.toLowerCase().includes(term)
        || (e.entityId ?? "").toLowerCase().includes(term);
    });
  }, [events, filter, search]);

  const eventTypes = useMemo(() => [...new Set(events.map((e) => e.eventType))].sort(), [events]);

  return <section className="panel" style={{ padding: 22, display: "grid", gap: 16 }}>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div>
        <div className="eyebrow">TRILHA DE AUDITORIA</div>
        <h2 style={{ margin: "6px 0" }}>{organizationName}</h2>
        <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
          Registro imutável de ações, alterações e tentativas de acesso negadas neste ambiente.
        </p>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="search"
          placeholder="Buscar por usuário ou ação..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 220 }}
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Todos os eventos</option>
          <option value="denied">Apenas acessos negados</option>
          {eventTypes.map((t) => <option key={t} value={t}>{eventLabel(t)}</option>)}
        </select>
      </div>
    </div>

    {loading && <p style={{ color: "var(--muted)", fontSize: 13 }}>Carregando trilha de auditoria...</p>}
    {error && <p style={{ color: "#B42318", fontSize: 13 }}>Não foi possível carregar: {error}</p>}
    {!loading && !error && filtered.length === 0 && (
      <p style={{ color: "var(--muted)", fontSize: 13 }}>
        Nenhum evento registrado{filter !== "all" || search ? " com os filtros atuais" : " ainda"}. Eventos aparecem conforme ações sensíveis são executadas.
      </p>
    )}

    {!loading && !error && filtered.length > 0 && (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border, #e5e5e5)" }}>
              <th style={{ padding: "8px 10px" }}>Data/Hora</th>
              <th style={{ padding: "8px 10px" }}>Usuário</th>
              <th style={{ padding: "8px 10px" }}>Ação</th>
              <th style={{ padding: "8px 10px" }}>Entidade</th>
              <th style={{ padding: "8px 10px" }}>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} style={{ borderBottom: "1px solid var(--border, #f0f0f0)" }}>
                <td style={{ padding: "8px 10px", whiteSpace: "nowrap", color: "var(--muted)" }}>{formatDateTime(e.occurredAt)}</td>
                <td style={{ padding: "8px 10px" }}>{e.actorEmail ?? (e.actorId ? e.actorId.slice(0, 8) + "…" : "—")}</td>
                <td style={{ padding: "8px 10px" }}>
                  <span style={{
                    display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600,
                    background: e.eventType === "access.denied" ? "#FEF3F2" : "var(--rsbuild-terracotta-soft, #F9F3F1)",
                    color: e.eventType === "access.denied" ? "#B42318" : "var(--rsbuild-terracotta, #B5583C)"
                  }}>
                    {eventLabel(e.eventType)}
                  </span>
                </td>
                <td style={{ padding: "8px 10px", color: "var(--muted)" }}>
                  {ENTITY_LABELS[e.entityType] ?? e.entityType}
                  {e.entityId ? ` · ${e.entityId.slice(0, 8)}…` : ""}
                </td>
                <td style={{ padding: "8px 10px", color: "var(--muted)", maxWidth: 380 }}>
                  {summarizeMetadata(e.metadata) || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    {!loading && !error && events.length > filtered.length && (
      <p style={{ color: "var(--muted)", fontSize: 11, margin: 0 }}>
        Mostrando {filtered.length} de {events.length} eventos recentes.
      </p>
    )}
  </section>;
}
