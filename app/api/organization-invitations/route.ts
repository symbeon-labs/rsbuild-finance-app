import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }

  const session = await createClient();
  const { data: { user }, error: authError } = await session.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: { organizationId?: string; email?: string; role?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const organizationId = String(body.organizationId ?? "");
  const email = String(body.email ?? "").trim().toLowerCase();
  const role = String(body.role ?? "viewer");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId)
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || !["viewer", "operator", "admin"].includes(role)) {
    return NextResponse.json({ error: "invalid_invitation" }, { status: 400 });
  }

  const { data: membership, error: membershipError } = await session
    .from("organization_memberships").select("role")
    .eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "organization_admin_required" }, { status: 403 });
  }
  if (role === "admin" && membership.role !== "owner") {
    return NextResponse.json({ error: "only_owner_can_invite_admin" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: invitation, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: new URL("/auth/callback?next=/", request.url).toString(),
    data: { invited_organization_id: organizationId }
  });
  if (inviteError || !invitation.user) {
    return NextResponse.json({ error: "invite_delivery_failed", detail: inviteError?.message ?? "user_not_created" }, { status: 502 });
  }

  const { error: membershipUpsertError } = await admin.from("organization_memberships").upsert({
    organization_id: organizationId,
    user_id: invitation.user.id,
    role
  }, { onConflict: "organization_id,user_id" });
  if (membershipUpsertError) {
    return NextResponse.json({ error: "invite_created_membership_failed", invitedUserId: invitation.user.id }, { status: 502 });
  }

  const { error: auditError } = await admin.from("organization_invitations").upsert({
    organization_id: organizationId,
    email,
    role,
    invited_by: user.id,
    invited_user_id: invitation.user.id,
    status: "sent"
  }, { onConflict: "organization_id,email" });
  if (auditError) {
    return NextResponse.json({ error: "invite_created_audit_failed", invitedUserId: invitation.user.id }, { status: 502 });
  }

  return NextResponse.json({ ok: true, email, role }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
