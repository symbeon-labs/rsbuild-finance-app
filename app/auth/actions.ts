"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { recordSessionEvent } from "@/lib/api/audit";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  if (!email || !password || password.length > 256) redirect("/login?error=invalid");

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=credentials");
  if (user) {
    await recordSessionEvent({
      userId: user.id,
      userEmail: user.email ?? email,
      eventType: "session.login",
      metadata: { method: "password" }
    });
  }

  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  redirect(destination);
}

export async function signOut() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    // Auditoria de logout é best-effort com teto de espera: nunca pode
    // bloquear a saída do usuário se o backend de auditoria estiver lento.
    await Promise.race([
      recordSessionEvent({
        userId: user.id,
        userEmail: user.email ?? null,
        eventType: "session.logout",
        metadata: { method: "explicit" }
      }),
      new Promise((resolve) => setTimeout(resolve, 3000))
    ]);
  }
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Conclui o processo de onboarding do usuário no primeiro acesso,
 * salvando dados de personalização da experiência e organização padrão.
 */
export async function completeOnboarding(formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const roleTitle = String(formData.get("roleTitle") ?? "").trim();
  const preferredModule = String(formData.get("preferredModule") ?? "finance").trim();
  const preferredTheme = String(formData.get("preferredTheme") ?? "sand").trim();
  const organizationId = String(formData.get("organizationId") ?? "").trim();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Atualiza metadados do usuário no Supabase Auth
  await supabase.auth.updateUser({
    data: {
      full_name: fullName,
      role_title: roleTitle,
      preferred_module: preferredModule,
      preferred_theme: preferredTheme,
      last_organization_id: organizationId,
      onboarding_completed: true,
      onboarded_at: new Date().toISOString()
    }
  });

  // Salva a organização selecionada em cookie para acesso direto em futuros logins
  if (organizationId) {
    const cookieStore = await cookies();
    cookieStore.set("rsbuild_last_org_id", organizationId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax"
    });
  }

  // Mapeia módulo preferido para aba inicial do workspace
  const tabMap: Record<string, string> = {
    finance: "visao-geral",
    reconciliation: "baixas",
    logistics: "pedidos-ha",
    audit: "torre-controle"
  };
  const targetTab = tabMap[preferredModule] || "visao-geral";

  redirect(`/?organizationId=${encodeURIComponent(organizationId)}&tab=${targetTab}`);
}

/**
 * Pula o onboarding opcional e entra direto na organização com padrões
 */
export async function skipOnboarding(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "").trim();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.auth.updateUser({
    data: {
      onboarding_completed: true,
      last_organization_id: organizationId
    }
  });

  if (organizationId) {
    const cookieStore = await cookies();
    cookieStore.set("rsbuild_last_org_id", organizationId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax"
    });
  }

  redirect(`/?organizationId=${encodeURIComponent(organizationId)}`);
}

/**
 * Atualiza a organização ativa do usuário em cookie e metadados
 */
export async function switchOrganization(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "").trim();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (organizationId) {
    await supabase.auth.updateUser({
      data: {
        last_organization_id: organizationId
      }
    });

    const cookieStore = await cookies();
    cookieStore.set("rsbuild_last_org_id", organizationId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax"
    });
  }

  redirect(`/?organizationId=${encodeURIComponent(organizationId)}`);
}

