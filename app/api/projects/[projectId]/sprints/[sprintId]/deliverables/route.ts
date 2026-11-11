import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string; sprintId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }

  const { projectId, sprintId } = await context.params;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(projectId) || !uuid.test(sprintId)) {
    return NextResponse.json({ error: "invalid_project_or_sprint" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const acceptanceCriteria = typeof body.acceptanceCriteria === "string" ? body.acceptanceCriteria.trim() : "";
  const versionLabel = typeof body.versionLabel === "string" ? body.versionLabel.trim() : "";
  const resourceUrl = typeof body.resourceUrl === "string" && body.resourceUrl.trim() ? body.resourceUrl.trim() : null;

  if (!title || title.length > 180 || description.length > 3000 || acceptanceCriteria.length > 3000 || versionLabel.length > 80) {
    return NextResponse.json({ error: "invalid_deliverable_payload" }, { status: 400 });
  }
  if (resourceUrl) {
    try {
      const parsed = new URL(resourceUrl);
      if (parsed.protocol !== "https:") throw new Error("unsupported_protocol");
    } catch {
      return NextResponse.json({ error: "invalid_deliverable_url" }, { status: 400 });
    }
  }

  const { data, error } = await supabase.from("project_deliverables").insert({
    project_id: projectId,
    sprint_id: sprintId,
    title,
    description,
    acceptance_criteria: acceptanceCriteria,
    version_label: versionLabel,
    resource_url: resourceUrl,
    submitted_by: user.id
  }).select("id, title, description, acceptance_criteria, version_label, status, resource_url, created_at").single();

  if (error) {
    return NextResponse.json({ error: error.code === "42501" ? "project_access_denied" : "deliverable_create_failed" }, {
      status: error.code === "42501" ? 403 : 422
    });
  }

  return NextResponse.json({ deliverable: data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
