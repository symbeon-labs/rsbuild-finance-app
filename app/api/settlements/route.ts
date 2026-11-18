import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/api/org-guard";
import { recordAuditEvent } from "@/lib/api/audit";

export const dynamic = "force-dynamic";

const SETTLEMENT_STATUSES = ["confirmada", "exportada", "estornada"];

export async function POST(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  const guard = await requireOrgContext(request, organizationId, ["owner", "admin"], "reconciliation");
  if (!guard.ok) return guard.response;
  const { supabase, userId, userEmail } = guard.ctx;

  let body: { settlements?: Array<{ receivableTitleId?: unknown; documentNumber?: unknown; customerName?: unknown; amount?: unknown; settlementDate?: unknown; sourceRecordId?: unknown; observation?: unknown }> };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const inputs = Array.isArray(body?.settlements) ? body.settlements : null;
  if (!inputs || !inputs.length) {
    return NextResponse.json({ error: "invalid_settlements_payload" }, { status: 400 });
  }

  const rows = inputs.map((s) => {
    const amount = Number(s.amount);
    return {
      organization_id: organizationId,
      receivable_title_id: typeof s.receivableTitleId === "string" ? s.receivableTitleId : null,
      document_number: String(s.documentNumber ?? "").trim().slice(0, 80),
      customer_name: String(s.customerName ?? "").trim().slice(0, 200),
      amount_minor: Number.isFinite(amount) ? Math.round(Math.abs(amount) * 100) : 0,
      settlement_date: typeof s.settlementDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.settlementDate) ? s.settlementDate : null,
      source_record_id: typeof s.sourceRecordId === "string" ? s.sourceRecordId.slice(0, 120) : null,
      observation: typeof s.observation === "string" ? s.observation.slice(0, 2000) : null,
      status: "confirmada",
      created_by: userId
    };
  });

  const invalid = rows.filter((r) => !r.document_number || !r.customer_name || r.amount_minor <= 0 || !r.settlement_date);
  if (invalid.length) {
    return NextResponse.json({ error: "invalid_settlements_payload", detail: `${invalid.length} baixa(s) com campos obrigatórios inválidos.` }, { status: 422 });
  }

  const { error } = await supabase.from("settlements").insert(rows);
  if (error) {
    console.error(JSON.stringify({ event: "rsbuild_settlements_import_failed", organizationId, code: error.code }));
    return NextResponse.json({ error: "settlements_import_failed" }, { status: 502 });
  }

  await recordAuditEvent({
    organizationId, actorId: userId, actorEmail: userEmail,
    eventType: "settlements.created", entityType: "settlement",
    metadata: { insertedCount: rows.length, totalAmountMinor: rows.reduce((sum, r) => sum + r.amount_minor, 0) }
  });

  return NextResponse.json({ insertedCount: rows.length }, {
    status: 201, headers: { "Cache-Control": "private, no-store" }
  });
}
