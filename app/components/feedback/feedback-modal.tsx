"use client";

import { useState, useRef, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type FeedbackCategory = "bug" | "improvement" | "compliment" | "other";
type FeedbackSeverity = "high" | "medium" | "low";
type FeedbackStatus = "open" | "in_progress" | "resolved" | "rejected";

interface FeedbackItem {
  id: string;
  category: FeedbackCategory;
  severity: FeedbackSeverity | null;
  description: string;
  status: FeedbackStatus;
  response_text: string | null;
  created_at: string;
  responded_at: string | null;
}

const CATEGORIES: Array<{ value: FeedbackCategory; label: string }> = [
  { value: "bug", label: "Bug" },
  { value: "improvement", label: "Melhoria" },
  { value: "compliment", label: "Elogio" },
  { value: "other", label: "Outro" }
];

const SEVERITIES: Array<{ value: FeedbackSeverity; label: string }> = [
  { value: "high", label: "Alta" },
  { value: "medium", label: "Média" },
  { value: "low", label: "Baixa" }
];

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: "Aberto",
  in_progress: "Em Andamento",
  resolved: "Resolvido",
  rejected: "Rejeitado"
};

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: "Bug",
  improvement: "Melhoria",
  compliment: "Elogio",
  other: "Outro"
};

interface FeedbackModalProps {
  organizationId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackModal({ organizationId, isOpen, onClose }: FeedbackModalProps) {
  const [activeTab, setActiveTab] = useState<"send" | "my" | "open" | "resolved" | "history">("send");
  const [category, setCategory] = useState<FeedbackCategory>("improvement");
  const [severity, setSeverity] = useState<FeedbackSeverity>("medium");
  const [description, setDescription] = useState("");
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    if (isOpen && activeTab !== "send") {
      loadFeedback();
    }
  }, [isOpen, activeTab, organizationId]);

  async function loadFeedback() {
    setLoading(true);
    try {
      let query = supabase
        .from("client_feedback")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (activeTab === "my") {
        query = query.eq("user_id", (await supabase.auth.getUser()).data.user?.id);
      } else if (activeTab === "open") {
        query = query.eq("status", "open");
      } else if (activeTab === "resolved") {
        query = query.eq("status", "resolved");
      }

      const { data, error } = await query;
      if (error) throw error;
      setFeedbackList(data || []);
    } catch (error) {
      console.error("Failed to load feedback:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!description.trim()) {
      setSubmitError("Por favor, descreva o que você quer contar.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: feedback, error: feedbackError } = await supabase
        .from("client_feedback")
        .insert({
          organization_id: organizationId,
          user_id: user.id,
          category,
          severity: category === "bug" ? severity : null,
          description: description.trim(),
          status: "open",
          metadata: { screenshots_count: screenshots.length }
        })
        .select()
        .single();

      if (feedbackError) throw feedbackError;

      // Upload screenshots
      for (const file of screenshots) {
        const fileExt = file.name.split(".").pop() || "png";
        const fileName = `${feedback.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("feedback-screenshots")
          .upload(fileName, file);

        if (uploadError) {
          console.error("Failed to upload screenshot:", uploadError);
        }
      }

      setSubmitSuccess(true);
      setDescription("");
      setScreenshots([]);
      setCategory("improvement");
      setSeverity("medium");
      
      // Reload feedback list
      await loadFeedback();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Falha ao enviar feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter(f => f.type.startsWith("image/"));
    if (imageFiles.length > 5) {
      setSubmitError("Máximo de 5 screenshots.");
      return;
    }
    setScreenshots(imageFiles);
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{
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
    }}>
      <div className="modal-content" style={{
        background: "var(--surface)",
        borderRadius: "12px",
        width: "90%",
        maxWidth: "600px",
        maxHeight: "80vh",
        overflow: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
      }}>
        {/* Header */}
        <div style={{
          padding: "20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <h2 style={{ margin: 0, fontSize: "18px" }}>Feedback e Sugestões</h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "var(--muted)"
            }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg)"
        }}>
          {[
            { id: "send", label: "Enviar" },
            { id: "my", label: "Meus pedidos" },
            { id: "open", label: "Abertos" },
            { id: "resolved", label: "Resolvidos" },
            { id: "history", label: "Histórico" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                flex: 1,
                padding: "12px",
                background: activeTab === tab.id ? "var(--surface)" : "transparent",
                border: "none",
                borderBottom: activeTab === tab.id ? "2px solid var(--rsbuild-terracotta)" : "2px solid transparent",
                cursor: "pointer",
                fontSize: "14px",
                color: activeTab === tab.id ? "var(--ink)" : "var(--muted)"
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: "20px" }}>
          {activeTab === "send" ? (
            <>
              {submitSuccess ? (
                <div style={{
                  padding: "20px",
                  textAlign: "center",
                  background: "rgba(76, 175, 80, 0.1)",
                  borderRadius: "8px",
                  color: "#2e7d32"
                }}>
                  <div style={{ fontSize: "48px", marginBottom: "10px" }}>✓</div>
                  <strong>Feedback enviado com sucesso!</strong>
                  <p style={{ marginTop: "10px", color: "var(--muted)" }}>
                    Agradecemos sua contribuição. Nossa equipe analisará seu feedback.
                  </p>
                  <button
                    onClick={() => setSubmitSuccess(false)}
                    className="primary-button"
                    style={{ marginTop: "20px" }}
                  >
                    Enviar outro
                  </button>
                </div>
              ) : (
                <>
                  {/* Category */}
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 600 }}>
                      Categoria
                    </label>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat.value}
                          onClick={() => setCategory(cat.value)}
                          style={{
                            padding: "8px 16px",
                            borderRadius: "20px",
                            border: category === cat.value ? "2px solid var(--rsbuild-terracotta)" : "1px solid var(--border)",
                            background: category === cat.value ? "rgba(255, 159, 64, 0.1)" : "var(--bg)",
                            cursor: "pointer",
                            fontSize: "13px"
                          }}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Severity (only for bugs) */}
                  {category === "bug" && (
                    <div style={{ marginBottom: "16px" }}>
                      <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 600 }}>
                        Severidade
                      </label>
                      <div style={{ display: "flex", gap: "8px" }}>
                        {SEVERITIES.map(sev => (
                          <button
                            key={sev.value}
                            onClick={() => setSeverity(sev.value)}
                            style={{
                              padding: "8px 16px",
                              borderRadius: "20px",
                              border: severity === sev.value ? "2px solid var(--rsbuild-terracotta)" : "1px solid var(--border)",
                              background: severity === sev.value ? "rgba(255, 159, 64, 0.1)" : "var(--bg)",
                              cursor: "pointer",
                              fontSize: "13px"
                            }}
                          >
                            {sev.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 600 }}>
                      O que você quer contar?
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={1000}
                      placeholder="Descreva o problema, sugestão ou elogio..."
                      style={{
                        width: "100%",
                        minHeight: "120px",
                        padding: "12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        background: "var(--bg)",
                        fontSize: "14px",
                        resize: "vertical"
                      }}
                    />
                    <div style={{ textAlign: "right", fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                      {description.length}/1000
                    </div>
                  </div>

                  {/* Screenshots */}
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 600 }}>
                      Prints da tela (opcional)
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      style={{ display: "none" }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="secondary-button"
                      style={{ marginBottom: "8px" }}
                    >
                      Adicionar screenshots
                    </button>
                    {screenshots.length > 0 && (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {screenshots.map((file, index) => (
                          <div
                            key={index}
                            style={{
                              position: "relative",
                              width: "80px",
                              height: "80px",
                              borderRadius: "8px",
                              overflow: "hidden",
                              border: "1px solid var(--border)"
                            }}
                          >
                            <img
                              src={URL.createObjectURL(file)}
                              alt={file.name}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                            <button
                              onClick={() => setScreenshots(screenshots.filter((_, i) => i !== index))}
                              style={{
                                position: "absolute",
                                top: "4px",
                                right: "4px",
                                width: "20px",
                                height: "20px",
                                borderRadius: "50%",
                                background: "rgba(0,0,0,0.7)",
                                color: "white",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "12px"
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Error */}
                  {submitError && (
                    <div style={{
                      padding: "12px",
                      background: "rgba(220, 38, 38, 0.1)",
                      borderRadius: "8px",
                      color: "#dc2626",
                      marginBottom: "16px",
                      fontSize: "13px"
                    }}>
                      {submitError}
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !description.trim()}
                    className="primary-button"
                    style={{ width: "100%" }}
                  >
                    {submitting ? "Enviando..." : "Enviar"}
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              {loading ? (
                <p style={{ textAlign: "center", color: "var(--muted)" }}>Carregando...</p>
              ) : feedbackList.length === 0 ? (
                <p style={{ textAlign: "center", color: "var(--muted)", padding: "40px" }}>
                  Nenhum feedback encontrado nesta categoria.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {feedbackList.map(item => (
                    <div
                      key={item.id}
                      style={{
                        padding: "16px",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        background: "var(--bg)"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <span style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          background: item.category === "bug" ? "rgba(220, 38, 38, 0.1)" :
                                     item.category === "improvement" ? "rgba(59, 130, 246, 0.1)" :
                                     item.category === "compliment" ? "rgba(34, 197, 94, 0.1)" :
                                     "rgba(107, 114, 128, 0.1)",
                          color: item.category === "bug" ? "#dc2626" :
                                 item.category === "improvement" ? "#2563eb" :
                                 item.category === "compliment" ? "#16a34a" :
                                 "#6b7280"
                        }}>
                          {CATEGORY_LABELS[item.category]}
                        </span>
                        <span style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          background: item.status === "resolved" ? "rgba(34, 197, 94, 0.1)" :
                                     item.status === "in_progress" ? "rgba(59, 130, 246, 0.1)" :
                                     "rgba(107, 114, 128, 0.1)",
                          color: item.status === "resolved" ? "#16a34a" :
                                 item.status === "in_progress" ? "#2563eb" :
                                 "#6b7280"
                        }}>
                          {STATUS_LABELS[item.status]}
                        </span>
                      </div>
                      <p style={{ margin: "0 0 8px 0", fontSize: "14px" }}>{item.description}</p>
                      {item.response_text && (
                        <div style={{
                          padding: "12px",
                          background: "rgba(59, 130, 246, 0.1)",
                          borderRadius: "8px",
                          fontSize: "13px",
                          color: "#1e40af"
                        }}>
                          <strong>Resposta:</strong> {item.response_text}
                        </div>
                      )}
                      <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                        {new Date(item.created_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
