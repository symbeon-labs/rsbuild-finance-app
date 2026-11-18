import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // Portfólio de projetos é informação interna da gestão RSBUILD.
  // Clientes finais não acessam mesmo possuindo grants de leitura em projetos próprios.
  const { data: rsbuildMembership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("role, organizations!inner(slug)")
    .eq("user_id", user.id)
    .eq("organizations.slug", "rsbuild")
    .maybeSingle();
  if (membershipError || !rsbuildMembership) {
    return NextResponse.json({ error: "project_portfolio_forbidden" }, { status: 403 });
  }

  // A visão institucional completa é exclusiva do Platform Admin. Para os
  // demais usuários, o portfólio é limitado aos projetos explicitamente
  // compartilhados com suas organizações clientes ou atribuídos diretamente.
  const { data: platformAdministrator } = await supabase.rpc("is_platform_administrator");
  let visibleProjectIds: Set<string> | null = null;
  if (platformAdministrator !== true) {
    const { data: clientMemberships, error: clientMembershipError } = await supabase
      .from("organization_memberships")
      .select("organization_id, organizations!inner(slug)")
      .eq("user_id", user.id)
      .neq("organizations.slug", "rsbuild");
    if (clientMembershipError) {
      return NextResponse.json({ error: "project_portfolio_unavailable" }, { status: 502 });
    }
    const clientOrganizationIds = (clientMemberships ?? []).map((membership: any) => membership.organization_id);
    const [sharedAccess, directMemberships] = await Promise.all([
      clientOrganizationIds.length
        ? supabase.from("project_organization_access").select("project_id").in("client_organization_id", clientOrganizationIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("project_memberships").select("project_id").eq("user_id", user.id)
    ]);
    if (sharedAccess.error || directMemberships.error) {
      return NextResponse.json({ error: "project_portfolio_unavailable" }, { status: 502 });
    }
    visibleProjectIds = new Set([
      ...(sharedAccess.data ?? []).map((item: any) => item.project_id),
      ...(directMemberships.data ?? []).map((item: any) => item.project_id)
    ]);
  }

  const { data, error } = await supabase
    .from("projects")
    .select(`
      id, project_key, name, client_display_name, description, status,
      start_date, target_date, created_at, updated_at,
      project_dependencies (id, sprint_id, task_id, title, description, dependency_type, status, responsible_label, due_date, evidence_url),
      project_sprints (
        id, sprint_number, title, objective, completion_criteria, status, start_date, end_date, sort_order,
        project_tasks (id, title, description, acceptance_criteria, status, priority, due_date, responsible_label, sort_order),
        project_deliverables (id, title, description, acceptance_criteria, version_label, status, resource_url, created_at)
      )
    `)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error(JSON.stringify({ event: "rsbuild_project_portfolio_read_failed", code: error.code }));
    return NextResponse.json({ error: "project_portfolio_unavailable" }, { status: 502 });
  }

  const visibleRows = visibleProjectIds === null
    ? (data ?? [])
    : (data ?? []).filter((project: any) => visibleProjectIds?.has(project.id));
  const projects = visibleRows.map((project: any) => ({
    ...project,
    project_sprints: [...(project.project_sprints ?? [])]
      .sort((a: any, b: any) => a.sort_order - b.sort_order || a.sprint_number - b.sprint_number)
      .map((sprint: any) => ({
        ...sprint,
        project_tasks: [...(sprint.project_tasks ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order),
        project_deliverables: sprint.project_deliverables ?? []
      }))
  }));

  return NextResponse.json({ projects }, {
    status: 200,
    headers: { "Cache-Control": "private, no-store" }
  });
}
