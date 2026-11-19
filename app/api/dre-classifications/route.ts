import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/api/org-guard";
import { recordAuditEvent } from "@/lib/api/audit";
import { runDreEngine, type DreOverride } from "@/lib/dre-engine";
import type { FinancialRecord } from "@/lib/finance";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RULE_VERSION = "dre-rules-v1";

function responseError(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  const guard = await requireOrgContext(request, organizationId, ["owner","admin","operator","viewer"], "finance");
  if (!guard.ok) return guard.response;
  const { data, error } = await guard.ctx.supabase
    .from("dre_classifications")
    .select("id,financial_record_id,account_code,treatment,confidence,status,reason,source,rule_version,allocations,reviewed_by,reviewed_at,updated_at")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(1000);
  if (error) return responseError("dre_classifications_unavailable", 502);
  return NextResponse.json({ classifications: data ?? [] }, {
    headers: { "Cache-Control": "private, no-store" }
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return responseError("origin_forbidden", 403);

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return responseError("invalid_json"); }

  const organizationId = typeof body.organizationId === "string" ? body.organizationId : "";
  const recordId = typeof body.recordId === "string" ? body.recordId : "";
  const accountCode = typeof body.accountCode === "string" ? body.accountCode : "";
  const unit = typeof body.unit === "string" ? body.unit : undefined;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 2000) : "";
  if (!UUID.test(organizationId) || !UUID.test(recordId) || !accountCode || !reason) {
    return responseError("invalid_classification_payload");
  }

  const guard = await requireOrgContext(request, organizationId, ["owner","admin","operator"], "finance");
  if (!guard.ok) return guard.response;
  const { supabase, userId, userEmail } = guard.ctx;

  const { data: source, error: sourceError } = await supabase
    .from("financial_records")
    .select("id,transaction_date,description,amount_minor,direction,category,status,import_batch_id,source_record_id")
    .eq("organization_id", organizationId)
    .eq("id", recordId)
    .maybeSingle();
  if (sourceError || !source) return responseError("financial_record_not_found", sourceError ? 502 : 404);

  const financialRecord: FinancialRecord = {
    id: source.id,
    date: source.transaction_date,
    description: source.description,
    amount: Number(source.amount_minor) / 100,
    direction: source.direction,
    category: source.category,
    source: "Supabase",
    status: source.status === "conciliado" ? "conciliado" : "pendente",
    importBatchId: source.import_batch_id ?? undefined,
    sourceRecordId: source.source_record_id ?? undefined
  };
  const override: DreOverride = {
    accountCode,
    ...(unit ? { unit: unit as DreOverride["unit"] } : {}),
    reason
  };

  let result;
  try { result = runDreEngine([financialRecord], { [recordId]: override }); }
  catch { return responseError("invalid_account_or_unit_allocation", 422); }
  const classification = result.classifications[0];
  const { data: classificationId, error: saveError } = await supabase.rpc("save_dre_classification", {
    p_organization_id: organizationId,
    p_financial_record_id: recordId,
    p_account_code: classification.account!.code,
    p_treatment: classification.account!.treatment,
    p_confidence: 1,
    p_status: "overridden",
    p_reason: reason,
    p_source: "manual",
    p_rule_version: RULE_VERSION,
    p_allocations: classification.allocations
  });
  if (saveError || !classificationId) {
    console.error(JSON.stringify({ event: "dre_classification_save_failed", organizationId, code: saveError?.code }));
    return responseError("dre_classification_save_failed", 502);
  }

  await recordAuditEvent({
    organizationId, actorId: userId, actorEmail: userEmail,
    eventType: "finance.dre_classification.overridden",
    entityType: "dre_classification", entityId: classificationId,
    metadata: { financialRecordId: recordId, accountCode, unit: unit ?? null, ruleVersion: RULE_VERSION }
  });
  return NextResponse.json({
    classification: {
      id: classificationId, financialRecordId: recordId,
      accountCode: classification.account!.code, treatment: classification.account!.treatment,
      confidence: 1, status: "overridden", reason,
      allocations: classification.allocations, reviewedBy: userId
    }
  }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
