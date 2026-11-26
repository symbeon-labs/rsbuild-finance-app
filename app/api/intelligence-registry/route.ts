import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret, maskKey } from "@/lib/erp-credentials";
import { recordAuditEvent } from "@/lib/api/audit";
import { consumeRateLimit } from "@/lib/api/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = ["agent", "llm", "decision_engine"] as const;
const PROVIDERS = ["openai", "anthropic", "google", "xai", "local", "custom", "internal", "mcp"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authorize(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return { user: null, error: "origin_forbidden" as const };
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { user: null, error: "unauthenticated" as const };
  if (!consumeRateLimit(`${user.id}:/api/intelligence-registry`)) return { user: null, error: "rate_limited" as const };
  const { data: allowed, error: rpcError } = await client.rpc("is_platform_administrator");
  if (rpcError || allowed !== true) return { user: null, error: "forbidden" as const };
  return { user, error: null };
}

function fail(error: string) {
  const status = error === "unauthenticated" ? 401 : error === "rate_limited" ? 429 : 403;
  return NextResponse.json({ error }, { status });
}

export async function GET(request: Request) {
  const access = await authorize(request);
  if (access.error || !access.user) return fail(access.error ?? "forbidden");
  const admin = createAdminClient();
  const { data, error } = await admin.from("intelligence_registry")
    .select("id,name,description,intelligence_type,provider,model,source_uri,runtime,config,credential_hint,status,created_at,updated_at")
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: "registry_unavailable" }, { status: 502 });
  return NextResponse.json({ items: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const access = await authorize(request);
  if (access.error || !access.user) return fail(access.error ?? "forbidden");
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim();
  const type = String(body.type ?? "");
  const provider = String(body.provider ?? "");
  const model = String(body.model ?? "").trim();
  const sourceUri = String(body.sourceUri ?? "").trim();
  const runtime = String(body.runtime ?? "").trim();
  const credential = String(body.credential ?? "").trim();
  const config = body.config && typeof body.config === "object" && !Array.isArray(body.config) ? body.config : {};

  if (name.length < 2 || name.length > 120 || description.length > 1000 ||
      !TYPES.includes(type as typeof TYPES[number]) ||
      !PROVIDERS.includes(provider as typeof PROVIDERS[number]) ||
      model.length > 160 || runtime.length > 120 || sourceUri.length > 2048 ||
      credential.length > 8192) {
    return NextResponse.json({ error: "invalid_registry_payload" }, { status: 400 });
  }
  if (sourceUri) {
    try {
      const parsed = new URL(sourceUri);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) throw new Error("invalid");
    } catch {
      return NextResponse.json({ error: "source_uri_must_be_https" }, { status: 400 });
    }
  }

  let encrypted: string | null = null;
  if (credential) {
    if (credential.length < 8) return NextResponse.json({ error: "credential_too_short" }, { status: 400 });
    try { encrypted = encryptSecret(credential); }
    catch { return NextResponse.json({ error: "encryption_unavailable" }, { status: 500 }); }
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: saved, error } = await admin.from("intelligence_registry").insert({
    name, description: description || null, intelligence_type: type, provider,
    model: model || null, source_uri: sourceUri || null, runtime: runtime || null,
    config, credential_encrypted: encrypted, credential_hint: credential ? maskKey(credential) : null,
    status: "registered", created_by: access.user.id, updated_by: access.user.id, updated_at: now
  }).select("id,name,description,intelligence_type,provider,model,source_uri,runtime,config,credential_hint,status,created_at,updated_at").single();

  if (error || !saved) return NextResponse.json({ error: "registry_save_failed" }, { status: 502 });
  const { data: rsbuild } = await admin.from("organizations").select("id").eq("slug", "rsbuild").maybeSingle();
  if (rsbuild?.id) await recordAuditEvent({
    organizationId: rsbuild.id, actorId: access.user.id, eventType: "intelligence.registered",
    entityType: "intelligence_registry", entityId: saved.id,
    metadata: { type, provider, name, hasCredential: Boolean(credential) }
  });
  return NextResponse.json({ ok: true, item: saved }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request) {
  const access = await authorize(request);
  if (access.error || !access.user) return fail(access.error ?? "forbidden");
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "invalid_registry_id" }, { status: 400 });
  const admin = createAdminClient();
  const { data: item, error } = await admin.from("intelligence_registry")
    .update({ status: "disabled", updated_by: access.user.id, updated_at: new Date().toISOString() })
    .eq("id", id).select("id,name,intelligence_type,provider").maybeSingle();
  if (error || !item) return NextResponse.json({ error: "registry_item_not_found" }, { status: 404 });
  const { data: rsbuild } = await admin.from("organizations").select("id").eq("slug", "rsbuild").maybeSingle();
  if (rsbuild?.id) await recordAuditEvent({
    organizationId: rsbuild.id, actorId: access.user.id, eventType: "intelligence.disabled",
    entityType: "intelligence_registry", entityId: id,
    metadata: { name: item.name, type: item.intelligence_type, provider: item.provider }
  });
  return NextResponse.json({ ok: true });
}
