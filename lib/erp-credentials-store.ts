/**
 * RSBUILD OS · ERP Credentials Store (server-only)
 *
 * Resolve as credenciais Omie da organização:
 *   1. Primeiro busca no banco (`organization_erp_credentials`) via Service Role.
 *   2. Se não houver registro no banco, faz fallback para variáveis de ambiente
 *      (`OMIE_APP_KEY_<ORG_UUID>` ou `OMIE_APP_KEY`).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, maskKey } from "@/lib/erp-credentials";
import type { OmieCredentials } from "@/lib/omie-client";

export interface OrgOmieIntegrationSummary {
  provider: "omie";
  configured: boolean;
  source: "database" | "env" | "none";
  status: "configured" | "verified" | "error" | "disabled" | "not_configured";
  appKeyHint: string | null;
  lastVerifiedAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
}

export function resolveEnvOmieCredentials(organizationId: string): OmieCredentials | null {
  const orgSuffix = organizationId.toUpperCase().replace(/-/g, "_");
  const appKey = process.env[`OMIE_APP_KEY_${orgSuffix}`] ?? process.env["OMIE_APP_KEY"];
  const appSecret = process.env[`OMIE_APP_SECRET_${orgSuffix}`] ?? process.env["OMIE_APP_SECRET"];
  if (!appKey || !appSecret) return null;
  return { appKey, appSecret };
}

export async function resolveOrgOmieCredentials(organizationId: string): Promise<OmieCredentials | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("organization_erp_credentials")
      .select("app_key, app_secret_encrypted, status")
      .eq("organization_id", organizationId)
      .eq("provider", "omie")
      .maybeSingle();

    if (!error && data && data.status !== "disabled") {
      return {
        appKey: data.app_key,
        appSecret: decryptSecret(data.app_secret_encrypted),
      };
    }
  } catch (err) {
    console.error(JSON.stringify({ event: "rsbuild_erp_credentials_resolve_failed", organizationId, err: String(err) }));
  }

  return resolveEnvOmieCredentials(organizationId);
}

export async function getOrgOmieSummary(organizationId: string): Promise<OrgOmieIntegrationSummary> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("organization_erp_credentials")
      .select("app_key_hint, status, last_verified_at, last_error, updated_at")
      .eq("organization_id", organizationId)
      .eq("provider", "omie")
      .maybeSingle();

    if (!error && data) {
      return {
        provider: "omie",
        configured: data.status !== "disabled",
        source: "database",
        status: data.status,
        appKeyHint: data.app_key_hint,
        lastVerifiedAt: data.last_verified_at,
        lastError: data.last_error,
        updatedAt: data.updated_at,
      };
    }
  } catch (err) {
    console.error(JSON.stringify({ event: "rsbuild_erp_summary_read_failed", organizationId, err: String(err) }));
  }

  const envCreds = resolveEnvOmieCredentials(organizationId);
  if (envCreds) {
    return {
      provider: "omie",
      configured: true,
      source: "env",
      status: "configured",
      appKeyHint: maskKey(envCreds.appKey),
      lastVerifiedAt: null,
      lastError: null,
      updatedAt: null,
    };
  }

  return {
    provider: "omie",
    configured: false,
    source: "none",
    status: "not_configured",
    appKeyHint: null,
    lastVerifiedAt: null,
    lastError: null,
    updatedAt: null,
  };
}
