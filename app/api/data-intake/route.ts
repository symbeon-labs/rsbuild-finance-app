import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/api/org-guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  const guard = await requireOrgContext(request, organizationId, ["owner", "admin", "operator", "viewer"], "finance");
  if (!guard.ok) return guard.response;

  const { data, error } = await guard.ctx.supabase
    .from("organization_documents")
    .select("id, origin_module, document_type, status, original_filename, media_type, file_size_bytes, file_sha256, description, uploaded_by, uploaded_at")
    .eq("organization_id", organizationId)
    .order("uploaded_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error(JSON.stringify({ event: "data_intake_list_failed", organizationId, code: error.code }));
    return NextResponse.json({ error: "documents_unavailable" }, { status: 502 });
  }
  return NextResponse.json({ documents: data ?? [] }, {
    status: 200,
    headers: { "Cache-Control": "private, no-store" }
  });
}
