"use client";

import { useEffect, useState } from "react";

type SandboxData = {
  organizations: any[];
  memberships: any[];
  financialAccounts: any[];
  financialRecords: any[];
  receivableTitles: any[];
  deliveryProofs: any[];
  auditEvents: any[];
  isSandbox: boolean;
};

export function SandboxView() {
  const [data, setData] = useState<SandboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/sandbox", { cache: "no-store" });
        const text = await res.text();
        let json: any = {};
        try {
          json = text ? JSON.parse(text) : {};
        } catch {
          throw new Error(`Resposta inválida (HTTP ${res.status})`);
        }
        if (!res.ok) {
          throw new Error(json.error || json.message || `Erro ${res.status}`);
        }
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao carregar sandbox.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="card cockpit-card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
        Carregando sandbox…
      </div>
    );
  }

  if (error) {
    return (
      <div className="card cockpit-card" style={{ padding: 24, borderLeft: "4px solid #DC2626" }}>
        <div style={{ fontWeight: 700, color: "#DC2626", marginBottom: 8 }}>Sandbox indisponível</div>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <section style={{ display: "grid", gap: 20 }}>
      {/* Header */}
      <div className="card cockpit-card" style={{ padding: "20px 24px", borderLeft: "4px solid #7C3AED" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>🧪</span>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
              Sandbox - Ambiente de Testes
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
              Dados sintéticos isolados para testes seguros. Nenhum dado real de clientes.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
        <div className="card cockpit-card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Organizações</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>{data.organizations.length}</div>
        </div>
        <div className="card cockpit-card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Membros</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>{data.memberships.length}</div>
        </div>
        <div className="card cockpit-card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Contas</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>{data.financialAccounts.length}</div>
        </div>
        <div className="card cockpit-card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Registros</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>{data.financialRecords.length}</div>
        </div>
        <div className="card cockpit-card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Títulos</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>{data.receivableTitles.length}</div>
        </div>
        <div className="card cockpit-card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Provas</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>{data.deliveryProofs.length}</div>
        </div>
      </div>

      {/* Organizations */}
      <div className="card cockpit-card" style={{ padding: "20px 24px" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
          Organizações Sandbox
        </h3>
        <div style={{ display: "grid", gap: 10 }}>
          {data.organizations.map((org) => (
            <div
              key={org.id}
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--surface-raised)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <div>
                <strong style={{ fontSize: 14, color: "var(--ink)" }}>{org.display_name}</strong>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{org.slug}</div>
              </div>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(124, 58, 237, 0.12)", color: "#7C3AED" }}>
                {org.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Sample Data Preview */}
      <div className="card cockpit-card" style={{ padding: "20px 24px" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
          Amostra de Dados Sintéticos
        </h3>
        <div style={{ display: "grid", gap: 16 }}>
          {data.financialRecords.slice(0, 3).map((record) => (
            <div key={record.id} style={{ padding: "10px 14px", borderRadius: 6, background: "var(--surface)", border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{record.description}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: record.direction === "entrada" ? "#059669" : "#DC2626" }}>
                  {record.direction === "entrada" ? "+" : "-"}R$ {(record.amount_cents / 100).toFixed(2)}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{record.transaction_date}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
