"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDateTimePtBr } from "@/lib/date-format";

type Status = "new" | "in_review" | "qualified" | "disqualified" | "converted";
type DiagnosticRequest = {
  id: string; company_name: string; segment: string; contact_name: string;
  contact_role: string; contact_email: string; contact_phone: string;
  units_count: string; systems_used: string; erp_used: string;
  areas_involved: string; needs: string[]; priority_process: string;
  problem_frequency: string; problem_impact: string; current_process: string;
  expected_result: string; intention: string; status: Status; created_at: string;
};
type Member = { id: string; label: string; role: string; title: string };
type Note = { id: string; request_id: string; author_id: string; body: string; created_at: string };
type Assignment = { request_id: string; assigned_to: string; assigned_by: string; updated_at: string };
type ReadReceipt = { request_id: string; read_at: string };

const STATUS_LABELS: Record<Status, string> = {
  new: "Nova", in_review: "Em análise", qualified: "Qualificada",
  disqualified: "Desqualificada", converted: "Convertida"
};
const STATUS_OPTIONS: Status[] = ["new", "in_review", "qualified", "disqualified", "converted"];
const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium", timeStyle: "short"
}).format(new Date(value));

export function LeadInboxView() {
  const [requests, setRequests] = useState<DiagnosticRequest[]>([]);
  const [reads, setReads] = useState<ReadReceipt[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [canChangeStatus, setCanChangeStatus] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread" | "in_review">("all");
  const [noteDraft, setNoteDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/diagnostic-inbox", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(response.status === 401
        ? "Sua sessão expirou. Entre novamente para acessar as mensagens."
        : "Não foi possível carregar as mensagens.");
      const rows = Array.isArray(payload.requests) ? payload.requests as DiagnosticRequest[] : [];
      setRequests(rows);
      setReads(Array.isArray(payload.reads) ? payload.reads : []);
      setAssignments(Array.isArray(payload.assignments) ? payload.assignments : []);
      setNotes(Array.isArray(payload.notes) ? payload.notes : []);
      setMembers(Array.isArray(payload.members) ? payload.members : []);
      setCurrentUserId(payload.currentUserId ?? "");
      setCanChangeStatus(Boolean(payload.permissions?.canChangeStatus));
      setSelectedId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar a caixa de mensagens.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRequests(); }, [loadRequests]);

  const readIds = useMemo(() => new Set(reads.map((item) => item.request_id)), [reads]);
  const filtered = useMemo(() => requests.filter((item) => {
    if (filter === "unread") return !readIds.has(item.id);
    if (filter === "in_review") return item.status === "in_review";
    return true;
  }), [requests, filter, readIds]);

  const selected = requests.find((item) => item.id === selectedId) ?? null;
  const selectedAssignment = assignments.find((item) => item.request_id === selectedId);
  const selectedNotes = notes.filter((item) => item.request_id === selectedId);
  const unreadCount = requests.filter((item) => !readIds.has(item.id)).length;
  const memberLabel = (id: string) => members.find((member) => member.id === id)?.label ?? "Membro da equipe";

  const postAction = async (payload: Record<string, string>) => {
    const response = await fetch("/api/diagnostic-inbox", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Não foi possível salvar esta alteração.");
  };

  const markRead = useCallback(async (requestId: string) => {
    if (readIds.has(requestId)) return;
    try {
      await postAction({ action: "read", requestId });
      setReads((current) => [...current.filter((item) => item.request_id !== requestId), {
        request_id: requestId, read_at: new Date().toISOString()
      }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao marcar mensagem como lida.");
    }
  }, [readIds]);

  useEffect(() => {
    if (selectedId && !loading) void markRead(selectedId);
  }, [selectedId, loading, markRead]);

  const updateStatus = async (status: Status) => {
    if (!selected) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/diagnostic-inbox", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: selected.id, status })
      });
      if (!response.ok) throw new Error("Não foi possível atualizar o status. Verifique sua permissão.");
      setRequests((current) => current.map((item) => item.id === selected.id ? { ...item, status } : item));
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao atualizar status."); }
    finally { setSaving(false); }
  };

  const assignLead = async (assignedTo: string) => {
    if (!selected) return;
    setSaving(true); setError("");
    try {
      await postAction({ action: "assign", requestId: selected.id, assignedTo });
      setAssignments((current) => assignedTo
        ? [...current.filter((item) => item.request_id !== selected.id), {
            request_id: selected.id, assigned_to: assignedTo, assigned_by: currentUserId,
            updated_at: new Date().toISOString()
          }]
        : current.filter((item) => item.request_id !== selected.id));
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao atribuir responsável."); }
    finally { setSaving(false); }
  };

  const addNote = async () => {
    if (!selected || !noteDraft.trim()) return;
    setSaving(true); setError("");
    try {
      await postAction({ action: "note", requestId: selected.id, note: noteDraft.trim() });
      setNoteDraft("");
      await loadRequests();
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao registrar nota."); }
    finally { setSaving(false); }
  };

  const field = (label: string, value?: string | null) => value?.trim()
    ? <div style={{ marginBottom: 15 }}><div className="eyebrow">{label}</div><div style={{ marginTop: 5, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{value}</div></div>
    : null;

  return (
    <section style={{ display: "grid", gap: 18 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow">RELACIONAMENTO · ENTRADA INSTITUCIONAL</div>
          <h1 style={{ margin: "8px 0 6px" }}>Central de Leads</h1>
          <p style={{ margin: 0, color: "var(--rsbuild-muted, #8b8580)" }}>Solicitações recebidas pelo formulário institucional.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => void loadRequests()} disabled={loading || saving}>
          {loading ? "Atualizando…" : "Atualizar caixa"}
        </button>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <div className="panel" style={{ padding: 18 }}><div className="eyebrow">TOTAL RECEBIDO</div><strong style={{ display: "block", fontSize: 28, marginTop: 8 }}>{requests.length}</strong></div>
        <div className="panel" style={{ padding: 18 }}><div className="eyebrow">NÃO LIDAS · VOCÊ</div><strong style={{ display: "block", fontSize: 28, marginTop: 8 }}>{unreadCount}</strong></div>
        <div className="panel" style={{ padding: 18 }}><div className="eyebrow">EM ANÁLISE</div><strong style={{ display: "block", fontSize: 28, marginTop: 8 }}>{requests.filter((item) => item.status === "in_review").length}</strong></div>
      </div>

      {error && <div className="notice" role="alert">{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 16, alignItems: "start" }}>
        <div className="panel" style={{ padding: 16 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {([["all", "Todas"], ["unread", "Não lidas"], ["in_review", "Em análise"]] as const).map(([key, label]) => (
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
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 7, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--rsbuild-muted, #8b8580)" }}>{dateTime(item.created_at)}</span>
                  {!readIds.has(item.id) && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--rsbuild-terracotta, #B5583C)" }}>● NÃO LIDA</span>}
                </div>
                {assignments.some((assignment) => assignment.request_id === item.id) && <div style={{ marginTop: 5, fontSize: 10, color: "var(--rsbuild-muted, #8b8580)" }}>Responsável: {memberLabel(assignments.find((assignment) => assignment.request_id === item.id)!.assigned_to)}</div>}
              </button>
            ))}
          </div>
        </div>

        <article className="panel" style={{ padding: 22, minHeight: 420 }}>
          {!selected && <div style={{ padding: "48px 12px", textAlign: "center", color: "var(--rsbuild-muted, #8b8580)" }}>Selecione uma mensagem para visualizar e conduzir o atendimento.</div>}
          {selected && <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
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

            <div style={{ borderTop: "1px solid var(--rsbuild-border, #ded8cf)", paddingTop: 16, marginTop: 8, display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                <label style={{ display: "grid", gap: 6, fontSize: 11, fontWeight: 700 }}>
                  STATUS DO ATENDIMENTO
                  <select value={selected.status} disabled={!canChangeStatus || saving} onChange={(event) => void updateStatus(event.target.value as Status)} className="secondary-button" style={{ width: "100%", textAlign: "left" }}>
                    {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                  </select>
                  {!canChangeStatus && <span style={{ fontSize: 10, fontWeight: 400, color: "var(--rsbuild-muted, #8b8580)" }}>Alteração de status restrita a owner/admin.</span>}
                </label>
                <label style={{ display: "grid", gap: 6, fontSize: 11, fontWeight: 700 }}>
                  RESPONSÁVEL
                  <select value={selectedAssignment?.assigned_to ?? ""} disabled={saving} onChange={(event) => void assignLead(event.target.value)} className="secondary-button" style={{ width: "100%", textAlign: "left" }}>
                    <option value="">Sem responsável</option>
                    {members.map((member) => <option key={member.id} value={member.id}>{member.label}{member.title ? " · " + member.title : ""}</option>)}
                  </select>
                </label>
              </div>
              <div>
                <div className="eyebrow" style={{ marginBottom: 8 }}>NOTAS INTERNAS · VISÍVEIS SOMENTE À EQUIPE RSBUILD</div>
                <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                  {selectedNotes.map((note) => (
                    <div key={note.id} style={{ padding: 12, borderRadius: 8, background: "var(--rsbuild-panel-soft, rgba(0,0,0,.035))", border: "1px solid var(--rsbuild-border, #ded8cf)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 10, color: "var(--rsbuild-muted, #8b8580)", marginBottom: 6 }}>
                        <strong>{memberLabel(note.author_id)}</strong><span>{dateTime(note.created_at)}</span>
                      </div>
                      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: 13 }}>{note.body}</div>
                    </div>
                  ))}
                  {selectedNotes.length === 0 && <p style={{ margin: 0, fontSize: 12, color: "var(--rsbuild-muted, #8b8580)" }}>Nenhuma nota registrada.</p>}
                </div>
                <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} maxLength={4000} rows={3} placeholder="Registre contexto, próximos passos ou informações internas…" style={{ width: "100%", resize: "vertical", padding: 11, borderRadius: 8, border: "1px solid var(--rsbuild-border, #ded8cf)", background: "transparent", color: "inherit", font: "inherit" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 10, color: "var(--rsbuild-muted, #8b8580)" }}>{noteDraft.length}/4000 caracteres</span>
                  <button className="primary-button" type="button" onClick={() => void addNote()} disabled={saving || !noteDraft.trim()}>{saving ? "Salvando…" : "Adicionar nota"}</button>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", borderTop: "1px solid var(--rsbuild-border, #ded8cf)", paddingTop: 16, marginTop: 16 }}>
              <a className="secondary-button" href={`mailto:${encodeURIComponent(selected.contact_email)}?subject=${encodeURIComponent("Retorno sobre sua solicitação | RSBUILD")}`}>Responder por e-mail</a>
              {selected.contact_phone && <a className="secondary-button" href={`https://wa.me/${selected.contact_phone.replace(/\\D/g, "")}`} target="_blank" rel="noreferrer">Abrir WhatsApp</a>}
            </div>
          </>}
        </article>
      </div>
      <p style={{ margin: 0, fontSize: 11, color: "var(--rsbuild-muted, #8b8580)" }}>Leitura é individual por usuário. Status, responsável e notas são compartilhados com a equipe autorizada da RSBUILD.</p>
    </section>
  );
}
