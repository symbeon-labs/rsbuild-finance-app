import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;
  if (origin !== requestOrigin) return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });

  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user?.email || !user.email_confirmed_at) {
    return NextResponse.json({ error: "verified_admin_required" }, { status: 401 });
  }

  const admins = (process.env.RSBUILD_PLATFORM_ADMIN_EMAILS ?? "")
    .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (!admins.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: "admin_forbidden" }, { status: 403 });
  }

  let body: { email?: string; legalName?: string; displayName?: string; taxIdentifier?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const legalName = (body.legalName ?? "").trim();
  const displayName = (body.displayName ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !legalName || legalName.length > 180 || !displayName || displayName.length > 120) {
    return NextResponse.json({ error: "invalid_provisioning_payload" }, { status: 422 });
  }

  let admin;
  try { admin = createAdminClient(); } catch {
    return NextResponse.json({ error: "admin_secret_not_configured" }, { status: 503 });
  }

  const { data: organization, error: orgError } = await admin
    .from("organizations")
    .insert({ legal_name: legalName, display_name: displayName, tax_identifier: body.taxIdentifier?.trim() || null })
    .select("id")
    .single();
  if (orgError || !organization) return NextResponse.json({ error: "organization_create_failed" }, { status: 500 });

  const { data: invitation, error: invitationError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: new URL("/auth/callback", request.url).toString(),
  });
  if (invitationError || !invitation.user) {
    await admin.from("organizations").delete().eq("id", organization.id);
    return NextResponse.json({ error: "invitation_failed_or_user_already_exists" }, { status: 422 });
  }
  const invitedUserId = invitation.user.id;

  const { error: membershipError } = await admin.from("organization_memberships").insert({
    organization_id: organization.id,
    user_id: invitedUserId,
    role: "owner",
  });

  if (membershipError) {
    await admin.auth.admin.deleteUser(invitedUserId);
    await admin.from("organizations").delete().eq("id", organization.id);
    return NextResponse.json({ error: "membership_provision_failed" }, { status: 500 });
  }

  await admin.from("audit_events").insert({
    organization_id: organization.id,
    actor_id: user.id,
    event_type: "organization_provisioned",
    entity_type: "organization",
    entity_id: organization.id,
    metadata: { invited_email: email },
  });

  return NextResponse.json({ organizationId: organization.id, invitedEmail: email }, {
    status: 201, headers: { "Cache-Control": "private, no-store" },
  });
}
