import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }

  const { projectId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
    return NextResponse.json({ error: "invalid_project" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const objective = typeof body.objective === "string" ? body.objective.trim() : "";
  const completionCriteria = typeof body.completionCriteria === "string" ? body.completionCriteria.trim() : "";
  const sprintNumber = Number(body.sprintNumber);
  const startDate = typeof body.startDate === "string" && body.startDate ? body.startDate : null;
  const endDate = typeof body.endDate === "string" && body.endDate ? body.endDate : null;

  if (!title || title.length > 140 || objective.length > 3000 || completionCriteria.length > 3000 ||
      !Number.isSafeInteger(sprintNumber) || sprintNumber < 1 ||
      (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) ||
      (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) ||
      (startDate && endDate && endDate < startDate)) {
    return NextResponse.json({ error: "invalid_sprint_payload" }, { status: 400 });
  }

  const { data, error } = await supabase.from("project_sprints").insert({
    project_id: projectId,
    sprint_number: sprintNumber,
    title,
    objective,
    completion_criteria: completionCriteria,
    start_date: startDate,
    end_date: endDate,
    created_by: user.id
  }).select("id, sprint_number, title, objective, completion_criteria, status, start_date, end_date").single();

  if (error) {
    const status = error.code === "23505" ? 409 : error.code === "42501" ? 403 : 422;
    return NextResponse.json({ error: error.code === "23505" ? "sprint_number_conflict" : "sprint_create_failed" }, { status });
  }

  return NextResponse.json({ sprint: data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request, context: RouteContext) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }
  const { projectId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
    return NextResponse.json({ error: "invalid_project" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const sprintId = typeof body.sprintId === "string" ? body.sprintId : "";
  const status = typeof body.status === "string" ? body.status : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sprintId) ||
      !["planned","active","blocked","completed","cancelled"].includes(status)) {
    return NextResponse.json({ error: "invalid_sprint_status" }, { status: 400 });
  }

  const { data, error } = await supabase.from("project_sprints")
    .update({ status })
    .eq("id", sprintId)
    .eq("project_id", projectId)
    .select("id, status")
    .single();
  if (error) return NextResponse.json({ error: error.code === "42501" ? "project_access_denied" : "sprint_update_failed" }, { status: error.code === "42501" ? 403 : 404 });
  return NextResponse.json({ sprint: data }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
}
