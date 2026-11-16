import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

/**
 * API para acessar dados da sandbox (read-only).
 * Apenas admins/owners da RSBUILD podem acessar dados de teste.
 */
export async function GET(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    if (!consumeRateLimit(`${user.id}:/api/sandbox`)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    // Verificar se o usuário é admin/owner da RSBUILD
    const { data: membership, error: membershipError } = await supabase
      .from("organization_memberships")
      .select("role, organizations!inner(slug)")
      .eq("user_id", user.id)
      .eq("organizations.slug", "rsbuild")
      .maybeSingle();

    if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "sandbox_forbidden" }, { status: 403 });
    }

    // Usar service role para acessar schema sandbox (bypass RLS para admin)
    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "admin_client_unavailable" }, { status: 503 });
    }

    // Buscar dados da sandbox
    const [orgsRes, membersRes, accountsRes, recordsRes, titlesRes, proofsRes, auditRes] = await Promise.all([
      admin.schema("sandbox").from("organizations").select("*").order("display_name"),
      admin.schema("sandbox").from("organization_memberships").select("*").limit(1000),
      admin.schema("sandbox").from("financial_accounts").select("*").limit(1000),
      admin.schema("sandbox").from("financial_records").select("*").order("transaction_date", { ascending: false }).limit(1000),
      admin.schema("sandbox").from("receivable_titles").select("*").order("due_date").limit(1000),
      admin.schema("sandbox").from("delivery_proofs").select("*").order("delivery_date", { ascending: false }).limit(1000),
      admin.schema("sandbox").from("audit_events").select("*").order("created_at", { ascending: false }).limit(1000)
    ]);

    const firstError = [orgsRes, membersRes, accountsRes, recordsRes, titlesRes, proofsRes, auditRes]
      .find((r) => r.error);

    if (firstError?.error) {
      console.error("Sandbox query failed:", firstError.error);
      return NextResponse.json({ error: "sandbox_query_failed" }, { status: 502 });
    }

    return NextResponse.json({
      organizations: orgsRes.data ?? [],
      memberships: membersRes.data ?? [],
      financialAccounts: accountsRes.data ?? [],
      financialRecords: recordsRes.data ?? [],
      receivableTitles: titlesRes.data ?? [],
      deliveryProofs: proofsRes.data ?? [],
      auditEvents: auditRes.data ?? [],
      isSandbox: true
    }, {
      status: 200,
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (err: any) {
    console.error("Critical error in /api/sandbox:", err);
    return NextResponse.json({ error: "sandbox_error" }, { status: 500 });
  }
}
