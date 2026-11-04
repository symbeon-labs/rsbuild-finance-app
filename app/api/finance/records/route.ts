import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const organizationId = new URL(request.url).searchParams.get("organizationId");
  if (!organizationId || !/^[0-9a-f-]{36}$/i.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("financial_records")
    .select("id,transaction_date,description,amount_minor,direction,category,status,import_batch_id,source_record_id")
    .eq("organization_id", organizationId)
    .order("transaction_date", { ascending: false })
    .limit(1000);

  if (error) return NextResponse.json({ error: "records_lookup_failed" }, { status: 403 });
  return NextResponse.json({
    records: (data ?? []).map((row) => ({
      id: row.id,
      date: row.transaction_date,
      description: row.description,
      amount: Number(row.amount_minor) / 100,
      direction: row.direction,
      category: row.category,
      source: "Supabase",
      status: row.status === "conciliado" ? "conciliado" : "pendente",
      importBatchId: row.import_batch_id ?? undefined,
      sourceRecordId: row.source_record_id ?? undefined,
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
