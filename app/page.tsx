import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import EnterpriseWorkspace from "./enterprise-workspace";
import { OnboardingExperience } from "@/app/components/auth/onboarding-experience";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { isDeveloperEmail } from "@/lib/permissions";
import type { OrganizationId } from "@/app/types/workspace";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    organizationId?: string;
    setup?: string;
    tab?: string;
  }>;
};

export default async function Home({ searchParams }: Props) {
  const params = await searchParams;
  const cookieStore = await cookies();
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

  // =========================================================================
  // FLUXO DE PRIMEIRO ACESSO (ONBOARDING & PERSONALIZAÇÃO DA EXPERIÊNCIA)
  // Para novos usuários no 1º login: personaliza perfil e confirma organização
  // sem expor outros tenants corporativos da plataforma.
  // =========================================================================
  const isOnboardingCompleted = Boolean(user.user_metadata?.onboarding_completed);
  const isForceSetup = params.setup === "true";
  const isDev = isDeveloperEmail(user.email);
  const shouldShowOnboarding = (!isOnboardingCompleted && !isDev) || isForceSetup;

  if (shouldShowOnboarding) {
    return (
      <OnboardingExperience
        userEmail={user.email ?? ""}
        organizations={organizations}
        defaultFullName={user.user_metadata?.full_name}
        defaultRoleTitle={user.user_metadata?.role_title}
        defaultTheme={user.user_metadata?.preferred_theme}
      />
    );
  }

  // =========================================================================
  // FLUXO DE ACESSO DIRETO (CONTAS EXISTENTES / RECORRENTES)
  // Usuários que já fizeram login vão DIRETO para o workspace sem tela intermediária.
  // =========================================================================
  // 1. Prioridade: Parâmetro explícito na URL (se for uma organização autorizada)
  let selected = organizations.find((organization) => organization.id === params.organizationId);

  // 2. Cookie de última organização utilizada
  const lastOrgIdCookie = cookieStore.get("rsbuild_last_org_id")?.value;
  if (!selected && lastOrgIdCookie) {
    selected = organizations.find((organization) => organization.id === lastOrgIdCookie);
  }

  // 3. Metadata do usuário salvo no Supabase Auth
  const metaLastOrgId = user.user_metadata?.last_organization_id as string | undefined;
  if (!selected && metaLastOrgId) {
    selected = organizations.find((organization) => organization.id === metaLastOrgId);
  }

  // 4. Se pertencer a apenas 1 organização, usa ela diretamente
  if (!selected && organizations.length === 1) {
    selected = organizations[0];
  }

  // 5. Fallback seguro para contas já logadas com múltiplas organizações:
  //    Seleciona a primeira organização vinculada para garantir entrada direta
  if (!selected && organizations.length > 0) {
    selected = organizations[0];
  }

  if (!selected) {
    return (
      <main className="app-shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <section className="panel" style={{ width: "min(100%, 560px)", padding: 32 }}>
          <h1>Nenhum espaço de trabalho ativo encontrado</h1>
          <p>Sua conta possui credenciais ativas mas nenhuma organização pôde ser selecionada.</p>
          <form action={signOut}><button className="secondary-button" type="submit">Sair</button></form>
        </section>
      </main>
    );
  }

  const selectedMembership = memberships.find((membership) => membership.organization_id === selected.id);
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
  return (
    <Suspense fallback={null}>
      <EnterpriseWorkspace
        organizationId={selected.id}
        organizationSlug={organizationSlug}
        organizationName={selected.display_name}
        membershipRole={selectedMembership?.role ?? "viewer"}
        userEmail={user.email ?? ""}
        userFullName={user.user_metadata?.full_name}
        userRoleTitle={user.user_metadata?.role_title}
        preferredTheme={user.user_metadata?.preferred_theme}
      />
    </Suspense>
  );
}
