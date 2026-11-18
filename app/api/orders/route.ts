import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/api/org-guard";
import { recordAuditEvent } from "@/lib/api/audit";

export const dynamic = "force-dynamic";

const MAX_ORDERS = 5000;
const PAYMENT_METHODS = ["boleto_7d", "boleto_14d", "pix", "a_vista", "a_combinar"];
const ORDER_STATUSES = ["rascunho", "confirmado", "enviado_omie"];

export async function GET(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  const guard = await requireOrgContext(request, organizationId, ["owner", "admin", "operator", "viewer"], "logistics");
  if (!guard.ok) return guard.response;
  const { supabase } = guard.ctx;

  const { data, error } = await supabase
    .from("whatsapp_orders")
    .select("id, raw_message, customer_name, delivery_date, payment_method, notes, items, total_boxes, total_amount_minor, confidence, unrecognized_lines, status, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(MAX_ORDERS);

  if (error) {
    console.error(JSON.stringify({ event: "rsbuild_orders_read_failed", organizationId, code: error.code }));
    return NextResponse.json({ error: "orders_unavailable" }, { status: 502 });
  }

  const orders = (data ?? []).map((row: any) => ({
    id: row.id,
    rawMessage: row.raw_message,
    customerName: row.customer_name,
    deliveryDate: row.delivery_date ?? undefined,
    paymentMethod: row.payment_method,
    notes: row.notes ?? undefined,
    items: row.items,
    totalBoxes: row.total_boxes,
    totalAmount: Number(row.total_amount_minor) / 100,
    confidence: row.confidence,
    unrecognizedLines: row.unrecognized_lines,
    status: row.status,
    createdAt: row.created_at
  }));

  return NextResponse.json({ orders, count: orders.length }, {
    status: 200, headers: { "Cache-Control": "private, no-store" }
  });
}

type OrderInput = {
  rawMessage?: unknown; customerName?: unknown; deliveryDate?: unknown;
  paymentMethod?: unknown; notes?: unknown; items?: unknown;
  totalBoxes?: unknown; totalAmount?: unknown; confidence?: unknown;
  unrecognizedLines?: unknown; status?: unknown;
};

export async function POST(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  const guard = await requireOrgContext(request, organizationId, ["owner", "admin", "operator"], "logistics");
  if (!guard.ok) return guard.response;
  const { supabase, userId, userEmail } = guard.ctx;

  let body: { orders?: OrderInput[] };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const inputs = Array.isArray(body?.orders) ? body.orders : null;
  if (!inputs || !inputs.length || inputs.length > MAX_ORDERS) {
    return NextResponse.json({ error: "invalid_orders_payload" }, { status: 400 });
  }

  const rows = inputs.map((o) => {
    const amount = Number(o.totalAmount);
    const paymentMethod = PAYMENT_METHODS.includes(String(o.paymentMethod)) ? String(o.paymentMethod) : "a_combinar";
    const status = ORDER_STATUSES.includes(String(o.status)) ? String(o.status) : "confirmado";
    const confidence = ["alta", "media", "baixa"].includes(String(o.confidence)) ? String(o.confidence) : "media";
    return {
      organization_id: organizationId,
      raw_message: String(o.rawMessage ?? "").slice(0, 5000),
      customer_name: String(o.customerName ?? "").trim().slice(0, 200),
      delivery_date: typeof o.deliveryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.deliveryDate) ? o.deliveryDate : null,
      payment_method: paymentMethod,
      notes: typeof o.notes === "string" ? o.notes.slice(0, 2000) : null,
      items: typeof o.items === "object" && o.items !== null ? o.items : "[]",
      total_boxes: Number.isInteger(Number(o.totalBoxes)) ? Math.max(0, Number(o.totalBoxes)) : 0,
      total_amount_minor: Number.isFinite(amount) ? Math.round(Math.abs(amount) * 100) : 0,
      confidence,
      unrecognized_lines: typeof o.unrecognizedLines === "object" && o.unrecognizedLines !== null ? o.unrecognizedLines : "[]",
      status,
      created_by: userId
    };
  });

  const invalid = rows.filter((r) => !r.customer_name);
  if (invalid.length) {
    return NextResponse.json({ error: "invalid_orders_payload", detail: `${invalid.length} pedido(s) sem cliente.` }, { status: 422 });
  }

  const { error } = await supabase.from("whatsapp_orders").insert(rows);
  if (error) {
    console.error(JSON.stringify({ event: "rsbuild_orders_import_failed", organizationId, code: error.code }));
    return NextResponse.json({ error: "orders_import_failed" }, { status: 502 });
  }

  await recordAuditEvent({
    organizationId, actorId: userId, actorEmail: userEmail,
    eventType: "orders.created", entityType: "whatsapp_order",
    metadata: { insertedCount: rows.length }
  });

  return NextResponse.json({ insertedCount: rows.length }, {
    status: 201, headers: { "Cache-Control": "private, no-store" }
  });
}
