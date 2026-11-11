"use client";

import { useCallback, useEffect, useState } from "react";

type Props = { organizationId: string; organizationName: string; role: string };
type Invitation = {
  id: string; email: string; role: string; status: string;
  expires_at: string; created_at: string; accepted_at?: string | null;
};

export function OrganizationAdminPanel({ organizationId, organizationName, role }: Props) {
  const canAdmin = role === "owner" || role === "admin";
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [banner, setBanner] = useState<string | null>(null);
  const [positionX, setPositionX] = useState(50);
  const [positionY, setPositionY] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  const loadInvitations = useCallback(async () => {
    if (!canAdmin) return;
    const response = await fetch("/api/organization-invitations?organizationId=" + encodeURIComponent(organizationId), { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível carregar os convites.");
    const data = await response.json();
    setInvitations(Array.isArray(data.invitations) ? data.invitations : []);
  }, [canAdmin, organizationId]);

  useEffect(() => {
    let active = true;
    fetch("/api/organization-branding?organizationId=" + encodeURIComponent(organizationId), { cache: "no-store" })
      .then(async (r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!active || !data) return;
        setBanner(data.bannerUrl);
        setPositionX(data.positionX);
        setPositionY(data.positionY);
        setZoom(data.zoom);
      }).catch(() => {});
    return () => { active = false; };
  }, [organizationId]);

  useEffect(() => {
    let active = true;
    loadInvitations().catch(() => {});
    return () => { active = false; };
  }, [loadInvitations]);

  async function sendInvite(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/organization-invitations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, email, role: inviteRole })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "invite_failed");
      setMessage("Convite enviado. O acesso será liberado após a aceitação e validação.");
      setEmail("");
      await loadInvitations();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar o convite.");
    } finally { setBusy(false); }
  }

  async function manageInvitation(invitationId: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/organization-invitations?organizationId=" + encodeURIComponent(organizationId) + "&invitationId=" + encodeURIComponent(invitationId), { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "invitation_action_failed");
      setMessage("Convite revogado.");
      await loadInvitations();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar o convite.");
    } finally { setBusy(false); }
  }

  async function saveBanner(event: React.FormEvent) {
    event.preventDefault();
    if (!file) { setMessage("Selecione uma imagem para o banner."); return; }
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      form.set("organizationId", organizationId);
      form.set("file", file);
      form.set("positionX", String(positionX));
      form.set("positionY", String(positionY));
      form.set("zoom", String(zoom));
      const response = await fetch("/api/organization-branding", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "banner_save_failed");
      setBanner(data.bannerUrl);
      setFile(null);
      setMessage("Banner salvo para " + organizationName + ".");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o banner.");
    } finally { setBusy(false); }
  }

  return <section className="panel" style={{ padding: 22, marginBottom: 20, display: "grid", gap: 22 }}>
    <div>
      <div className="eyebrow">ADMINISTRAÇÃO DA ORGANIZAÇÃO</div>
      <h2 style={{ margin: "6px 0" }}>{organizationName}</h2>
      <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>Convites e identidade visual ficam vinculados ao UUID desta organização.</p>
    </div>
    {canAdmin && <>
      <form onSubmit={sendInvite} style={{ display: "grid", gap: 10, maxWidth: 560 }}>
        <h3 style={{ margin: 0 }}>Convidar integrante</h3>
        <label style={{ display: "grid", gap: 5, fontSize: 12 }}>E-mail
          <input type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="pessoa@empresa.com" />
        </label>
        <label style={{ display: "grid", gap: 5, fontSize: 12 }}>Papel
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
            <option value="viewer">Visualização</option>
            <option value="operator">Operação</option>
            {role === "owner" && <option value="admin">Administrador</option>}
          </select>
        </label>
        <button className="primary-button" disabled={busy} type="submit">{busy ? "Enviando…" : "Enviar convite"}</button>
      </form>
      <div style={{ display: "grid", gap: 10 }}>
        <h3 style={{ margin: 0 }}>Convites da organização</h3>
        {invitations.length === 0 && <p style={{ color: "var(--muted)", fontSize: 12 }}>Nenhum convite registrado.</p>}
        {invitations.map(invitation => <div key={invitation.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
          <div style={{ minWidth: 180 }}>
            <strong style={{ fontSize: 12 }}>{invitation.email}</strong>
            <div style={{ color: "var(--muted)", fontSize: 11 }}>{invitation.role} · {invitation.status} · expira {new Date(invitation.expires_at).toLocaleDateString("pt-BR")}</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["pending", "sent", "failed"].includes(invitation.status) && <button type="button" className="secondary-button" disabled={busy} onClick={() => manageInvitation(invitation.id)}>Revogar</button>}
          </div>
        </div>)}
      </div>
    </>}
    <form onSubmit={saveBanner} style={{ display: "grid", gap: 12 }}>
      <h3 style={{ margin: 0 }}>Banner exclusivo da empresa</h3>
      {banner && <div style={{ height: 170, overflow: "hidden", borderRadius: 9, background: "#171717" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={banner} alt={"Banner de " + organizationName} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: positionX + "% " + positionY + "%", transform: "scale(" + zoom + ")" }} />
      </div>}
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} disabled={!canAdmin} />
      <label style={{ display: "grid", gap: 5, fontSize: 12 }}>Enquadramento horizontal
        <input type="range" min="0" max="100" value={positionX} onChange={e => setPositionX(Number(e.target.value))} disabled={!canAdmin} />
      </label>
      <label style={{ display: "grid", gap: 5, fontSize: 12 }}>Enquadramento vertical
        <input type="range" min="0" max="100" value={positionY} onChange={e => setPositionY(Number(e.target.value))} disabled={!canAdmin} />
      </label>
      <label style={{ display: "grid", gap: 5, fontSize: 12 }}>Zoom
        <input type="range" min="1" max="3" step="0.05" value={zoom} onChange={e => setZoom(Number(e.target.value))} disabled={!canAdmin} />
      </label>
      <button className="primary-button" type="submit" disabled={!canAdmin || busy || !file}>{busy ? "Salvando…" : "Salvar banner e enquadramento"}</button>
      {!canAdmin && <p style={{ color: "var(--muted)", fontSize: 11 }}>Somente owner/admin pode alterar a identidade visual.</p>}
    </form>
    {message && <p role="status" style={{ fontSize: 12, color: "var(--muted)" }}>{message}</p>}
  </section>;
}
