import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/api/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MODES = ["internal", "beta", "contractual"] as const;
const ENVIRONMENTS = ["qa", "sandbox", "production"] as const;

async function authorize(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return { session: null, user: null, error: "origin_forbidden" as const };
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return { session: null, user: null, error: "unauthenticated" as const };
  if (!consumeRateLimit(`${user.id}:/api/intelligence-assignments`)) return { session: null, user: null, error: "rate_limited" as const };
  const { data: allowed, error: rpcError } = await session.rpc("is_platform_administrator");
  if (rpcError || allowed !== true) return { session: null, user: null, error: "forbidden" as const };
  return { session, user, error: null };
}

function fail(error: string) {
  const status = error === "unauthenticated" ? 401 : error === "rate_limited" ? 429 : error === "origin_forbidden" ? 403 : 403;
  return NextResponse.json({ error }, { status });
}

export async function GET(request: Request) {
  const access = await authorize(request);
  if (access.error || !access.user) return fail(access.error ?? "forbidden");
  const admin = createAdminClient();
  const [{ data: assignments, error }, { data: organizations }, { data: intelligences }] = await Promise.all([
    admin.from("intelligence_assignments")
      .select("id,intelligence_id,organization_id,status,access_mode,environments,expires_at,created_by,approved_by,approved_at,created_at,updated_at")
      .order("updated_at", { ascending: false }),
    admin.from("organizations").select("id,slug,display_name").order("display_name"),
    admin.from("intelligence_registry").select("id,name,intelligence_type,provider,status,legacy_agent_id").order("name")
  ]);
  if (error || !organizations || !intelligences) return NextResponse.json({ error: "assignments_unavailable" }, { status: 502 });
  return NextResponse.json({ assignments: assignments ?? [], organizations, intelligences }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const access = await authorize(request);
  if (access.error || !access.user || !access.session) return fail(access.error ?? "forbidden");
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  const intelligenceId = String(body.intelligenceId ?? "");
  const organizationId = String(body.organizationId ?? "");
  const accessMode = String(body.accessMode ?? "internal");
  const environments = body.environments;
  const expiresAtRaw = body.expiresAt ? String(body.expiresAt) : null;

  if (!UUID.test(intelligenceId) || !UUID.test(organizationId) ||
      !MODES.includes(accessMode as typeof MODES[number]) ||
      !Array.isArray(environments) || environments.length === 0 ||
      environments.some((value: unknown) => !ENVIRONMENTS.includes(String(value) as typeof ENVIRONMENTS[number])) ||
      (environments.includes("production") && accessMode !== "contractual")) {
    return NextResponse.json({ error: "invalid_assignment_payload" }, { status: 400 });
  }
  let expiresAt: string | null = null;
  if (expiresAtRaw) {
    const parsed = new Date(expiresAtRaw);
    if (!Number.isFinite(parsed.getTime()) || parsed.getTime() <= Date.now()) {
      return NextResponse.json({ error: "invalid_expiration" }, { status: 400 });
    }
    expiresAt = parsed.toISOString();
  }

  const { data, error } = await access.session.rpc("create_intelligence_assignment", {
    p_intelligence_id: intelligenceId,
    p_organization_id: organizationId,
    p_access_mode: accessMode,
    p_environments: [...new Set(environments)],
    p_expires_at: expiresAt
  });
  if (error) {
    const message = error.message || "";
    const status = error.code === "42501" ? 403 : error.code === "23503" ? 409 : error.code === "22023" ? 400 : 502;
    return NextResponse.json({ error: message.includes("registered_intelligence_required") ? "registered_intelligence_required" :
      message.includes("organization_not_found") ? "organization_not_found" :
      message.includes("qa_organization_required") ? "qa_organization_required" :
      message.includes("invalid_assignment_policy") ? "invalid_assignment_policy" :
      message.includes("audit_organization_missing") ? "audit_unavailable" : "assignment_save_failed" }, { status });
  }
  return NextResponse.json({ ok: true, assignmentId: data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request) {
  const access = await authorize(request);
  if (access.error || !access.user || !access.session) return fail(access.error ?? "forbidden");
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "invalid_assignment_id" }, { status: 400 });
  const { error } = await access.session.rpc("revoke_intelligence_assignment", { p_assignment_id: id });
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 502;
    return NextResponse.json({ error: error.message.includes("audit_organization_missing") ? "audit_unavailable" : "assignment_revoke_failed" }, { status });
  }
  return NextResponse.json({ ok: true });
}
