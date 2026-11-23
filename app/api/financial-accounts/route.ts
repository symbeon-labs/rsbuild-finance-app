import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/api/org-guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }
  const client = await createClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization" }, { status: 400 });
  }
  const guard = await requireOrgContext(request, organizationId, ["owner", "admin", "operator"], "finance");
  if (!guard.ok) return guard.response;

  const { data, error } = await client.from("financial_accounts")
    .select("id,name,institution,external_reference,bank_code,branch_id")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("institution", { ascending: true })
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: "financial_accounts_unavailable" }, { status: 502 });
  return NextResponse.json({ accounts: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}
