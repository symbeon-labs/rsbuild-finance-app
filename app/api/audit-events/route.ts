import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/api/org-guard";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

type AuditCursor = { occurredAt: string; id: number };

function decodeCursor(value: string | null): AuditCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<AuditCursor>;
    if (
      typeof parsed.occurredAt !== "string" ||
      !Number.isFinite(Date.parse(parsed.occurredAt)) ||
      !Number.isSafeInteger(parsed.id) ||
      Number(parsed.id) <= 0
    ) return null;
    return { occurredAt: parsed.occurredAt, id: Number(parsed.id) };
  } catch {
    return null;
  }
}

function encodeCursor(cursor: AuditCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const organizationId = params.get("organizationId") ?? "";
  const requestedSize = Number(params.get("limit") ?? DEFAULT_PAGE_SIZE);
  if (!Number.isInteger(requestedSize) || requestedSize < 1 || requestedSize > MAX_PAGE_SIZE) {
    return NextResponse.json({ error: "invalid_limit" }, { status: 400 });
  }

  const cursorValue = params.get("cursor");
  const cursor = decodeCursor(cursorValue);
  if (cursorValue && !cursor) {
    return NextResponse.json({ error: "invalid_cursor" }, { status: 400 });
  }

  const guard = await requireOrgContext(request, organizationId, ["owner", "admin", "operator", "viewer"], "audit");
  if (!guard.ok) return guard.response;
  const { supabase } = guard.ctx;

  let query = supabase
    .from("audit_events")
    .select("id, actor_id, event_type, entity_type, entity_id, occurred_at, metadata")
    .eq("organization_id", organizationId)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(requestedSize + 1);

  if (cursor) {
    query = query.or(
      `occurred_at.lt.${cursor.occurredAt},and(occurred_at.eq.${cursor.occurredAt},id.lt.${cursor.id})`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error(JSON.stringify({ event: "audit_events_read_failed", organizationId, code: error.code }));
    return NextResponse.json({ error: "audit_events_unavailable" }, { status: 502 });
  }

  const rows = data ?? [];
  const hasMore = rows.length > requestedSize;
  const page = hasMore ? rows.slice(0, requestedSize) : rows;
  const last = page.at(-1);
  const nextCursor = hasMore && last
    ? encodeCursor({ occurredAt: last.occurred_at, id: Number(last.id) })
    : null;

  const events = page.map((row: any) => ({
    id: row.id,
    actorId: row.actor_id,
    actorEmail: row.metadata?.actorEmail ?? null,
    eventType: row.event_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    occurredAt: row.occurred_at,
    metadata: row.metadata ?? {}
  }));

  return NextResponse.json({ events, count: events.length, hasMore, nextCursor }, {
    status: 200, headers: { "Cache-Control": "private, no-store" }
  });
}
