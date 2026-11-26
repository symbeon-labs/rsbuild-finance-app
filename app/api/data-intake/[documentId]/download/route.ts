import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgContext } from "@/lib/api/org-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  if (!UUID.test(documentId)) return NextResponse.json({ error: "invalid_document" }, { status: 400 });

  const guard = await requireOrgContext(request, organizationId, ["owner", "admin", "operator", "viewer"], "finance");
  if (!guard.ok) return guard.response;

  const { data: document, error } = await guard.ctx.supabase
    .from("organization_documents")
    .select("id, storage_bucket, storage_path")
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !document) return NextResponse.json({ error: "document_not_found" }, { status: 404 });

  const admin = createAdminClient();
  const { data, error: signedUrlError } = await admin.storage
    .from(document.storage_bucket)
    .createSignedUrl(document.storage_path, 60, { download: true });

  if (signedUrlError || !data?.signedUrl) {
    console.error(JSON.stringify({ event: "data_intake_signed_url_failed", organizationId, documentId }));
    return NextResponse.json({ error: "document_download_unavailable" }, { status: 502 });
  }

  const { error: eventError } = await admin.from("organization_document_events").insert({
    document_id: documentId,
    organization_id: organizationId,
    actor_id: guard.ctx.userId,
    event_type: "downloaded",
    metadata: { delivery: "signed_url_issued" }
  });
  if (eventError) {
    console.error(JSON.stringify({
      event: "data_intake_download_audit_failed",
      organizationId,
      documentId,
      actorId: guard.ctx.userId,
      code: eventError.code
    }));
    // Fail closed: do not disclose a signed URL when the required audit event
    // cannot be persisted. The unreturned URL expires after 60 seconds.
    return NextResponse.json({ error: "document_download_audit_failed" }, { status: 502 });
  }

  return NextResponse.redirect(data.signedUrl, {
    status: 302,
    headers: { "Cache-Control": "private, no-store" }
  });
}
