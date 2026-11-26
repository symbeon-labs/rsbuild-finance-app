import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret, maskKey } from "@/lib/erp-credentials";
import { recordAuditEvent } from "@/lib/api/audit";
import { consumeRateLimit } from "@/lib/api/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROVIDERS = ["openai", "anthropic", "google", "xai", "custom_api", "mcp"] as const;
const MODES = ["internal", "beta", "contractual"] as const;
const ENVIRONMENTS = ["qa", "sandbox", "production"] as const;

async function authorizePlatformAdmin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return { user: null, error: "origin_forbidden" as const };
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return { user: null, error: "unauthenticated" as const };
  if (!consumeRateLimit(`${user.id}:/api/agent-integrations`)) return { user: null, error: "rate_limited" as const };
  const { data: allowed, error: rpcError } = await session.rpc("is_platform_administrator");
  if (rpcError || allowed !== true) return { user: null, error: "forbidden" as const };
  return { user, error: null };
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
  const accessMode = String(body.accessMode ?? "internal");
  const environments = body.environments;
  const expiresAt = body.expiresAt ? String(body.expiresAt) : null;

  if (!UUID.test(agentId) || !UUID.test(organizationId) ||
      !PROVIDERS.includes(provider as typeof PROVIDERS[number]) ||
      !MODES.includes(accessMode as typeof MODES[number]) ||
      !Array.isArray(environments) || environments.length === 0 ||
      environments.some((env: unknown) => !ENVIRONMENTS.includes(String(env) as typeof ENVIRONMENTS[number])) ||
      (environments.includes("production") && accessMode !== "contractual") ||
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

  let expiresAtIso: string | null = null;
  if (expiresAt) {
    const parsed = new Date(expiresAt);
    if (!Number.isFinite(parsed.getTime())) return NextResponse.json({ error: "invalid_expiration" }, { status: 400 });
    expiresAtIso = parsed.toISOString();
  }

  let encrypted: string;
  try { encrypted = encryptSecret(credential); }
  catch { return NextResponse.json({ error: "encryption_unavailable" }, { status: 500 }); }

  const admin = createAdminClient();
  const { data: grant, error: grantError } = await admin
    .from("agent_organization_grants")
    .select("id,status,expires_at")
    .eq("agent_id", agentId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (grantError || !grant || grant.status !== "active" ||
      (grant.expires_at && new Date(grant.expires_at).getTime() <= Date.now())) {
    return NextResponse.json({ error: "active_agent_grant_required" }, { status: 409 });
  }

  const { data: agent, error: agentError } = await admin.from("agents")
    .select("status").eq("id", agentId).maybeSingle();
  if (agentError || !agent || agent.status !== "active") {
    return NextResponse.json({ error: "active_agent_required" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { data: saved, error: saveError } = await admin.from("agent_integrations").upsert({
    agent_id: agentId,
    organization_id: organizationId,
    provider,
    display_name: displayName,
    endpoint_url: endpointUrl,
    model: model || null,
    credential_encrypted: encrypted,
    credential_hint: maskKey(credential),
    status: "configured",
    last_error: null,
    updated_by: access.user.id,
    updated_at: now,
    created_by: access.user.id
  }, { onConflict: "agent_id,organization_id,provider" })
    .select("id,agent_id,organization_id,provider,display_name,endpoint_url,model,credential_hint,status,last_verified_at,last_error,updated_at")
    .single();

  if (saveError || !saved) return NextResponse.json({ error: "agent_integration_save_failed" }, { status: 502 });

  // Expand or change the agent grant only after the encrypted connection is stored.
  // If the grant update fails, disable the new connection so access remains fail-closed.
  const { error: grantUpdateError } = await admin.from("agent_organization_grants").update({
    access_mode: accessMode,
    entitled_environments: [...new Set(environments)],
    expires_at: expiresAtIso,
    updated_at: now
  }).eq("id", grant.id);
  if (grantUpdateError) {
    await admin.from("agent_integrations").update({ status: "disabled", updated_by: access.user.id, updated_at: new Date().toISOString() }).eq("id", saved.id);
    return NextResponse.json({ error: "agent_grant_update_failed" }, { status: 502 });
  }

  const { data: rsbuild } = await admin.from("organizations").select("id").eq("slug", "rsbuild").maybeSingle();
  if (rsbuild?.id) {
    await recordAuditEvent({
      organizationId: rsbuild.id,
      actorId: access.user.id,
      eventType: "agent.integration.configured",
      entityType: "agent_integration",
      entityId: saved.id,
      metadata: { agentId, organizationId, provider, accessMode, environments: [...new Set(environments)], credentialHint: maskKey(credential) }
    });
  }

  return NextResponse.json({ ok: true, integration: saved }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request) {
  const access = await authorizePlatformAdmin(request);
  if (access.error || !access.user) return errorResponse(access.error ?? "forbidden");
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "invalid_integration_id" }, { status: 400 });

  const admin = createAdminClient();
  const { data: existing, error: readError } = await admin.from("agent_integrations")
    .select("id,agent_id,organization_id,provider").eq("id", id).maybeSingle();
  if (readError || !existing) return NextResponse.json({ error: "integration_not_found" }, { status: 404 });

  const { error } = await admin.from("agent_integrations").update({
    status: "disabled", updated_by: access.user.id, updated_at: new Date().toISOString()
  }).eq("id", id);
  if (error) return NextResponse.json({ error: "integration_disable_failed" }, { status: 502 });

  const { data: rsbuild } = await admin.from("organizations").select("id").eq("slug", "rsbuild").maybeSingle();
  if (rsbuild?.id) {
    await recordAuditEvent({
      organizationId: rsbuild.id, actorId: access.user.id,
      eventType: "agent.integration.disabled", entityType: "agent_integration", entityId: id,
      metadata: { agentId: existing.agent_id, organizationId: existing.organization_id, provider: existing.provider }
    });
  }
  return NextResponse.json({ ok: true });
}
