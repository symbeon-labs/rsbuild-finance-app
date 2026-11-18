# Executable Governance Architecture — RSBUILD OS

**Version:** 1.0 · **Status:** implementation proposal in code review

## Authority boundaries

- Symbeon platform authority is represented by an explicit, independently provisioned `platform_administrators` grant.
- RSBUILD `owner` and `admin` remain organization-scoped roles. They do not imply platform administration.
- Organization Owner can administer RSBUILD organization resources within existing organization policies.
- Platform administrators can manage capability licenses through the database authorization boundary.
- Workspace and environment access remains separately scoped.

## Implemented in this change

1. A fail-closed `platform_administrators` registry with revocation metadata.
2. A server-side `is_platform_administrator()` database predicate based on `auth.uid()`.
3. Capability-license RLS policies moved from RSBUILD organization owner to explicit platform administrators.
4. Capability-license mutations run through a narrowly scoped SECURITY DEFINER RPC with explicit platform-grant verification; direct authenticated DML on license and event tables is revoked.
5. Organization owners retain tenant-scoped access but cannot administer platform licenses. Platform administrators can inspect the minimal organization directory needed for licensing without receiving tenant membership or operational data access.
6. License records persist an explicit QA/Sandbox/Production allow-list and optional expiration. A grant without an environment is rejected.
7. Shared server-side guards enforce Finance, Reconciliation, Logistics and Audit entitlements on the corresponding operational API routes. QA vs Production is derived from the organization slug on the server.
8. Sandbox organizations are explicitly linked to their tenant identity. A narrow boolean RPC checks Sandbox entitlements without exposing license records or granting platform authority.
9. A dedicated /platform-admin route exposes the licensing controls only after server-side verification. Unit and pgTAP tests cover authority separation, mutation boundaries, expiry, environment scope and revocation.

## Bootstrap — mandatory before applying in production

The migration deliberately does not promote any current RSBUILD owner. Before enabling the new license-management path, Symbeon must verify the designated human administrator and insert their auth user UUID into `platform_administrators` through a trusted service-role / SQL administrative session. Record the approver and reason. Never bootstrap from client-supplied metadata, email claims, organization role or a browser request.

Example controlled bootstrap (execute manually only after identity verification):

```sql
insert into public.platform_administrators (user_id, granted_by, reason)
values ('<verified-auth-user-uuid>', '<approver-auth-user-uuid>', 'Initial Symbeon platform administrator bootstrap');
```

No automatic seed is intentional: an automatic grant to the RSBUILD owner would recreate the privilege escalation this change is designed to remove.

## Important integration boundary

The TypeScript predicate is a pure policy helper, not an authorization source. Runtime enforcement must query the database grant and entitlement server-side. The licensing record now stores an explicit environment allow-list and optional expiration; a granted license without an environment is rejected. Do not accept `platformAdministrator`, capability status, environment, organization ID or role from browser payloads as authoritative.

The shared guard is wired to the Finance, Reconciliation, Logistics and Audit operational routes, and the Sandbox API uses a separate narrow entitlement check. Other API surfaces that are not part of those four capability domains still require their own explicit capability mapping. The pure TypeScript helper remains a policy/test utility, never an authorization source. The initial Symbeon administrator is not provisioned by this migration.

## Deployment sequence

1. Review and merge only after SQL review.
2. Apply migration in staging.
3. Bootstrap at least one verified Symbeon platform administrator out-of-band.
4. Test positive and negative cases with two organizations and all three environments.
5. Verify current RSBUILD owner retains organization administration but cannot grant/revoke platform licenses.
6. Verify a platform administrator can grant/revoke licenses without gaining operational tenant membership.
7. Only then apply to production and update the platform access runbook.

## Required follow-up

- Audit remaining API surfaces and assign capability mappings where applicable.
- Define break-glass, MFA and periodic access review.
- Confirm the legal license/IP policy with counsel before external reliance.
