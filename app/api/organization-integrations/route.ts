/**
 * /api/organization-integrations
 *
 * Gerencia credenciais de integração ERP (Omie) por organização.
 * Somente Owner, Admin ou Platform Admin podem consultar, salvar, testar ou remover.
 * Segredos (app_secret) são criptografados no servidor e NUNCA retornados ao cliente.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAuditEvent } from "@/lib/api/audit";
import { encryptSecret, maskKey } from "@/lib/erp-credentials";
import { getOrgOmieSummary, resolveOrgOmieCredentials } from "@/lib/erp-credentials-store";
import { listReceivableTitles, OmieClientError } from "@/lib/omie-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authorizeAdmin(organizationId: string) {
  if (!UUID.test(organizationId)) {
    return { user: null, error: "invalid_organization" as const };
  }
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) {
    return { user: null, error: "unauthenticated" as const };
  }
  const { data: membership } = await session
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: platformAdmin } = await session.rpc("is_platform_administrator");
  const canAdmin = ["owner", "admin"].includes(membership?.role ?? "") || platformAdmin === true;
  if (!canAdmin) {
    return { user: null, error: "forbidden" as const };
  }
  return { user, error: null };
}

export async function GET(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
  const access = await authorizeAdmin(organizationId);
  if (access.error) {
    return NextResponse.json(
      { error: access.error },
      { status: access.error === "unauthenticated" ? 401 : 403 }
    );
  }

  const omie = await getOrgOmieSummary(organizationId);
  return NextResponse.json(
    { integrations: [omie] },
    { status: 200, headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function PUT(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const organizationId = String(body.organizationId ?? "");
  const access = await authorizeAdmin(organizationId);
  if (access.error || !access.user) {
    return NextResponse.json(
      { error: access.error },
      { status: access.error === "unauthenticated" ? 401 : 403 }
    );
  }

  const provider = String(body.provider ?? "omie");
  if (provider !== "omie") {
    return NextResponse.json({ error: "unsupported_provider" }, { status: 400 });
  }

  const appKey = String(body.appKey ?? "").trim();
  const appSecret = String(body.appSecret ?? "").trim();
  const shouldTest = body.testConnection !== false;

  if (appKey.length < 4 || appSecret.length < 4) {
    return NextResponse.json(
      { error: "invalid_credentials", detail: "Informe App Key e App Secret válidos." },
      { status: 400 }
    );
  }

  let status: "configured" | "verified" | "error" = "configured";
  let lastVerifiedAt: string | null = null;
  let lastError: string | null = null;

  if (shouldTest) {
    try {
      await listReceivableTitles({ appKey, appSecret }, { nPagina: 1, nRegPorPagina: 1 });
      status = "verified";
      lastVerifiedAt = new Date().toISOString();
    } catch (err) {
      const detail = err instanceof OmieClientError ? err.message : "Falha ao validar credenciais na API Omie.";
      return NextResponse.json(
        { error: "omie_verification_failed", detail },
        { status: 422 }
      );
    }
  }

  let encryptedSecret: string;
  try {
    encryptedSecret = encryptSecret(appSecret);
  } catch (err) {
    return NextResponse.json(
      { error: "encryption_unavailable", detail: err instanceof Error ? err.message : "Falha de criptografia." },
      { status: 500 }
    );
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error: upsertError } = await admin.from("organization_erp_credentials").upsert(
    {
      organization_id: organizationId,
      provider: "omie",
      app_key: appKey,
      app_secret_encrypted: encryptedSecret,
      app_key_hint: maskKey(appKey),
      status,
      last_verified_at: lastVerifiedAt,
      last_error: lastError,
      updated_by: access.user.id,
      updated_at: now,
    },
    { onConflict: "organization_id,provider" }
  );

  if (upsertError) {
    console.error(JSON.stringify({ event: "rsbuild_erp_credentials_save_failed", organizationId, code: upsertError.code }));
    return NextResponse.json({ error: "integration_save_failed" }, { status: 502 });
  }

  await recordAuditEvent({
    organizationId,
    actorId: access.user.id,
    actorEmail: access.user.email ?? "",
    eventType: "integration.omie_configured",
    entityType: "organization_erp_credentials",
    entityId: `${organizationId}:omie`,
    metadata: { status, appKeyHint: maskKey(appKey) },
  });

  const omie = await getOrgOmieSummary(organizationId);
  return NextResponse.json({ ok: true, integration: omie }, { status: 200 });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const organizationId = String(body?.organizationId ?? "");
  const access = await authorizeAdmin(organizationId);
  if (access.error || !access.user) {
    return NextResponse.json(
      { error: access.error },
      { status: access.error === "unauthenticated" ? 401 : 403 }
    );
  }

  const credentials = await resolveOrgOmieCredentials(organizationId);
  if (!credentials) {
    return NextResponse.json(
      { error: "omie_credentials_not_configured", detail: "Nenhuma credencial Omie configurada para testar." },
      { status: 404 }
    );
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  try {
    const res = await listReceivableTitles(credentials, { nPagina: 1, nRegPorPagina: 1 });
    await admin
      .from("organization_erp_credentials")
      .update({ status: "verified", last_verified_at: now, last_error: null, updated_at: now })
      .eq("organization_id", organizationId)
      .eq("provider", "omie");

    const omie = await getOrgOmieSummary(organizationId);
    return NextResponse.json({
      ok: true,
      totalRecords: res.totalRecords,
      integration: omie,
    });
  } catch (err) {
    const detail = err instanceof OmieClientError ? err.message : "Erro ao conectar com a API Omie.";
    await admin
      .from("organization_erp_credentials")
      .update({ status: "error", last_error: detail.slice(0, 500), updated_at: now })
      .eq("organization_id", organizationId)
      .eq("provider", "omie");

    return NextResponse.json({ error: "omie_verification_failed", detail }, { status: 422 });
  }
}

export async function DELETE(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId") ?? "";
  const access = await authorizeAdmin(organizationId);
  if (access.error || !access.user) {
    return NextResponse.json(
      { error: access.error },
      { status: access.error === "unauthenticated" ? 401 : 403 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("organization_erp_credentials")
    .delete()
    .eq("organization_id", organizationId)
    .eq("provider", "omie");

  if (error) {
    return NextResponse.json({ error: "integration_delete_failed" }, { status: 502 });
  }

  await recordAuditEvent({
    organizationId,
    actorId: access.user.id,
    actorEmail: access.user.email ?? "",
    eventType: "integration.omie_removed",
    entityType: "organization_erp_credentials",
    entityId: `${organizationId}:omie`,
    metadata: {},
  });

  const omie = await getOrgOmieSummary(organizationId);
  return NextResponse.json({ ok: true, integration: omie });
}
