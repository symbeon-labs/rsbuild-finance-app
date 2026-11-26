import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret, maskKey } from "@/lib/erp-credentials";
import { consumeRateLimit } from "@/lib/api/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROVIDERS = ["openai", "anthropic", "google", "xai", "custom_api", "mcp"] as const;

async function authorizePlatformAdmin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return { session: null, user: null, error: "origin_forbidden" as const };
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return { user: null, error: "unauthenticated" as const };
  if (!consumeRateLimit(`${user.id}:/api/agent-integrations`)) return { user: null, error: "rate_limited" as const };
  const { data: allowed, error: rpcError } = await session.rpc("is_platform_administrator");
  if (rpcError || allowed !== true) return { user: null, error: "forbidden" as const };
  return { session, user, error: null };
}

function errorResponse(error: string) {
  const status = error === "unauthenticated" ? 401 : error === "rate_limited" ? 429 : error === "origin_forbidden" ? 403 : 403;
  return NextResponse.json({ error }, { status });
}

export async function GET(request: Request) {
  const access = await authorizePlatformAdmin(request);
  if (access.error || !access.user) return errorResponse(access.error ?? "forbidden");

  const admin = createAdminClient();
  const [{ data: grants, error: grantsError }, { data: integrations, error: integrationsError }, { data: agents }, { data: organizations }] = await Promise.all([
    admin.from("agent_organization_grants").select("id,agent_id,organization_id,capabilities,status,access_mode,entitled_environments,expires_at,created_at,updated_at").order("created_at", { ascending: false }),
    admin.from("agent_integrations").select("id,agent_id,organization_id,provider,display_name,endpoint_url,model,credential_hint,status,last_verified_at,last_error,updated_at").order("updated_at", { ascending: false }),
    admin.from("agents").select("id,slug,display_name,status,version").order("display_name"),
    admin.from("organizations").select("id,slug,display_name").order("display_name")
  ]);
  if (grantsError || integrationsError || !agents || !organizations) {
    return NextResponse.json({ error: "agent_integrations_unavailable" }, { status: 502 });
  }
  return NextResponse.json({
    grants: grants ?? [],
    integrations: integrations ?? [],
    agents: agents ?? [],
    organizations: organizations ?? []
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const access = await authorizePlatformAdmin(request);
  if (access.error || !access.user) return errorResponse(access.error ?? "forbidden");

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  const agentId = String(body.agentId ?? "");
  const organizationId = String(body.organizationId ?? "");
  const provider = String(body.provider ?? "");
  const displayName = String(body.displayName ?? "").trim();
  const endpointRaw = String(body.endpointUrl ?? "").trim();
  const model = String(body.model ?? "").trim();
  const credential = String(body.credential ?? "").trim();
  if (!UUID.test(agentId) || !UUID.test(organizationId) ||
      !PROVIDERS.includes(provider as typeof PROVIDERS[number]) ||
      displayName.length < 2 || displayName.length > 100 ||
      credential.length < 8 || credential.length > 8192 ||
      model.length > 120 || endpointRaw.length > 2048) {
    return NextResponse.json({ error: "invalid_integration_payload" }, { status: 400 });
  }

  let endpointUrl: string | null = null;
  if (endpointRaw) {
    try {
      const parsed = new URL(endpointRaw);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) throw new Error("invalid");
      endpointUrl = parsed.toString();
    } catch {
      return NextResponse.json({ error: "endpoint_must_be_https" }, { status: 400 });
    }
  }

  let encrypted: string;
  try { encrypted = encryptSecret(credential); }
  catch { return NextResponse.json({ error: "encryption_unavailable" }, { status: 500 }); }

  const admin = createAdminClient();
  const { data: integrationId, error: saveError } = await access.session!.rpc("save_agent_integration", {
    p_agent_id: agentId,
    p_organization_id: organizationId,
    p_provider: provider,
    p_display_name: displayName,
    p_endpoint_url: endpointUrl,
    p_model: model || null,
    p_credential_encrypted: encrypted,
    p_credential_hint: maskKey(credential)
  });
  if (saveError || !integrationId) {
    const status = saveError?.code === "42501" ? 403 : saveError?.code === "22023" ? 400 : 502;
    const message = saveError?.message || "";
    return NextResponse.json({ error: message.includes("active_intelligence_assignment_required") ? "active_intelligence_assignment_required" :
      message.includes("audit_organization_missing") ? "audit_unavailable" : "agent_integration_save_failed" }, { status });
  }
  const admin = createAdminClient();
  const { data: saved, error: readError } = await admin.from("agent_integrations")
    .select("id,agent_id,organization_id,provider,display_name,endpoint_url,model,credential_hint,status,last_verified_at,last_error,updated_at")
    .eq("id", integrationId).single();
  if (readError || !saved) return NextResponse.json({ error: "agent_integration_readback_failed" }, { status: 502 });

  return NextResponse.json({ ok: true, integration: saved }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request) {
  const access = await authorizePlatformAdmin(request);
  if (access.error || !access.user) return errorResponse(access.error ?? "forbidden");
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "invalid_integration_id" }, { status: 400 });

  const { error } = await access.session!.rpc("disable_agent_integration", { p_integration_id: id });
  if (error) return NextResponse.json({ error: error.code === "P0002" ? "integration_not_found" :
    error.message.includes("audit_organization_missing") ? "audit_unavailable" : "integration_disable_failed" },
    { status: error.code === "P0002" ? 404 : error.code === "42501" ? 403 : 502 });
  return NextResponse.json({ ok: true });
}
