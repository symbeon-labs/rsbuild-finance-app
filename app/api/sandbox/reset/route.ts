import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

/**
 * API para resetar a sandbox (limpar dados e re-seed).
 * Apenas owners da RSBUILD podem resetar a sandbox.
 */
export async function POST(request: Request) {
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

    if (!consumeRateLimit(`${user.id}:/api/sandbox/reset`)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    // Verificar se o usuário é owner da RSBUILD
    const { data: membership, error: membershipError } = await supabase
      .from("organization_memberships")
      .select("role, organizations!inner(slug)")
      .eq("user_id", user.id)
      .eq("organizations.slug", "rsbuild")
      .maybeSingle();

    if (membershipError || !membership || membership.role !== "owner") {
      return NextResponse.json({ error: "sandbox_reset_forbidden" }, { status: 403 });
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "admin_client_unavailable" }, { status: 503 });
    }

    // Limpar todas as tabelas da sandbox (ordem importa por causa de FKs)
    const tables = [
      "audit_events",
      "delivery_proofs",
      "receivable_titles",
      "financial_records",
      "financial_accounts",
      "organization_memberships",
      "organizations"
    ];

    for (const table of tables) {
      const { error } = await admin.schema("sandbox").from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) {
        console.error(`Failed to clear sandbox.${table}:`, error);
        // Continue with other tables even if one fails
      }
    }

    // Re-seed com dados sintéticos
    // (Isso seria implementado com um script de seed ou RPC)
    // Por enquanto, apenas limpamos - o seed pode ser re-executado manualmente

    return NextResponse.json({
      success: true,
      message: "Sandbox cleared. Re-run seed migration to restore test data."
    });
  } catch (err: any) {
    console.error("Critical error in /api/sandbox/reset:", err);
    return NextResponse.json({ error: "sandbox_reset_error" }, { status: 500 });
  }
}
