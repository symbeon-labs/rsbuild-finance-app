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

  const { data, error } = await supabase
    .from("projects")
    .select(`
      id, project_key, name, client_display_name, description, status,
      start_date, target_date, created_at, updated_at,
      project_sprints (
        id, sprint_number, title, objective, status, start_date, end_date, sort_order,
        project_tasks (id, title, status, priority, due_date, sort_order),
        project_deliverables (id, title, status, resource_url, created_at)
      )
    `)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error(JSON.stringify({ event: "rsbuild_project_portfolio_read_failed", code: error.code }));
    return NextResponse.json({ error: "project_portfolio_unavailable" }, { status: 502 });
  }

  const projects = (data ?? []).map((project: any) => ({
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
