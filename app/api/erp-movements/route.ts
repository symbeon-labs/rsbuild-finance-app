import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/api/org-guard";

export const dynamic = "force-dynamic";

const MOVEMENT_DIRECTIONS = ["entrada", "saída"];

export async function POST(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  const guard = await requireOrgContext(request, organizationId, ["owner", "admin", "operator"]);
  if (!guard.ok) return guard.response;
  const { supabase, userId } = guard.ctx;

  let body: { sourceLabel?: string; movements?: Array<{ date?: unknown; description?: unknown; amount?: unknown; direction?: unknown; documentNumber?: unknown; category?: unknown }> };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const inputs = Array.isArray(body?.movements) ? body.movements : null;
  if (!inputs || !inputs.length) {
    return NextResponse.json({ error: "invalid_movements_payload" }, { status: 400 });
  }

  const { data: snapshot, error: snapshotError } = await supabase
    .from("erp_snapshots")
    .insert({
      organization_id: organizationId,
      source_label: typeof body.sourceLabel === "string" ? body.sourceLabel.slice(0, 200) : null,
      record_count: inputs.length,
      created_by: userId
    })
    .select("id")
    .maybeSingle();

  if (snapshotError || !snapshot) {
    console.error(JSON.stringify({ event: "rsbuild_erp_snapshot_failed", organizationId, code: snapshotError?.code }));
    return NextResponse.json({ error: "erp_snapshot_failed" }, { status: 502 });
  }

  const rows = inputs.map((m) => {
    const amount = Number(m.amount);
    const direction = MOVEMENT_DIRECTIONS.includes(String(m.direction)) ? String(m.direction) : "entrada";
    return {
      organization_id: organizationId,
      snapshot_id: snapshot.id,
      movement_date: typeof m.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(m.date) ? m.date : null,
      description: String(m.description ?? "").trim().slice(0, 500),
      amount_minor: Number.isFinite(amount) ? Math.round(Math.abs(amount) * 100) : 0,
      direction,
      document_number: typeof m.documentNumber === "string" ? m.documentNumber.slice(0, 80) : null,
      category: typeof m.category === "string" ? m.category.slice(0, 120) : null
    };
  });

  const invalid = rows.filter((r) => !r.movement_date || !r.description);
  if (invalid.length) {
    return NextResponse.json({ error: "invalid_movements_payload", detail: `${invalid.length} movimento(s) sem data ou descrição.` }, { status: 422 });
  }

  const { error } = await supabase.from("erp_movements").insert(rows);
  if (error) {
    console.error(JSON.stringify({ event: "rsbuild_erp_movements_import_failed", organizationId, code: error.code }));
    return NextResponse.json({ error: "erp_movements_import_failed" }, { status: 502 });
  }

  return NextResponse.json({ insertedCount: rows.length, snapshotId: snapshot.id }, {
    status: 201, headers: { "Cache-Control": "private, no-store" }
  });
}
