import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";
  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (!code) return NextResponse.redirect(new URL("/login?error=invite", url.origin));

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return NextResponse.redirect(new URL("/login?error=invite", url.origin));

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.email) return NextResponse.redirect(new URL("/login?error=invite", url.origin));

  // Provision only after Auth has verified the session identity. The database
  // function binds the invite to both this Auth user id and verified email.
  const admin = createAdminClient();
  const { data: organizations, error: acceptanceError } = await admin.rpc(
    "accept_organization_invitations_for_user",
    { p_user_id: user.id, p_email: user.email.toLowerCase() }
  );
  if (acceptanceError) {
    return NextResponse.redirect(new URL("/login?error=invite_acceptance", url.origin));
  }
  const organizationId = Array.isArray(organizations) ? organizations[0] : null;
  if (organizationId) {
    return NextResponse.redirect(new URL(`/?organizationId=${encodeURIComponent(organizationId)}`, url.origin));
  }
  return NextResponse.redirect(new URL(destination, url.origin));
}
