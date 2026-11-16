"use client";

import { useEffect, useMemo, useState } from "react";

type DirectoryMember = {
  userId: string;
  email: string | null;
  role: string;
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

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  operator: "Operação",
  viewer: "Visualização"
};

const LEVEL_LABELS: Record<string, string> = {
  viewer: "Visualização",
  contributor: "Contribuição"
};

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function AccessDirectoryView() {
  const [orgs, setOrgs] = useState<DirectoryOrg[]>([]);
  const [projects, setProjects] = useState<ProjectGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantLevel, setGrantLevel] = useState("viewer");
  const [grantOrgLevel, setGrantOrgLevel] = useState("viewer");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/access-directory", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "access_directory_failed");
      setOrgs(data.organizations ?? []);
      setProjects(data.projects ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "access_directory_failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const allUsers = useMemo(() => {
    const map = new Map<string, string>();
    for (const org of orgs) for (const m of org.members) map.set(m.userId, m.email ?? m.userId.slice(0, 8));
    return [...map.entries()].map(([userId, email]) => ({ userId, email }));
  }, [orgs]);

  const term = search.trim().toLowerCase();
  const filteredOrgs = orgs.filter((o) =>
    !term || o.displayName.toLowerCase().includes(term) || o.slug.includes(term)
    || o.members.some((m) => (m.email ?? "").toLowerCase().includes(term))
  );
  const filteredProjects = projects.filter((p) =>
    !term || p.name.toLowerCase().includes(term) || p.clientDisplayName.toLowerCase().includes(term)
  );

  async function grantAccess(projectId: string, targetType: "user" | "organization", targetId: string, accessLevel: string) {
    if (!targetId) return;
    setBusy(true); setNotice("");
    try {
      const res = await fetch("/api/project-access", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, targetType, targetId, accessLevel })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "grant_failed");
      setNotice("Acesso concedido.");
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "grant_failed");
    } finally {
      setBusy(false);
    }
  }

  async function revokeAccess(projectId: string, targetType: "user" | "organization", targetId: string) {
    setBusy(true); setNotice("");
    try {
      const res = await fetch(`/api/project-access?projectId=${projectId}&targetType=${targetType}&targetId=${targetId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "revoke_failed");
      setNotice("Acesso revogado.");
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "revoke_failed");
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel" style={{ padding: 22, display: "grid", gap: 20 }}>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div>
        <div className="eyebrow">ACESSOS &amp; IDENTIDADES</div>
        <h2 style={{ margin: "6px 0" }}>Central de Acessos RSBUILD</h2>
        <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
          Membros, convites e permissões por projeto em todas as organizações — visão consolidada da holding.
        </p>
      </div>
      <input type="search" placeholder="Buscar organização ou pessoa..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 240 }} />
    </div>

    {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}
    {loading && <p style={{ color: "var(--muted)", fontSize: 13 }}>Carregando diretório de acessos...</p>}
    {error && <p style={{ color: "#B42318", fontSize: 13 }}>Não foi possível carregar: {error}</p>}

    {!loading && !error && (
      <>
        {/* Organizações e membros */}
        <div>
          <h3 style={{ fontSize: 15, margin: "0 0 10px" }}>Organizações &amp; Equipes</h3>
          <div style={{ display: "grid", gap: 14 }}>
            {filteredOrgs.map((org) => (
              <div key={org.id} style={{ border: "1px solid var(--rsbuild-border)", borderRadius: 10, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <strong>{org.displayName}</strong>
                  <span style={{ fontSize: 11, color: "var(--rsbuild-muted)" }}>{org.slug} · {org.members.length} membro(s)</span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--rsbuild-muted)" }}>
                      <th style={{ padding: "4px 8px" }}>E-mail</th>
                      <th style={{ padding: "4px 8px" }}>Papel</th>
                      <th style={{ padding: "4px 8px" }}>Último login</th>
                      <th style={{ padding: "4px 8px" }}>Desde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {org.members.map((m) => (
                      <tr key={m.userId} style={{ borderTop: "1px solid var(--rsbuild-border)" }}>
                        <td style={{ padding: "6px 8px" }}>{m.email ?? m.userId.slice(0, 8) + "…"}</td>
                        <td style={{ padding: "6px 8px" }}>{ROLE_LABELS[m.role] ?? m.role}</td>
                        <td style={{ padding: "6px 8px", color: "var(--rsbuild-muted)" }}>{formatDateTime(m.lastSignInAt)}</td>
                        <td style={{ padding: "6px 8px", color: "var(--rsbuild-muted)" }}>{formatDate(m.memberSince)}</td>
                      </tr>
                    ))}
                    {org.invitations.filter((i) => i.status !== "failed").map((i, idx) => (
                      <tr key={`inv-${idx}`} style={{ borderTop: "1px solid var(--rsbuild-border)", opacity: 0.7 }}>
                        <td style={{ padding: "6px 8px" }}>{i.email}</td>
                        <td style={{ padding: "6px 8px" }}>Convite · {ROLE_LABELS[i.role] ?? i.role}</td>
                        <td style={{ padding: "6px 8px", color: "var(--rsbuild-muted)" }}>—</td>
                        <td style={{ padding: "6px 8px", color: "var(--rsbuild-muted)" }}>{formatDate(i.invitedAt)}</td>
                      </tr>
                    ))}
                    {org.members.length === 0 && org.invitations.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: "8px", color: "var(--rsbuild-muted)" }}>Sem membros registrados.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>

        {/* Acesso por projeto */}
        <div>
          <h3 style={{ fontSize: 15, margin: "0 0 10px" }}>Acesso por Projeto</h3>
          <p style={{ fontSize: 12, color: "var(--rsbuild-muted)", margin: "0 0 12px" }}>
            Grants individuais (pessoa) e por organização. O acesso de projeto sempre exige membership válida na organização — nunca concede acesso organizacional por si só.
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {filteredProjects.map((p) => {
              const expanded = expandedProject === p.id;
              return (
                <div key={p.id} style={{ border: "1px solid var(--rsbuild-border)", borderRadius: 10, padding: 14 }}>
                  <button
                    type="button"
                    onClick={() => setExpandedProject(expanded ? null : p.id)}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", width: "100%" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong>{p.name}</strong>
                        <span style={{ fontSize: 12, color: "var(--rsbuild-muted)", marginLeft: 8 }}>{p.clientDisplayName}</span>
                      </div>
                      <span style={{ fontSize: 12, color: "var(--rsbuild-muted)" }}>
                        {p.memberGrants.length} pessoa(s) · {p.organizationGrants.length} org(s) {expanded ? "▲" : "▼"}
                      </span>
                    </div>
                  </button>

                  {expanded && (
                    <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Pessoas com acesso</div>
                        {p.memberGrants.length === 0 && <div style={{ fontSize: 12, color: "var(--rsbuild-muted)" }}>Nenhum grant individual — acesso via organização.</div>}
                        {p.memberGrants.map((g) => (
                          <div key={g.userId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", fontSize: 12, borderTop: "1px solid var(--rsbuild-border)" }}>
                            <span style={{ flex: 1 }}>{g.email ?? g.userId.slice(0, 8)}</span>
                            <span style={{ color: "var(--rsbuild-muted)" }}>{LEVEL_LABELS[g.accessLevel] ?? g.accessLevel}</span>
                            <button type="button" disabled={busy} onClick={() => revokeAccess(p.id, "user", g.userId)} className="secondary-button" style={{ fontSize: 11, padding: "3px 8px" }}>Revogar</button>
                          </div>
                        ))}
                        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                          <select value={grantUserId} onChange={(e) => setGrantUserId(e.target.value)}>
                            <option value="">Selecionar pessoa…</option>
                            {allUsers.map((u) => <option key={u.userId} value={u.userId}>{u.email}</option>)}
                          </select>
                          <select value={grantLevel} onChange={(e) => setGrantLevel(e.target.value)}>
                            <option value="viewer">Visualização</option>
                            <option value="contributor">Contribuição</option>
                          </select>
                          <button
                            type="button" disabled={busy || !grantUserId}
                            onClick={() => { grantAccess(p.id, "user", grantUserId, grantLevel); setGrantUserId(""); }}
                            className="primary-button" style={{ fontSize: 12, padding: "6px 12px" }}
                          >Conceder</button>
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Organização cliente</div>
                        <p style={{ fontSize: 12, color: "var(--rsbuild-muted)", margin: "0 0 8px" }}>
                          O acesso organizacional é sempre da organização cliente deste projeto — o modelo não permite grants para outras empresas.
                        </p>
                        {p.organizationGrants.length === 0 && p.clientOrganizationId && (
                          <div style={{ fontSize: 12, color: "var(--rsbuild-muted)", padding: "5px 0" }}>
                            {p.clientDisplayName} — sem grant organizacional ativo.
                          </div>
                        )}
                        {p.organizationGrants.map((g) => (
                          <div key={g.organizationId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", fontSize: 12, borderTop: "1px solid var(--rsbuild-border)" }}>
                            <span style={{ flex: 1 }}>{g.organizationName ?? p.clientDisplayName}</span>
                            <span style={{ color: "var(--rsbuild-muted)" }}>{LEVEL_LABELS[g.accessLevel] ?? g.accessLevel}</span>
                            <button type="button" disabled={busy} onClick={() => revokeAccess(p.id, "organization", g.organizationId)} className="secondary-button" style={{ fontSize: 11, padding: "3px 8px" }}>Revogar</button>
                          </div>
                        ))}
                        {p.clientOrganizationId && p.organizationGrants.length === 0 && (
                          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <span style={{ fontSize: 12 }}>{p.clientDisplayName}</span>
                            <select value={grantOrgLevel} onChange={(e) => setGrantOrgLevel(e.target.value)}>
                              <option value="viewer">Visualização</option>
                              <option value="contributor">Contribuição</option>
                            </select>
                            <button
                              type="button" disabled={busy}
                              onClick={() => grantAccess(p.id, "organization", p.clientOrganizationId as string, grantOrgLevel)}
                              className="primary-button" style={{ fontSize: 12, padding: "6px 12px" }}
                            >Conceder acesso</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredProjects.length === 0 && !loading && (
              <p style={{ fontSize: 12, color: "var(--rsbuild-muted)" }}>Nenhum projeto encontrado.</p>
            )}
          </div>
        </div>
      </>
    )}
  </section>;
}
