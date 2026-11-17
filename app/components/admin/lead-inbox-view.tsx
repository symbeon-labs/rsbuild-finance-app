"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type DiagnosticRequest = {
  id: string;
  company_name: string;
  segment: string;
  contact_name: string;
  contact_role: string;
  contact_email: string;
  contact_phone: string;
  units_count: string;
  systems_used: string;
  erp_used: string;
  areas_involved: string;
  needs: string[];
  priority_process: string;
  problem_frequency: string;
  problem_impact: string;
  current_process: string;
  expected_result: string;
  intention: string;
  status: "new" | "in_review" | "qualified" | "disqualified" | "converted";
  created_at: string;
};

const STATUS_LABELS: Record<DiagnosticRequest["status"], string> = {
  new: "Nova",
  in_review: "Em análise",
  qualified: "Qualificada",
  disqualified: "Desqualificada",
  converted: "Convertida"
};

const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium", timeStyle: "short"
}).format(new Date(value));

export function LeadInboxView() {
  const [requests, setRequests] = useState<DiagnosticRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "new" | "in_review">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/diagnostic-inbox", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(response.status === 401
          ? "Sua sessão expirou. Entre novamente para acessar as mensagens."
          : "Não foi possível carregar as mensagens.");
      }
      const rows = Array.isArray(payload.requests) ? payload.requests as DiagnosticRequest[] : [];
      setRequests(rows);
      setSelectedId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar a caixa de mensagens.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRequests(); }, [loadRequests]);

  const filtered = useMemo(() => requests.filter((item) => {
    if (filter === "new") return item.status === "new";
    if (filter === "in_review") return item.status === "in_review";
    return true;
  }), [requests, filter]);

  const selected = requests.find((item) => item.id === selectedId) ?? null;
  const newCount = requests.filter((item) => item.status === "new").length;

  const field = (label: string, value?: string | null) => value?.trim()
    ? <div style={{ marginBottom: 16 }}><div className="eyebrow">{label}</div><div style={{ marginTop: 5, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{value}</div></div>
    : null;

  return (
    <section style={{ display: "grid", gap: 18 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow">RELACIONAMENTO · ENTRADA INSTITUCIONAL</div>
          <h1 style={{ margin: "8px 0 6px" }}>Caixa de mensagens</h1>
          <p style={{ margin: 0, color: "var(--rsbuild-muted, #8b8580)" }}>Solicitações recebidas pelo formulário da página institucional.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => void loadRequests()} disabled={loading}>
          {loading ? "Atualizando…" : "Atualizar caixa"}
        </button>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        <div className="panel" style={{ padding: 18 }}><div className="eyebrow">TOTAL RECEBIDO</div><strong style={{ display: "block", fontSize: 28, marginTop: 8 }}>{requests.length}</strong></div>
        <div className="panel" style={{ padding: 18 }}><div className="eyebrow">NOVAS</div><strong style={{ display: "block", fontSize: 28, marginTop: 8 }}>{newCount}</strong></div>
        <div className="panel" style={{ padding: 18 }}><div className="eyebrow">EM ANÁLISE</div><strong style={{ display: "block", fontSize: 28, marginTop: 8 }}>{requests.filter((item) => item.status === "in_review").length}</strong></div>
      </div>

      {error && <div className="notice" role="alert">{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 16, alignItems: "start" }}>
        <div className="panel" style={{ padding: 16 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {([["all", "Todas"], ["new", "Novas"], ["in_review", "Em análise"]] as const).map(([key, label]) => (
              <button key={key} type="button" className={filter === key ? "primary-button" : "secondary-button"} onClick={() => setFilter(key)}>{label}</button>
            ))}
          </div>
          {loading && <p>Carregando mensagens…</p>}
          {!loading && !error && filtered.length === 0 && <p style={{ color: "var(--rsbuild-muted, #8b8580)" }}>Nenhuma mensagem nesta visualização.</p>}
          <div style={{ display: "grid", gap: 8 }}>
            {filtered.map((item) => (
              <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} aria-pressed={selectedId === item.id}
                style={{ textAlign: "left", padding: 13, borderRadius: 8, border: selectedId === item.id ? "1px solid var(--rsbuild-terracotta, #B5583C)" : "1px solid var(--rsbuild-border, #ded8cf)", background: selectedId === item.id ? "var(--rsbuild-panel-soft, rgba(181,88,60,.07))" : "transparent", color: "inherit", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <strong style={{ fontSize: 13 }}>{item.company_name}</strong>
                  <span style={{ fontSize: 10, whiteSpace: "nowrap", color: "var(--rsbuild-terracotta, #B5583C)" }}>{STATUS_LABELS[item.status] ?? item.status}</span>
                </div>
                <div style={{ marginTop: 5, fontSize: 12 }}>{item.contact_name}</div>
                <div style={{ marginTop: 5, fontSize: 11, color: "var(--rsbuild-muted, #8b8580)" }}>{dateTime(item.created_at)}</div>
              </button>
            ))}
          </div>
        </div>

        <article className="panel" style={{ padding: 22, minHeight: 360 }}>
          {!selected && <div style={{ padding: "48px 12px", textAlign: "center", color: "var(--rsbuild-muted, #8b8580)" }}>Selecione uma mensagem para visualizar os dados enviados.</div>}
          {selected && <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
              <div><div className="eyebrow">SOLICITAÇÃO RECEBIDA</div><h2 style={{ margin: "7px 0 4px" }}>{selected.company_name}</h2><div style={{ color: "var(--rsbuild-muted, #8b8580)", fontSize: 12 }}>{dateTime(selected.created_at)}</div></div>
              <span style={{ alignSelf: "flex-start", padding: "6px 10px", borderRadius: 999, background: "var(--rsbuild-panel-soft, rgba(181,88,60,.08))", color: "var(--rsbuild-terracotta, #B5583C)", fontSize: 11, fontWeight: 700 }}>{STATUS_LABELS[selected.status] ?? selected.status}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 18 }}>
              <div>{field("CONTATO", selected.contact_name)}{field("CARGO / FUNÇÃO", selected.contact_role)}{field("E-MAIL", selected.contact_email)}{field("TELEFONE", selected.contact_phone)}</div>
              <div>{field("SEGMENTO", selected.segment)}{field("UNIDADES / EMPRESAS", selected.units_count)}{field("ERP", selected.erp_used)}{field("OUTROS SISTEMAS", selected.systems_used)}</div>
            </div>
            {field("ÁREAS ENVOLVIDAS", selected.areas_involved)}
            {selected.needs?.length > 0 && field("FRENTES DE INTERESSE", selected.needs.join(" · "))}
            {field("PROCESSO PRIORITÁRIO", selected.priority_process)}
            {field("FREQUÊNCIA DO PROBLEMA", selected.problem_frequency)}
            {field("IMPACTO ATUAL", selected.problem_impact)}
            {field("COMO O PROCESSO FUNCIONA HOJE", selected.current_process)}
            {field("RESULTADO ESPERADO", selected.expected_result)}
            {field("O QUE MOTIVOU O CONTATO", selected.intention)}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", borderTop: "1px solid var(--rsbuild-border, #ded8cf)", paddingTop: 16, marginTop: 8 }}>
              <a className="secondary-button" href={`mailto:${encodeURIComponent(selected.contact_email)}?subject=${encodeURIComponent("Retorno sobre sua solicitação | RSBUILD")}`}>Responder por e-mail</a>
              {selected.contact_phone && <a className="secondary-button" href={`https://wa.me/${selected.contact_phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">Abrir WhatsApp</a>}
            </div>
          </>}
        </article>
      </div>
      <p style={{ margin: 0, fontSize: 11, color: "var(--rsbuild-muted, #8b8580)" }}>A caixa é somente leitura nesta primeira entrega. Os dados permanecem protegidos pelas permissões da organização RSBUILD.</p>
    </section>
  );
}
