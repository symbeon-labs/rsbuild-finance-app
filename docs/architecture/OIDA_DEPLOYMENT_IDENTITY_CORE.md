# OIDA-01 — Deployment Identity Core

**Status:** Contract proposal  
**Scope:** RSBUILD Finance App  
**Target:** one application codebase, independently configured deployments  
**Change class:** documentation and declarative examples only

## 1. Purpose

Define the minimum deployment identity contract that allows the same product code to run as either:

- **standalone:** a customer-owned runtime with its own authentication, database, storage, secrets, and release lifecycle;
- **managed_shared:** a runtime operated within an explicitly managed multi-organization environment.

The deployment identity is configuration, not authorization. A manifest must never grant a user access, bypass membership checks, or replace database row-level security.

## 2. Architectural boundaries

### Product runtime

Contains domain capabilities such as finance, reconciliation, logistics, and audit. Runtime code must consume a validated deployment context and must not infer customer identity from hard-coded organization slugs.

### Control plane

Contains RSBUILD-only portfolio functions: cross-tenant directory, institutional administration, project grants, and centralized governance. It is optional to the customer runtime.

A standalone deployment MUST NOT require:
- an organization with slug `rsbuild`;
- access to the RSBUILD Access Directory;
- an RSBUILD platform-administrator RPC;
- a central Supabase service-role or secret key.

### Customer infrastructure

Each standalone deployment owns its Supabase project, Auth configuration, Storage buckets, secrets, backups, and operational domain. A deployment may use a managed provider, but credentials and data boundaries remain deployment-specific.

## 3. Manifest contract

Canonical schema: `deployment/manifest.schema.json`.

Required top-level fields:

| Field | Meaning |
|---|---|
| `schemaVersion` | Version of this manifest contract |
| `deploymentId` | Stable, deployment-unique identifier |
| `mode` | `standalone` or `managed_shared` |
| `identity` | Organization slug and display name |
| `controlPlane` | Explicit control-plane mode |
| `capabilities` | Declared product capability switches |
| `infrastructure` | Environment-variable names for infrastructure configuration |
| `release` | Release channel |

The manifest contains environment-variable **names**, never secret values. It is safe to commit example manifests only when they contain no credentials, access tokens, customer data, or live project identifiers.

## 4. Security invariants

1. The manifest is not an authorization source. Membership, roles, entitlements, and resource ownership remain server-validated.
2. A requested organization ID is never trusted without checking the authenticated user's membership.
3. Standalone mode must fail closed when required infrastructure configuration is missing.
4. A standalone runtime must not instantiate an elevated cross-tenant client unless a separately reviewed local administrative use case requires it.
5. Control-plane availability must not be a prerequisite for core customer operations.
6. Capability flags may hide or expose product surfaces, but server-side capability authorization remains authoritative.
7. No secret may be placed in a `NEXT_PUBLIC_*` variable.
8. Storage bucket names and credentials are deployment-scoped; URLs alone do not establish authorization.
9. Database RLS remains mandatory even when deployments use separate Supabase projects.
10. Backup, restore, retention, and deletion are owned and tested per deployment.

## 5. Resolution and precedence

The future runtime resolver must use this order:

1. Load the deployment manifest from a server-controlled deployment path or trusted deployment configuration.
2. Validate it against the pinned schema version.
3. Resolve environment variables named by the manifest.
4. Reject unknown modes, missing required variables, malformed identifiers, and unsupported schema versions.
5. Construct an immutable deployment context.
6. Pass that context to runtime services explicitly.

Browser query parameters, cookies, local storage, request bodies, and user metadata MUST NOT override deployment identity or infrastructure configuration.

## 6. Compatibility and migration strategy

The current application contains a central RSBUILD workspace and known organization slugs such as `mundo_sabor`, `hub_acai`, and their QA variants. OIDA-01 does not remove or rename these records.

During a later migration:
- existing shared deployments will be represented as `managed_shared`;
- independent customer installations will use `standalone`;
- current slug-specific presentation presets may remain as presentation metadata temporarily;
- authorization logic must move away from fixed allowlists before arbitrary customer deployment is enabled;
- existing database IDs and records must not be rewritten merely to satisfy this manifest.

## 7. Explicit non-goals for OIDA-01

This PR does not:
- implement a runtime manifest loader;
- alter authentication, authorization, RLS, or database schemas;
- provision Supabase or Vercel projects;
- create or rotate secrets;
- migrate customer data;
- split the current shared database;
- change production or QA deployments;
- claim that Mundo do Sabor or Hub Açaí are already independently deployable.

## 8. Acceptance criteria

- [ ] A versioned JSON Schema defines the deployment contract.
- [ ] Reference manifests exist for Mundo do Sabor and Hub Açaí, with placeholders only.
- [ ] Both examples explicitly disable the RSBUILD control plane for standalone mode.
- [ ] No credentials or live infrastructure identifiers are committed.
- [ ] Documentation distinguishes declared configuration from implemented runtime behavior.
- [ ] A follow-up implementation PR adds server-side loading, validation, tests, and a compatibility path for the current shared deployment.

## 9. Follow-up work

| Work item | Scope |
|---|---|
| OIDA-02 | Server-side manifest resolver and immutable deployment context |
| OIDA-03 | Remove mandatory RSBUILD identity/control-plane dependencies from standalone runtime |
| OIDA-04 | Per-deployment Supabase/Auth/Storage provisioning and release pipeline |
| OIDA-05 | Backup, restore, export, and operational handover verification |

**Decision:** OIDA-01 establishes the contract first. Runtime changes are intentionally deferred so the current shared QA and production environments are not destabilized by a broad refactor.
