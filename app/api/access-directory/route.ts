import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Diretório central de acessos e identidades — somente equipe RSBUILD.
 *
 * Esta rota agrega dados cross-tenant. A sessão do usuário é usada apenas
 * para autenticação; toda leitura de organizações e permissões é feita pelo
 * cliente administrativo no servidor. Nunca fazer fallback para o cliente
 * autenticado, pois isso mistura escopos RLS e pode expor dados parcialmente.
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

    // Cross-tenant access is fail-closed: no authenticated-client fallback.
    const admin = getAdminClient();
    if (!admin) {
      console.error(JSON.stringify({
        event: "access_directory_admin_client_unavailable",
        hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        hasSecretKey: Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
      }));
      return NextResponse.json({ error: "access_directory_admin_unavailable" }, { status: 503 });
    }

    // Resolve the trusted RSBUILD tenant and authorize the caller server-side.
    const { data: rsbuildOrg, error: orgLookupError } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", "rsbuild")
      .maybeSingle();

    if (orgLookupError || !rsbuildOrg) {
      console.error(JSON.stringify({
        event: "access_directory_tenant_lookup_failed",
        code: orgLookupError?.code ?? null,
        message: orgLookupError?.message ?? "rsbuild organization not found"
      }));
      return NextResponse.json({ error: "access_directory_unavailable" }, { status: 502 });
    }

    const { data: membership, error: membershipError } = await admin
      .from("organization_memberships")
      .select("role")
      .eq("organization_id", rsbuildOrg.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      console.error(JSON.stringify({
        event: "access_directory_membership_lookup_failed",
        code: membershipError.code,
        message: membershipError.message
      }));
      return NextResponse.json({ error: "access_directory_unavailable" }, { status: 502 });
    }
    if (!membership || !["owner", "admin", "operator"].includes(membership.role)) {
      return NextResponse.json({ error: "access_directory_forbidden" }, { status: 403 });
    }

    const [orgsRes, membershipsRes, invitesRes, userGrantsRes, orgGrantsRes, projectsRes] = await Promise.all([
      admin.from("organizations").select("id, slug, display_name").order("display_name"),
      admin.from("organization_memberships").select("organization_id, user_id, role, custom_title, created_at").limit(20000),
      admin.from("organization_invitations").select("organization_id, email, role, status, invited_by, invited_user_id, created_at").limit(10000),
      admin.from("project_memberships").select("project_id, managing_organization_id, user_id, access_level, created_at").limit(20000),
      admin.from("project_organization_access").select("project_id, managing_organization_id, client_organization_id, access_level, created_at").limit(20000),
      admin.from("projects").select("id, managing_organization_id, client_organization_id, client_display_name, project_key, name, status").limit(5000)
    ]);

    const firstError = [orgsRes, membershipsRes, invitesRes, userGrantsRes, orgGrantsRes, projectsRes]
      .find((result) => result.error);
    if (firstError?.error) {
      console.error(JSON.stringify({
        event: "access_directory_query_failed",
        code: firstError.error.code,
        message: firstError.error.message
      }));
      return NextResponse.json({ error: "access_directory_unavailable" }, { status: 502 });
    }

    // Auth user metadata is retrieved only after RSBUILD membership is verified.
    const usersById = new Map<string, { email: string | null; lastSignInAt: string | null }>();
    try {
      for (let page = 1; page <= 10; page++) {
        const { data: list, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (listError) {
          console.warn(JSON.stringify({ event: "access_directory_auth_users_unavailable", message: listError.message }));
          break;
        }
        for (const authUser of list?.users ?? []) {
          usersById.set(authUser.id, {
            email: authUser.email ?? null,
            lastSignInAt: authUser.last_sign_in_at ?? null
          });
        }
        if (!list?.users?.length || list.users.length < 200) break;
      }
    } catch (error) {
      console.warn("Could not fetch user emails from admin.auth.admin.listUsers", error);
    }

    if (!usersById.has(user.id)) {
      usersById.set(user.id, { email: user.email ?? null, lastSignInAt: user.last_sign_in_at ?? null });
    }

    const orgName = new Map((orgsRes.data ?? []).map((org: any) => [org.id, org.display_name]));

    const groupBy = <T extends Record<string, any>>(rows: T[] | null | undefined, key: string) => {
      const map = new Map<string, T[]>();
      for (const row of rows ?? []) {
        const groupKey = String(row[key]);
        const group = map.get(groupKey) ?? [];
        group.push(row);
        map.set(groupKey, group);
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
      members: (membersByOrg.get(org.id) ?? []).map((member: any) => ({
        userId: member.user_id,
        email: usersById.get(member.user_id)?.email ?? null,
        role: member.role,
        customTitle: member.custom_title ?? null,
        lastSignInAt: usersById.get(member.user_id)?.lastSignInAt ?? null,
        memberSince: member.created_at
      })),
      invitations: (invitesByOrg.get(org.id) ?? []).map((invite: any) => ({
        email: invite.email,
        role: invite.role,
        status: invite.status,
        invitedUserId: invite.invited_user_id,
        invitedAt: invite.created_at
      }))
    }));

    const projects = (projectsRes.data ?? []).map((project: any) => ({
      id: project.id,
      name: project.name,
      projectKey: project.project_key,
      status: project.status,
      managingOrganizationId: project.managing_organization_id,
      clientOrganizationId: project.client_organization_id ?? null,
      clientDisplayName: project.client_display_name,
      memberGrants: (userGrantsByProject.get(project.id) ?? []).map((grant: any) => ({
        userId: grant.user_id,
        email: usersById.get(grant.user_id)?.email ?? null,
        accessLevel: grant.access_level,
        grantedAt: grant.created_at
      })),
      organizationGrants: (orgGrantsByProject.get(project.id) ?? []).map((grant: any) => ({
        organizationId: grant.client_organization_id,
        organizationName: orgName.get(grant.client_organization_id) ?? null,
        accessLevel: grant.access_level,
        grantedAt: grant.created_at
      }))
    }));

    return NextResponse.json({ organizations, projects, adminMode: true }, {
      status: 200,
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error: any) {
    console.error("Critical error in /api/access-directory:", error);
    return NextResponse.json(
      { error: "access_directory_error", message: error?.message || "Erro interno ao processar diretório de acessos." },
      { status: 500 }
    );
  }
}
