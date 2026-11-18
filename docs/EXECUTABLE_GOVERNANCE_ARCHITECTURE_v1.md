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
4. Capability-license RPC authorization moved to the same platform boundary.
5. TypeScript authorization vocabulary and unit tests proving that organization ownership does not imply platform authority.
6. Capability-use predicate requiring a granted license, active implementation and explicit environment entitlement.

## Bootstrap — mandatory before applying in production

The migration deliberately does not promote any current RSBUILD owner. Before enabling the new license-management path, Symbeon must verify the designated human administrator and insert their auth user UUID into `platform_administrators` through a trusted service-role / SQL administrative session. Record the approver and reason. Never bootstrap from client-supplied metadata, email claims, organization role or a browser request.

Example controlled bootstrap (execute manually only after identity verification):

```sql
insert into public.platform_administrators (user_id, granted_by, reason)
values ('<verified-auth-user-uuid>', '<approver-auth-user-uuid>', 'Initial Symbeon platform administrator bootstrap');
```

No automatic seed is intentional: an automatic grant to the RSBUILD owner would recreate the privilege escalation this change is designed to remove.

## Important integration boundary

The TypeScript predicate is a pure policy helper, not an authorization source. Runtime enforcement must query the database grant and entitlement server-side. Do not accept `platformAdministrator`, capability status, environment, organization ID or role from browser payloads as authoritative.

All capability-protected API routes and server actions must call a shared server-side guard before data access or mutation. This PR establishes the database authority boundary for licensing administration; it does not yet retrofit every module route or provision the initial Symbeon administrator.

## Deployment sequence

1. Review and merge only after SQL review.
2. Apply migration in staging.
3. Bootstrap at least one verified Symbeon platform administrator out-of-band.
4. Test positive and negative cases with two organizations and all three environments.
5. Verify current RSBUILD owner retains organization administration but cannot grant/revoke platform licenses.
6. Verify a platform administrator can grant/revoke licenses without gaining operational tenant membership.
7. Only then apply to production and update the platform access runbook.

## Required follow-up

- Add environment scope and validity window to entitlement records if not already modeled elsewhere.
- Centralize capability enforcement in all protected API routes.
- Add pgTAP tests for platform administrator isolation and license lifecycle.
- Define break-glass, MFA and periodic access review.
- Confirm the legal license/IP policy with counsel before external reliance.
