"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { getCapabilityLicensingData, setCapabilityLicense } from "@/app/actions/capability-licenses";

type CatalogItem = { capability_key: string; display_name: string; description: string };
type Organization = { id: string; display_name: string; slug: string };
type License = { organization_id: string; capability_key: string; license_status: string; operational_status: string; notes: string | null; updated_at: string };
type Event = { id: string; organization_id: string; capability_key: string; event_type: string; reason: string | null; created_at: string };

const LICENSE_LABELS: Record<string, string> = {
  blocked: "Bloqueado", granted: "Liberado", suspended: "Suspenso", revoked: "Revogado"
};
const OPERATIONAL_LABELS: Record<string, string> = {
  not_implemented: "Não implementado", in_development: "Em desenvolvimento",
  available: "Disponível", active: "Ativo"
};

export function CapabilityLicensingPanel() {
  const [data, setData] = useState<{ catalog: CatalogItem[]; organizations: Organization[]; licenses: License[]; events: Event[] } | null>(null);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [licenseDrafts, setLicenseDrafts] = useState<Record<string, { licenseStatus: string; operationalStatus: string; reason: string }>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await getCapabilityLicensingData();
    if (!result.ok) {
      setMessage(result.error);
      setData(null);
    } else {
      const orgs = result.organizations.filter((org) => org.slug !== "rsbuild");
      setData({ catalog: result.catalog, organizations: orgs, licenses: result.licenses, events: result.events });
      setSelectedOrg((current) => current && orgs.some((org) => org.id === current) ? current : orgs[0]?.id ?? "");
      setMessage("");
    }
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const selectedOrganization = data?.organizations.find((org) => org.id === selectedOrg);
  const licenseFor = (key: string) => data?.licenses.find((license) => license.organization_id === selectedOrg && license.capability_key === key);

  function draftFor(key: string) {
    const existing = licenseFor(key);
    return licenseDrafts[key] ?? {
      licenseStatus: existing?.license_status ?? "blocked",
      operationalStatus: existing?.operational_status ?? "not_implemented",
      reason: ""
    };
  }

  function updateDraft(key: string, patch: Partial<{ licenseStatus: string; operationalStatus: string; reason: string }>) {
    setLicenseDrafts((current) => ({ ...current, [key]: { ...draftFor(key), ...patch } }));
  }

  function save(key: string) {
    const draft = draftFor(key);
    startTransition(async () => {
      const result = await setCapabilityLicense({
        organizationId: selectedOrg,
        capabilityKey: key,
        licenseStatus: draft.licenseStatus,
        operationalStatus: draft.operationalStatus,
        reason: draft.reason
      });
      setMessage(result.ok ? "Licença atualizada e registrada no histórico." : (result.error ?? "Não foi possível atualizar a licença."));
      if (result.ok) {
        setLicenseDrafts((current) => { const next = { ...current }; delete next[key]; return next; });
        await refresh();
      }
    });
  }

  return (
    <section className="card cockpit-card" style={{ padding: 20, display: "grid", gap: 16, borderTop: "3px solid var(--rsbuild-terracotta, #B5583C)" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow">CONTROLE EXCLUSIVO DO OWNER</div>
          <h2 style={{ margin: "4px 0", color: "var(--ink)", fontSize: 19 }}>Licenciamento de capacidades</h2>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>
            Libere, suspenda ou revogue módulos por organização. A autorização não altera os papéis nem as permissões dos usuários.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={() => void refresh()} disabled={loading || pending}>Atualizar</button>
      </header>

      {message && <div className="notice" role="status">{message}</div>}
      {loading ? <p style={{ color: "var(--muted)", fontSize: 13 }}>Carregando licenças…</p> : !data ? null : (
        <>
          <label style={{ display: "grid", gap: 6, maxWidth: 460, color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>
            ORGANIZAÇÃO
            <select value={selectedOrg} onChange={(event) => setSelectedOrg(event.target.value)} style={{ height: 40, border: "1px solid var(--line)", borderRadius: 7, padding: "0 10px", background: "var(--bg)", color: "var(--ink)" }}>
              {data.organizations.map((org) => <option key={org.id} value={org.id}>{org.display_name} · {org.slug}</option>)}
            </select>
          </label>

          {!selectedOrganization ? <p style={{ color: "var(--muted)", fontSize: 12 }}>Nenhuma organização cliente encontrada.</p> : (
            <div style={{ display: "grid", gap: 12 }}>
              {data.catalog.map((capability) => {
                const draft = draftFor(capability.capability_key);
                const saved = licenseFor(capability.capability_key);
                const dirty = !!licenseDrafts[capability.capability_key];
                return (
                  <article key={capability.capability_key} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: 14, display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <strong style={{ color: "var(--ink)", fontSize: 13 }}>{capability.display_name}</strong>
                      <span className="status-pill" style={{ fontSize: 10 }}>{LICENSE_LABELS[saved?.license_status ?? "blocked"]} · {OPERATIONAL_LABELS[saved?.operational_status ?? "not_implemented"]}</span>
                    </div>
                    <p style={{ margin: 0, color: "var(--muted)", fontSize: 11 }}>{capability.description}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 9 }}>
                      <label style={{ display: "grid", gap: 5, color: "var(--muted)", fontSize: 10, fontWeight: 700 }}>
                        LICENÇA
                        <select value={draft.licenseStatus} onChange={(e) => updateDraft(capability.capability_key, { licenseStatus: e.target.value })} style={{ height: 36, border: "1px solid var(--line)", borderRadius: 6, padding: "0 8px", background: "var(--bg)", color: "var(--ink)" }}>
                          {Object.entries(LICENSE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 5, color: "var(--muted)", fontSize: 10, fontWeight: 700 }}>
                        ESTADO OPERACIONAL
                        <select value={draft.operationalStatus} onChange={(e) => updateDraft(capability.capability_key, { operationalStatus: e.target.value })} style={{ height: 36, border: "1px solid var(--line)", borderRadius: 6, padding: "0 8px", background: "var(--bg)", color: "var(--ink)" }}>
                          {Object.entries(OPERATIONAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input value={draft.reason} onChange={(e) => updateDraft(capability.capability_key, { reason: e.target.value })} placeholder="Motivo / referência da decisão (opcional)" maxLength={500} style={{ flex: "1 1 240px", minWidth: 0, height: 36, border: "1px solid var(--line)", borderRadius: 6, padding: "0 10px", background: "var(--bg)", color: "var(--ink)", fontSize: 11 }} />
                      <button type="button" className="primary-button" disabled={pending || !dirty || !selectedOrg} onClick={() => save(capability.capability_key)} style={{ fontSize: 11 }}>Salvar decisão</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, display: "grid", gap: 8 }}>
            <strong style={{ color: "var(--ink)", fontSize: 12 }}>Histórico recente de decisões</strong>
            {data.events.length ? data.events.slice(0, 12).map((event) => {
              const org = data.organizations.find((item) => item.id === event.organization_id);
              const cap = data.catalog.find((item) => item.capability_key === event.capability_key);
              return <div key={event.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", borderBottom: "1px solid var(--line)", padding: "7px 0", fontSize: 11 }}>
                <span style={{ color: "var(--ink)" }}>{org?.display_name ?? "Organização"} · {cap?.display_name ?? event.capability_key} · {event.event_type}</span>
                <span style={{ color: "var(--muted)" }}>{new Date(event.created_at).toLocaleString("pt-BR")}{event.reason ? " · " + event.reason : ""}</span>
              </div>;
            }) : <p style={{ margin: 0, color: "var(--muted)", fontSize: 11 }}>Nenhuma decisão registrada ainda.</p>}
          </div>
        </>
      )}
    </section>
  );
}
