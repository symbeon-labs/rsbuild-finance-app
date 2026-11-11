# RSBUILD OS — Enterprise Governance Architecture

**Document ID:** RSBUILD-OS-ARCH-GOV-001  
**Version:** 1.0.0  
**Status:** Proposed — architectural review required  
**Decision baseline:** Independent companies (Option A)  
**Repository:** `symbeon-labs/rsbuild-finance-app`  
**Branch:** `docs/enterprise-governance-v1.0`

---

## 1. Purpose

Define the multi-company governance model for RSBUILD OS as an Enterprise Operations & Governance Platform. The platform must allow RSBUILD to register, integrate, observe and govern multiple independent companies without merging their ownership, identities, operational data or internal administration.

This document is an architectural specification, not evidence that the described capabilities are implemented, security-tested, commercially contracted or production-ready.

## 2. Accepted product direction

- **RSBUILD OS** is the platform and operational control environment.
- **Finance** remains the first structured business domain; it is not the whole product.
- **HUB** and **Mundo do Sabor** are modeled as independent companies/tenants.
- Future companies are onboarded as separate tenants through explicit provisioning and authorization.
- The platform uses a **modular monolith** initially. Microservices are not a prerequisite for this model.
- The Integration Layer connects approved systems through versioned contracts.
- Symbeon-owned cores remain independently governed and are consumed only through accepted, versioned contracts.
- A platform-level operator does not automatically receive access to tenant business data.

## 3. Core domain terminology

These concepts must not be conflated:

| Concept | Definition | Boundary |
|---|---|---|
| Platform | RSBUILD OS software and its control plane | Platform governance |
| Tenant | An independent company environment registered in RSBUILD OS | Primary data-isolation boundary |
| Legal entity | A registered legal person belonging to a tenant | Tenant-owned business data |
| Business unit | A branch, store, department or operating unit within a tenant | Subdivision, not a separate tenant by default |
| User identity | An authenticated human or service principal | Global identity, no implicit tenant access |
| Membership | Explicit relationship between an identity and a tenant | Tenant-scoped authorization |
| Role | Named collection of permissions | Assigned within a scope |
| Entitlement | Contractually/operationally enabled product capability | Tenant + module + environment |
| Integration | Authorized connection to an external system | Tenant-scoped unless explicitly platform-wide |
| Environment | Development, staging/homologation or production | Separate configuration and credentials |

**Tenant rule:** each independent company receives its own tenant identifier. HUB and Mundo do not share a tenant merely because they are both integrated by RSBUILD.

A tenant may contain one or more legal entities or business units only when the company's ownership and operating model justify that structure. This must be explicitly configured; it must not be inferred from names, email domains or shared vendors.

## 4. Architecture planes

### 4.1 Platform Control Plane

Owns platform-level metadata and governance:

- Tenant registry and lifecycle state.
- Platform identities and platform-scoped roles.
- Tenant provisioning status and technical health metadata.
- Product catalog, module registry and entitlement definitions.
- Integration catalog and connector capability definitions.
- Platform policy versions and security configuration.
- Platform audit events.

The control plane may display tenant metadata and operational health signals that are explicitly classified as safe for platform visibility. It does not become a universal query path into tenant financial or operational records.

### 4.2 Tenant Data Plane

Each tenant owns its business data and tenant-scoped configuration:

- Legal entities and business units.
- Finance accounts, imports, movements and reports.
- Operational records and domain workflows.
- Tenant users, memberships and scoped roles.
- Tenant integrations, credentials references and synchronization state.
- Tenant audit events and approval records.

All tenant data access must be authorized against the active tenant context and enforced server-side and at the database boundary.

### 4.3 Integration Layer

The Integration Layer mediates connections between RSBUILD OS, tenant-authorized external systems and separately owned cores.

Every integration must define:

- Tenant and environment scope.
- Data owner and system of record.
- Direction and permitted operations (read, write, webhook, export).
- Versioned contract and schema.
- Credential reference and rotation owner.
- Rate limits, idempotency and retry behavior.
- Failure handling, observability and data provenance.
- Approval, rollback and revocation procedures.

Read-only is the default for new external integrations. Write access requires a separate explicit authorization and review.

## 5. Identity and authorization model

### 5.1 Identity is not membership

Authentication establishes who the actor is. It does not establish which company's data the actor may access.

A user may belong to multiple independent tenants only through separate, explicit memberships. The active tenant is a request context, not a privilege grant. Every request must verify that the authenticated identity has an active membership and the required permission in that tenant.

Platform staff identities and tenant memberships are separate relationships. Being a platform owner/operator must not silently create memberships in every tenant.

### 5.2 Authorization strategy

Use a combined model:

- **RBAC:** roles group stable permission sets.
- **ABAC:** policies evaluate tenant, resource, action, environment, ownership, sensitivity and approval state.
- **Entitlements:** determine whether a tenant has a capability enabled.
- **Separation of duties:** high-impact actions may require a second authorized actor.

Effective access is the intersection of:
1. authenticated identity;
2. active tenant membership or explicit platform-scoped authority;
3. permission for the requested action and resource;
4. tenant entitlement for the capability;
5. environment and policy constraints;
6. any required approval state.

A UI-hidden feature is not an access control. API handlers, server actions, background jobs and database policies must enforce the same boundary.

### 5.3 Initial role catalogue

Roles are templates, not universal grants. Their permissions must be assigned explicitly and may be narrowed by scope.

| Role | Scope | Intended authority |
|---|---|---|
| Platform Owner | Platform | Manage platform configuration, tenant lifecycle and platform governance; no silent business-data access |
| Platform Operator | Platform | Operate approved platform workflows and view permitted health metadata |
| Company Admin | One tenant | Manage that company's users, memberships, configuration and enabled modules |
| Company Manager | Tenant / business unit | Manage assigned operational areas |
| Operator | Tenant / business unit | Execute explicitly permitted daily workflows |
| Auditor / Read-only | Tenant or approved audit scope | Read permitted records and evidence; no mutation by default |
| Service Principal | Tenant + integration | Execute narrowly scoped machine actions |

Do not implement role names as a hierarchy where higher rank automatically inherits every lower permission. Define permission sets explicitly and test for privilege escalation.

### 5.4 Privileged support / break-glass

There is no hidden universal superuser path.

If exceptional support access to tenant business data is required, it must use a dedicated, time-bounded, tenant-specific grant with:
- stated purpose and ticket/reference;
- explicit approval by an authorized tenant representative, except a separately documented legal/emergency procedure;
- minimum necessary permissions;
- strong re-authentication;
- immutable audit events for grant, use and revocation;
- automatic expiry and immediate revocation capability.

Platform ownership alone is not a justification for routine access to tenant records.

## 6. Tenant isolation and data security

### 6.1 Mandatory invariants

1. Every tenant-owned row carries a non-null `tenant_id`.
2. Tenant identifiers are assigned by trusted server-side provisioning, never trusted from client payloads.
3. Tenant ownership is immutable through ordinary client update paths.
4. Reads, inserts, updates, deletes, exports, background jobs and file operations are tenant-scoped.
5. Database row-level security (RLS) is enabled and fail-closed for tenant-owned tables.
6. Cross-tenant relationships are rejected by database constraints, including composite foreign keys where appropriate.
7. Storage objects use tenant-scoped paths and policies; path naming alone is not authorization.
8. Service-role credentials never reach browsers or client bundles.
9. Logs and telemetry avoid unnecessary business payloads and secrets.
10. Tenant context is revalidated in asynchronous jobs and webhook handlers; it is not inferred from mutable client state.

### 6.2 Recommended initial persistence pattern

Use the existing managed PostgreSQL/Supabase direction as the initial implementation target, subject to verification of the current D02 branch and migrations.

Recommended baseline:
- Shared database with logical tenant isolation through `tenant_id`, RLS and relational constraints.
- Tenant-scoped Storage policies and private buckets.
- Server-side Auth/session verification.
- Trusted server functions for privileged transitions.
- Explicit separation between client-writable fields and server-controlled fields.

A shared database is an implementation choice, not a weakening of the tenant boundary. If regulatory, contractual or scale requirements later demand dedicated databases, the tenant contract should permit migration without changing domain semantics.

### 6.3 Required security tests

Before tenant onboarding is considered production-capable, automated tests must prove:

- Tenant A cannot read, update, delete or export Tenant B records.
- Tenant A cannot create references to Tenant B records.
- Forged `tenant_id`, owner or actor fields are rejected or overwritten by trusted context.
- Viewer/read-only roles cannot mutate protected data.
- Membership revocation takes effect on subsequent requests and sessions according to documented session policy.
- Storage list, read, upload, overwrite and delete are isolated.
- Background jobs and webhooks cannot cross tenant boundaries.
- Platform roles do not acquire tenant data access implicitly.
- Privileged support grants expire and are fully audited.

Use at least two tenants and multiple identities in database-level integration tests. A green UI test alone is insufficient.

## 7. Tenant lifecycle

Tenant lifecycle states:

- **PROVISIONING** — creation in progress; no operational use.
- **PENDING_APPROVAL** — technical setup complete; awaiting required acceptance.
- **ACTIVE** — enabled within approved contract and environment scope.
- **SUSPENDED** — access restricted; retention and export policy remains explicit.
- **OFFBOARDING** — access and integrations being revoked; data disposition pending.
- **ARCHIVED** — retained under the applicable policy; no normal operational access.

Provisioning must be idempotent and auditable. It creates the tenant boundary, initial tenant administrator invitation, baseline policies and environment-specific configuration. It must not automatically import business records or enable every module.

Suspension and offboarding require defined handling for active sessions, API keys, webhooks, scheduled jobs, backups, retention, export and deletion obligations.

## 8. Entitlements and commercial boundaries

A tenant's access to a module is represented as an entitlement, not inferred from its role.

An entitlement should record at minimum:
- tenant;
- module/capability identifier and version;
- environment;
- status (proposed, pending, enabled, suspended, expired);
- effective and expiry dates;
- contract/approval reference;
- limits or quotas where applicable;
- approving authority and audit reference.

A user can have a role that permits Finance operations while the tenant entitlement for a separate module remains disabled. Conversely, enabling a module does not grant every tenant user access to it.

The platform must distinguish:
- technical availability;
- tenant entitlement;
- user permission;
- contractual authorization;
- operational readiness.

These are separate gates.

## 9. Audit and approval

Audit events should be append-only from application workflows and record:
- actor identity and actor type;
- tenant and environment scope, when applicable;
- action and resource type/identifier;
- timestamp;
- outcome;
- correlation/request identifier;
- policy and entitlement version;
- approval reference, when required;
- safe before/after metadata or cryptographic references where justified.

Do not store secrets, access tokens or unnecessary sensitive payloads in audit logs. Audit retention, export and tamper-evidence requirements must be specified before production acceptance.

High-impact actions requiring approval should be configurable by risk class. Initial candidates include tenant suspension, membership elevation, entitlement changes, integration write-scope activation, bulk exports and exceptional support access.

## 10. Cross-tenant visibility and reporting

Default policy: no cross-tenant business-data visibility.

The Operations Center may show:
- tenant lifecycle and onboarding state;
- enabled module/entitlement status;
- integration availability and last successful synchronization;
- technical errors and safe operational counters;
- security and policy events classified for platform operators.

Consolidated business indicators, transaction-level views or comparisons across companies require explicit authorization from each relevant tenant, a defined purpose, data minimization and an auditable aggregation contract. No cross-tenant dashboard should be built merely because platform operators can technically query the database.

## 11. Environments and Developer Zone

Development, staging/homologation and production must have separate:
- credentials and secrets;
- callback URLs and integration endpoints;
- database/storage configuration or strict environment namespaces;
- test fixtures and data policies;
- access groups and deployment permissions.

Developer Zone is a controlled engineering surface, not a bypass around tenant authorization. It must not expose production secrets or real tenant data by default. Test tenants and synthetic fixtures are preferred.

## 12. Proposed logical data model

The following is a conceptual model, not an approved migration or final SQL schema.

### Platform-scoped entities
- `platform_users` / external identity mapping
- `tenants`
- `platform_memberships`
- `module_catalog`
- `entitlement_definitions`
- `tenant_entitlements`
- `integration_catalog`
- `platform_audit_events`

### Tenant-scoped entities
- `tenant_memberships`
- `tenant_roles`
- `role_permissions`
- `legal_entities`
- `business_units`
- `tenant_integrations`
- `approval_requests`
- `tenant_audit_events`
- domain tables such as finance accounts, import batches and movements, each carrying `tenant_id`.

### Relationship invariants
- A membership references exactly one tenant.
- A tenant-owned resource references exactly one tenant.
- A tenant-owned child may reference only a parent with the same `tenant_id`.
- A tenant entitlement references a registered tenant and catalog capability.
- Integration credentials are referenced through a secret manager; raw secrets are not stored in ordinary application tables.
- Platform events and tenant events have distinct visibility and retention policies.

## 13. Relationship with Finance and Symbeon Financial Core

Finance remains a bounded context inside RSBUILD OS. It owns its application workflows and tenant-scoped finance records.

The Symbeon Financial Core remains independently owned and provider-controlled. RSBUILD OS consumes it only through a versioned contract formally accepted by both sides. This governance specification does not transfer ownership, source code, internal methods, models or implementation details of the Core.

The Integration Layer must prevent direct coupling between tenant UI components and provider-owned internals. Tenant scope and authorization must be propagated through the accepted integration contract.

No write-back, payments, transfers, autonomous settlement or ERP mutation is enabled by this document.

## 14. Delivery plan and gates

This architecture adds a governance workstream without replacing the existing stabilization and D02 obligations.

| Work item | Outcome | Gate / dependency |
|---|---|---|
| GOV-00 — Architecture acceptance | Approve terminology, tenant boundary, control/data planes and invariants | Review this document; reconcile PR #23 |
| GOV-01 — Tenant model | Domain model and lifecycle for independent companies | GOV-00; inspect current D02 schema |
| GOV-02 — Identity & authorization | Membership, scoped roles, RBAC/ABAC policy and tests | GOV-01; Auth/RLS baseline |
| GOV-03 — Entitlements | Module catalog and tenant capability grants | GOV-01/02; commercial contract mapping |
| GOV-04 — Operations Center | Platform-safe tenant and integration overview | GOV-01/03; visibility classification |
| GOV-05 — Integration registry | Tenant-scoped connectors, scopes and credential references | GOV-01/02; versioned contracts |
| GOV-06 — Audit & approval | Append-only events and risk-based approvals | GOV-02/03/05; retention policy |

### Sequencing constraints

1. First reconcile the active D02 implementation and its migration history; do not create parallel schema work.
2. Close the outstanding RLS, Storage, authorship and cross-tenant tests already recorded in the repository's D02 work.
3. Review the existing tenant-onboarding and RBAC branches before opening new implementation branches.
4. GOV-01 must map the proposed concepts to the existing schema and identify gaps before any migration is written.
5. GOV-02 must not be considered complete until database and server-side negative tests pass.
6. GOV-03/04/05/06 proceed only after their dependencies and acceptance criteria are documented.
7. No production onboarding of HUB or Mundo do Sabor until the tenant isolation gate is accepted.

## 15. Explicit non-goals

This specification does not authorize:
- merging independent companies into one tenant;
- automatic cross-company data sharing or consolidated financial reporting;
- platform-wide unrestricted access to tenant records;
- hidden superuser or bypass accounts;
- microservices decomposition;
- autonomous financial decisions or write-back to source systems;
- enabling modules without contractual and operational approval;
- production migration, schema changes or data onboarding;
- claiming that multi-tenancy or security is already implemented.

## 16. Open decisions before implementation

The following require explicit review and must not be guessed in code:

1. Whether each tenant has one legal entity or may contain multiple legal entities.
2. Which tenant representative can approve memberships, support access and cross-tenant aggregation.
3. Data retention, export, deletion and backup/recovery commitments.
4. Required audit retention and tamper-evidence level.
5. Whether any specific tenant requires dedicated infrastructure rather than shared PostgreSQL with RLS.
6. Commercial mapping between contracts, modules, quotas and entitlement lifecycle.
7. Exact identity-provider and session-revocation behavior, based on the existing Auth implementation.

## 17. Acceptance checklist

- [ ] Independent-company tenant model accepted.
- [ ] Platform control plane and tenant data plane boundaries accepted.
- [ ] Identity separated from tenant membership.
- [ ] No implicit platform-to-tenant data access.
- [ ] Tenant isolation invariants accepted.
- [ ] RBAC + ABAC + entitlements responsibilities accepted.
- [ ] Lifecycle, audit, approval and offboarding requirements accepted.
- [ ] Cross-tenant reporting default-deny accepted.
- [ ] Finance/Core ownership boundary preserved.
- [ ] Existing D02 and PR #23 work reconciled.
- [ ] Implementation issues and test evidence defined before coding.

---

**Decision summary:** RSBUILD OS will support multiple independent company tenants. The platform governs tenant registration, capability enablement and safe operational metadata; each company retains its own data boundary, membership administration and business operations. Any cross-tenant access is exceptional, explicit, purpose-bound and auditable.

**Status:** Proposed for architectural review. No production or implementation approval is implied.
