"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

interface FeedbackItem {
  id: string;
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  user_id: string;
  user_email: string;
  category: "bug" | "improvement" | "compliment" | "other";
  severity: "high" | "medium" | "low" | null;
  description: string;
  status: "open" | "in_progress" | "resolved" | "rejected";
  response_text: string | null;
  responded_at: string | null;
  created_at: string;
}

interface FeedbackResponse {
  id: string;
  feedback_id: string;
  responded_by: string;
  response_text: string;
  response_type: "acknowledgment" | "update" | "resolution" | "rejection";
  created_at: string;
}

const CATEGORY_LABELS = {
  bug: "Bug",
  improvement: "Melhoria",
  compliment: "Elogio",
  other: "Outro"
};

const STATUS_LABELS = {
  open: "Aberto",
  in_progress: "Em Andamento",
  resolved: "Resolvido",
  rejected: "Rejeitado"
};

const STATUS_COLORS = {
  open: "#2563eb",
  in_progress: "#f59e0b",
  resolved: "#16a34a",
  rejected: "#dc2626"
};

export function FeedbackAdminPanel() {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [responseText, setResponseText] = useState("");
  const [responseType, setResponseType] = useState<"acknowledgment" | "update" | "resolution" | "rejection">("acknowledgment");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    loadFeedbacks();
  }, []);

  async function loadFeedbacks() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("all_client_feedback")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFeedbacks(data || []);
    } catch (error) {
      console.error("Failed to load feedbacks:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRespond() {
    if (!selectedFeedback || !responseText.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update feedback status
      const newStatus = responseType === "resolution" ? "resolved" : 
                      responseType === "rejection" ? "rejected" : "in_progress";

      await supabase
        .from("client_feedback")
        .update({
          status: newStatus,
          response_text: responseText,
          responded_by: user.id,
          responded_at: new Date().toISOString()
        })
        .eq("id", selectedFeedback.id);

      // Insert response record
      await supabase
        .from("feedback_responses")
        .insert({
          feedback_id: selectedFeedback.id,
          responded_by: user.id,
          response_text: responseText,
          response_type: responseType
        });

      // Reload feedbacks
      await loadFeedbacks();
      setSelectedFeedback(null);
      setResponseText("");
      setResponseType("acknowledgment");
    } catch (error) {
      console.error("Failed to respond to feedback:", error);
      alert("Erro ao enviar resposta");
    }
  }

  const filteredFeedbacks = feedbacks.filter(f => {
    if (filterStatus !== "all" && f.status !== filterStatus) return false;
    if (filterCategory !== "all" && f.category !== filterCategory) return false;
    return true;
  });

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
        Carregando feedbacks...
      </div>
    );
  }

  return (
    <div style={{ padding: "24px" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>
          Gestão de Feedback
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "14px" }}>
          Canal direto entre clientes e equipe RSBUILD
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid var(--line)",
            background: "var(--surface)",
            fontSize: "13px"
          }}
        >
          <option value="all">Todos os status</option>
          <option value="open">Abertos</option>
          <option value="in_progress">Em Andamento</option>
          <option value="resolved">Resolvidos</option>
          <option value="rejected">Rejeitados</option>
        </select>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid var(--line)",
            background: "var(--surface)",
            fontSize: "13px"
          }}
        >
          <option value="all">Todas as categorias</option>
          <option value="bug">Bugs</option>
          <option value="improvement">Melhorias</option>
          <option value="compliment">Elogios</option>
          <option value="other">Outros</option>
        </select>

        <button
          onClick={loadFeedbacks}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "1px solid var(--line)",
            background: "var(--surface)",
            cursor: "pointer",
            fontSize: "13px"
          }}
        >
          Atualizar
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
        <div style={{ padding: "16px", background: "var(--bg)", borderRadius: "8px", border: "1px solid var(--line)" }}>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#2563eb" }}>
            {feedbacks.filter(f => f.status === "open").length}
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>Abertos</div>
        </div>
        <div style={{ padding: "16px", background: "var(--bg)", borderRadius: "8px", border: "1px solid var(--line)" }}>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#f59e0b" }}>
            {feedbacks.filter(f => f.status === "in_progress").length}
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>Em Andamento</div>
        </div>
        <div style={{ padding: "16px", background: "var(--bg)", borderRadius: "8px", border: "1px solid var(--line)" }}>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#16a34a" }}>
            {feedbacks.filter(f => f.status === "resolved").length}
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>Resolvidos</div>
        </div>
        <div style={{ padding: "16px", background: "var(--bg)", borderRadius: "8px", border: "1px solid var(--line)" }}>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#dc2626" }}>
            {feedbacks.filter(f => f.category === "bug").length}
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>Bugs</div>
        </div>
      </div>

      {/* Feedback List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {filteredFeedbacks.map(feedback => (
          <div
            key={feedback.id}
            style={{
              padding: "16px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            onClick={() => setSelectedFeedback(feedback)}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--rsbuild-terracotta)"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--line)"}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "8px" }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span
                  style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    background: feedback.category === "bug" ? "rgba(220, 38, 38, 0.1)" :
                               feedback.category === "improvement" ? "rgba(59, 130, 246, 0.1)" :
                               feedback.category === "compliment" ? "rgba(34, 197, 94, 0.1)" :
                               "rgba(107, 114, 128, 0.1)",
                    color: feedback.category === "bug" ? "#dc2626" :
                           feedback.category === "improvement" ? "#2563eb" :
                           feedback.category === "compliment" ? "#16a34a" :
                           "#6b7280"
                  }}
                >
                  {CATEGORY_LABELS[feedback.category]}
                </span>
                <span
                  style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: 600,
                    background: `${STATUS_COLORS[feedback.status]}20`,
                    color: STATUS_COLORS[feedback.status]
                  }}
                >
                  {STATUS_LABELS[feedback.status]}
                </span>
                {feedback.severity && (
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                    Severidade: {feedback.severity}
                  </span>
                )}
              </div>
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                {new Date(feedback.created_at).toLocaleString("pt-BR")}
              </span>
            </div>

            <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: "var(--ink)" }}>
              {feedback.description}
            </p>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)" }}>
              <span>{feedback.organization_name}</span>
              <span>{feedback.user_email}</span>
            </div>
          </div>
        ))}

        {filteredFeedbacks.length === 0 && (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
            Nenhum feedback encontrado
          </div>
        )}
      </div>

      {/* Response Modal */}
      {selectedFeedback && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
          onClick={() => setSelectedFeedback(null)}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: "12px",
              width: "90%",
              maxWidth: "600px",
              maxHeight: "80vh",
              overflow: "auto",
              padding: "24px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 16px 0", fontSize: "18px" }}>Responder Feedback</h2>

            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                Categoria: {CATEGORY_LABELS[selectedFeedback.category]}
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                Status: {STATUS_LABELS[selectedFeedback.status]}
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "8px" }}>
                Organização: {selectedFeedback.organization_name}
              </div>
              <div style={{ padding: "12px", background: "var(--bg)", borderRadius: "8px", fontSize: "14px" }}>
                {selectedFeedback.description}
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 600 }}>
                Tipo de Resposta
              </label>
              <select
                value={responseType}
                onChange={(e) => setResponseType(e.target.value as any)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                  background: "var(--surface)",
                  fontSize: "13px"
                }}
              >
                <option value="acknowledgment">Reconhecimento</option>
                <option value="update">Atualização</option>
                <option value="resolution">Resolução</option>
                <option value="rejection">Rejeição</option>
              </select>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 600 }}>
                Resposta
              </label>
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                maxLength={1000}
                placeholder="Digite sua resposta..."
                style={{
                  width: "100%",
                  minHeight: "120px",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  background: "var(--bg)",
                  fontSize: "14px",
                  resize: "vertical"
                }}
              />
              <div style={{ textAlign: "right", fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                {responseText.length}/1000
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setSelectedFeedback(null)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: "14px"
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleRespond}
                disabled={!responseText.trim()}
                style={{
                  padding: "10px 20px",
                  borderRadius: "6px",
                  border: "none",
                  background: "var(--rsbuild-terracotta)",
                  color: "white",
                  cursor: responseText.trim() ? "pointer" : "not-allowed",
                  opacity: responseText.trim() ? 1 : 0.5,
                  fontSize: "14px",
                  fontWeight: 600
                }}
              >
                Enviar Resposta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
