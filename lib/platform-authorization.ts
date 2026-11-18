/**
 * RSBUILD OS authorization vocabulary.
 *
 * Organization roles are tenant-scoped. Platform authority is a separate
 * server-verified grant and must never be inferred from organization role.
 */
import type { MemberRole } from "@/lib/permissions";

export type PlatformRole = "platform_admin";
export type Environment = "production" | "qa" | "sandbox";
export type CapabilityStatus =
  | "blocked"
  | "granted"
  | "suspended"
  | "revoked";

export interface AuthorizationContext {
  userId: string;
  organizationId: string;
  organizationRole: MemberRole;
  environment: Environment;
  platformAdministrator: boolean;
}

/** QA organizations use an explicit _qa suffix (including alpha/beta lanes).
 * Sandbox is evaluated by its isolated schema and dedicated RPC, never here.
 */
export function resolveOrganizationEnvironment(slug: string): Environment {
  return /_qa(?:_|$)/i.test(slug) ? "qa" : "production";
}

export function isOrganizationOwner(role: MemberRole): boolean {
  return role === "owner";
}

export function canAdministerOrganization(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Access to the RSBUILD tenant workspace is granted by an explicit
 * membership in that organization. This is separate from platform-wide
 * administration and does not expose the internal sprint portfolio.
 */
export function canEnterOrganizationWorkspace(input: {
  organizationSlug: string;
  organizationRole?: MemberRole | null;
  platformAdministrator: boolean;
}): boolean {
  if (input.organizationSlug !== "rsbuild") return true;
  if (input.platformAdministrator) return true;
  return input.organizationRole === "owner"
    || input.organizationRole === "admin"
    || input.organizationRole === "operator";
}

/** Never infer this privilege from owner/admin membership. */
export function canAdministerPlatform(
  context: Pick<AuthorizationContext, "platformAdministrator">
): boolean {
  return context.platformAdministrator === true;
}

export function canManageCapabilityLicenses(
  context: Pick<AuthorizationContext, "platformAdministrator">
): boolean {
  return canAdministerPlatform(context);
}

export function isCapabilityUsable(input: {
  licenseStatus: CapabilityStatus;
  operationalStatus: "not_implemented" | "in_development" | "available" | "active";
  environment: Environment;
  entitledEnvironments: Environment[];
  expiresAt?: string | null;
  now?: Date;
}): boolean {
  const expiresAt = input.expiresAt ? Date.parse(input.expiresAt) : null;
  const notExpired = expiresAt === null
    || (Number.isFinite(expiresAt) && expiresAt > (input.now ?? new Date()).getTime());
  return input.licenseStatus === "granted"
    && input.operationalStatus === "active"
    && input.entitledEnvironments.includes(input.environment)
    && notExpired;
}
