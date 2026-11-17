"use client";

import { useRouter } from "next/navigation";
import { RsbuildIcon } from "@/app/components/rsbuild-icons";

export type HoldingWorkspaceOrganization = {
  id: string;
  slug: string;
  name: string;
};

type Props = {
  organizations: HoldingWorkspaceOrganization[];
  sandboxOrganizations: HoldingWorkspaceOrganization[];
  currentOrganizationId: string;
};

function EnvironmentCard({
  item,
  kind,
  onOpen
}: {
  item: HoldingWorkspaceOrganization;
  kind: "production" | "qa" | "sandbox";
  onOpen: () => void;
}) {
  const meta = {
    production: { label: "OFICIAL", description: "Ambiente operacional da empresa", tone: "#059669", icon: "building-2" as const },
    qa: { label: "HOMOLOGAÇÃO", description: "Testes funcionais e validação com dados controlados", tone: "#B7791F", icon: "flask-conical" as const },
    sandbox: { label: "SANDBOX", description: "Laboratório isolado para experimentação e evidências", tone: "#7C3AED", icon: "test-tube" as const }
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
        Abrir ambiente <RsbuildIcon name="arrow-right" size={14} tone="accent" />
      </button>
    </article>
  );
}

export function HoldingWorkspaceManagementView({
  organizations,
  sandboxOrganizations,
  currentOrganizationId
}: Props) {
  const router = useRouter();
  const official = organizations.filter((item) => !item.slug.endsWith("_qa") && item.slug !== "rsbuild");
  const qa = organizations.filter((item) => item.slug.endsWith("_qa"));
  const internal = organizations.find((item) => item.slug === "rsbuild");

  function openOrganization(id: string) {
    router.push(`/?organizationId=${encodeURIComponent(id)}&tab=workspace`);
  }

  function openSandbox() {
    router.push(`/?organizationId=${encodeURIComponent(currentOrganizationId)}&tab=sandbox`);
  }

  return (
    <section style={{ display: "grid", gap: 24, paddingBottom: 36 }}>
      <header className="cockpit-hero">
        <div>
          <div className="eyebrow">RSBUILD OS · ADMINISTRAÇÃO MULTIEMPRESA</div>
          <h1 style={{ margin: "6px 0", color: "var(--ink)", fontSize: 25 }}>Workspaces & Ambientes</h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, maxWidth: 760 }}>
            Central de acesso aos ambientes empresariais autorizados, com separação entre operação oficial, homologação e sandbox.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="status-pill" style={{ fontSize: 11 }}>Acesso por autorização</span>
        </div>
      </header>

      {internal && (
        <article className="card cockpit-card" style={{ padding: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", borderLeft: "4px solid var(--rsbuild-terracotta, #B5583C)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <RsbuildIcon name="control-tower" size={25} tone="accent" />
            <div>
              <div className="eyebrow">HOLDING · CAMADA INSTITUCIONAL</div>
              <strong style={{ color: "var(--ink)", fontSize: 15 }}>{internal.name}</strong>
              <p style={{ margin: "3px 0 0", color: "var(--muted)", fontSize: 12 }}>Governança, portfólio, identidades e observabilidade do ecossistema.</p>
            </div>
          </div>
          <span style={{ color: "#059669", fontSize: 10, fontWeight: 800 }}>AMBIENTE ATUAL</span>
        </article>
      )}

      <section style={{ display: "grid", gap: 12 }}>
        <div>
          <div className="eyebrow">01 · AMBIENTES OFICIAIS</div>
          <h2 style={{ color: "var(--ink)", margin: "4px 0", fontSize: 18 }}>Operação das empresas</h2>
          <p style={{ color: "var(--muted)", margin: 0, fontSize: 12 }}>Acesso apenas às organizações para as quais sua conta possui membership.</p>
        </div>
        {official.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
            {official.map((item) => <EnvironmentCard key={item.id} item={item} kind="production" onOpen={() => openOrganization(item.id)} />)}
          </div>
        ) : <p style={{ color: "var(--muted)", fontSize: 12 }}>Nenhum ambiente oficial empresarial concedido a esta conta.</p>}
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <div>
          <div className="eyebrow">02 · QA</div>
          <h2 style={{ color: "var(--ink)", margin: "4px 0", fontSize: 18 }}>Ambientes de homologação</h2>
          <p style={{ color: "var(--muted)", margin: 0, fontSize: 12 }}>Espaços destinados à validação de processos antes de qualquer promoção para produção.</p>
        </div>
        {qa.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
            {qa.map((item) => <EnvironmentCard key={item.id} item={item} kind="qa" onOpen={() => openOrganization(item.id)} />)}
          </div>
        ) : <p style={{ color: "var(--muted)", fontSize: 12 }}>Nenhum ambiente QA concedido a esta conta.</p>}
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <div>
          <div className="eyebrow">03 · LABORATÓRIO ISOLADO</div>
          <h2 style={{ color: "var(--ink)", margin: "4px 0", fontSize: 18 }}>Sandbox</h2>
          <p style={{ color: "var(--muted)", margin: 0, fontSize: 12 }}>Ambientes isolados para experimentação, cenários sintéticos e registro de evidências.</p>
        </div>
        {sandboxOrganizations.length ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
              {sandboxOrganizations.map((item) => <EnvironmentCard key={item.id} item={item} kind="sandbox" onOpen={openSandbox} />)}
            </div>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 11 }}>
              A central de homologação abre os casos atualmente habilitados para Mundo do Sabor. Os demais sandboxes aparecem como ambientes concedidos, sem misturar seus dados.
            </p>
          </>
        ) : <p style={{ color: "var(--muted)", fontSize: 12 }}>Nenhum ambiente Sandbox concedido a esta conta.</p>}
      </section>
    </section>
  );
}
