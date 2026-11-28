"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DataIntakeDocumentType } from "@/lib/data-intake-validation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type DocumentItem = {
  id: string;
  origin_module: string;
  document_type: DataIntakeDocumentType;
  status: "received" | "under_review" | "accepted" | "rejected";
  original_filename: string;
  media_type: string;
  file_size_bytes: number;
  file_sha256: string;
  description: string | null;
  uploaded_at: string;
};

const TYPES: Array<[DataIntakeDocumentType, string]> = [
  ["financial_support", "Documento de apoio financeiro"],
  ["invoice", "Nota fiscal"],
  ["boleto", "Boleto"],
  ["receipt", "Comprovante"],
  ["contract", "Contrato"],
  ["spreadsheet", "Planilha"],
  ["other", "Outro documento"]
];

const STATUS: Record<DocumentItem["status"], string> = {
  received: "RECEBIDO",
  under_review: "EM ANÁLISE",
  accepted: "ACEITO",
  rejected: "REJEITADO"
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DataIntakePanel({ organizationId, canWrite }: { organizationId: string; canWrite: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentType, setDocumentType] = useState<DataIntakeDocumentType>("financial_support");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/data-intake?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Não foi possível carregar os documentos.");
      setDocuments(Array.isArray(payload.documents) ? payload.documents : []);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar documentos.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const intentResponse = await fetch("/api/data-intake/upload-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          fileName: file.name,
          fileSize: file.size,
          documentType,
          description
        })
      });
      const intent = await intentResponse.json();
      if (!intentResponse.ok) {
        const message = intent.error === "file_too_large"
          ? "O arquivo excede o limite de 20 MiB."
          : intent.error === "unsupported_file_type"
            ? "Formato não suportado."
            : intent.message || "Não foi possível iniciar o envio.";
        throw new Error(message);
      }

      // Binary payload travels directly from the browser to private Supabase Storage.
      // This avoids Vercel Function request-body limits and keeps file bytes out of our API.
      const supabase = createSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from("rsbuild-data-intake")
        .uploadToSignedUrl(intent.path, intent.token, file, {
          contentType: intent.mediaType,
          upsert: false
        });
      if (uploadError) throw new Error("O armazenamento privado não conseguiu receber o arquivo.");

      const completeResponse = await fetch("/api/data-intake/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          path: intent.path,
          fileName: file.name,
          documentType,
          description
        })
      });
      const payload = await completeResponse.json();
      if (!completeResponse.ok) {
        const messages: Record<string, string> = {
          duplicate_document: "Este arquivo já foi recebido nesta organização.",
          upload_intent_expired: "O prazo de envio expirou. Selecione o arquivo novamente.",
          upload_intent_mismatch: "Os dados do envio foram alterados. Inicie um novo envio.",
          document_already_finalized: "Este envio já foi finalizado. Atualize a lista de documentos.",
          unsupported_or_invalid_file: payload.message || "Formato ou conteúdo de arquivo inválido.",
          document_registration_failed: "O arquivo foi enviado, mas não foi possível registrar seus metadados.",
          document_audit_failed: "Não foi possível concluir o registro de auditoria do documento."
        };
        throw new Error(messages[payload.error] || payload.message || "Não foi possível concluir o recebimento.");
      }
      setNotice("Documento recebido e armazenado com segurança.");
      setDescription("");
      if (inputRef.current) inputRef.current.value = "";
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha no envio do documento.");
    } finally {
      // Reset even on failure so the same file can be selected and retried.
      if (inputRef.current) inputRef.current.value = "";
      setUploading(false);
    }
  }

  return (
    <section className="panel" style={{ marginTop: 18, padding: 18, display: "grid", gap: 14 }}>
      <div className="panel-heading">
        <div>
          <span className="dre-section-kicker">RSBUILD DATA INTAKE · V1</span>
          <h2>Central de documentos</h2>
          <p>Receba e organize documentos da organização em um repositório privado, com registro de origem e integridade.</p>
        </div>
        <span className="subtle-tag">Armazenamento privado</span>
      </div>

      {canWrite && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, alignItems: "end", padding: 14, border: "1px solid var(--border)", borderRadius: 10 }}>
          <label style={{ display: "grid", gap: 5, fontSize: 12 }}>
            Tipo de documento
            <select value={documentType} onChange={event => setDocumentType(event.target.value as DataIntakeDocumentType)}>
              {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 5, fontSize: 12, gridColumn: "span 2" }}>
            Observação (opcional)
            <input value={description} onChange={event => setDescription(event.target.value)} maxLength={1000} placeholder="Ex.: NF referente ao pedido 1042" />
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.docx,.csv,.json,.xml,.txt,.png,.jpg,.jpeg,.webp,application/pdf"
              style={{ display: "none" }}
              onChange={event => void upload(event.target.files?.[0])}
            />
            <button type="button" className="primary-button" disabled={uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? "Enviando…" : "＋ Enviar documento"}
            </button>
            <span style={{ fontSize: 10, color: "var(--muted)" }}>PDF, Office, CSV, JSON, XML, TXT e imagens · até 20 MB</span>
          </div>
        </div>
      )}

      {notice && <p role="status" style={{ margin: 0, color: "var(--green-text,#047857)", fontSize: 12 }}>{notice}</p>}
      {error && <p role="alert" style={{ margin: 0, color: "var(--red,#B91C1C)", fontSize: 12 }}>{error}</p>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <strong style={{ fontSize: 12 }}>Documentos recebidos ({documents.length})</strong>
        <button type="button" className="secondary-button" onClick={() => void refresh()} disabled={loading}>{loading ? "Atualizando…" : "Atualizar"}</button>
      </div>

      {loading ? <p style={{ color: "var(--muted)", fontSize: 12 }}>Carregando documentos…</p> : documents.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", border: "1px dashed var(--border)", borderRadius: 9, color: "var(--muted)", fontSize: 12 }}>
          Nenhum documento recebido nesta organização.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 7 }}>
          {documents.map(document => (
            <article key={document.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 11, border: "1px solid var(--border)", borderRadius: 8 }}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: "block", fontSize: 12, overflowWrap: "anywhere" }}>{document.original_filename}</strong>
                <span style={{ display: "block", marginTop: 4, color: "var(--muted)", fontSize: 10 }}>
                  {TYPES.find(([value]) => value === document.document_type)?.[1] ?? "Documento"} · {document.origin_module.toUpperCase()} · {formatBytes(Number(document.file_size_bytes))} · {new Date(document.uploaded_at).toLocaleString("pt-BR")}
                </span>
                {document.description && <span style={{ display: "block", marginTop: 3, color: "var(--muted)", fontSize: 10 }}>{document.description}</span>}
                <span style={{ display: "block", marginTop: 3, color: "var(--muted)", fontSize: 9 }}>SHA-256: {document.file_sha256.slice(0, 16)}… · {STATUS[document.status]}</span>
              </div>
              <a
                className="secondary-button"
                href={`/api/data-intake/${encodeURIComponent(document.id)}/download?organizationId=${encodeURIComponent(organizationId)}`}
                style={{ flexShrink: 0, textDecoration: "none", fontSize: 10, padding: "7px 10px" }}
              >Baixar</a>
            </article>
          ))}
        </div>
      )}
      <p style={{ margin: 0, color: "var(--muted)", fontSize: 10 }}>
        V1 preserva o arquivo original e registra integridade, autoria e histórico de recebimento. Extração automática e lançamento financeiro só ocorrerão em etapas posteriores, após revisão.
      </p>
    </section>
  );
}
