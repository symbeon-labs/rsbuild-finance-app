"use client";

import { useEffect, useMemo, useState } from "react";

type DirectoryMember = {
  userId: string;
  email: string | null;
  role: string;
  customTitle: string | null;
  lastSignInAt: string | null;
  memberSince: string;
};

type DirectoryInvitation = {
  email: string;
  role: string;
  status: string;
  invitedAt: string;
};

type DirectoryOrg = {
  id: string;
  slug: string;
  displayName: string;
  members: DirectoryMember[];
  invitations: DirectoryInvitation[];
};

type ProjectGrant = {
  id: string;
  name: string;
  projectKey: string;
  status: string;
  clientOrganizationId: string | null;
  clientDisplayName: string;
  memberGrants: Array<{ userId: string; email: string | null; accessLevel: string; grantedAt: string }>;
  organizationGrants: Array<{ organizationId: string; organizationName: string | null; accessLevel: string; grantedAt: string }>;
};

const ROLE_METADATA: Record<string, { label: string; bg: string; color: string; border: string }> = {
  owner: {
    label: "Proprietário",
    bg: "rgba(16, 185, 129, 0.12)",
    color: "#059669",
    border: "rgba(16, 185, 129, 0.28)"
  },
  admin: {
    label: "Administrador",
    bg: "rgba(181, 88, 60, 0.14)",
    color: "#B5583C",
    border: "rgba(181, 88, 60, 0.3)"
  },
  operator: {
    label: "Operação",
    bg: "rgba(37, 99, 235, 0.12)",
    color: "#2563EB",
    border: "rgba(37, 99, 235, 0.25)"
  },
  viewer: {
    label: "Visualização",
    bg: "rgba(100, 116, 139, 0.12)",
    color: "#64748B",
    border: "rgba(100, 116, 139, 0.22)"
  }
};

const LEVEL_METADATA: Record<string, { label: string; bg: string; color: string }> = {
  viewer: {
    label: "Visualização",
    bg: "rgba(100, 116, 139, 0.12)",
    color: "#64748B"
  },
  contributor: {
    label: "Contribuição",
    bg: "rgba(37, 99, 235, 0.12)",
    color: "#2563EB"
  }
};

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function AccessDirectoryView() {
  const [orgs, setOrgs] = useState<DirectoryOrg[]>([]);
  const [projects, setProjects] = useState<ProjectGrant[]>([]);
  const [adminMode, setAdminMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"organizations" | "projects">("organizations");
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantLevel, setGrantLevel] = useState("viewer");
  const [grantOrgLevel, setGrantOrgLevel] = useState("viewer");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [editingTitle, setEditingTitle] = useState<{ orgId: string; userId: string; current: string } | null>(null);
  const [newTitle, setNewTitle] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/access-directory", { cache: "no-store" });
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Resposta do servidor não pôde ser interpretada (HTTP ${res.status}).`);
      }
      if (!res.ok) {
        throw new Error(data.message || data.error || `Erro de carregamento (HTTP ${res.status})`);
      }
      setOrgs(data.organizations ?? []);
      setProjects(data.projects ?? []);
      setAdminMode(Boolean(data.adminMode));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar diretório de acessos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const allUsers = useMemo(() => {
    const map = new Map<string, string>();
    for (const org of orgs) {
      for (const m of org.members) {
        map.set(m.userId, m.email ?? m.userId.slice(0, 8));
      }
    }
    return [...map.entries()].map(([userId, email]) => ({ userId, email }));
  }, [orgs]);

  const totalMembers = useMemo(() => {
    return orgs.reduce((acc, o) => acc + o.members.length, 0);
  }, [orgs]);

  const totalInvites = useMemo(() => {
    return orgs.reduce((acc, o) => acc + o.invitations.filter((i) => i.status !== "failed").length, 0);
  }, [orgs]);

  const term = search.trim().toLowerCase();
  const filteredOrgs = useMemo(() => {
    return orgs.filter(
      (o) =>
        !term ||
        o.displayName.toLowerCase().includes(term) ||
        o.slug.includes(term) ||
        o.members.some((m) => (m.email ?? "").toLowerCase().includes(term))
    );
  }, [orgs, term]);

  const filteredProjects = useMemo(() => {
    return projects.filter(
      (p) =>
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.clientDisplayName.toLowerCase().includes(term) ||
        p.projectKey.toLowerCase().includes(term)
    );
  }, [projects, term]);

  async function grantAccess(projectId: string, targetType: "user" | "organization", targetId: string, accessLevel: string) {
    if (!targetId) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/project-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, targetType, targetId, accessLevel })
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {}
      if (!res.ok) throw new Error(data.message || data.error || "Falha ao conceder acesso.");
      setNotice({ message: "Acesso concedido com sucesso.", type: "success" });
      await load();
    } catch (e) {
      setNotice({ message: e instanceof Error ? e.message : "Falha ao conceder acesso.", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function revokeAccess(projectId: string, targetType: "user" | "organization", targetId: string) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/project-access?projectId=${projectId}&targetType=${targetType}&targetId=${targetId}`, {
        method: "DELETE"
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {}
      if (!res.ok) throw new Error(data.message || data.error || "Falha ao revogar acesso.");
      setNotice({ message: "Acesso revogado com sucesso.", type: "success" });
      await load();
    } catch (e) {
      setNotice({ message: e instanceof Error ? e.message : "Falha ao revogar acesso.", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function updateCustomTitle(organizationId: string, userId: string, customTitle: string | null) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/member-titles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, userId, customTitle })
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {}
      if (!res.ok) throw new Error(data.error || data.message || "Falha ao atualizar título.");
      setNotice({ message: customTitle ? "Título personalizado definido." : "Título personalizado removido.", type: "success" });
      setEditingTitle(null);
      setNewTitle("");
      await load();
    } catch (e) {
      setNotice({ message: e instanceof Error ? e.message : "Falha ao atualizar título.", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ display: "grid", gap: 20 }}>
      {/* Hero Header */}
      <div
        className="card cockpit-card cockpit-hero"
        style={{
          padding: "24px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16
        }}
      >
        <div>
          <div className="eyebrow" style={{ color: "var(--rsbuild-terracotta)", marginBottom: 6 }}>
            GOVERNANÇA &amp; IDENTIDADES
          </div>
          <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>
            Central de Acessos &amp; Matriz de Identidades
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", maxWidth: 640, lineHeight: 1.5 }}>
            Diretório consolidado de organizações, operadores e matriz de permissões por projeto. Governança cross-tenant com auditoria pericial nativa.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <input
              type="search"
              placeholder="Buscar organização ou usuário…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                minWidth: 260,
                padding: "8px 14px",
                fontSize: 13,
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--surface)",
                color: "var(--ink)",
                outline: "none"
              }}
            />
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="secondary-button"
            style={{
              padding: "8px 14px",
              fontSize: 13,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "var(--surface)",
              color: "var(--ink)"
            }}
          >
            {loading ? "Atualizando…" : "↻ Recarregar"}
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <div className="card cockpit-card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase" }}>
            Organizações
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ink)", margin: "4px 0" }}>{orgs.length}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>No radar da holding</div>
        </div>

        <div className="card cockpit-card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase" }}>
            Membros Ativos
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ink)", margin: "4px 0" }}>{totalMembers}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Cadastrados no ecossistema</div>
        </div>

        <div className="card cockpit-card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase" }}>
            Convites Pendentes
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: totalInvites > 0 ? "var(--rsbuild-terracotta)" : "var(--ink)", margin: "4px 0" }}>
            {totalInvites}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Aguardando ativação</div>
        </div>

        <div className="card cockpit-card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase" }}>
            Projetos Governados
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ink)", margin: "4px 0" }}>{projects.length}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Com alçadas configuradas</div>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: 8,
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: notice.type === "success" ? "rgba(16, 185, 129, 0.12)" : "rgba(220, 38, 38, 0.12)",
            color: notice.type === "success" ? "#059669" : "#DC2626",
            border: `1px solid ${notice.type === "success" ? "rgba(16, 185, 129, 0.3)" : "rgba(220, 38, 38, 0.3)"}`
          }}
        >
          <span>{notice.message}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="card cockpit-card" style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
          Carregando diretório de acessos e matriz de identidade…
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div
          className="card cockpit-card"
          style={{
            padding: 24,
            borderLeft: "4px solid #DC2626",
            background: "var(--surface)",
            display: "grid",
            gap: 12
          }}
        >
          <div style={{ fontWeight: 700, color: "#DC2626", fontSize: 15 }}>
            Não foi possível carregar a Central de Acessos
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>{error}</p>
          <div>
            <button
              type="button"
              onClick={load}
              className="primary-button"
              style={{
                padding: "8px 16px",
                fontSize: 13,
                borderRadius: 8,
                background: "var(--rsbuild-terracotta)",
                color: "#FFFFFF",
                border: "none"
              }}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!loading && !error && (
        <div className="card cockpit-card" style={{ padding: "20px 24px" }}>
          {/* Navigation Tabs */}
          <div className="admin-tabs" style={{ marginBottom: 20 }}>
            <button
              type="button"
              className={`admin-tab-btn ${activeTab === "organizations" ? "active" : ""}`}
              onClick={() => setActiveTab("organizations")}
            >
              🏢 Organizações &amp; Equipes ({filteredOrgs.length})
            </button>
            <button
              type="button"
              className={`admin-tab-btn ${activeTab === "projects" ? "active" : ""}`}
              onClick={() => setActiveTab("projects")}
            >
              🔐 Acesso por Projeto ({filteredProjects.length})
            </button>
          </div>

          {/* TAB 1: Organizações & Equipes */}
          {activeTab === "organizations" && (
            <div style={{ display: "grid", gap: 18 }}>
              {filteredOrgs.map((org) => {
                const isMDS = org.slug.includes("sabor") || org.slug.includes("mds");
                const isHub = org.slug.includes("acai") || org.slug.includes("hub");
                const accentColor = isMDS ? "#2563EB" : isHub ? "#7C3AED" : "var(--rsbuild-terracotta)";

                return (
                  <div
                    key={org.id}
                    style={{
                      borderRadius: 10,
                      border: "1px solid var(--line)",
                      background: "var(--surface-raised)",
                      overflow: "hidden",
                      borderTop: `3px solid ${accentColor}`
                    }}
                  >
                    <div
                      style={{
                        padding: "14px 18px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 10,
                        borderBottom: "1px solid var(--line)"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <strong style={{ fontSize: 15, color: "var(--ink)" }}>{org.displayName}</strong>
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: "rgba(100, 116, 139, 0.12)",
                            color: "var(--muted)",
                            fontFamily: "monospace"
                          }}
                        >
                          {org.slug}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>
                        {org.members.length} membro(s) cadastrado(s)
                      </span>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                        <thead>
                          <tr style={{ background: "var(--surface)", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            <th style={{ padding: "10px 18px", fontWeight: 600 }}>Operador / E-mail</th>
                            <th style={{ padding: "10px 18px", fontWeight: 600 }}>Papel Institucional</th>
                            <th style={{ padding: "10px 18px", fontWeight: 600 }}>Último Acesso</th>
                            <th style={{ padding: "10px 18px", fontWeight: 600 }}>Membro Desde</th>
                          </tr>
                        </thead>
                        <tbody>
                          {org.members.map((m) => {
                            const meta = ROLE_METADATA[m.role] ?? ROLE_METADATA.viewer;
                            const isEditing = editingTitle?.orgId === org.id && editingTitle?.userId === m.userId;
                            const displayLabel = m.customTitle || meta.label;
                            return (
                              <tr
                                key={m.userId}
                                style={{
                                  borderTop: "1px solid var(--line)",
                                  transition: "background 0.15s ease"
                                }}
                              >
                                <td style={{ padding: "12px 18px", color: "var(--ink)", fontWeight: 500 }}>
                                  {m.email ?? `${m.userId.slice(0, 12)}…`}
                                </td>
                                <td style={{ padding: "12px 18px" }}>
                                  {isEditing ? (
                                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                      <input
                                        type="text"
                                        value={newTitle}
                                        onChange={(e) => setNewTitle(e.target.value)}
                                        placeholder="Título personalizado"
                                        maxLength={100}
                                        style={{
                                          padding: "4px 8px",
                                          fontSize: 11,
                                          borderRadius: 6,
                                          border: "1px solid var(--line)",
                                          background: "var(--surface)",
                                          color: "var(--ink)",
                                          width: 140
                                        }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => updateCustomTitle(org.id, m.userId, newTitle.trim() || null)}
                                        disabled={busy}
                                        style={{
                                          padding: "4px 8px",
                                          fontSize: 10,
                                          borderRadius: 6,
                                          background: "var(--rsbuild-terracotta)",
                                          color: "#fff",
                                          border: "none",
                                          cursor: "pointer"
                                        }}
                                      >
                                        Salvar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingTitle(null);
                                          setNewTitle("");
                                        }}
                                        style={{
                                          padding: "4px 8px",
                                          fontSize: 10,
                                          borderRadius: 6,
                                          background: "var(--surface)",
                                          color: "var(--muted)",
                                          border: "1px solid var(--line)",
                                          cursor: "pointer"
                                        }}
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  ) : (
                                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                      <span
                                        style={{
                                          display: "inline-block",
                                          padding: "3px 10px",
                                          borderRadius: 6,
                                          fontSize: 11,
                                          fontWeight: 600,
                                          background: meta.bg,
                                          color: meta.color,
                                          border: `1px solid ${meta.border}`
                                        }}
                                      >
                                        {displayLabel}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingTitle({ orgId: org.id, userId: m.userId, current: m.customTitle || "" });
                                          setNewTitle(m.customTitle || "");
                                        }}
                                        style={{
                                          padding: "2px 6px",
                                          fontSize: 10,
                                          borderRadius: 4,
                                          background: "transparent",
                                          color: "var(--muted)",
                                          border: "1px solid var(--line)",
                                          cursor: "pointer"
                                        }}
                                        title="Editar título personalizado"
                                      >
                                        ✏️
                                      </button>
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: "12px 18px", color: "var(--muted)", fontSize: 12 }}>
                                  {formatDateTime(m.lastSignInAt)}
                                </td>
                                <td style={{ padding: "12px 18px", color: "var(--muted)", fontSize: 12 }}>
                                  {formatDate(m.memberSince)}
                                </td>
                              </tr>
                            );
                          })}

                          {org.invitations
                            .filter((i) => i.status !== "failed")
                            .map((i, idx) => {
                              const meta = ROLE_METADATA[i.role] ?? ROLE_METADATA.viewer;
                              return (
                                <tr
                                  key={`inv-${idx}`}
                                  style={{
                                    borderTop: "1px solid var(--line)",
                                    opacity: 0.85,
                                    background: "rgba(245, 158, 11, 0.04)"
                                  }}
                                >
                                  <td style={{ padding: "12px 18px", color: "var(--ink)" }}>{i.email}</td>
                                  <td style={{ padding: "12px 18px" }}>
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        padding: "3px 10px",
                                        borderRadius: 6,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        background: "rgba(245, 158, 11, 0.12)",
                                        color: "#D97706",
                                        border: "1px solid rgba(245, 158, 11, 0.28)"
                                      }}
                                    >
                                      Convite · {meta.label}
                                    </span>
                                  </td>
                                  <td style={{ padding: "12px 18px", color: "var(--muted)", fontSize: 12 }}>
                                    Aguardando aceite
                                  </td>
                                  <td style={{ padding: "12px 18px", color: "var(--muted)", fontSize: 12 }}>
                                    {formatDate(i.invitedAt)}
                                  </td>
                                </tr>
                              );
                            })}

                          {org.members.length === 0 && org.invitations.length === 0 && (
                            <tr>
                              <td colSpan={4} style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>
                                Nenhum membro ou convite ativo registrado para esta organização.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              {filteredOrgs.length === 0 && (
                <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
                  Nenhuma organização encontrada para o filtro &ldquo;{search}&rdquo;.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Acesso por Projeto */}
          {activeTab === "projects" && (
            <div style={{ display: "grid", gap: 14 }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                Grants individuais e corporativos vinculados às esteiras de projeto. O acesso exige associação ativa à organização mantenedora.
              </p>

              {filteredProjects.map((p) => {
                const expanded = expandedProject === p.id;
                return (
                  <div
                    key={p.id}
                    style={{
                      borderRadius: 10,
                      border: "1px solid var(--line)",
                      background: "var(--surface-raised)",
                      overflow: "hidden"
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedProject(expanded ? null : p.id)}
                      style={{
                        width: "100%",
                        padding: "16px 20px",
                        background: "none",
                        border: "none",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                        textAlign: "left"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: 6,
                            background: "var(--rsbuild-terracotta-soft)",
                            color: "var(--rsbuild-terracotta)",
                            fontFamily: "monospace"
                          }}
                        >
                          {p.projectKey}
                        </span>
                        <div>
                          <strong style={{ fontSize: 15, color: "var(--ink)", display: "block" }}>{p.name}</strong>
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>{p.clientDisplayName}</span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>
                          {p.memberGrants.length} pessoa(s) · {p.organizationGrants.length} org(s)
                        </span>
                        <span style={{ fontSize: 14, color: "var(--muted)" }}>{expanded ? "▲" : "▼"}</span>
                      </div>
                    </button>

                    {expanded && (
                      <div
                        style={{
                          padding: "16px 20px 20px",
                          borderTop: "1px solid var(--line)",
                          background: "var(--surface)",
                          display: "grid",
                          gap: 18
                        }}
                      >
                        {/* Pessoas com Acesso */}
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
                            Pessoas com Acesso ao Projeto
                          </div>
                          {p.memberGrants.length === 0 && (
                            <div style={{ fontSize: 12, color: "var(--muted)", padding: "6px 0" }}>
                              Nenhum grant individual — o acesso é concedido via papel na organização.
                            </div>
                          )}
                          <div style={{ display: "grid", gap: 6 }}>
                            {p.memberGrants.map((g) => {
                              const meta = LEVEL_METADATA[g.accessLevel] ?? LEVEL_METADATA.viewer;
                              return (
                                <div
                                  key={g.userId}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "8px 12px",
                                    borderRadius: 6,
                                    border: "1px solid var(--line)",
                                    background: "var(--surface-raised)",
                                    fontSize: 12
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                                      {g.email ?? g.userId.slice(0, 10)}
                                    </span>
                                    <span
                                      style={{
                                        padding: "2px 8px",
                                        borderRadius: 4,
                                        fontSize: 10,
                                        fontWeight: 600,
                                        background: meta.bg,
                                        color: meta.color
                                      }}
                                    >
                                      {meta.label}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => revokeAccess(p.id, "user", g.userId)}
                                    className="secondary-button"
                                    style={{
                                      fontSize: 11,
                                      padding: "3px 10px",
                                      borderRadius: 6,
                                      border: "1px solid var(--line)",
                                      background: "var(--surface)",
                                      color: "#DC2626"
                                    }}
                                  >
                                    Revogar
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          {/* Formulário Conceder Grant Pessoa */}
                          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
                            <select
                              value={grantUserId}
                              onChange={(e) => setGrantUserId(e.target.value)}
                              style={{
                                padding: "8px 12px",
                                borderRadius: 8,
                                border: "1px solid var(--line)",
                                background: "var(--surface)",
                                color: "var(--ink)",
                                fontSize: 12,
                                minWidth: 220
                              }}
                            >
                              <option value="">Selecionar operador…</option>
                              {allUsers.map((u) => (
                                <option key={u.userId} value={u.userId}>
                                  {u.email}
                                </option>
                              ))}
                            </select>

                            <select
                              value={grantLevel}
                              onChange={(e) => setGrantLevel(e.target.value)}
                              style={{
                                padding: "8px 12px",
                                borderRadius: 8,
                                border: "1px solid var(--line)",
                                background: "var(--surface)",
                                color: "var(--ink)",
                                fontSize: 12
                              }}
                            >
                              <option value="viewer">Visualização</option>
                              <option value="contributor">Contribuição</option>
                            </select>

                            <button
                              type="button"
                              disabled={busy || !grantUserId}
                              onClick={() => {
                                grantAccess(p.id, "user", grantUserId, grantLevel);
                                setGrantUserId("");
                              }}
                              className="primary-button"
                              style={{
                                padding: "8px 14px",
                                fontSize: 12,
                                borderRadius: 8,
                                background: "var(--rsbuild-terracotta)",
                                color: "#FFFFFF",
                                border: "none"
                              }}
                            >
                              Conceder Acesso
                            </button>
                          </div>
                        </div>

                        {/* Grant Organização Cliente */}
                        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
                            Acesso Organizacional da Empresa Cliente
                          </div>
                          <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted)" }}>
                            Habilita visualização unificada para todos os membros ativos da empresa cliente vinculada.
                          </p>

                          {p.organizationGrants.length === 0 && p.clientOrganizationId && (
                            <div style={{ fontSize: 12, color: "var(--muted)", padding: "6px 0" }}>
                              {p.clientDisplayName} — sem grant corporativo ativo no momento.
                            </div>
                          )}

                          <div style={{ display: "grid", gap: 6 }}>
                            {p.organizationGrants.map((g) => {
                              const meta = LEVEL_METADATA[g.accessLevel] ?? LEVEL_METADATA.viewer;
                              return (
                                <div
                                  key={g.organizationId}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "8px 12px",
                                    borderRadius: 6,
                                    border: "1px solid var(--line)",
                                    background: "var(--surface-raised)",
                                    fontSize: 12
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                                      {g.organizationName ?? p.clientDisplayName}
                                    </span>
                                    <span
                                      style={{
                                        padding: "2px 8px",
                                        borderRadius: 4,
                                        fontSize: 10,
                                        fontWeight: 600,
                                        background: meta.bg,
                                        color: meta.color
                                      }}
                                    >
                                      {meta.label}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => revokeAccess(p.id, "organization", g.organizationId)}
                                    className="secondary-button"
                                    style={{
                                      fontSize: 11,
                                      padding: "3px 10px",
                                      borderRadius: 6,
                                      border: "1px solid var(--line)",
                                      background: "var(--surface)",
                                      color: "#DC2626"
                                    }}
                                  >
                                    Revogar
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          {p.clientOrganizationId && p.organizationGrants.length === 0 && (
                            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{p.clientDisplayName}</span>
                              <select
                                value={grantOrgLevel}
                                onChange={(e) => setGrantOrgLevel(e.target.value)}
                                style={{
                                  padding: "8px 12px",
                                  borderRadius: 8,
                                  border: "1px solid var(--line)",
                                  background: "var(--surface)",
                                  color: "var(--ink)",
                                  fontSize: 12
                                }}
                              >
                                <option value="viewer">Visualização</option>
                                <option value="contributor">Contribuição</option>
                              </select>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => grantAccess(p.id, "organization", p.clientOrganizationId as string, grantOrgLevel)}
                                className="primary-button"
                                style={{
                                  padding: "8px 14px",
                                  fontSize: 12,
                                  borderRadius: 8,
                                  background: "var(--rsbuild-terracotta)",
                                  color: "#FFFFFF",
                                  border: "none"
                                }}
                              >
                                Conceder Acesso Organizacional
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredProjects.length === 0 && (
                <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
                  Nenhum projeto encontrado para o filtro &ldquo;{search}&rdquo;.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
