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

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const responsibleLabel = typeof body.responsibleLabel === "string" ? body.responsibleLabel.trim() : "";
  const dependencyType = ["client_input","access","decision","external_service","technical","other"].includes(String(body.dependencyType))
    ? String(body.dependencyType) : "other";
  const dueDate = typeof body.dueDate === "string" && body.dueDate ? body.dueDate : null;

  if (!title || title.length > 180 || description.length > 3000 || responsibleLabel.length > 160 ||
      (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))) {
    return NextResponse.json({ error: "invalid_dependency_payload" }, { status: 400 });
  }

  const { data, error } = await supabase.from("project_dependencies").insert({
    project_id: projectId,
    title,
    description,
    dependency_type: dependencyType,
    responsible_label: responsibleLabel,
    due_date: dueDate,
    created_by: user.id
  }).select("id, title, description, dependency_type, status, responsible_label, due_date, evidence_url").single();

  if (error) {
    return NextResponse.json({ error: error.code === "42501" ? "project_access_denied" : "dependency_create_failed" }, {
      status: error.code === "42501" ? 403 : 422
    });
  }

  return NextResponse.json({ dependency: data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
