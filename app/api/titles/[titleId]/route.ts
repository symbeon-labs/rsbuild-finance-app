import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/api/org-guard";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: { params: Promise<{ titleId: string }> }) {
  const { titleId } = await context.params;
  if (!UUID.test(titleId)) return NextResponse.json({ error: "invalid_title" }, { status: 400 });

  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  const guard = await requireOrgContext(request, organizationId, ["owner", "admin", "operator"]);
  if (!guard.ok) return guard.response;
  const { supabase } = guard.ctx;

  let body: { status?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  if (!["pendente", "baixado", "cancelado"].includes(String(body?.status))) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("receivable_titles")
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq("id", titleId)
    .eq("organization_id", organizationId)
    .select("id, status")
    .maybeSingle();

  if (error) {
    console.error(JSON.stringify({ event: "rsbuild_title_update_failed", organizationId, code: error.code }));
    return NextResponse.json({ error: "title_update_failed" }, { status: 502 });
  }
  if (!data) return NextResponse.json({ error: "title_not_found" }, { status: 404 });

  return NextResponse.json({ title: data }, { headers: { "Cache-Control": "private, no-store" } });
}
