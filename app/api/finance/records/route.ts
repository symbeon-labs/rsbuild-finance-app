import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const organizationId = params.get("organizationId");
  const rawLimit = Number(params.get("limit") ?? DEFAULT_LIMIT);
  const rawOffset = Number(params.get("offset") ?? 0);
  if (!organizationId || !/^[0-9a-f-]{36}$/i.test(organizationId) ||
      !Number.isInteger(rawLimit) || rawLimit < 1 ||
      !Number.isInteger(rawOffset) || rawOffset < 0) {
    return NextResponse.json({ error: "invalid_pagination_or_organization" }, { status: 400 });
  }
  const limit = Math.min(rawLimit, MAX_LIMIT);

  const { data, error, count } = await supabase
    .from("financial_records")
    .select("id,transaction_date,description,amount_minor,direction,category,status,import_batch_id,source_record_id", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("transaction_date", { ascending: false })
    .order("id", { ascending: false })
    .range(rawOffset, rawOffset + limit - 1);

  if (error) return NextResponse.json({ error: "records_lookup_failed" }, { status: 403 });
  const rows = data ?? [];
  return NextResponse.json({
    records: rows.map((row) => ({
      id: row.id,
      date: row.transaction_date,
      description: row.description,
      amountMinor,
      direction: row.direction,
      category: row.category,
      source: "Supabase",
      status: row.status === "conciliado" ? "conciliado" : "pendente",
      importBatchId: row.import_batch_id ?? undefined,
      sourceRecordId: row.source_record_id ?? undefined,
    })),
    pagination: {
      limit,
      offset: rawOffset,
      total: count ?? null,
      hasMore: rows.length === limit && (count === null || rawOffset + rows.length < count),
      nextOffset: rawOffset + rows.length,
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
