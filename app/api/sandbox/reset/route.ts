import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

/**
 * API para resetar a sandbox (limpar dados e re-seed).
 * Apenas owners da RSBUILD podem resetar — a função sandbox_reset()
 * (security definer) revalida o role no banco antes de executar.
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

    // Verificar se o usuário é owner da RSBUILD (a RPC revalida no banco também)
    const { data: membership, error: membershipError } = await supabase
      .from("organization_memberships")
      .select("role, organizations!inner(slug)")
      .eq("user_id", user.id)
      .eq("organizations.slug", "rsbuild")
      .maybeSingle();

    if (membershipError || !membership || membership.role !== "owner") {
      return NextResponse.json({ error: "sandbox_reset_forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase.rpc("sandbox_reset");

    if (error) {
      if (error.message?.includes("sandbox_reset_forbidden")) {
        return NextResponse.json({ error: "sandbox_reset_forbidden" }, { status: 403 });
      }
      console.error("Sandbox reset failed:", error);
      return NextResponse.json({ error: "sandbox_reset_failed" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: data?.message ?? "Sandbox reset successfully with synthetic test data."
    });
  } catch (err: any) {
    console.error("Critical error in /api/sandbox/reset:", err);
    return NextResponse.json({ error: "sandbox_reset_error" }, { status: 500 });
  }
}
