"use client";

const pillars = [
  {
    number: "01",
    title: "Integração de agentes",
    description:
      "Conexão controlada de agentes inteligentes aos ambientes e sistemas autorizados, respeitando os limites definidos para cada operação.",
    tags: ["Conectividade", "Escopo autorizado"]
  },
  {
    number: "02",
    title: "Governança e supervisão",
    description:
      "Políticas de atuação, níveis de autonomia e pontos de aprovação humana para manter decisões relevantes sob responsabilidade das pessoas.",
    tags: ["Human-in-the-loop", "Políticas de segurança"]
  },
  {
    number: "03",
    title: "Observabilidade e conformidade",
    description:
      "Acompanhamento institucional das atividades, rastreabilidade e controles para apoiar transparência, segurança e melhoria contínua.",
    tags: ["Rastreabilidade", "Conformidade"]
  }
];

export function AgentsInstitutionalView() {
  return (
    <section aria-labelledby="agents-institutional-title" style={{ display: "grid", gap: 20 }}>
      <div
        className="card cockpit-card"
        style={{
          padding: "clamp(24px, 4vw, 42px)",
          borderLeft: "4px solid #7C3AED",
          background: "linear-gradient(135deg, var(--surface-raised), var(--surface))"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <span aria-hidden="true" style={{ fontSize: 26 }}>✳</span>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.5px", color: "#7C3AED", textTransform: "uppercase" }}>
            Capacidade institucional
          </span>
          <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, padding: "5px 9px", borderRadius: 20, color: "#7C3AED", background: "rgba(124,58,237,.10)" }}>
            EM EVOLUÇÃO
          </span>
        </div>
        <h2 id="agents-institutional-title" style={{ margin: 0, maxWidth: 760, fontSize: "clamp(25px, 3vw, 34px)", lineHeight: 1.15, color: "var(--ink)" }}>
          Inteligência integrada. Governança humana. Operação controlada.
        </h2>
        <p style={{ margin: "14px 0 0", maxWidth: 820, fontSize: 14, lineHeight: 1.75, color: "var(--muted)" }}>
          A RSBUILD desenvolve uma camada institucional para integração, supervisão e governança de agentes inteligentes nos ambientes conectados. A infraestrutura foi concebida para operar com escopos autorizados, limites explícitos de atuação, rastreabilidade e mecanismos de aprovação humana.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))", gap: 14 }}>
        {pillars.map((pillar) => (
          <article key={pillar.number} className="card cockpit-card" style={{ padding: 22, display: "flex", flexDirection: "column", minHeight: 218 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1px", color: "#7C3AED" }}>{pillar.number}</span>
            <h3 style={{ margin: "13px 0 8px", fontSize: 16, color: "var(--ink)" }}>{pillar.title}</h3>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.7, color: "var(--muted)", flex: 1 }}>{pillar.description}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 16 }}>
              {pillar.tags.map((tag) => (
                <span key={tag} style={{ fontSize: 10, padding: "4px 7px", borderRadius: 5, border: "1px solid var(--line)", color: "var(--muted)" }}>{tag}</span>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="card cockpit-card" style={{ padding: "18px 22px", display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span aria-hidden="true" style={{ fontSize: 18 }}>◈</span>
        <div>
          <strong style={{ display: "block", fontSize: 13, color: "var(--ink)" }}>Acesso e responsabilidade</strong>
          <p style={{ margin: "5px 0 0", fontSize: 12, lineHeight: 1.65, color: "var(--muted)" }}>
            Os recursos avançados de integração, configuração e administração são restritos à equipe técnica autorizada da RSBUILD. Agentes não substituem a decisão humana em ações sujeitas à aprovação.
          </p>
        </div>
      </div>
    </section>
  );
}
