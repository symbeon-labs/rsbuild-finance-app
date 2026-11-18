import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/api/org-guard";

export const dynamic = "force-dynamic";

const MAX_EVENTS = 300;

export async function GET(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  const guard = await requireOrgContext(request, organizationId, ["owner", "admin", "operator", "viewer"], "audit");
  if (!guard.ok) return guard.response;
  const { supabase } = guard.ctx;

  const { data, error } = await supabase
    .from("audit_events")
    .select("id, actor_id, event_type, entity_type, entity_id, occurred_at, metadata")
    .eq("organization_id", organizationId)
    .order("occurred_at", { ascending: false })
    .limit(MAX_EVENTS);

  if (error) {
    console.error(JSON.stringify({ event: "audit_events_read_failed", organizationId, code: error.code }));
    return NextResponse.json({ error: "audit_events_unavailable" }, { status: 502 });
  }

  const events = (data ?? []).map((row: any) => ({
    id: row.id,
    actorId: row.actor_id,
    actorEmail: row.metadata?.actorEmail ?? null,
    eventType: row.event_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    occurredAt: row.occurred_at,
    metadata: row.metadata ?? {}
  }));

  return NextResponse.json({ events, count: events.length }, {
    status: 200, headers: { "Cache-Control": "private, no-store" }
  });
}
