import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import EnterpriseWorkspace from "./enterprise-workspace";
import { createClient } from "@/lib/supabase/server";
import { selectOrganization, signOut } from "@/app/auth/actions";
import type { OrganizationId } from "@/app/types/workspace";

export const dynamic = "force-dynamic";

// The selection action redirects with ?error=organization when membership validation fails.
type Props = { searchParams: Promise<{ organizationId?: string; error?: string }> };

export default async function Home({ searchParams }: Props) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const rememberedOrganizationId = cookieStore.get("rsbuild_active_organization")?.value;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .order("organization_id");

  if (membershipError || !memberships?.length) {
    return (
      <main className="app-shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <section className="panel" style={{ width: "min(100%, 560px)", padding: 32 }}>
          <div className="eyebrow">RSBUILD OS</div>
          <h1 style={{ marginTop: 12 }}>Acesso aguardando provisionamento</h1>
          <p>Sua conta foi autenticada, mas ainda não está vinculada a uma organização. Solicite ao administrador o provisionamento do seu acesso.</p>
          <p style={{ overflowWrap: "anywhere" }}>{user.email}</p>
          <form action={signOut}><button className="secondary-button" type="submit">Sair</button></form>
        </section>
      </main>
    );
  }

  const organizationIds = memberships.map((membership) => membership.organization_id);
  const { data: organizations, error: organizationsError } = await supabase
    .from("organizations")
    .select("id, display_name, slug")
    .in("id", organizationIds);

  if (organizationsError || !organizations?.length) {
    return (
      <main className="app-shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <section className="panel" style={{ width: "min(100%, 560px)", padding: 32 }}>
          <h1>Não foi possível carregar suas organizações</h1>
          <p>Tente novamente ou solicite suporte ao administrador.</p>
          <form action={signOut}><button className="secondary-button" type="submit">Sair</button></form>
        </section>
      </main>
    );
  }

  const requestedOrganizationId = params.organizationId;
  const selected = organizations.find((organization) => organization.id === requestedOrganizationId)
    ?? organizations.find((organization) => organization.id === rememberedOrganizationId)
    ?? (organizations.length === 1 ? organizations[0] : null);

  if (!selected) {
    return (
      <main className="app-shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <section className="panel" style={{ width: "min(100%, 560px)", padding: 32 }}>
          <div className="eyebrow">RSBUILD OS</div>
          <h1 style={{ marginTop: 12 }}>Selecione a organização</h1>
          <p>Escolha o espaço de trabalho vinculado à sua conta.</p>
          {params.error === "organization" && <p role="alert" style={{ color: "var(--danger, #B42318)" }}>Não foi possível selecionar essa organização. Verifique seu vínculo de acesso e tente novamente.</p>}
          <form action={selectOrganization} style={{ display: "grid", gap: 16, marginTop: 20 }}>
            <label style={{ display: "grid", gap: 6 }}>Organização
              <select name="organizationId" required defaultValue="">
                <option value="" disabled>Selecione...</option>
                {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.display_name}</option>)}
              </select>
            </label>
            <button className="primary-button" type="submit">Continuar</button>
          </form>
          <form action={signOut} style={{ marginTop: 12 }}><button className="secondary-button" type="submit">Sair</button></form>
        </section>
      </main>
    );
  }

  const selectedMembership = memberships.find((membership) => membership.organization_id === selected.id);
  const devAllowlist = (process.env.RSBUILD_DEV_AUTHORIZED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const isDeveloperAuthorized = Boolean(user.email && devAllowlist.includes(user.email.toLowerCase()));
  const validOrganizationSlugs: OrganizationId[] = ["rsbuild", "hub_acai", "mundo_sabor"];
  if (!validOrganizationSlugs.includes(selected.slug as OrganizationId)) {
    return (
      <main className="app-shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <section className="panel" style={{ width: "min(100%, 560px)", padding: 32 }}>
          <h1>Organização sem identificador configurado</h1>
          <p>O espaço de trabalho existe, mas seu identificador canônico ainda não está disponível. Solicite ao administrador a validação da configuração do tenant.</p>
          <form action={signOut}><button className="secondary-button" type="submit">Sair</button></form>
        </section>
      </main>
    );
  }
  const organizationSlug = selected.slug as OrganizationId;
  return <Suspense fallback={null}><EnterpriseWorkspace
    key={selected.id}
    organizationId={selected.id}
    availableOrganizations={organizations.map((organization) => ({ id: organization.id, name: organization.display_name }))}
    organizationSlug={organizationSlug}
    organizationName={selected.display_name}
    membershipRole={selectedMembership?.role ?? "viewer"}
    userEmail={user.email ?? ""}
    isDeveloperAuthorized={isDeveloperAuthorized}
  /></Suspense>;
}
