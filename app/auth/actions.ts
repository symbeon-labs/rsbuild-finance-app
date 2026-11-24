"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
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



/**
 * Resolve a URL pública da aplicação sem fixar localhost em links enviados
 * por e-mail. NEXT_PUBLIC_SITE_URL deve apontar para o domínio canônico.
 */
async function getPublicAppUrl() {
  // Em Preview, o verifier PKCE fica no cookie do próprio deployment.
  // Portanto, o link enviado por e-mail precisa voltar para esse mesmo host,
  // nunca para o domínio de produção.
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    const previewUrl = process.env.VERCEL_URL.startsWith("http")
      ? process.env.VERCEL_URL
      : `https://${process.env.VERCEL_URL}`;
    return new URL(previewUrl).origin;
  }

  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return new URL(configured).origin;

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelUrl) {
    const normalized = vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`;
    return new URL(normalized).origin;
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  if (!host) throw new Error("Não foi possível determinar a URL pública da aplicação.");
  return new URL(`${protocol}://${host}`).origin;
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || email.length > 254) redirect("/forgot-password?error=invalid");

  const supabase = await createClient();
  const appUrl = await getPublicAppUrl();
  const redirectTo = new URL("/auth/callback?next=/reset-password", appUrl).toString();

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) redirect("/forgot-password?error=request");
  // Resposta neutra para não revelar se o e-mail está cadastrado.
  redirect("/forgot-password?sent=1");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 8 || password.length > 256) redirect("/reset-password?error=password");
  if (password !== confirmation) redirect("/reset-password?error=mismatch");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/forgot-password?error=session");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/reset-password?error=update");

  // Revoga as demais sessões após a troca de credencial.
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?password_updated=1");
}


/** Atualiza a senha a partir da sessão autenticada, após validar a senha atual. */
export async function changePassword(formData: FormData) {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (!currentPassword || currentPassword.length > 256) redirect("/account/security?error=current");
  if (password.length < 8 || password.length > 256) redirect("/account/security?error=password");
  if (password !== confirmation) redirect("/account/security?error=mismatch");
  if (currentPassword === password) redirect("/account/security?error=same");

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.email) redirect("/login");

  // Supabase Auth valida a senha atual na mesma sessão autenticada.
  // Evita criar uma sessão paralela e sobrescrever os cookies do usuário.
  const { error: updateError } = await supabase.auth.updateUser({
    password,
    current_password: currentPassword
  });
  if (updateError) {
    if (updateError.code === "current_password_mismatch" ||
        updateError.code === "current_password_required" ||
        updateError.code === "invalid_credentials") {
      redirect("/account/security?error=current");
    }
    redirect("/account/security?error=update");
  }

  await recordSessionEvent({
    userId: user.id,
    userEmail: user.email,
    eventType: "account.password_changed",
    metadata: { method: "authenticated_settings" }
  });

  // A troca da senha já foi concluída. Só informar revogação se o Auth confirmar.
  // Em falha, preservamos a sessão atual e mostramos o estado parcial com transparência.
  try {
    const { error: revokeError } = await supabase.auth.signOut({ scope: "others" });
    if (revokeError) {
      console.error(JSON.stringify({
        event: "account_other_sessions_revocation_failed",
        userId: user.id,
        code: revokeError.code
      }));
      redirect("/account/security?changed=1&sessions=warning");
    }
  } catch (error) {
    console.error(JSON.stringify({
      event: "account_other_sessions_revocation_exception",
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown"
    }));
    redirect("/account/security?changed=1&sessions=warning");
  }
  redirect("/account/security?changed=1&sessions=revoked");
}
