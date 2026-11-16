import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

/**
 * API para atualizar custom_title de membros de organização.
 * Apenas admins/owners da organização podem atualizar.
 */
export async function PATCH(request: Request) {
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

    if (!consumeRateLimit(`${user.id}:/api/member-titles`)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const body = await request.json();
    const { organizationId, userId, customTitle } = body;

    if (!organizationId || !userId) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    // Validar tamanho do título (max 100 chars)
    if (customTitle && customTitle.length > 100) {
      return NextResponse.json({ error: "title_too_long" }, { status: 400 });
    }

    // Verificar se o usuário é admin/owner da organização
    const { data: membership, error: membershipError } = await supabase
      .from("organization_memberships")
      .select("role, organizations!inner(slug)")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Atualizar custom_title
    const { error: updateError } = await supabase
      .from("organization_memberships")
      .update({ custom_title: customTitle || null })
      .eq("organization_id", organizationId)
      .eq("user_id", userId);

    if (updateError) {
      console.error("Failed to update custom_title:", updateError);
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, customTitle: customTitle || null });
  } catch (err: any) {
    console.error("Critical error in /api/member-titles:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
