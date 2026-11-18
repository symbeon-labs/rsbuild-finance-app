import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordAuditEvent } from "@/lib/api/audit";
import { consumeRateLimit } from "@/lib/api/rate-limit";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type OrgRole = "owner" | "admin" | "operator" | "viewer";
export type CapabilityKey = "finance" | "reconciliation" | "logistics" | "audit";
export type CapabilityEnvironment = "qa" | "sandbox" | "production";

export type OrgContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  userEmail: string;
  role: OrgRole;
};

export type GuardResult =
  | { ok: true; ctx: OrgContext }
  | { ok: false; response: NextResponse };

function deny(status: number, error: string): GuardResult {
  return { ok: false, response: NextResponse.json({ error }, { status }) };
}

/**
 * Guard comum das rotas de dados operacionais:
 * - rejeita origem cruzada
 * - exige sessão autenticada
 * - valida UUID da organização
 * - exige membership e, opcionalmente, um dos papéis permitidos
 * - quando solicitado, valida entitlement de capacidade e ambiente no banco
 */
export async function requireOrgContext(
  request: Request,
  organizationId: string,
  allowedRoles: OrgRole[] = ["owner", "admin", "operator", "viewer"],
  requiredCapability?: CapabilityKey
): Promise<GuardResult> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return deny(403, "origin_forbidden");
  }
  if (!UUID_PATTERN.test(organizationId)) {
    return deny(400, "invalid_organization");
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return deny(401, "unauthenticated");

  const pathname = new URL(request.url).pathname;
  if (!consumeRateLimit(`${user.id}:${pathname}`)) {
    return deny(429, "rate_limited");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("role, organizations!inner(slug)")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    await recordAuditEvent({
      organizationId,
      actorId: user.id,
      actorEmail: user.email ?? null,
      eventType: "access.denied",
      entityType: "organization",
      entityId: organizationId,
      metadata: { reason: "organization_access_denied", path: new URL(request.url).pathname, method: request.method }
    });
    return deny(403, "organization_access_denied");
  }
  const role = membership.role as OrgRole;
  if (!allowedRoles.includes(role)) {
    await recordAuditEvent({
      organizationId,
      actorId: user.id,
      actorEmail: user.email ?? null,
      eventType: "access.denied",
      entityType: "organization",
      entityId: organizationId,
      metadata: { reason: "insufficient_role", requiredRoles: allowedRoles, actualRole: role, path: new URL(request.url).pathname, method: request.method }
    });
    return deny(403, "insufficient_role");
  }

  if (requiredCapability) {
    // This guard protects public-schema production tenant routes.
    // Sandbox routes use a separate RPC and an explicit sandbox entitlement check.
    // QA is not exposed through this route family yet.
    const environment: CapabilityEnvironment = "production";

    const { data: entitlement, error: entitlementError } = await supabase
      .from("organization_capability_licenses")
      .select("license_status, operational_status, entitled_environments, expires_at")
      .eq("organization_id", organizationId)
      .eq("capability_key", requiredCapability)
      .maybeSingle();

    if (entitlementError) {
      console.error(JSON.stringify({
        event: "capability_entitlement_lookup_failed",
        organizationId,
        capability: requiredCapability,
        code: entitlementError.code
      }));
      return deny(503, "capability_entitlement_unavailable");
    }

    const expiry = entitlement?.expires_at ? Date.parse(entitlement.expires_at) : null;
    const validUntil = expiry === null || (Number.isFinite(expiry) && expiry > Date.now());
    const allowed = entitlement?.license_status === "granted"
      && entitlement.operational_status === "active"
      && Array.isArray(entitlement.entitled_environments)
      && entitlement.entitled_environments.includes(environment)
      && validUntil;

    if (!allowed) {
      await recordAuditEvent({
        organizationId,
        actorId: user.id,
        actorEmail: user.email ?? null,
        eventType: "access.denied",
        entityType: "capability",
        entityId: null,
        metadata: {
          reason: "capability_not_entitled",
          capability: requiredCapability,
          environment,
          path: pathname,
          method: request.method
        }
      });
      return deny(403, "capability_not_entitled");
    }
  }

  return { ok: true, ctx: { supabase, userId: user.id, userEmail: user.email ?? "", role } };
}
