"use client";

import { useCallback, useEffect, useState } from "react";

type Agent = { id: string; slug: string; display_name: string; status: string; version: string };
type Organization = { id: string; slug: string; display_name: string };
type Grant = { id: string; agent_id: string; organization_id: string; capabilities: string[]; status: string; access_mode: string; entitled_environments: string[]; expires_at: string | null };
type Integration = { id: string; agent_id: string; organization_id: string; provider: string; display_name: string; endpoint_url: string | null; model: string | null; credential_hint: string; status: string; last_verified_at: string | null; last_error: string | null; updated_at: string };
type Data = { agents: Agent[]; organizations: Organization[]; grants: Grant[]; integrations: Integration[] };

const PROVIDERS = [
  ["openai", "OpenAI"], ["anthropic", "Anthropic"], ["google", "Google Gemini"],
  ["xai", "xAI"], ["custom_api", "API personalizada"], ["mcp", "Servidor MCP"]
] as const;
const MODES = [["internal", "Interno"], ["beta", "Beta controlado"], ["contractual", "Contratual"]] as const;
const ENVIRONMENTS = ["qa", "sandbox", "production"] as const;

export function ControlledAgentIntegrationsPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [agentId, setAgentId] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [provider, setProvider] = useState<string>("openai");
  const [displayName, setDisplayName] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [model, setModel] = useState("");
  const [credential, setCredential] = useState("");
  const [accessMode, setAccessMode] = useState<string>("internal");
  const [environments, setEnvironments] = useState<string[]>(["qa"]);
  const [expiresAt, setExpiresAt] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/agent-integrations", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Não foi possível carregar integrações.");
      setData(json);
      setMessage("");
      setAgentId((current) => current || json.agents?.[0]?.id || "");
      setOrganizationId((current) => current || json.organizations?.find((o: Organization) => o.slug !== "rsbuild")?.id || json.organizations?.[0]?.id || "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao carregar integrações.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/agent-integrations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, organizationId, provider, displayName, endpointUrl, model, credential, accessMode, environments, expiresAt: expiresAt || null })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Falha ao salvar integração.");
      setCredential("");
      setMessage("Integração cadastrada. Credencial armazenada criptografada; conexão ainda não foi testada.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar integração.");
    } finally { setBusy(false); }
  }

  async function disable(id: string) {
    if (!window.confirm("Desativar esta integração? A credencial permanecerá armazenada, mas não poderá ser usada pela camada de integração.")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/agent-integrations?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Falha ao desativar integração.");
      setMessage("Integração desativada.");
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao desativar integração."); }
    finally { setBusy(false); }
  }

  const grantFor = (integration: Integration) => data?.grants.find((g) => g.agent_id === integration.agent_id && g.organization_id === integration.organization_id);
  const agentName = (id: string) => data?.agents.find((a) => a.id === id)?.display_name ?? "Agente";
  const orgName = (id: string) => data?.organizations.find((o) => o.id === id)?.display_name ?? "Organização";

  return <section style={{ display: "grid", gap: 16 }}>
    <header className="card cockpit-card" style={{ padding: 20, borderLeft: "4px solid #7C3AED" }}>
      <div className="eyebrow">SYMBEON · CONTROLLED AI</div>
      <h2 style={{ margin: "5px 0", color: "var(--ink)", fontSize: 20 }}>Integrações controladas de agentes</h2>
      <p style={{ margin: 0, color: "var(--muted)", fontSize: 12, lineHeight: 1.65 }}>
        Cadastre provedores e credenciais por agente e organização. Esta versão registra configurações com segurança; não executa chamadas ao provedor nem concede autonomia operacional.
      </p>
    </header>

    {message && <div className="notice" role="status">{message}</div>}
    {loading ? <div className="card cockpit-card" style={{ padding: 24, color: "var(--muted)" }}>Carregando conexões…</div> : <>
      <div className="card cockpit-card" style={{ padding: 20, display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0, color: "var(--ink)", fontSize: 15 }}>Nova configuração</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
          <label style={{ display: "grid", gap: 5, color: "var(--muted)", fontSize: 11 }}>AGENTE
            <select value={agentId} onChange={e => setAgentId(e.target.value)}>{data?.agents.map(a => <option key={a.id} value={a.id}>{a.display_name} · {a.status}</option>)}</select>
          </label>
          <label style={{ display: "grid", gap: 5, color: "var(--muted)", fontSize: 11 }}>ORGANIZAÇÃO
            <select value={organizationId} onChange={e => setOrganizationId(e.target.value)}>{data?.organizations.map(o => <option key={o.id} value={o.id}>{o.display_name}</option>)}</select>
          </label>
          <label style={{ display: "grid", gap: 5, color: "var(--muted)", fontSize: 11 }}>PROVEDOR
            <select value={provider} onChange={e => setProvider(e.target.value)}>{PROVIDERS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <label style={{ display: "grid", gap: 5, color: "var(--muted)", fontSize: 11 }}>NOME DA CONEXÃO
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={100} placeholder="Ex.: OpenAI · RS Guardião" />
          </label>
          <label style={{ display: "grid", gap: 5, color: "var(--muted)", fontSize: 11 }}>ENDPOINT HTTPS (OPCIONAL)
            <input value={endpointUrl} onChange={e => setEndpointUrl(e.target.value)} maxLength={2048} placeholder="https://api.exemplo.com/v1" />
          </label>
          <label style={{ display: "grid", gap: 5, color: "var(--muted)", fontSize: 11 }}>MODELO (OPCIONAL)
            <input value={model} onChange={e => setModel(e.target.value)} maxLength={120} placeholder="Ex.: modelo homologado" />
          </label>
          <label style={{ display: "grid", gap: 5, color: "var(--muted)", fontSize: 11, gridColumn: "1 / -1" }}>CHAVE / TOKEN
            <input type="password" value={credential} onChange={e => setCredential(e.target.value)} autoComplete="new-password" maxLength={8192} placeholder="A credencial não será exibida novamente" />
          </label>
          <label style={{ display: "grid", gap: 5, color: "var(--muted)", fontSize: 11 }}>MODALIDADE
            <select value={accessMode} onChange={e => { const next = e.target.value; setAccessMode(next); if (next !== "contractual") setEnvironments(current => current.filter(env => env !== "production")); }}>{MODES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <label style={{ display: "grid", gap: 5, color: "var(--muted)", fontSize: 11 }}>VALIDADE (OPCIONAL)
            <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <strong style={{ color: "var(--muted)", fontSize: 11 }}>AMBIENTES AUTORIZADOS</strong>
          {ENVIRONMENTS.map(env => <label key={env} style={{ display: "inline-flex", gap: 5, alignItems: "center", color: "var(--muted)", fontSize: 11 }}>
            <input type="checkbox" checked={environments.includes(env)} disabled={env === "production" && accessMode !== "contractual"} onChange={e => setEnvironments(current => e.target.checked ? [...current, env] : current.filter(x => x !== env))} />{env.toUpperCase()}
          </label>)}
        </div>
        <div><button className="primary-button" type="button" disabled={busy || !agentId || !organizationId || displayName.trim().length < 2 || credential.trim().length < 8 || environments.length === 0} onClick={() => void save()}>{busy ? "Salvando…" : "Salvar configuração segura"}</button></div>
      </div>

      <div className="card cockpit-card" style={{ padding: 20, display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0, color: "var(--ink)", fontSize: 15 }}>Conexões cadastradas</h3>
        {data?.integrations.length ? data.integrations.map(item => {
          const grant = grantFor(item);
          return <article key={item.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 14, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <strong style={{ color: "var(--ink)", fontSize: 13 }}>{item.display_name}</strong>
              <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>{agentName(item.agent_id)} → {orgName(item.organization_id)} · {item.provider.toUpperCase()}</div>
              <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>{item.model || "Modelo não definido"} · {item.credential_hint} · {grant?.access_mode ?? "—"} · {(grant?.entitled_environments ?? []).join(", ")}</div>
              <div style={{ color: item.status === "configured" ? "#059669" : "#D97706", fontSize: 11, marginTop: 5 }}>{item.status === "configured" ? "Configurado · não testado" : item.status}</div>
            </div>
            {item.status !== "disabled" && <button type="button" className="secondary-button" disabled={busy} onClick={() => void disable(item.id)}>Desativar</button>}
          </article>;
        }) : <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>Nenhuma integração cadastrada.</p>}
      </div>
    </>}
  </section>;
}
