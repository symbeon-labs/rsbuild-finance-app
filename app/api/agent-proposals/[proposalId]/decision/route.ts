import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/api/rate-limit";
import { recordAuditEvent } from "@/lib/api/audit";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Decide uma proposta de agente (HITL): approved | rejected.
 * Autorizado: owner institucional da RSBUILD ou owner do tenant alvo.
 * Perfis admin/operator não recebem autoridade decisória por herança de
 * membership. O RLS reforça a mesma alçada no banco.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ proposalId: string }> }
) {
  try {
    const { proposalId } = await params;
    if (!UUID_PATTERN.test(proposalId)) {
      return NextResponse.json({ error: "invalid_proposal" }, { status: 400 });
    }

    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (!consumeRateLimit(`${user.id}:/api/agent-proposals/decision`)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    let body: any = {};
    try { body = await request.json(); } catch { /* body opcional */ }
    const decision = body?.decision;
    const reason = typeof body?.reason === "string" ? body.reason.slice(0, 500) : null;
    if (!["approved", "rejected"].includes(decision)) {
      return NextResponse.json({ error: "invalid_decision" }, { status: 400 });
    }

    // Carrega a proposta (RLS já limita a leitura a RSBUILD ou ao tenant dono)
    const { data: proposal, error: proposalError } = await supabase
      .from("agent_action_proposals")
      .select("id, agent_id, organization_id, status")
      .eq("id", proposalId)
      .maybeSingle();

    if (proposalError || !proposal) {
      return NextResponse.json({ error: "proposal_not_found" }, { status: 404 });
    }
    if (proposal.status !== "pending") {
      return NextResponse.json({ error: "proposal_already_decided" }, { status: 409 });
    }

    // Autoridade decisória é separada da administração operacional:
    // somente owner institucional RSBUILD ou owner do tenant pode decidir.
    const { data: isPlatformAdministrator } = await supabase.rpc("is_platform_administrator");
    const isPlatformAdmin = isPlatformAdministrator === true;

    let isTenantOwner = false;
    if (!isPlatformAdmin) {
      const { data: tenantMembership } = await supabase
        .from("organization_memberships")
        .select("role")
        .eq("user_id", user.id)
        .eq("organization_id", proposal.organization_id)
        .maybeSingle();
      isTenantOwner = tenantMembership?.role === "owner";
    }

    if (!isPlatformAdmin && !isTenantOwner) {
      await recordAuditEvent({
        organizationId: proposal.organization_id,
        actorId: user.id,
        actorEmail: user.email ?? null,
        eventType: "access.denied",
        entityType: "agent_action_proposal",
        entityId: proposalId,
        metadata: { reason: "insufficient_role", path: new URL(request.url).pathname }
      });
      return NextResponse.json({ error: "insufficient_role" }, { status: 403 });
    }

    const { data: updated, error: updateError } = await supabase
      .from("agent_action_proposals")
      .update({
        status: decision,
        decided_by: user.id,
        decided_at: new Date().toISOString(),
        decision_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq("id", proposalId)
      .eq("status", "pending")
      .select("id, status")
      .maybeSingle();

    if (updateError || !updated) {
      console.error(JSON.stringify({ event: "agent_proposal_decision_failed", code: updateError?.code }));
      return NextResponse.json({ error: "decision_failed" }, { status: 500 });
    }

    await recordAuditEvent({
      organizationId: proposal.organization_id,
      actorId: user.id,
      actorEmail: user.email ?? null,
      eventType: decision === "approved" ? "agent.proposal.approved" : "agent.proposal.rejected",
      entityType: "agent_action_proposal",
      entityId: proposalId,
      metadata: {
        agentId: proposal.agent_id,
        decisionReason: reason,
        governanceLayer: isPlatformAdmin ? "platform_admin" : "tenant_owner"
      }
    });

    return NextResponse.json({ success: true, status: updated.status }, {
      status: 200, headers: { "Cache-Control": "private, no-store" }
    });
  } catch (err: any) {
    console.error("Critical error in agent proposal decision:", err);
    return NextResponse.json({ error: "decision_error" }, { status: 500 });
  }
}
