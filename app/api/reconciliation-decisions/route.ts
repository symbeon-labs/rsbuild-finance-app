import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/api/org-guard";

export const dynamic = "force-dynamic";

const DECISION_TYPES = ["manual_match", "unmatch", "erp_match"];

export async function POST(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  const guard = await requireOrgContext(request, organizationId, ["owner", "admin", "operator"]);
  if (!guard.ok) return guard.response;
  const { supabase, userId } = guard.ctx;

  let body: { decisions?: Array<{ financialRecordId?: unknown; decisionType?: unknown; counterpartLabel?: unknown; justification?: unknown }> };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const inputs = Array.isArray(body?.decisions) ? body.decisions : null;
  if (!inputs || !inputs.length) {
    return NextResponse.json({ error: "invalid_decisions_payload" }, { status: 400 });
  }

  const rows = inputs.map((d) => {
    const decisionType = DECISION_TYPES.includes(String(d.decisionType)) ? String(d.decisionType) : "manual_match";
    return {
      organization_id: organizationId,
      financial_record_id: typeof d.financialRecordId === "string" ? d.financialRecordId : null,
      decision_type: decisionType,
      counterpart_label: typeof d.counterpartLabel === "string" ? d.counterpartLabel.slice(0, 200) : null,
      justification: typeof d.justification === "string" ? d.justification.slice(0, 2000) : null,
      actor_id: userId
    };
  });

  const invalid = rows.filter((r) => !r.decision_type);
  if (invalid.length) {
    return NextResponse.json({ error: "invalid_decisions_payload", detail: `${invalid.length} decisão(ões) sem tipo.` }, { status: 422 });
  }

  const { error } = await supabase.from("reconciliation_decisions").insert(rows);
  if (error) {
    console.error(JSON.stringify({ event: "rsbuild_decisions_import_failed", organizationId, code: error.code }));
    return NextResponse.json({ error: "decisions_import_failed" }, { status: 502 });
  }

  return NextResponse.json({ insertedCount: rows.length }, {
    status: 201, headers: { "Cache-Control": "private, no-store" }
  });
}
