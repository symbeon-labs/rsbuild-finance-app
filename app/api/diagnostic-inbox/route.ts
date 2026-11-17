import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Authenticated read endpoint for the RSBUILD institutional inbox.
 * RLS on diagnostic_requests restricts rows to RSBUILD owner/admin/operator.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("diagnostic_requests")
    .select([
      "id", "company_name", "segment", "contact_name", "contact_role",
      "contact_email", "contact_phone", "units_count", "systems_used",
      "erp_used", "areas_involved", "needs", "priority_process",
      "problem_frequency", "problem_impact", "current_process",
      "expected_result", "intention", "status", "created_at"
    ].join(","))
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error(JSON.stringify({ event: "diagnostic_inbox_read_failed", code: error.code }));
    return NextResponse.json({ error: "inbox_unavailable" }, { status: 502 });
  }

  return NextResponse.json({ requests: data ?? [] }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" }
  });
}
