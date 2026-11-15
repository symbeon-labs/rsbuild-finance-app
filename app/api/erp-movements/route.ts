import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/api/org-guard";
import { recordAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MOVEMENT_DIRECTIONS = ["entrada", "saída"];

export async function GET(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  const guard = await requireOrgContext(request, organizationId);
  if (!guard.ok) return guard.response;
  const { supabase } = guard.ctx;

  const { data: snapshot, error: snapshotError } = await supabase
    .from("erp_snapshots")
    .select("id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snapshotError) {
    console.error(JSON.stringify({ event: "rsbuild_erp_snapshot_read_failed", organizationId, code: snapshotError.code }));
    return NextResponse.json({ error: "erp_movements_unavailable" }, { status: 502 });
  }

  if (!snapshot) {
    return NextResponse.json({ movements: [], snapshot: null }, {
      status: 200, headers: { "Cache-Control": "private, no-store" }
    });
  }

  const { data, error } = await supabase
    .from("erp_movements")
    .select("id, movement_date, description, amount_minor, direction, document_number, category, created_at")
    .eq("organization_id", organizationId)
    .eq("snapshot_id", snapshot.id)
    .order("movement_date", { ascending: true })
    .limit(10000);

  if (error) {
    console.error(JSON.stringify({ event: "rsbuild_erp_movements_read_failed", organizationId, code: error.code }));
    return NextResponse.json({ error: "erp_movements_unavailable" }, { status: 502 });
  }

  const movements = (data ?? []).map((row: any) => ({
    id: row.id,
    date: row.movement_date,
    description: row.description,
    amount: Number(row.amount_minor) / 100,
    direction: row.direction,
    documentNumber: row.document_number ?? undefined,
    category: row.category ?? undefined
  }));

  return NextResponse.json({ movements, snapshot }, {
    status: 200, headers: { "Cache-Control": "private, no-store" }
  });
}

export async function POST(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  const guard = await requireOrgContext(request, organizationId, ["owner", "admin", "operator"]);
  if (!guard.ok) return guard.response;
  const { supabase, userId, userEmail } = guard.ctx;

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
    // Compensação: remove o snapshot órfão via service role (RLS não concede DELETE a usuários).
    // O insert de movements é atômico — se falhou, nenhum movimento foi gravado.
    const admin = createAdminClient();
    const { error: cleanupError } = await admin.from("erp_snapshots").delete().eq("id", snapshot.id);
    if (cleanupError) {
      console.error(JSON.stringify({ event: "rsbuild_erp_snapshot_cleanup_failed", organizationId, snapshotId: snapshot.id, code: cleanupError.code }));
    }
    console.error(JSON.stringify({ event: "rsbuild_erp_movements_import_failed", organizationId, code: error.code }));
    return NextResponse.json({ error: "erp_movements_import_failed", orphanSnapshotId: cleanupError ? snapshot.id : undefined }, { status: 502 });
  }

  await recordAuditEvent({
    organizationId, actorId: userId, actorEmail: userEmail,
    eventType: "erp.snapshot_imported", entityType: "erp_snapshot", entityId: snapshot.id,
    metadata: { insertedCount: rows.length, sourceLabel: typeof body.sourceLabel === "string" ? body.sourceLabel.slice(0, 200) : null }
  });

  return NextResponse.json({ insertedCount: rows.length, snapshotId: snapshot.id }, {
    status: 201, headers: { "Cache-Control": "private, no-store" }
  });
}
