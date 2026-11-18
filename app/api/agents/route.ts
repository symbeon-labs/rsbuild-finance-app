import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Agent Governance API — console técnico com registro, escopos e fila HITL.
 * Restrito ao owner institucional RSBUILD. Administradores e operadores
 * recebem apenas a visão institucional sanitizada no frontend.
 */
export async function GET(request: Request) {
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
    if (!consumeRateLimit(`${user.id}:/api/agents`)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const { data: membership, error: membershipError } = await supabase
      .from("organization_memberships")
      .select("role, organizations!inner(slug)")
      .eq("user_id", user.id)
      .eq("organizations.slug", "rsbuild")
      .maybeSingle();

    if (membershipError || !membership || membership.role !== "owner") {
      return NextResponse.json({ error: "agents_forbidden" }, { status: 403 });
    }

    const [agentsRes, grantsRes, proposalsRes, orgsRes] = await Promise.all([
      supabase.from("agents").select("*").order("display_name"),
      supabase.from("agent_organization_grants").select("*").limit(1000),
      supabase.from("agent_action_proposals")
        .select("*")
        .order("requested_at", { ascending: false })
        .limit(200),
      supabase.from("organizations").select("id, slug, display_name").limit(500)
    ]);

    const firstError = [agentsRes, grantsRes, proposalsRes, orgsRes].find((r) => r.error);
    if (firstError?.error) {
      console.error(JSON.stringify({ event: "agents_query_failed", code: firstError.error.code }));
      return NextResponse.json({ error: "agents_unavailable" }, { status: 502 });
    }

    const orgName = new Map((orgsRes.data ?? []).map((o: any) => [o.id, o.display_name]));
    const agentName = new Map((agentsRes.data ?? []).map((a: any) => [a.id, a.display_name]));

    return NextResponse.json({
      agents: (agentsRes.data ?? []).map((a: any) => ({
        id: a.id,
        slug: a.slug,
        displayName: a.display_name,
        description: a.description,
        kind: a.kind,
        status: a.status,
        version: a.version,
        capabilities: a.capabilities ?? [],
        protocol: a.protocol,
        createdAt: a.created_at
      })),
      grants: (grantsRes.data ?? []).map((g: any) => ({
        id: g.id,
        agentId: g.agent_id,
        agentName: agentName.get(g.agent_id) ?? null,
        organizationId: g.organization_id,
        organizationName: orgName.get(g.organization_id) ?? null,
        capabilities: g.capabilities ?? [],
        status: g.status,
        createdAt: g.created_at
      })),
      proposals: (proposalsRes.data ?? []).map((p: any) => ({
        id: p.id,
        agentId: p.agent_id,
        agentName: agentName.get(p.agent_id) ?? null,
        organizationId: p.organization_id,
        organizationName: orgName.get(p.organization_id) ?? null,
        actionType: p.action_type,
        title: p.title,
        summary: p.summary,
        payload: p.payload ?? {},
        status: p.status,
        requestedAt: p.requested_at,
        decidedBy: p.decided_by,
        decidedAt: p.decided_at,
        decisionReason: p.decision_reason,
        executedAt: p.executed_at
      })),
      role: membership.role
    }, {
      status: 200,
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (err: any) {
    console.error("Critical error in /api/agents:", err);
    return NextResponse.json({ error: "agents_error" }, { status: 500 });
  }
}
