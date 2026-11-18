"use client";

import { useRouter } from "next/navigation";
import { RsbuildIcon } from "@/app/components/rsbuild-icons";
import { CapabilityLicensingPanel } from "@/app/components/executive/capability-licensing-panel";

export type HoldingWorkspaceOrganization = {
  id: string;
  slug: string;
  name: string;
};

type Props = {
  organizations: HoldingWorkspaceOrganization[];
  sandboxOrganizations: HoldingWorkspaceOrganization[];
  currentOrganizationId: string;
  canManageCapabilities?: boolean;
};

const CAPABILITIES = [
  { name: "Finanças & Caixa", state: "planned", description: "Gestão financeira e movimentações por empresa." },
  { name: "Reconciliação & Baixas", state: "planned", description: "Conferência bancária, títulos e baixas." },
  { name: "Logística & Expedição", state: "planned", description: "Pedidos, expedição e comprovantes." },
  { name: "Auditoria & Governança", state: "available", description: "Auditoria institucional, acessos e governança." }
] as const;

function EnvironmentCard({ item, kind, onOpen }: {
  item: HoldingWorkspaceOrganization;
  kind: "production" | "qa" | "sandbox";
  onOpen: () => void;
}) {
  const meta = {
    production: { label: "OFICIAL", description: "Ambiente operacional da empresa", tone: "#059669", icon: "integration" as const },
    qa: { label: "HOMOLOGAÇÃO", description: "Testes funcionais e validação com dados controlados", tone: "#B7791F", icon: "approval" as const },
    sandbox: { label: "SANDBOX", description: "Laboratório isolado para experimentação e evidências", tone: "#7C3AED", icon: "search" as const }
  }[kind];

  return (
    <article className="card cockpit-card" style={{ padding: 18, display: "grid", gap: 12, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: meta.tone, fontSize: 10, fontWeight: 800, letterSpacing: ".08em" }}>
          <RsbuildIcon name={meta.icon} size={16} tone="secondary" /> {meta.label}
        </span>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: meta.tone }} />
      </div>
      <div>
        <h3 style={{ margin: 0, color: "var(--ink)", fontSize: 16 }}>{item.name}</h3>
        <p style={{ margin: "5px 0 0", color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>{meta.description}</p>
      </div>
      <button type="button" className="secondary-button" onClick={onOpen} style={{ justifySelf: "start", display: "inline-flex", alignItems: "center", gap: 7 }}>
        Abrir ambiente →
      </button>
    </article>
  );
}

export function HoldingWorkspaceManagementView({ organizations, sandboxOrganizations, currentOrganizationId, canManageCapabilities = false }: Props) {
  const router = useRouter();
  const official = organizations.filter((item) => !item.slug.endsWith("_qa") && item.slug !== "rsbuild");
  const qa = organizations.filter((item) => item.slug.endsWith("_qa"));
  const integratedSandboxOrganizations = sandboxOrganizations.filter((item) => item.slug === "mundo-sabor-sandbox");
  const internal = organizations.find((item) => item.slug === "rsbuild");

  function openOrganization(id: string) {
    router.push(`/?organizationId=${encodeURIComponent(id)}&tab=workspace`);
  }

  function openSandbox() {
    router.push(`/?organizationId=${encodeURIComponent(currentOrganizationId)}&tab=sandbox`);
  }

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
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, maxWidth: 780, lineHeight: 1.6 }}>
            Núcleo de organização e governança do ecossistema: estrutura empresarial, identidades, projetos, capacidades habilitadas e ambientes autorizados.
          </p>
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
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 12, lineHeight: 1.55 }}>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <div>
          <div className="eyebrow">02 · CATÁLOGO DE CAPACIDADES</div>
          <h2 style={{ color: "var(--ink)", margin: "4px 0", fontSize: 18 }}>Módulos & habilitações</h2>
          <p style={{ color: "var(--muted)", margin: 0, fontSize: 12 }}>O catálogo descreve capacidades do ecossistema; disponibilidade operacional é definida por workspace.</p>
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
                <p style={{ margin: 0, color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>{item.description}</p>
              </article>
            );
          })}
        </div>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 11 }}>Os módulos financeiros, de reconciliação e logística não estão habilitados no workspace institucional RSBUILD. O catálogo não concede acesso nem representa implantação concluída.</p>
      </section>

      {canManageCapabilities && <section style={{ display: "grid", gap: 12 }}>
        <div>
          <div className="eyebrow">03 · AUTORIZAÇÃO INSTITUCIONAL</div>
          <h2 style={{ color: "var(--ink)", margin: "4px 0", fontSize: 18 }}>Licenças por organização</h2>
          <p style={{ color: "var(--muted)", margin: 0, fontSize: 12 }}>Somente o Owner institucional pode conceder, suspender ou revogar capacidades.</p>
        </div>
        <CapabilityLicensingPanel />
      </section>}

      <section style={{ display: "grid", gap: 12 }}>
        <div>
          <div className="eyebrow">03 · AMBIENTES E ENTIDADES</div>
          <h2 style={{ color: "var(--ink)", margin: "4px 0", fontSize: 18 }}>Organizações do ecossistema</h2>
          <p style={{ color: "var(--muted)", margin: 0, fontSize: 12 }}>Acesso apenas às organizações e ambientes para os quais sua conta possui autorização.</p>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <h3 style={{ color: "var(--ink)", fontSize: 14, margin: "4px 0 9px" }}>Empresas · ambientes oficiais</h3>
            {official.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
              {official.map((item) => <EnvironmentCard key={item.id} item={item} kind="production" onOpen={() => openOrganization(item.id)} />)}
            </div> : <p style={{ color: "var(--muted)", fontSize: 12 }}>Nenhum ambiente oficial empresarial concedido a esta conta.</p>}
          </div>
          <div>
            <h3 style={{ color: "var(--ink)", fontSize: 14, margin: "4px 0 9px" }}>Ambientes de homologação</h3>
            {qa.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
              {qa.map((item) => <EnvironmentCard key={item.id} item={item} kind="qa" onOpen={() => openOrganization(item.id)} />)}
            </div> : <p style={{ color: "var(--muted)", fontSize: 12 }}>Nenhum ambiente QA concedido a esta conta.</p>}
          </div>
          <div>
            <h3 style={{ color: "var(--ink)", fontSize: 14, margin: "4px 0 9px" }}>Laboratórios isolados</h3>
            {integratedSandboxOrganizations.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
              {integratedSandboxOrganizations.map((item) => <EnvironmentCard key={item.id} item={item} kind="sandbox" onOpen={openSandbox} />)}
            </div> : <p style={{ color: "var(--muted)", fontSize: 12 }}>Nenhum Sandbox integrado e concedido a esta conta.</p>}
          </div>
        </div>
      </section>
    </section>
  );
}
