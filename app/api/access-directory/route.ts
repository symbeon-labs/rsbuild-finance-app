import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Diretório central de acessos e identidades — somente equipe RSBUILD.
 *
 * Agrega por organização: membros (papel + último login), convites e
 * grants de projeto (individuais e por organização cliente).
 * Leitura cross-tenant preferencialmente via service role; caso indisponível,
 * degrada graciosamente usando a sessão autenticada do usuário RSBUILD.
 */
export async function GET(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (!consumeRateLimit(`${user.id}:/api/access-directory`)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const { data: membership, error: membershipError } = await supabase
      .from("organization_memberships")
      .select("role, organizations!inner(slug)")
      .eq("user_id", user.id)
      .eq("organizations.slug", "rsbuild")
      .maybeSingle();
    if (membershipError || !membership || !["owner", "admin", "operator"].includes(membership.role)) {
      return NextResponse.json({ error: "access_directory_forbidden" }, { status: 403 });
    }

    // Tenta cliente service-role (admin) para visão cross-tenant e listUsers;
    // Se não configurado no ambiente, usa o cliente autenticado (RLS do operador RSBUILD).
    const admin = getAdminClient();
    const queryClient = admin || supabase;

    const [orgsRes, membershipsRes, invitesRes, userGrantsRes, orgGrantsRes, projectsRes] = await Promise.all([
      queryClient.from("organizations").select("id, slug, display_name").order("display_name"),
      queryClient.from("organization_memberships").select("organization_id, user_id, role, custom_title, created_at").limit(20000),
      queryClient.from("organization_invitations").select("organization_id, email, role, status, invited_by, invited_user_id, created_at").limit(10000),
      queryClient.from("project_memberships").select("project_id, managing_organization_id, user_id, access_level, created_at").limit(20000),
      queryClient.from("project_organization_access").select("project_id, managing_organization_id, client_organization_id, access_level, created_at").limit(20000),
      queryClient.from("projects").select("id, managing_organization_id, client_organization_id, client_display_name, project_key, name, status").limit(5000)
    ]);

    const firstError = [orgsRes, membershipsRes, invitesRes, userGrantsRes, orgGrantsRes, projectsRes]
      .find((r) => r.error);
    if (firstError?.error) {
      console.error(JSON.stringify({ event: "access_directory_query_failed", code: firstError.error.code, message: firstError.error.message }));
      return NextResponse.json({ error: "access_directory_unavailable", message: firstError.error.message }, { status: 502 });
    }

    // Mapa de usuários Auth (e-mail + último login)
    const usersById = new Map<string, { email: string | null; lastSignInAt: string | null }>();
    if (admin) {
      try {
        for (let page = 1; page <= 10; page++) {
          const { data: list, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 200 });
          if (listError) break;
          for (const u of list?.users ?? []) {
            usersById.set(u.id, { email: u.email ?? null, lastSignInAt: u.last_sign_in_at ?? null });
          }
          if (!list?.users?.length || list.users.length < 200) break;
        }
      } catch (adminAuthErr) {
        console.warn("Could not fetch user emails from admin.auth.admin.listUsers", adminAuthErr);
      }
    }

    // Garante que o usuário corrente esteja catalogado
    if (user.id && !usersById.has(user.id)) {
      usersById.set(user.id, { email: user.email ?? null, lastSignInAt: user.last_sign_in_at ?? null });
    }

    const orgName = new Map((orgsRes.data ?? []).map((o: any) => [o.id, o.display_name]));
    const projectName = new Map((projectsRes.data ?? []).map((p: any) => [p.id, p.name]));

    const groupBy = <T extends Record<string, any>>(rows: T[] | null | undefined, key: string) => {
      const map = new Map<string, T[]>();
      for (const row of rows ?? []) {
        const k = String(row[key]);
        const arr = map.get(k) ?? [];
        arr.push(row);
        map.set(k, arr);
      }
      return map;
    };

    const membersByOrg = groupBy(membershipsRes.data as any[], "organization_id");
    const invitesByOrg = groupBy(invitesRes.data as any[], "organization_id");
    const userGrantsByProject = groupBy(userGrantsRes.data as any[], "project_id");
    const orgGrantsByProject = groupBy(orgGrantsRes.data as any[], "project_id");

    const organizations = (orgsRes.data ?? []).map((org: any) => ({
      id: org.id,
      slug: org.slug,
      displayName: org.display_name,
      members: (membersByOrg.get(org.id) ?? []).map((m: any) => ({
        userId: m.user_id,
        email: usersById.get(m.user_id)?.email ?? null,
        role: m.role,
        customTitle: m.custom_title ?? null,
        lastSignInAt: usersById.get(m.user_id)?.lastSignInAt ?? null,
        memberSince: m.created_at
      })),
      invitations: (invitesByOrg.get(org.id) ?? []).map((i: any) => ({
        email: i.email,
        role: i.role,
        status: i.status,
        invitedUserId: i.invited_user_id,
        invitedAt: i.created_at
      }))
    }));

    const projects = (projectsRes.data ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      projectKey: p.project_key,
      status: p.status,
      managingOrganizationId: p.managing_organization_id,
      clientOrganizationId: p.client_organization_id ?? null,
      clientDisplayName: p.client_display_name,
      memberGrants: (userGrantsByProject.get(p.id) ?? []).map((g: any) => ({
        userId: g.user_id,
        email: usersById.get(g.user_id)?.email ?? null,
        accessLevel: g.access_level,
        grantedAt: g.created_at
      })),
      organizationGrants: (orgGrantsByProject.get(p.id) ?? []).map((g: any) => ({
        organizationId: g.client_organization_id,
        organizationName: orgName.get(g.client_organization_id) ?? null,
        accessLevel: g.access_level,
        grantedAt: g.created_at
      }))
    }));

    return NextResponse.json({ organizations, projects, adminMode: Boolean(admin) }, {
      status: 200, headers: { "Cache-Control": "private, no-store" }
    });
  } catch (err: any) {
    console.error("Critical error in /api/access-directory:", err);
    return NextResponse.json(
      { error: "access_directory_error", message: err?.message || "Erro interno ao processar diretório de acessos." },
      { status: 500 }
    );
  }
}
