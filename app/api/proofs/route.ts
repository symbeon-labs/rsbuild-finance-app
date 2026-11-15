import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/api/org-guard";

export const dynamic = "force-dynamic";

const MAX_PROOFS = 5000;
const DELIVERY_STATUSES = ["pendente_entrega", "comprovado", "recusa_devolucao", "extraviado"];

export async function GET(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  const guard = await requireOrgContext(request, organizationId);
  if (!guard.ok) return guard.response;
  const { supabase } = guard.ctx;

  const { data, error } = await supabase
    .from("delivery_proofs")
    .select("id, nfe_number, nfe_key, customer_name, customer_document, nfe_amount_minor, issue_date, delivery_date, status, driver_name, receiver_name, receiver_document, proof_file_url, notes, synced_to_omie, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(MAX_PROOFS);

  if (error) {
    console.error(JSON.stringify({ event: "rsbuild_proofs_read_failed", organizationId, code: error.code }));
    return NextResponse.json({ error: "proofs_unavailable" }, { status: 502 });
  }

  const proofs = (data ?? []).map((row: any) => ({
    id: row.id,
    nfeNumber: row.nfe_number,
    nfeKey: row.nfe_key ?? undefined,
    customerName: row.customer_name,
    customerDocument: row.customer_document ?? undefined,
    nfeAmount: Number(row.nfe_amount_minor) / 100,
    issueDate: row.issue_date ?? "",
    deliveryDate: row.delivery_date ?? undefined,
    status: row.status,
    driverName: row.driver_name ?? undefined,
    receiverName: row.receiver_name ?? undefined,
    receiverDocument: row.receiver_document ?? undefined,
    proofFileUrl: row.proof_file_url ?? undefined,
    notes: row.notes ?? undefined,
    syncedToOmie: row.synced_to_omie
  }));

  return NextResponse.json({ proofs, count: proofs.length }, {
    status: 200, headers: { "Cache-Control": "private, no-store" }
  });
}

type ProofInput = {
  nfeNumber?: unknown; nfeKey?: unknown; customerName?: unknown; customerDocument?: unknown;
  nfeAmount?: unknown; issueDate?: unknown; deliveryDate?: unknown; status?: unknown;
  driverName?: unknown; receiverName?: unknown; receiverDocument?: unknown;
  proofFileUrl?: unknown; notes?: unknown;
};

export async function POST(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  const guard = await requireOrgContext(request, organizationId, ["owner", "admin", "operator"]);
  if (!guard.ok) return guard.response;
  const { supabase, userId } = guard.ctx;

  let body: { proofs?: ProofInput[] };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const inputs = Array.isArray(body?.proofs) ? body.proofs : null;
  if (!inputs || !inputs.length || inputs.length > MAX_PROOFS) {
    return NextResponse.json({ error: "invalid_proofs_payload" }, { status: 400 });
  }

  const rows = inputs.map((p) => {
    const amount = Number(p.nfeAmount);
    const status = DELIVERY_STATUSES.includes(String(p.status)) ? String(p.status) : "pendente_entrega";
    return {
      organization_id: organizationId,
      nfe_number: String(p.nfeNumber ?? "").trim().slice(0, 60),
      nfe_key: typeof p.nfeKey === "string" ? p.nfeKey.trim().slice(0, 60) : null,
      customer_name: String(p.customerName ?? "").trim().slice(0, 200),
      customer_document: typeof p.customerDocument === "string" ? p.customerDocument.slice(0, 30) : null,
      nfe_amount_minor: Number.isFinite(amount) ? Math.round(Math.abs(amount) * 100) : 0,
      issue_date: typeof p.issueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.issueDate) ? p.issueDate : null,
      delivery_date: typeof p.deliveryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.deliveryDate) ? p.deliveryDate : null,
      status,
      driver_name: typeof p.driverName === "string" ? p.driverName.slice(0, 160) : null,
      receiver_name: typeof p.receiverName === "string" ? p.receiverName.slice(0, 160) : null,
      receiver_document: typeof p.receiverDocument === "string" ? p.receiverDocument.slice(0, 60) : null,
      proof_file_url: typeof p.proofFileUrl === "string" ? p.proofFileUrl.slice(0, 500) : null,
      notes: typeof p.notes === "string" ? p.notes.slice(0, 2000) : null,
      created_by: userId
    };
  });

  const invalid = rows.filter((r) => !r.nfe_number || !r.customer_name);
  if (invalid.length) {
    return NextResponse.json({ error: "invalid_proofs_payload", detail: `${invalid.length} comprovante(s) sem NF ou cliente.` }, { status: 422 });
  }

  const { error } = await supabase.from("delivery_proofs").insert(rows);
  if (error) {
    console.error(JSON.stringify({ event: "rsbuild_proofs_import_failed", organizationId, code: error.code }));
    return NextResponse.json({ error: "proofs_import_failed" }, { status: 502 });
  }

  return NextResponse.json({ insertedCount: rows.length }, {
    status: 201, headers: { "Cache-Control": "private, no-store" }
  });
}
