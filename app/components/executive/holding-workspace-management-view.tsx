"use client";

import { RsbuildIcon } from "@/app/components/rsbuild-icons";
import { CapabilityLicensingPanel } from "@/app/components/executive/capability-licensing-panel";

export type HoldingWorkspaceOrganization = { id: string; slug: string; name: string; };

type Props = { canManageCapabilities?: boolean; };

const CAPABILITIES = [
  { name: "Finanças & Caixa", state: "planned", description: "Gestão financeira e movimentações por empresa." },
  { name: "Reconciliação & Baixas", state: "planned", description: "Conferência bancária, títulos e baixas." },
  { name: "Logística & Expedição", state: "planned", description: "Pedidos, expedição e comprovantes." },
  { name: "Auditoria & Governança", state: "available", description: "Auditoria institucional, acessos e governança." }
] as const;

export function HoldingWorkspaceManagementView({ canManageCapabilities = false }: Props) {

  const sections = [
    { title: "Organizações & unidades", detail: "Empresas e ambientes vinculados à estrutura institucional.", icon: "integration" as const },
    { title: "Identidades & permissões", detail: "Acesso concedido por membership, papel e escopo de projeto.", icon: "users" as const },
    { title: "Projetos & portfólio", detail: "Projetos, sprints, responsáveis, dependências e entregáveis.", icon: "document" as const },
    { title: "Políticas & evidências", detail: "Governança, rastreabilidade e controles auditáveis.", icon: "guardian" as const }
  ];

  return (
    <section style={{ display: "grid", gap: 24, paddingBottom: 36 }}>
      <header className="cockpit-hero">
        <div>
          <div className="eyebrow">RSBUILD OS · INSTITUTIONAL GOVERNANCE LAYER</div>
          <h1 style={{ margin: "6px 0", color: "var(--ink)", fontSize: 27 }}>Workspace Institucional</h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>Governança central da RSBUILD.</p>
        </div>
        <span className="status-pill" style={{ fontSize: 11 }}>Camada institucional</span>
      </header>

      {internal && (
        <article className="card cockpit-card" style={{ padding: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", borderLeft: "4px solid var(--rsbuild-terracotta, #B5583C)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <RsbuildIcon name="control-tower" size={28} tone="accent" />
            <div>
              <div className="eyebrow">ORGANIZAÇÃO-MÃE · HOLDING</div>
              <strong style={{ color: "var(--ink)", fontSize: 16 }}>{internal.name}</strong>
              <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>Governança central, portfólio, identidades e observabilidade.</p>
            </div>
          </div>
          <span style={{ color: "#059669", fontSize: 10, fontWeight: 800 }}>WORKSPACE ATUAL</span>
        </article>
      )}

      <section style={{ display: "grid", gap: 12 }}>
        <div>
          <div className="eyebrow">01 · ESTRUTURA INSTITUCIONAL</div>
          <h2 style={{ color: "var(--ink)", margin: "4px 0", fontSize: 18 }}>Pilares do Workspace</h2>
          <p style={{ color: "var(--muted)", margin: 0, fontSize: 12 }}>Visão lógica dos domínios que organizam a operação e a governança.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {sections.map((item) => (
            <article key={item.title} className="card cockpit-card" style={{ padding: 17, display: "grid", gap: 9 }}>
              <RsbuildIcon name={item.icon} size={21} tone="accent" />
              <strong style={{ color: "var(--ink)", fontSize: 14 }}>{item.title}</strong>
            </article>
          ))}
        </div>
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <div>
          <div className="eyebrow">02 · CATÁLOGO DE CAPACIDADES</div>
          <h2 style={{ color: "var(--ink)", margin: "4px 0", fontSize: 18 }}>Módulos & habilitações</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
          {CAPABILITIES.map((item) => {
            const active = item.state === "available";
            return (
              <article key={item.name} className="card cockpit-card" style={{ padding: 17, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ color: "var(--ink)", fontSize: 13 }}>{item.name}</strong>
                  <span className="status-pill" style={{ color: active ? "#059669" : "#9A6B25", fontSize: 9 }}>{active ? "DISPONÍVEL" : "ROADMAP"}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {canManageCapabilities && <section style={{ display: "grid", gap: 12 }}>
        <div>
          <div className="eyebrow">03 · AUTORIZAÇÃO INSTITUCIONAL</div>
          <h2 style={{ color: "var(--ink)", margin: "4px 0", fontSize: 18 }}>Licenças por organização</h2>
        </div>
        <CapabilityLicensingPanel />
      </section>}

    </section>
  );
}
