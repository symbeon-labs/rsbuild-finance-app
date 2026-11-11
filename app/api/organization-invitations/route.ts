import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function authorize(request: Request, organizationId: string) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return { error: "origin_forbidden", status: 403 } as const;
  if (!UUID.test(organizationId)) return { error: "invalid_organization", status: 400 } as const;
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return { error: "unauthenticated", status: 401 } as const;
  const { data: membership, error: membershipError } = await session.from("organization_memberships")
    .select("role").eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) {
    return { error: "organization_admin_required", status: 403 } as const;
  }
  return { user, role: membership.role, error: null } as const;
}

export async function GET(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  const access = await authorize(request, organizationId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const admin = createAdminClient();
  const { data, error } = await admin.from("organization_invitations")
    .select("id,email,role,status,created_at,expires_at,accepted_at,revoked_at,last_sent_at")
    .eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "invitation_list_failed" }, { status: 502 });
  return NextResponse.json({ invitations: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  let body: { organizationId?: string; email?: string; role?: string; invitationId?: string; action?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const organizationId = String(body.organizationId ?? "");
  const access = await authorize(request, organizationId);
  if (access.error || !("user" in access)) return NextResponse.json({ error: access.error }, { status: access.status });
  const admin = createAdminClient();

  if (body.action && body.action !== "create") return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  const email = String(body.email ?? "").trim().toLowerCase();
  const role = String(body.role ?? "viewer");
  if (email.length > 254 || !EMAIL.test(email) || !["viewer", "operator", "admin"].includes(role)) {
    return NextResponse.json({ error: "invalid_invitation" }, { status: 400 });
  }
  if (role === "admin" && access.role !== "owner") {
    return NextResponse.json({ error: "only_owner_can_invite_admin" }, { status: 403 });
  }

  const { count: recentInvitations, error: rateError } = await admin.from("organization_invitations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId).eq("invited_by", access.user.id)
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if (rateError) return NextResponse.json({ error: "invitation_rate_check_failed" }, { status: 502 });
  if ((recentInvitations ?? 0) >= 10) return NextResponse.json({ error: "invitation_rate_limit" }, { status: 429 });

  const { data: existing } = await admin.from("organization_invitations")
    .select("id,status,expires_at").eq("organization_id", organizationId).eq("email", email).maybeSingle();
  if (existing && (existing.status === "accepted" ||
      (["pending", "sent"].includes(existing.status) && new Date(existing.expires_at).getTime() > Date.now()))) {
    return NextResponse.json({ error: "invitation_already_exists" }, { status: 409 });
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: row, error: recordError } = await admin.from("organization_invitations").upsert({
    organization_id: organizationId, email, role, invited_by: access.user.id,
    invited_user_id: null, status: "pending", expires_at: expiresAt,
    accepted_at: null, revoked_at: null, last_sent_at: null
  }, { onConflict: "organization_id,email" }).select("id").single();
  if (recordError || !row) return NextResponse.json({ error: "invitation_record_failed" }, { status: 502 });

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: new URL("/auth/callback?invitationId=" + encodeURIComponent(row.id), request.url).toString(),
    data: { invited_organization_id: organizationId }
  });
  if (inviteError || !invited.user) {
    await admin.from("organization_invitations").update({ status: "failed" }).eq("id", row.id);
    return NextResponse.json({ error: "invite_delivery_failed" }, { status: 502 });
  }
  const { error: sentError } = await admin.from("organization_invitations").update({
    invited_user_id: invited.user.id, status: "sent", last_sent_at: new Date().toISOString()
  }).eq("id", row.id);
  if (sentError) return NextResponse.json({ error: "invite_state_update_failed", invitationId: row.id }, { status: 502 });
  return NextResponse.json({ ok: true, invitationId: row.id, email, role, status: "sent", expiresAt }, {
    status: 201, headers: { "Cache-Control": "private, no-store" }
  });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId") ?? "";
  const invitationId = url.searchParams.get("invitationId") ?? "";
  const access = await authorize(request, organizationId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!UUID.test(invitationId)) return NextResponse.json({ error: "invalid_invitation" }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("organization_invitations").update({
    status: "revoked", revoked_at: new Date().toISOString()
  }).eq("id", invitationId).eq("organization_id", organizationId)
    .in("status", ["pending", "sent", "failed"]).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "invitation_revoke_failed" }, { status: 502 });
  if (!data) return NextResponse.json({ error: "invitation_not_revocable" }, { status: 409 });
  return NextResponse.json({ ok: true, invitationId, status: "revoked" }, { headers: { "Cache-Control": "private, no-store" } });
}
