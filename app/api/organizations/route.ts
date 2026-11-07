import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("organization_memberships")
    .select("role, organization:organizations(id, display_name, legal_name)")
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: "organization_lookup_failed" }, { status: 500 });
  return NextResponse.json({ organizations: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}
