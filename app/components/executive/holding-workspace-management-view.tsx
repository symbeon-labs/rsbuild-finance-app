"use client";

import { RsbuildIcon } from "@/app/components/rsbuild-icons";

export type HoldingWorkspaceOrganization = { id: string; slug: string; name: string; };

type Props = { organizationName: string; };

const PILLARS = [
  {
    number: "01",
    title: "Integração operacional",
    description: "Conectar organizações, sistemas e fluxos de trabalho em ambientes autorizados.",
    icon: "integration" as const
  },
  {
    number: "02",
    title: "Governança e controle",
    description: "Organizar identidades, responsabilidades e limites de acesso com critérios explícitos.",
    icon: "guardian" as const
  },
  {
    number: "03",
    title: "Transparência operacional",
    description: "Acompanhar atividades relevantes com registros, evidências e supervisão adequada.",
    icon: "document" as const
  }
];

export function HoldingWorkspaceManagementView({ organizationName }: Props) {
  return (
    <section style={{ display: "grid", gap: 22, paddingBottom: 36 }}>
      <header
        className="cockpit-hero"
        style={{
          padding: "clamp(26px, 4vw, 42px)",
          alignItems: "flex-start",
          background: "linear-gradient(120deg, var(--surface-raised), var(--surface))",
          borderLeft: "4px solid var(--rsbuild-terracotta, #B5583C)"
        }}
      >
        <div style={{ maxWidth: 760 }}>
          <div className="eyebrow">RSBUILD OS · GOVERNANÇA INSTITUCIONAL</div>
          <h1 style={{ margin: "10px 0 8px", color: "var(--ink)", fontSize: "clamp(27px, 3vw, 36px)", lineHeight: 1.12 }}>
            Estrutura para operações conectadas.
          </h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14, lineHeight: 1.75 }}>
            A RSBUILD organiza a integração e a governança de ambientes empresariais,
            conectando processos, pessoas e tecnologia sob regras de acesso e
            responsabilidades definidas.
          </p>
        </div>
        <span className="status-pill" style={{ fontSize: 10, whiteSpace: "nowrap" }}>
          AMBIENTE INSTITUCIONAL
        </span>
      </header>

      <article
        className="card cockpit-card"
        style={{
          padding: "18px 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              display: "grid",
              placeItems: "center",
              background: "var(--rsbuild-terracotta-soft, rgba(181,88,60,.10))"
            }}
          >
            <RsbuildIcon name="control-tower" size={25} tone="accent" />
          </div>
          <div>
            <div className="eyebrow">ORGANIZAÇÃO ATUAL</div>
            <strong style={{ color: "var(--ink)", fontSize: 16 }}>{organizationName}</strong>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>
              Espaço institucional de coordenação e governança.
            </p>
          </div>
        </div>
        <span style={{ color: "#059669", fontSize: 10, fontWeight: 800, letterSpacing: ".5px" }}>
          ● CONTEXTO INSTITUCIONAL
        </span>
      </article>

      <section style={{ display: "grid", gap: 12 }}>
        <div>
          <div className="eyebrow">COMO A RSBUILD OPERA</div>
          <h2 style={{ color: "var(--ink)", margin: "5px 0", fontSize: 19 }}>
            Princípios de atuação
          </h2>
          <p style={{ color: "var(--muted)", margin: 0, fontSize: 13, lineHeight: 1.6 }}>
            Uma visão geral das frentes que orientam a plataforma, sem expor configurações ou estruturas técnicas internas.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 235px), 1fr))", gap: 14 }}>
          {PILLARS.map((item) => (
            <article
              key={item.number}
              className="card cockpit-card"
              style={{ padding: 21, display: "flex", flexDirection: "column", gap: 12, minHeight: 190 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <RsbuildIcon name={item.icon} size={23} tone="accent" />
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: "var(--muted)" }}>
                  {item.number}
                </span>
              </div>
              <div>
                <h3 style={{ color: "var(--ink)", margin: "0 0 7px", fontSize: 15 }}>{item.title}</h3>
                <p style={{ color: "var(--muted)", margin: 0, fontSize: 12.5, lineHeight: 1.7 }}>
                  {item.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        className="card cockpit-card"
        style={{
          padding: "20px 22px",
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: 14,
          alignItems: "start",
          borderLeft: "3px solid #7C3AED"
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 21, color: "#7C3AED" }}>◈</span>
        <div>
          <strong style={{ display: "block", color: "var(--ink)", fontSize: 13 }}>
            Acesso orientado por responsabilidade
          </strong>
          <p style={{ color: "var(--muted)", margin: "5px 0 0", fontSize: 12, lineHeight: 1.7 }}>
            Cada ambiente e recurso é disponibilizado conforme autorização e finalidade.
            Configurações administrativas e componentes técnicos permanecem restritos
            aos responsáveis designados.
          </p>
        </div>
      </section>
    </section>
  );
}
