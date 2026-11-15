import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/api/org-guard";

export const dynamic = "force-dynamic";

const MAX_TITLES = 5000;

export async function GET(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  const guard = await requireOrgContext(request, organizationId);
  if (!guard.ok) return guard.response;
  const { supabase } = guard.ctx;

  const { data, error } = await supabase
    .from("receivable_titles")
    .select("id, document_number, customer_name, customer_doc, amount_minor, due_date, issue_date, bank_account, category, our_number, status, created_at")
    .eq("organization_id", organizationId)
    .order("due_date", { ascending: true })
    .limit(MAX_TITLES);

  if (error) {
    console.error(JSON.stringify({ event: "rsbuild_titles_read_failed", organizationId, code: error.code }));
    return NextResponse.json({ error: "titles_unavailable" }, { status: 502 });
  }

  const titles = (data ?? []).map((row: any) => ({
    id: row.id,
    documentNumber: row.document_number,
    customerName: row.customer_name,
    customerDoc: row.customer_doc ?? undefined,
    amount: Number(row.amount_minor) / 100,
    dueDate: row.due_date,
    issueDate: row.issue_date ?? undefined,
    bankAccount: row.bank_account ?? undefined,
    category: row.category ?? undefined,
    ourNumber: row.our_number ?? undefined,
    status: row.status
  }));

  return NextResponse.json({ titles, count: titles.length }, {
    status: 200, headers: { "Cache-Control": "private, no-store" }
  });
}

type TitleInput = {
  documentNumber?: unknown; customerName?: unknown; customerDoc?: unknown;
  amount?: unknown; dueDate?: unknown; issueDate?: unknown;
  bankAccount?: unknown; category?: unknown; ourNumber?: unknown;
};

export async function POST(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  const guard = await requireOrgContext(request, organizationId, ["owner", "admin", "operator"]);
  if (!guard.ok) return guard.response;
  const { supabase, userId } = guard.ctx;

  let body: { titles?: TitleInput[] };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const inputs = Array.isArray(body?.titles) ? body.titles : null;
  if (!inputs || !inputs.length || inputs.length > MAX_TITLES) {
    return NextResponse.json({ error: "invalid_titles_payload" }, { status: 400 });
  }

  const rows = inputs.map((t) => {
    const amount = Number(t.amount);
    const dueDate = typeof t.dueDate === "string" ? t.dueDate : "";
    const documentNumber = typeof t.documentNumber === "string" ? t.documentNumber.trim() : "";
    const customerName = typeof t.customerName === "string" ? t.customerName.trim() : "";
    const issueDate = typeof t.issueDate === "string" && t.issueDate ? t.issueDate : null;
    return {
      organization_id: organizationId,
      document_number: documentNumber.slice(0, 80),
      customer_name: customerName.slice(0, 200),
      customer_doc: typeof t.customerDoc === "string" ? t.customerDoc.slice(0, 30) : null,
      amount_minor: Number.isFinite(amount) ? Math.round(amount * 100) : -1,
      due_date: /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null,
      issue_date: issueDate && /^\d{4}-\d{2}-\d{2}$/.test(issueDate) ? issueDate : null,
      bank_account: typeof t.bankAccount === "string" ? t.bankAccount.slice(0, 120) : null,
      category: typeof t.category === "string" ? t.category.slice(0, 120) : null,
      our_number: typeof t.ourNumber === "string" ? t.ourNumber.slice(0, 80) : null,
      created_by: userId
    };
  });

  const invalid = rows.filter((r) => !r.document_number || !r.customer_name || r.amount_minor < 0 || !r.due_date);
  if (invalid.length) {
    return NextResponse.json({ error: "invalid_titles_payload", detail: `${invalid.length} título(s) com campos obrigatórios inválidos.` }, { status: 422 });
  }

  const { data, error } = await supabase
    .from("receivable_titles")
    .upsert(rows, { onConflict: "organization_id,document_number,due_date,amount_minor", ignoreDuplicates: true })
    .select("id");

  if (error) {
    console.error(JSON.stringify({ event: "rsbuild_titles_import_failed", organizationId, code: error.code }));
    return NextResponse.json({ error: "titles_import_failed" }, { status: 502 });
  }

  return NextResponse.json({ insertedCount: data?.length ?? 0, receivedCount: rows.length }, {
    status: 201, headers: { "Cache-Control": "private, no-store" }
  });
}
