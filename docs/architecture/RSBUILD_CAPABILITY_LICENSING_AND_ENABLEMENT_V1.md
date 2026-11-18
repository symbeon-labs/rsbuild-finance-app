# RSBUILD OS — Capability Licensing & Enablement v1.0

## Purpose

Establish a centrally governed entitlement layer. Capability availability is granted per organization by the RSBUILD institutional owner. Tenant administrators may configure operational use only after an entitlement has been granted; they cannot grant, suspend, or revoke entitlements.

## Authority model

- **RSBUILD owner:** sole authority to grant, suspend, or revoke an organization's capability entitlement.
- **RSBUILD admin/operator:** may view institutional information according to existing access rules; cannot mutate capability entitlements.
- **Tenant admin:** may configure a granted capability within that tenant, subject to its operational state and existing RBAC.
- **Tenant operator/contributor/viewer:** access remains controlled by existing module and resource permissions.

The entitlement layer must never elevate a user's membership role or grant access to tenant financial data.

## Independent state dimensions

Each organization/capability pair has two independent state dimensions:

### License status
- `blocked`: no authorization has been granted.
- `granted`: RSBUILD has authorized the organization to use the capability.
- `suspended`: authorization is temporarily disabled.
- `revoked`: authorization has been withdrawn.

### Operational status
- `not_implemented`: capability is not implemented.
- `in_development`: implementation is in progress.
- `available`: implementation is ready for tenant configuration.
- `active`: tenant has activated the capability for use.

A capability is usable only when license status is `granted` and operational status is `active`. The catalog entry alone never grants entitlement.

## Persistence model

- `capability_catalog`: canonical list of platform capabilities.
- `organization_capability_licenses`: current entitlement and operational state for each organization/capability pair.
- `capability_license_events`: append-only audit trail of grant, suspension, revocation, and state changes.

No tenant entitlements are seeded by default. Existing frontend presets are not authoritative and must not be used as authorization evidence.

## Security invariants

1. RLS is enabled on all three tables.
2. Authenticated users may read the catalog.
3. Organization members may read only their organization's license rows.
4. Only a user with the `owner` membership role in the organization whose slug is `rsbuild` may mutate license rows or read/append institutional license events.
5. There is intentionally no update/delete policy for the event log.
6. No `service_role` credential may be exposed to the browser.
7. License checks must be enforced server-side and in database policies at protected operation boundaries; hiding a menu item is not authorization.
8. Granting a capability never changes memberships, roles, project scopes, or RLS policies for tenant data.

## Lifecycle

1. Owner selects an organization and a capability.
2. Owner grants, suspends, or revokes the entitlement and records a reason.
3. The event is recorded with actor, timestamp, and before/after state.
4. The tenant workspace reads the authoritative entitlement state.
5. If granted and operationally available, a tenant administrator may activate it.
6. Revocation/suspension blocks new use; data is retained and existing records are not deleted.

## Initial catalog

- `finance` — Finanças & Caixa
- `reconciliation` — Reconciliação & Baixas
- `logistics` — Logística & Expedição
- `audit` — Auditoria & Governança

## Implementation status

This change introduces the persistence and policy foundation only. It does not yet connect the workspace UI, server-side entitlement checks, or module activation flows. The migration must be reviewed and applied through the normal database migration and homologation process before the feature is considered operational.
