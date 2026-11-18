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

export function isOrganizationOwner(role: MemberRole): boolean {
  return role === "owner";
}

export function canAdministerOrganization(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
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
}): boolean {
  return input.licenseStatus === "granted"
    && input.operationalStatus === "active"
    && input.entitledEnvironments.includes(input.environment);
}
