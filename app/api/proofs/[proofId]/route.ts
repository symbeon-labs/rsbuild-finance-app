import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/api/org-guard";
import { recordAuditEvent } from "@/lib/api/audit";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DELIVERY_STATUSES = ["pendente_entrega", "comprovado", "recusa_devolucao", "extraviado"];

export async function PATCH(request: Request, context: { params: Promise<{ proofId: string }> }) {
  const { proofId } = await context.params;
  if (!UUID.test(proofId)) return NextResponse.json({ error: "invalid_proof" }, { status: 400 });

  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  const guard = await requireOrgContext(request, organizationId, ["owner", "admin", "operator"]);
  if (!guard.ok) return guard.response;
  const { supabase, userId, userEmail } = guard.ctx;

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.status === "string" && DELIVERY_STATUSES.includes(body.status)) update.status = body.status;
  if (typeof body.deliveryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.deliveryDate)) update.delivery_date = body.deliveryDate;
  if (typeof body.receiverName === "string") update.receiver_name = body.receiverName.slice(0, 160);
  if (typeof body.receiverDocument === "string") update.receiver_document = body.receiverDocument.slice(0, 60);
  if (typeof body.proofFileUrl === "string") update.proof_file_url = body.proofFileUrl.slice(0, 500);
  if (typeof body.driverName === "string") update.driver_name = body.driverName.slice(0, 160);
  if (typeof body.notes === "string") update.notes = body.notes.slice(0, 2000);

  const { data, error } = await supabase
    .from("delivery_proofs")
    .update(update)
    .eq("id", proofId)
    .eq("organization_id", organizationId)
    .select("id, status")
    .maybeSingle();

  if (error) {
    console.error(JSON.stringify({ event: "rsbuild_proof_update_failed", organizationId, code: error.code }));
    return NextResponse.json({ error: "proof_update_failed" }, { status: 502 });
  }
  if (!data) return NextResponse.json({ error: "proof_not_found" }, { status: 404 });

  await recordAuditEvent({
    organizationId, actorId: userId, actorEmail: userEmail,
    eventType: "proof.updated", entityType: "delivery_proof", entityId: proofId,
    metadata: { fields: Object.keys(update).filter((k) => k !== "updated_at") }
  });

  return NextResponse.json({ proof: data }, { headers: { "Cache-Control": "private, no-store" } });
}
