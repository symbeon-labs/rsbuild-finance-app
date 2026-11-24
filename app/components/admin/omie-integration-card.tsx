"use client";

import { useEffect, useState } from "react";

export type OmieIntegrationStatus = {
  provider: "omie";
  configured: boolean;
  source: "database" | "env" | "none";
  status: "configured" | "verified" | "error" | "disabled" | "not_configured";
  appKeyHint: string | null;
  lastVerifiedAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
};

interface OmieIntegrationCardProps {
  organizationId: string;
  organizationName: string;
  canAdmin: boolean;
  onStatusChange?: (status: OmieIntegrationStatus) => void;
}

export function OmieIntegrationCard({
  organizationId,
  organizationName,
  canAdmin,
  onStatusChange
}: OmieIntegrationCardProps) {
  const [omieStatus, setOmieStatus] = useState<OmieIntegrationStatus | null>(null);
  const [omieAppKey, setOmieAppKey] = useState("");
  const [omieAppSecret, setOmieAppSecret] = useState("");
  const [showOmieSecret, setShowOmieSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  useEffect(() => {
    if (!canAdmin || !organizationId) return;
    let active = true;
    fetch(`/api/organization-integrations?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data?.integrations) return;
        const omie = data.integrations.find((item: OmieIntegrationStatus) => item.provider === "omie");
        if (omie) {
          setOmieStatus(omie);
          onStatusChange?.(omie);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [organizationId, canAdmin, onStatusChange]);

  async function saveOmieIntegration(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/organization-integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          provider: "omie",
          appKey: omieAppKey,
          appSecret: omieAppSecret,
          testConnection: true
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.detail || data?.error || `Erro HTTP ${response.status} ao validar integração Omie.`);
      }
      if (data?.integration) {
        setOmieStatus(data.integration);
        onStatusChange?.(data.integration);
      }
      setOmieAppKey("");
      setOmieAppSecret("");
      setMessage({
        text: `Integração Omie verificada e salva com segurança para ${organizationName}.`,
        type: "success"
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Não foi possível salvar as credenciais Omie.",
        type: "error"
      });
    } finally {
      setBusy(false);
    }
  }

  async function testOmieIntegration() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/organization-integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.detail || data?.error || `Falha ao testar conexão Omie (HTTP ${response.status}).`);
      }
      if (data?.integration) {
        setOmieStatus(data.integration);
        onStatusChange?.(data.integration);
      }
      setMessage({
        text: `Conexão Omie ativa! ${typeof data?.totalRecords === "number" ? `${data.totalRecords} título(s) em aberto localizados.` : ""}`,
        type: "success"
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Erro ao testar conexão Omie.",
        type: "error"
      });
    } finally {
      setBusy(false);
    }
  }

  async function removeOmieIntegration() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/organization-integrations?organizationId=${encodeURIComponent(organizationId)}`, {
        method: "DELETE"
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.detail || data?.error || "Não foi possível remover a integração.");
      }
      if (data?.integration) {
        setOmieStatus(data.integration);
        onStatusChange?.(data.integration);
      }
      setMessage({
        text: "Credenciais Omie removidas desta organização.",
        type: "info"
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Falha ao remover credenciais Omie.",
        type: "error"
      });
    } finally {
      setBusy(false);
    }
  }

  if (!canAdmin) {
    return (
      <div
        style={{
          padding: "16px",
          borderRadius: "10px",
          background: "var(--surface-raised)",
          border: "1px solid var(--line)",
          fontSize: "12.5px",
          color: "var(--muted)"
        }}
      >
        🔒 Somente usuários com alçada de <strong>Proprietário</strong> ou <strong>Administrador</strong> podem visualizar e configurar credenciais de integração ERP desta organização.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      {message && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background:
              message.type === "success"
                ? "rgba(16, 185, 129, 0.12)"
                : message.type === "error"
                ? "rgba(239, 68, 68, 0.12)"
                : "var(--rsbuild-terracotta-soft)",
            border: `1px solid ${
              message.type === "success"
                ? "rgba(16, 185, 129, 0.3)"
                : message.type === "error"
                ? "rgba(239, 68, 68, 0.3)"
                : "rgba(181, 88, 60, 0.3)"
            }`,
            color:
              message.type === "success"
                ? "#059669"
                : message.type === "error"
                ? "#DC2626"
                : "var(--rsbuild-terracotta)"
          }}
        >
          <span>{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: "14px", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "20px"
        }}
      >
        {/* Formulário de Conexão Omie */}
        <div
          style={{
            padding: "20px",
            borderRadius: "10px",
            background: "var(--surface-raised)",
            border: "1px solid var(--line)"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", gap: "10px", flexWrap: "wrap" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--ink)" }}>
              Omie ERP · Contas a Receber
            </h3>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: "20px",
                background:
                  omieStatus?.status === "verified"
                    ? "rgba(16, 185, 129, 0.14)"
                    : omieStatus?.status === "error"
                    ? "rgba(239, 68, 68, 0.14)"
                    : omieStatus?.configured
                    ? "rgba(37, 99, 235, 0.12)"
                    : "rgba(100, 116, 139, 0.12)",
                color:
                  omieStatus?.status === "verified"
                    ? "#059669"
                    : omieStatus?.status === "error"
                    ? "#DC2626"
                    : omieStatus?.configured
                    ? "#2563EB"
                    : "#64748B"
              }}
            >
              {omieStatus?.status === "verified"
                ? "● Conectada e Verificada"
                : omieStatus?.status === "error"
                ? "● Erro de Conexão"
                : omieStatus?.configured
                ? omieStatus.source === "env"
                  ? "● Configurada via Servidor"
                  : "● Configurada"
                : "○ Não configurada"}
            </span>
          </div>

          <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 14px", lineHeight: 1.5 }}>
            Conecte a conta Omie de <strong>{organizationName}</strong> para consultar títulos a receber em tempo real e gerar arquivos de baixa em lote sem exposição de segredos.
          </p>

          {omieStatus?.configured && (
            <div
              style={{
                padding: "12px",
                borderRadius: "8px",
                background: "var(--surface)",
                border: "1px solid var(--line)",
                marginBottom: "16px",
                fontSize: "12px",
                display: "grid",
                gap: "6px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                <span style={{ color: "var(--muted)" }}>App Key ativa:</span>
                <strong style={{ color: "var(--ink)", fontFamily: "monospace" }}>
                  {omieStatus.appKeyHint || "••••••"}
                </strong>
              </div>
              {omieStatus.lastVerifiedAt && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                  <span style={{ color: "var(--muted)" }}>Última verificação:</span>
                  <span style={{ color: "var(--ink)" }}>
                    {new Date(omieStatus.lastVerifiedAt).toLocaleString("pt-BR")}
                  </span>
                </div>
              )}
              {omieStatus.lastError && (
                <div style={{ color: "#DC2626", fontSize: "11px" }}>
                  Último erro: {omieStatus.lastError}
                </div>
              )}
              <div style={{ display: "flex", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void testOmieIntegration()}
                  className="secondary-button"
                  style={{ height: "34px", fontSize: "12px" }}
                >
                  🔄 Testar Conexão Agora
                </button>
                {omieStatus.source === "database" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeOmieIntegration()}
                    className="secondary-button"
                    style={{ height: "34px", fontSize: "12px", color: "#DC2626" }}
                  >
                    Remover Credencial
                  </button>
                )}
              </div>
            </div>
          )}

          <form onSubmit={saveOmieIntegration} style={{ display: "grid", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--ink)", marginBottom: "6px" }}>
                {omieStatus?.configured ? "Atualizar Omie App Key" : "Omie App Key"}
              </label>
              <input
                type="text"
                required
                value={omieAppKey}
                onChange={(e) => setOmieAppKey(e.target.value)}
                placeholder="Ex: 1234567890123"
                autoComplete="off"
                style={{
                  width: "100%",
                  height: "40px",
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  background: "var(--bg)",
                  color: "var(--ink)",
                  fontSize: "13px",
                  fontFamily: "monospace"
                }}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)" }}>
                  {omieStatus?.configured ? "Atualizar Omie App Secret" : "Omie App Secret"}
                </label>
                <button
                  type="button"
                  onClick={() => setShowOmieSecret((prev) => !prev)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--rsbuild-terracotta)",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  {showOmieSecret ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <input
                type={showOmieSecret ? "text" : "password"}
                required
                value={omieAppSecret}
                onChange={(e) => setOmieAppSecret(e.target.value)}
                placeholder="Cole aqui o App Secret do portal Omie"
                autoComplete="new-password"
                style={{
                  width: "100%",
                  height: "40px",
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  background: "var(--bg)",
                  color: "var(--ink)",
                  fontSize: "13px",
                  fontFamily: "monospace"
                }}
              />
            </div>

            <button
              type="submit"
              disabled={busy || !omieAppKey.trim() || !omieAppSecret.trim()}
              className="primary-button"
              style={{ height: "40px", marginTop: "4px" }}
            >
              {busy ? "Validando e salvando..." : "Testar e Salvar Credenciais Omie"}
            </button>
          </form>
        </div>

        {/* Guia Rápido para o Cliente */}
        <div
          style={{
            padding: "20px",
            borderRadius: "10px",
            background: "var(--surface-raised)",
            border: "1px solid var(--line)",
            display: "grid",
            gap: "12px",
            alignContent: "start"
          }}
        >
          <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--ink)" }}>
            Como obter suas chaves no Omie
          </h3>
          <ol style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "var(--muted)", lineHeight: 1.7, display: "grid", gap: "6px" }}>
            <li>Acesse o portal da sua empresa no <strong>Omie</strong> com perfil administrador.</li>
            <li>Clique no ícone de <strong>Configurações (engrenagem)</strong> no canto superior direito.</li>
            <li>Selecione <strong>Integrações / API</strong> (ou <em>Chaves de Acesso da API</em>).</li>
            <li>Copie os campos <strong>App Key</strong> e <strong>App Secret</strong> e cole ao lado.</li>
          </ol>

          <div
            style={{
              padding: "12px",
              borderRadius: "8px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              fontSize: "12px",
              color: "var(--muted)",
              lineHeight: 1.5
            }}
          >
            <strong style={{ color: "var(--ink)", display: "block", marginBottom: "4px" }}>
              🛡️ Segurança &amp; Governança
            </strong>
            O <strong>App Secret</strong> é criptografado com AES-256-GCM no servidor antes de ser gravado e nunca retorna para o navegador. A plataforma consulta apenas títulos em aberto e gera o CSV de baixa para revisão humana.
          </div>
        </div>
      </div>
    </div>
  );
}
