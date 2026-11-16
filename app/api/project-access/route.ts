import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordAuditEvent } from "@/lib/api/audit";
import { consumeRateLimit } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACCESS_LEVELS = ["viewer", "contributor"];

/**
 * Gestão de acesso por projeto (project_memberships e project_organization_access).
 * Escrita restrita a owner/admin da organização gestora (RSBUILD) — o RLS
 * das tabelas é a fronteira final; aqui validamos contexto e papel antes.
 */
async function guard(request: Request, write = false) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return { ok: false as const, response: NextResponse.json({ error: "origin_forbidden" }, { status: 403 }) };
  }
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false as const, response: NextResponse.json({ error: "unauthenticated" }, { status: 401 }) };
  }
  if (!consumeRateLimit(`${user.id}:/api/project-access`)) {
    return { ok: false as const, response: NextResponse.json({ error: "rate_limited" }, { status: 429 }) };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role, organizations!inner(slug)")
    .eq("user_id", user.id)
    .eq("organizations.slug", "rsbuild")
    .maybeSingle();
  if (membershipError || !membership) {
    return { ok: false as const, response: NextResponse.json({ error: "project_access_forbidden" }, { status: 403 }) };
  }
  if (write && !["owner", "admin"].includes(membership.role)) {
    await recordAuditEvent({
      organizationId: membership.organization_id,
      actorId: user.id,
      actorEmail: user.email ?? null,
      eventType: "access.denied",
      entityType: "project_access",
      metadata: { reason: "insufficient_role", requiredRoles: ["owner", "admin"], actualRole: membership.role, path: "/api/project-access", method: request.method }
    });
    return { ok: false as const, response: NextResponse.json({ error: "insufficient_role" }, { status: 403 }) };
  }
  return { ok: true as const, supabase, user, role: membership.role as string };
}

async function loadProject(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string) {
  const { data, error } = await supabase
    .from("projects")
    .select("id, managing_organization_id, client_organization_id, name")
    .eq("id", projectId)
    .maybeSingle();
  if (error) return { error };
  return { project: data };
}

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId") ?? "";
  if (!UUID.test(projectId)) return NextResponse.json({ error: "invalid_project" }, { status: 400 });

  const g = await guard(request);
  if (!g.ok) return g.response;

  const { project, error } = await loadProject(g.supabase, projectId);
  if (error) return NextResponse.json({ error: "project_lookup_failed" }, { status: 502 });
  if (!project) return NextResponse.json({ error: "project_not_found" }, { status: 404 });

  const [members, orgGrants] = await Promise.all([
    g.supabase.from("project_memberships")
      .select("user_id, access_level, created_at")
      .eq("project_id", projectId),
    g.supabase.from("project_organization_access")
      .select("client_organization_id, access_level, created_at")
      .eq("project_id", projectId)
  ]);
  if (members.error || orgGrants.error) {
    return NextResponse.json({ error: "project_access_unavailable" }, { status: 502 });
  }

  return NextResponse.json({
    members: members.data ?? [],
    organizationGrants: orgGrants.data ?? []
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const g = await guard(request, true);
  if (!g.ok) return g.response;

  let body: { projectId?: string; targetType?: string; targetId?: string; accessLevel?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const projectId = String(body.projectId ?? "");
  const targetType = String(body.targetType ?? "");
  const targetId = String(body.targetId ?? "");
  const accessLevel = String(body.accessLevel ?? "viewer");

  if (!UUID.test(projectId) || !UUID.test(targetId) || !["user", "organization"].includes(targetType) || !ACCESS_LEVELS.includes(accessLevel)) {
    return NextResponse.json({ error: "invalid_project_access_payload" }, { status: 400 });
  }

  const { project, error } = await loadProject(g.supabase, projectId);
  if (error) return NextResponse.json({ error: "project_lookup_failed" }, { status: 502 });
  if (!project) return NextResponse.json({ error: "project_not_found" }, { status: 404 });

  // FK composta exige que o grant organizacional seja exatamente a
  // organização cliente do projeto — grants para outras orgs não existem.
  if (targetType === "organization" && targetId !== project.client_organization_id) {
    return NextResponse.json({ error: "invalid_organization_grant" }, { status: 400 });
  }

  // Não há policy de UPDATE nas tabelas de grant: re-concessão = delete + insert
  // (RLS garante que apenas owner/admin da organização gestora executa ambos).
  const removeExisting = targetType === "user"
    ? g.supabase.from("project_memberships").delete()
        .eq("project_id", projectId).eq("user_id", targetId)
    : g.supabase.from("project_organization_access").delete()
        .eq("project_id", projectId).eq("client_organization_id", targetId);
  const { error: deleteError } = await removeExisting;
  if (deleteError) {
    console.error(JSON.stringify({ event: "project_access_reset_failed", projectId, code: deleteError.code }));
    return NextResponse.json({ error: "project_access_grant_failed" }, { status: 502 });
  }

  const insertQuery = targetType === "user"
    ? g.supabase.from("project_memberships").insert({
        project_id: projectId,
        managing_organization_id: project.managing_organization_id,
        user_id: targetId,
        access_level: accessLevel,
        created_by: g.user.id
      })
    : g.supabase.from("project_organization_access").insert({
        project_id: projectId,
        managing_organization_id: project.managing_organization_id,
        client_organization_id: targetId,
        access_level: accessLevel,
        created_by: g.user.id
      });
  const { error: insertError } = await insertQuery;
  if (insertError) {
    console.error(JSON.stringify({ event: "project_access_grant_failed", projectId, code: insertError.code }));
    return NextResponse.json({ error: "project_access_grant_failed" }, { status: 502 });
  }

  await recordAuditEvent({
    organizationId: project.managing_organization_id,
    actorId: g.user.id,
    actorEmail: g.user.email ?? null,
    eventType: "project.access_granted",
    entityType: "project",
    entityId: projectId,
    metadata: { targetType, targetId, accessLevel, projectName: project.name }
  });

  return NextResponse.json({ ok: true }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request) {
  const g = await guard(request, true);
  if (!g.ok) return g.response;

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") ?? "";
  const targetType = url.searchParams.get("targetType") ?? "";
  const targetId = url.searchParams.get("targetId") ?? "";

  if (!UUID.test(projectId) || !UUID.test(targetId) || !["user", "organization"].includes(targetType)) {
    return NextResponse.json({ error: "invalid_project_access_payload" }, { status: 400 });
  }

  const { project, error } = await loadProject(g.supabase, projectId);
  if (error) return NextResponse.json({ error: "project_lookup_failed" }, { status: 502 });
  if (!project) return NextResponse.json({ error: "project_not_found" }, { status: 404 });

  if (targetType === "organization" && targetId !== project.client_organization_id) {
    return NextResponse.json({ error: "invalid_organization_grant" }, { status: 400 });
  }

  const deleteQuery = targetType === "user"
    ? g.supabase.from("project_memberships").delete().eq("project_id", projectId).eq("user_id", targetId)
    : g.supabase.from("project_organization_access").delete().eq("project_id", projectId).eq("client_organization_id", targetId);

  const { error: deleteError } = await deleteQuery;
  if (deleteError) {
    console.error(JSON.stringify({ event: "project_access_revoke_failed", projectId, code: deleteError.code }));
    return NextResponse.json({ error: "project_access_revoke_failed" }, { status: 502 });
  }

  await recordAuditEvent({
    organizationId: project.managing_organization_id,
    actorId: g.user.id,
    actorEmail: g.user.email ?? null,
    eventType: "project.access_revoked",
    entityType: "project",
    entityId: projectId,
    metadata: { targetType, targetId, projectName: project.name }
  });

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
