import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const invitationId = url.searchParams.get("invitationId");
  const next = url.searchParams.get("next") ?? "/";
  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const supabase = await createClient();

  // Supabase inviteUserByEmail uses the invite OTP/token_hash flow (not PKCE).
  // Keep code exchange for other supported callback flows.
  if (tokenHash && type === "invite") {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "invite" });
    if (error) return NextResponse.redirect(new URL("/login?error=invite", url.origin));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/login?error=invite", url.origin));
  } else {
    return NextResponse.redirect(new URL("/login?error=invite", url.origin));
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.email) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=invite", url.origin));
  }
  if (!invitationId) return NextResponse.redirect(new URL(destination, url.origin));
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(invitationId)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=invite_invalid", url.origin));
  }

  // The RPC binds this exact invitation to the verified Auth user ID and email.
  const admin = createAdminClient();
  const { data: organizationId, error: acceptanceError } = await admin.rpc(
    "accept_organization_invitation",
    { p_invitation_id: invitationId, p_user_id: user.id, p_email: user.email.toLowerCase() }
  );
  if (acceptanceError || !organizationId) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=invite_invalid", url.origin));
  }
  return NextResponse.redirect(new URL(`/?organizationId=${encodeURIComponent(organizationId)}`, url.origin));
}
