import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/api/org-guard";
import { recordAuditEvent } from "@/lib/api/audit";

export const dynamic = "force-dynamic";

const MAX_SETTLEMENTS = 500;

type SettlementInput = {
  receivableTitleId?: unknown;
  amountMinor?: unknown;
  settlementDate?: unknown;
  sourceRecordId?: unknown;
  observation?: unknown;
};

export async function POST(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  const guard = await requireOrgContext(request, organizationId, ["owner", "admin"], "reconciliation");
  if (!guard.ok) return guard.response;
  const { supabase, userId, userEmail } = guard.ctx;

  let body: { settlements?: SettlementInput[] };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const inputs = Array.isArray(body?.settlements) ? body.settlements : null;
  if (!inputs || !inputs.length || inputs.length > MAX_SETTLEMENTS) {
    return NextResponse.json({ error: "invalid_settlements_payload" }, { status: 400 });
  }

  const seenTitleIds = new Set<string>();
  const settlements = inputs.map((item) => {
    const titleId = typeof item.receivableTitleId === "string" ? item.receivableTitleId : "";
    const amountMinor = Number(item.amountMinor);
    const settlementDate = typeof item.settlementDate === "string" ? item.settlementDate : "";
    const sourceRecordId = typeof item.sourceRecordId === "string" ? item.sourceRecordId.trim() : "";
    const observation = typeof item.observation === "string" ? item.observation : "";
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(settlementDate)
      && !Number.isNaN(Date.parse(`${settlementDate}T00:00:00Z`));
    const duplicateTitle = titleId ? seenTitleIds.has(titleId) : false;
    if (titleId) seenTitleIds.add(titleId);
    return {
      receivableTitleId: titleId,
      amountMinor: Number.isSafeInteger(amountMinor) ? amountMinor : 0,
      settlementDate,
      sourceRecordId,
      observation,
      valid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(titleId)
        && Number.isSafeInteger(amountMinor) && amountMinor > 0
        && validDate && !duplicateTitle
        && sourceRecordId.length <= 120 && observation.length <= 2000
    };
  });

  if (settlements.some((item) => !item.valid)) {
    return NextResponse.json({ error: "invalid_settlements_payload" }, { status: 422 });
  }

  const rpc = (supabase as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string } | null }>
  }).rpc;
  const { data, error } = await rpc("confirm_receivable_settlements", {
    p_organization_id: organizationId,
    p_settlements: settlements.map(({ valid: _valid, ...item }) => item)
  });

  if (error) {
    const status = error.code === "42501" ? 403
      : error.code === "P0002" ? 404
      : error.code === "23505" ? 409
      : error.code === "55000" ? 409
      : error.code === "22023" ? 422 : 502;
    console.error(JSON.stringify({ event: "rsbuild_settlements_confirm_failed", organizationId, code: error.code }));
    return NextResponse.json({ error: "settlements_confirmation_failed" }, { status });
  }

  const insertedCount = Number((data as { insertedCount?: unknown } | null)?.insertedCount ?? 0);
  await recordAuditEvent({
    organizationId, actorId: userId, actorEmail: userEmail,
    eventType: "settlements.created", entityType: "settlement",
    metadata: {
      insertedCount,
      totalAmountMinor: settlements.reduce((sum, item) => sum + item.amountMinor, 0),
      confirmationMode: "atomic_receivable_settlement"
    }
  });

  return NextResponse.json({ insertedCount }, {
    status: 201, headers: { "Cache-Control": "private, no-store" }
  });
}
