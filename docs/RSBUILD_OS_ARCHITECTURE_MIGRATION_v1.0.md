# RSBUILD OS — Architecture & Repository Migration v1.0

**Status:** Proposed — requires product, application, domain and provider review  
**Repository:** `symbeon-labs/rsbuild-finance-app` (repository slug retained during transition)  
**Product identity:** RSBUILD OS  
**Initial domain:** Finance  
**Change class:** Documentation and product-architecture alignment only

## 1. Decision

The existing `rsbuild-finance-app` repository is designated as the evolutionary base of **RSBUILD OS**, the enterprise operating platform.

The current Finance application becomes the **first structured domain** of RSBUILD OS. It is not the whole product, and this decision does not claim that other domains are implemented or committed for delivery.

The repository history, current application and existing technical work are preserved. No second platform repository is created as part of this migration.

The GitHub repository slug remains `rsbuild-finance-app` temporarily to avoid prematurely changing deployment, CI, webhook, package, documentation and external references. The product identity in project documentation is RSBUILD OS. A later repository rename is a separate operational change requiring a reference/deployment audit.

## 2. Product definition

RSBUILD OS is an enterprise operating platform that organizes company capabilities, workflows and data domains under shared foundations for identity, authorization, governance, auditability and controlled integration.

The platform is developed incrementally around validated business processes. A domain is not considered implemented because it appears in a discovery map, a report, a roadmap or an architecture diagram.

**Product positioning:** RSBUILD OS connects validated operational domains through shared governance and integration capabilities. Finance is its first structured domain, supported by Symbeon Financial Core through an agreed, versioned consumer contract.

## 3. Architecture principles retained from baseline v1.0

The technical constraints in `ARCHITECTURE_BASELINE_v1.0.md` remain applicable unless explicitly superseded by an approved ADR:

- Modular monolith as the initial application architecture; no premature microservices.
- Strict ownership boundary between RSBUILD application, Integration Layer and Symbeon Financial Core.
- Server-side authentication and authorization; browser-supplied roles and tenant IDs are untrusted.
- Organization-scoped persistence and fail-closed tenant isolation.
- Source provenance, evidence references, versioned mappings and append-only audit history.
- Exact monetary representation, explicit currency and temporal semantics.
- Provider outcomes remain distinct from RSBUILD workflow states.
- Human review for consequential financial decisions; no autonomous payment, settlement or ERP write-back.
- Finance and Logistics remain distinct bounded contexts.
- No direct Core database access, private implementation imports or replication of Core algorithms/methodology.
- Small, reviewable PRs with tests, evidence, scope and rollback notes.

The v1.0 document remains in the repository as the original finance-focused architecture baseline. This migration document supersedes its product scope and identity; it does not silently erase or invalidate its technical controls.

## 4. Platform responsibility zones

### 4.1 RSBUILD OS application

Owns the platform experience and application-level capabilities:

- Workspace and navigation across enabled domains.
- Identity integration, sessions, organization membership and server-side authorization enforcement.
- Domain workflow orchestration and application configuration.
- Application-owned operational persistence and read models.
- Audit of application actions and human decisions.
- Tenant-aware presentation, notifications and operational visibility.
- Platform-level observability and lifecycle controls.

### 4.2 Integration Layer

A cross-cutting boundary, not an independent business domain. It owns:

- Versioned DTOs and contract validation.
- Adapters and mappings between domain workflows and external/provider contracts.
- Capability and version negotiation.
- Correlation IDs, provenance propagation and error translation.
- Idempotency coordination and compatibility checks where required.
- Controlled communication with ERP, bank, messaging and provider systems.

### 4.3 Symbeon Financial Core

A separate provider-owned, reusable financial infrastructure. It retains ownership of its internal implementation, canonical financial semantics, reusable validation and reconciliation capabilities, methodology instruments and private roadmap.

RSBUILD OS may consume only approved, versioned interfaces and permitted evidence/outcome references. It must not depend on Core internals or its database.

**Contract status:** the provider-side RSBUILD Integration Contract v0.1 remains Proposed until the responsible parties formally review and accept it. This migration does not approve that contract, authorize Core access, or imply an integration is implemented.

## 5. Domain model: platform domains versus discovery areas

The discovery map contains 15 operational areas. These are evidence of organizational scope, not a ready-made list of 15 software modules. They must be grouped into bounded contexts through process validation, ownership mapping, data analysis and acceptance criteria.

Initial domain map:

| Domain / capability group | Discovery areas that may contribute | Status in RSBUILD OS |
|---|---|---|
| Finance | Finance | First structured domain; current application foundation |
| Supply & Procurement | Purchasing, receiving, inventory | Candidate domain group; validate boundaries and workflows |
| Production & Quality | Production, lot release, hygiene/quality | Candidate domain group; requirements incomplete |
| Commercial & Sales | Customer service/sales, stores, e-commerce, marketing | Candidate domain group; rules require validation and parameterization |
| Logistics & Fulfillment | Expedition, freight and delivery flows | Separate bounded context; do not merge with Finance |
| Corporate Services | Administration/people, maintenance, internal rules | Candidate scope; requirements incomplete |
| Shared platform capabilities | Identity, permissions, audit, task/event orchestration, documents and integrations | Cross-domain foundations; staged platform capabilities |

The final bounded contexts may differ from these groups. A single operational area may span several domains, and a domain may serve multiple areas. Domain boundaries must follow business ownership, invariants and data responsibilities—not the visual map alone.

## 6. Finance as the first vertical

Finance remains the first implementation and validation focus. Its roadmap and implementation plan continue to govern Finance work, but are now explicitly subordinate to the RSBUILD OS platform architecture.

Finance-domain work must retain the existing sequence and safety gates for:
- Import integrity and provenance.
- Identity, organization membership and tenant isolation.
- Operational persistence and artifact retention.
- Reliable financial views and exact calculations.
- Read-only source integration after scope and access approval.
- Reconciliation candidates, exceptions and human decisions.
- Auditability, observability and operational readiness.

The Finance domain consumes Financial Core capabilities through the Integration Layer only after contract and methodology alignment. No financial algorithm or proprietary methodology is copied into the application.

## 7. Cross-domain capabilities and workflow orchestration

The discovery material suggests reusable platform capabilities, but each must be specified and validated before implementation:

- Event-to-task orchestration and queues.
- Document intake, classification and evidence references.
- Human request, review, approval and recorded-decision workflows.
- Notifications and messaging-provider adapters.
- Audit and provenance.
- Role/permission enforcement.
- External-system adapters and capability registries.

A workflow crossing Finance, Purchasing, Inventory or Production must not collapse their data models into one domain. It coordinates domain-owned operations through explicit contracts and records correlation/provenance across the workflow.

WhatsApp, ERP, bank and AI integrations require approved credentials, scopes, privacy policy, provider selection, costs and failure handling. A personal messaging account or an AI assistant is not an authorization boundary.

## 8. Migration sequence

### M0 — Product and architecture alignment (this change)
- Establish RSBUILD OS as product identity and this repository as its application base.
- Preserve Finance as the first structured domain.
- Define platform, domain and integration ownership.
- Record discovery areas as candidate domains, not delivery commitments.
- Keep this phase documentation-only.

**Exit:** product scope, ownership boundaries, exclusions and review owners are documented. No runtime implementation is authorized by M0 alone.

### M1 — Finance vertical foundation
- Review and approve A00 architecture baseline and required ADRs.
- Resolve identity/session, organization model, authorization and persistence decisions.
- Establish tested tenant isolation, provenance and audit foundations.
- Harden Finance import and read workflows in small PRs.

**Exit:** evidence-backed security, persistence and financial-integrity gates; no production claim before operational acceptance.

### M2 — First controlled integrations
- Align and accept the consumer contract with Symbeon Financial Core.
- Validate provider capability/version and transport.
- Assess Omie API scopes and representative data; begin read-only.
- Add source adapters only after permission, mapping and conformance tests.

**Exit:** approved contract, traceable data flow, failure handling and no-loss mapping evidence.

### M3 — First cross-domain workflow pilot
- Select one validated workflow from discovery (for example, purchase request → approval → receiving evidence → finance task).
- Identify domain owners, source of truth, events, permissions and exception paths.
- Implement only the smallest end-to-end vertical with explicit contracts.

**Exit:** operational validation by responsible users, audit evidence and bounded rollback.

### M4 — Progressive domain expansion
- Prioritize further domains based on validated business value, readiness, access and commercial agreement.
- Reuse shared platform capabilities without merging domain ownership.
- Add modules only through reviewed specifications, ADRs and acceptance gates.

**Exit:** each new domain has a named owner, bounded context, contract, tests, operational evidence and explicit acceptance.

## 9. Repository migration rules

During this transition:

1. Keep the current repository and Git history; do not create a replacement repository.
2. Keep the repository slug unchanged until all deployment and integration references are inventoried.
3. Update product-facing documentation to RSBUILD OS.
4. Retain Finance-specific documents, but label them as Finance-domain plans and controls.
5. Keep brand assets and product UI aligned with the approved RSBUILD OS identity in a separate design review.
6. Do not move folders, rename runtime modules, change schemas or alter application behavior as part of this documentation migration.
7. Do not expose Symbeon Financial Core internals, private methodology, secrets or customer financial data.
8. Do not modify the Core repository or mark its contract accepted through this change.
9. Do not merge unrelated work, including the separate PR #22 workstream.
10. Keep implementation behind A00 approval and small, reviewable PRs.

A future repository slug rename requires a separate checklist covering Vercel project linkage, GitHub Actions, webhooks, badges, package metadata, environment references, documentation links, branch protections and external consumers.

## 10. Evidence, scope and acceptance

This migration is based on the existing repository documentation and the business-discovery material already analyzed. The 15-area map, executive report and interview transcript establish discovery evidence and candidate requirements; they do not prove API availability, software ownership, implementation readiness or authorization to copy the Blue System.

Required decisions before broader implementation:
- Product/domain owners and decision authority.
- Approved bounded contexts and workflow scope.
- Identity, role and approval matrix.
- Data ownership, source-of-truth and retention.
- Core consumer contract and methodology alignment.
- Omie API scope and technical feasibility.
- AI/data-use policy and messaging-provider arrangements.
- Commercial scope, IP ownership, licensing and acceptance model.

**Acceptance checklist**
- [ ] RSBUILD OS product identity approved.
- [ ] Repository role as platform application base approved.
- [ ] Finance confirmed as first structured domain.
- [ ] Platform / Integration / Core boundaries reviewed.
- [ ] Candidate domains explicitly distinguished from implemented scope.
- [ ] Existing Finance safety gates retained.
- [ ] Core contract remains Proposed until formal acceptance.
- [ ] M0 accepted by product and technical owners.
- [ ] No runtime, schema, infrastructure or financial behavior changed in this migration.

**Status:** Proposed. This document prepares the architectural migration; it does not declare M0 accepted, authorize implementation, or establish production readiness.
