"use client";

import { useEffect, useState, useMemo } from "react";

type Props = {
  organizationId: string;
  organizationName: string;
  role: string;
};

type ActiveTab = "members" | "branding";

const ROLE_DESCRIPTIONS: Record<string, { label: string; desc: string; badgeBg: string; badgeColor: string }> = {
  viewer: {
    label: "Visualização",
    desc: "Acesso de somente leitura aos painéis, extratos e relatórios consolidados.",
    badgeBg: "rgba(100, 116, 139, 0.12)",
    badgeColor: "#64748B"
  },
  operator: {
    label: "Operação",
    desc: "Importação de extratos, conciliação exata e cadastros operacionais.",
    badgeBg: "rgba(37, 99, 235, 0.12)",
    badgeColor: "#2563EB"
  },
  admin: {
    label: "Administrador",
    desc: "Configurações da empresa, gestão de membros e alçadas de auditoria.",
    badgeBg: "rgba(181, 88, 60, 0.14)",
    badgeColor: "#B5583C"
  },
  owner: {
    label: "Proprietário",
    desc: "Alçada irrestrita, governança de holding e autorização de baixas em lote.",
    badgeBg: "rgba(16, 185, 129, 0.14)",
    badgeColor: "#059669"
  }
};

export function OrganizationAdminPanel({ organizationId, organizationName, role }: Props) {
  const canAdmin = role === "owner" || role === "admin";
  const [activeTab, setActiveTab] = useState<ActiveTab>("members");

  // Equipe & Convites
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");

  // Identidade Visual & Branding
  const [banner, setBanner] = useState<string | null>(null);
  const [positionX, setPositionX] = useState(50);
  const [positionY, setPositionY] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Status & Feedback
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [busy, setBusy] = useState(false);

  // Live preview para arquivo selecionado localmente
  const previewUrl = useMemo(() => {
    if (file) {
      return URL.createObjectURL(file);
    }
    return banner;
  }, [file, banner]);

  // Carregar dados de branding existentes
  useEffect(() => {
    let active = true;
    fetch(`/api/organization-branding?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setBanner(data.bannerUrl);
        if (typeof data.positionX === "number") setPositionX(data.positionX);
        if (typeof data.positionY === "number") setPositionY(data.positionY);
        if (typeof data.zoom === "number") setZoom(data.zoom);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [organizationId]);

  async function sendInvite(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/organization-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, email, role: inviteRole })
      });
      let data: any = null;
      try {
        data = await response.json();
      } catch {
        const textFallback = await response.text().catch(() => "");
        throw new Error(textFallback || `Erro HTTP ${response.status}: Falha na comunicação com o servidor.`);
      }
      if (!response.ok) throw new Error(data?.detail || data?.error || data?.message || "Falha ao enviar convite.");
      setMessage({
        text: `Convite enviado com sucesso para ${email}. O acesso está vinculado exclusivamente a ${organizationName}.`,
        type: "success"
      });
      setEmail("");
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Não foi possível enviar o convite.",
        type: "error"
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveBanner(event: React.FormEvent) {
    event.preventDefault();
    if (!file && !banner) {
      setMessage({ text: "Selecione uma imagem para o banner antes de salvar.", type: "error" });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("organizationId", organizationId);
      if (file) form.set("file", file);
      form.set("positionX", String(positionX));
      form.set("positionY", String(positionY));
      form.set("zoom", String(zoom));

      const response = await fetch("/api/organization-branding", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao salvar banner.");
      setBanner(data.bannerUrl);
      setFile(null);
      setMessage({
        text: `Identidade visual e enquadramento de ${organizationName} atualizados com sucesso!`,
        type: "success"
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Não foi possível salvar a identidade visual.",
        type: "error"
      });
    } finally {
      setBusy(false);
    }
  }

  function handleResetFraming() {
    setPositionX(50);
    setPositionY(50);
    setZoom(1);
  }

  return (
    <section
      className="panel cockpit-card"
      style={{
        padding: "26px 30px",
        marginBottom: "24px",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "12px",
        boxShadow: "var(--shadow)"
      }}
    >
      {/* 1. CABEÇALHO EXECUTIVO */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 800,
                letterSpacing: "0.8px",
                textTransform: "uppercase",
                background: "var(--rsbuild-terracotta)",
                color: "#FFFFFF",
                padding: "2px 8px",
                borderRadius: "4px"
              }}
            >
              Governança &amp; Identidade
            </span>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>UUID Multi-Tenant Isolado</span>
          </div>
          <h2 style={{ fontSize: "22px", fontWeight: 700, margin: "2px 0 4px", color: "var(--ink)" }}>
            {organizationName}
          </h2>
          <p style={{ color: "var(--muted)", fontSize: "13px", margin: 0 }}>
            Administração de membros, alçadas de segurança e personalização de identidade visual corporativa.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", color: "var(--muted)" }}>Sua alçada:</span>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: "20px",
              background: ROLE_DESCRIPTIONS[role]?.badgeBg || "var(--rsbuild-terracotta-soft)",
              color: ROLE_DESCRIPTIONS[role]?.badgeColor || "var(--rsbuild-terracotta)"
            }}
          >
            ● {ROLE_DESCRIPTIONS[role]?.label || role}
          </span>
        </div>
      </div>

      {/* 2. SISTEMA DE ABAS EXECUTIVAS */}
      <div className="admin-tabs">
        <button
          type="button"
          onClick={() => setActiveTab("members")}
          className={`admin-tab-btn ${activeTab === "members" ? "active" : ""}`}
        >
          <span>👥</span>
          <span>Membros &amp; Convites</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("branding")}
          className={`admin-tab-btn ${activeTab === "branding" ? "active" : ""}`}
        >
          <span>🎨</span>
          <span>Identidade Visual &amp; Banner</span>
        </button>
      </div>

      {/* 3. FEEDBACK TOAST / ALERTA */}
      {message && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "18px",
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

      {/* 4. ABA 1: MEMBROS & CONVITES */}
      {activeTab === "members" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
          {/* Formulário de Convite */}
          <div
            style={{
              padding: "20px",
              borderRadius: "10px",
              background: "var(--surface-raised)",
              border: "1px solid var(--line)"
            }}
          >
            <h3 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 4px", color: "var(--ink)" }}>
              Convidar Novo Integrante
            </h3>
            <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 16px" }}>
              Envie um convite direto com alçada restrita aos dados operacionais desta empresa.
            </p>

            {canAdmin ? (
              <form onSubmit={sendInvite} style={{ display: "grid", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--ink)", marginBottom: "6px" }}>
                    E-mail corporativo do usuário
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="exemplo@empresa.com.br"
                    style={{
                      width: "100%",
                      height: "40px",
                      padding: "0 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--line)",
                      background: "var(--bg)",
                      color: "var(--ink)",
                      fontSize: "13px"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--ink)", marginBottom: "6px" }}>
                    Papel &amp; Nível de Alçada
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    style={{
                      width: "100%",
                      height: "40px",
                      padding: "0 10px",
                      borderRadius: "8px",
                      border: "1px solid var(--line)",
                      background: "var(--bg)",
                      color: "var(--ink)",
                      fontSize: "13px"
                    }}
                  >
                    <option value="viewer">Visualização (Somente leitura e dashboards)</option>
                    <option value="operator">Operação (Conciliação, baixas e lançamentos)</option>
                    {role === "owner" && (
                      <option value="admin">Administrador (Gestão de membros e configurações)</option>
                    )}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={busy || !email}
                  className="primary-button"
                  style={{
                    height: "40px",
                    marginTop: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px"
                  }}
                >
                  <span>✉️</span>
                  <span>{busy ? "Enviando convite..." : "Enviar Convite Oficial"}</span>
                </button>
              </form>
            ) : (
              <div style={{ padding: "14px", borderRadius: "8px", background: "rgba(0,0,0,0.03)", fontSize: "12px", color: "var(--muted)" }}>
                ⚠️ Apenas usuários com papel de <strong>Administrador</strong> ou <strong>Proprietário</strong> possuem autorização para convidar novos integrantes.
              </div>
            )}
          </div>

          {/* Matriz de Alçadas e Segurança */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <h4 style={{ fontSize: "13px", fontWeight: 700, margin: 0, color: "var(--ink)" }}>
              Matriz de Permissões Multi-Tenant
            </h4>
            <div style={{ display: "grid", gap: "8px" }}>
              {Object.entries(ROLE_DESCRIPTIONS).map(([key, info]) => (
                <div
                  key={key}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    background: "var(--surface)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <strong style={{ fontSize: "12px", color: "var(--ink)" }}>{info.label}</strong>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "12px",
                        background: info.badgeBg,
                        color: info.badgeColor
                      }}
                    >
                      {key.toUpperCase()}
                    </span>
                  </div>
                  <p style={{ fontSize: "11px", color: "var(--muted)", margin: 0, lineHeight: 1.4 }}>
                    {info.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. ABA 2: IDENTIDADE VISUAL & BANNER */}
      {activeTab === "branding" && (
        <form onSubmit={saveBanner} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Caixa de Pré-Visualização Dinâmica */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)" }}>
                Pré-visualização do Banner (Live Preview)
              </span>
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                Proporção Panorâmica 21:9 · Altura de exibição adaptável
              </span>
            </div>

            <div className="banner-preview-box">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={`Banner de ${organizationName}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: `${positionX}% ${positionY}%`,
                    transform: `scale(${zoom})`,
                    transition: "transform 0.08s ease, object-position 0.08s ease"
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "rgba(255, 255, 255, 0.45)",
                    gap: "6px"
                  }}
                >
                  <span style={{ fontSize: "28px" }}>🖼️</span>
                  <span style={{ fontSize: "12px" }}>Nenhum banner configurado ainda para {organizationName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Área de Seleção e Upload do Banner (Dropzone Premium) */}
          {canAdmin && (
            <div
              className="banner-upload-dropzone"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) setFile(dropped);
              }}
              onClick={() => {
                document.getElementById("rsbuild-banner-file-input")?.click();
              }}
              style={{
                borderColor: isDragging ? "var(--rsbuild-terracotta)" : undefined,
                background: isDragging ? "var(--rsbuild-terracotta-soft)" : undefined
              }}
            >
              <input
                id="rsbuild-banner-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                style={{ display: "none" }}
              />
              <span style={{ fontSize: "24px" }}>📤</span>
              <strong style={{ fontSize: "13px", color: "var(--ink)" }}>
                {file ? file.name : "Clique para selecionar ou arraste o banner da empresa"}
              </strong>
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                Formatos suportados: PNG, JPG ou WEBP (Resolução recomendada: 1920x480px)
              </span>
            </div>
          )}

          {/* Controles Ergonômicos de Enquadramento & Zoom */}
          <div
            style={{
              padding: "18px 20px",
              borderRadius: "10px",
              background: "var(--surface-raised)",
              border: "1px solid var(--line)",
              display: "grid",
              gap: "16px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "13px", color: "var(--ink)" }}>
                Ajuste Fino de Posicionamento &amp; Escala
              </strong>
              <button
                type="button"
                onClick={handleResetFraming}
                className="secondary-button"
                style={{ height: "28px", fontSize: "11px", padding: "0 10px" }}
              >
                Restaurar Padrão (50% / 50%)
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              {/* Slider X */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--muted)", marginBottom: "2px" }}>
                  <span>Enquadramento Horizontal (X)</span>
                  <strong style={{ color: "var(--ink)" }}>{positionX}%</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={positionX}
                  onChange={(e) => setPositionX(Number(e.target.value))}
                  disabled={!canAdmin}
                  className="rsbuild-range-slider"
                  aria-label="Enquadramento horizontal do banner"
                />
              </div>

              {/* Slider Y */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--muted)", marginBottom: "2px" }}>
                  <span>Enquadramento Vertical (Y)</span>
                  <strong style={{ color: "var(--ink)" }}>{positionY}%</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={positionY}
                  onChange={(e) => setPositionY(Number(e.target.value))}
                  disabled={!canAdmin}
                  className="rsbuild-range-slider"
                  aria-label="Enquadramento vertical do banner"
                />
              </div>

              {/* Slider Zoom */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--muted)", marginBottom: "2px" }}>
                  <span>Zoom / Escala</span>
                  <strong style={{ color: "var(--ink)" }}>{zoom.toFixed(2)}x</strong>
                </div>
                <input
                  type="range"
                  min="1"
                  max="2.5"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  disabled={!canAdmin}
                  className="rsbuild-range-slider"
                  aria-label="Zoom do banner"
                />
              </div>
            </div>
          </div>

          {/* Botão de Salvar */}
          {canAdmin ? (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="submit"
                disabled={busy || (!file && !banner)}
                className="primary-button"
                style={{
                  height: "40px",
                  padding: "0 24px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <span>💾</span>
                <span>{busy ? "Salvando configurações..." : "Salvar Banner & Identidade"}</span>
              </button>
            </div>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: "12px", margin: 0, textAlign: "center" }}>
              🔒 Somente usuários com perfil de Proprietário ou Administrador podem alterar o banner da organização.
            </p>
          )}
        </form>
      )}
    </section>
  );
}
