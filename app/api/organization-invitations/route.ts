import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAuditEvent } from "@/lib/api/audit";
import { consumeRateLimit } from "@/lib/api/rate-limit";

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
  if (!consumeRateLimit(`${user.id}:/api/organization-invitations`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

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
    await recordAuditEvent({
      organizationId,
      actorId: user.id,
      actorEmail: user.email ?? null,
      eventType: "access.denied",
      entityType: "organization",
      entityId: organizationId,
      metadata: { reason: "insufficient_role", requiredRoles: ["owner", "admin"], actualRole: membership?.role ?? null, path: "/api/organization-invitations", method: "POST" }
    });
    return NextResponse.json({ error: "organization_admin_required" }, { status: 403 });
  }
  if (role === "admin" && membership.role !== "owner") {
    await recordAuditEvent({
      organizationId,
      actorId: user.id,
      actorEmail: user.email ?? null,
      eventType: "access.denied",
      entityType: "organization",
      entityId: organizationId,
      metadata: { reason: "role_escalation_attempt", attemptedRole: role, path: "/api/organization-invitations", method: "POST" }
    });
    return NextResponse.json({ error: "only_owner_can_invite_admin" }, { status: 403 });
  }

  const admin = createAdminClient();
  let invitedUserId: string | null = null;

  const { data: invitation, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: new URL("/auth/callback?next=/", request.url).toString(),
    data: { invited_organization_id: organizationId }
  });

  if (invitation?.user?.id) {
    invitedUserId = invitation.user.id;
  } else if (inviteError) {
    const errorMsg = String(inviteError.message || "");
    // Se o usuário já existe no Supabase Auth, localizamos seu ID para vincular à organização
    if (/already|exists|registered/i.test(errorMsg)) {
      for (let page = 1; page <= 20 && !invitedUserId; page++) {
        const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        const found = list?.users?.find((u) => u.email?.toLowerCase() === email) ?? null;
        if (found) invitedUserId = found.id;
        if (!list?.users?.length || list.users.length < 200) break;
      }
    }
    if (!invitedUserId) {
      return NextResponse.json({ error: "invite_delivery_failed", detail: errorMsg || "user_not_created" }, { status: 502 });
    }
  } else {
    return NextResponse.json({ error: "invite_delivery_failed", detail: "user_not_created" }, { status: 502 });
  }

  const { error: membershipUpsertError } = await admin.from("organization_memberships").upsert({
    organization_id: organizationId,
    user_id: invitedUserId,
    role
  }, { onConflict: "organization_id,user_id" });
  if (membershipUpsertError) {
    return NextResponse.json({ error: "invite_created_membership_failed", detail: membershipUpsertError.message, invitedUserId }, { status: 502 });
  }

  // Trilha append-only: reenvio atualiza apenas status/usuário convidado,
  // preservando invited_by, role e created_at originais.
  const { data: existing } = await admin.from("organization_invitations")
    .select("id")
    .eq("organization_id", organizationId).eq("email", email).maybeSingle();

  if (existing) {
    const { error: updateError } = await admin.from("organization_invitations")
      .update({ invited_user_id: invitedUserId, status: "sent" })
      .eq("id", existing.id);
    if (updateError) {
      return NextResponse.json({ error: "invite_resent_failed", detail: updateError.message, invitedUserId }, { status: 502 });
    }
  } else {
    const { error: auditError } = await admin.from("organization_invitations").insert({
      organization_id: organizationId,
      email,
      role,
      invited_by: user.id,
      invited_user_id: invitedUserId,
      status: "sent"
    });
    if (auditError) {
      return NextResponse.json({ error: "invite_created_audit_failed", detail: auditError.message, invitedUserId }, { status: 502 });
    }
  }

  await recordAuditEvent({
    organizationId,
    actorId: user.id,
    actorEmail: user.email ?? null,
    eventType: "invitation.sent",
    entityType: "organization_invitation",
    entityId: invitedUserId,
    metadata: { invitedEmail: email, role }
  });

  return NextResponse.json({ ok: true, email, role }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
