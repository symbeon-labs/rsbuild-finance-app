# RSBUILD Finance — Architecture Baseline v1.0

**Status:** Proposed — architecture review required before implementation  
**Scope:** RSBUILD Finance application and its application-owned infrastructure  
**Consumer contract:** Symbeon Financial Core ↔ RSBUILD Finance Integration Contract v0.1  
**Change policy:** Documentation baseline only. This document does not authorize code, schema, infrastructure or contract changes.

## 1. Purpose and architectural decision

This document establishes the target architecture for RSBUILD Finance before implementation work begins. It translates the existing product plan and the consumer integration boundary into application-level responsibilities, components, data flows, trust boundaries, delivery stages and acceptance gates.

The system is a **modular monolith**. Modules are separated by business capability and dependency rules, not by premature microservices. The application may later deploy selected capabilities independently only when measured operational, security or scaling needs justify that decision.

The RSBUILD application is a consumer of Symbeon Financial Core. It must not become a second implementation of reusable financial semantics, parsers, validation rules, reconciliation algorithms or methodology.

The architecture is intentionally split into three ownership zones:

1. **RSBUILD application:** user experience, identity, tenant membership, authorization enforcement, application workflows, persistence infrastructure, operational configuration and presentation.
2. **Integration boundary:** versioned contract handling, DTO translation, capability negotiation, persistence adaptation, error/state translation and correlation.
3. **Symbeon Financial Core:** reusable financial semantics and capabilities exposed through the approved consumer contract. Its implementation, internal architecture, algorithms, methodology assets and roadmap remain outside this repository.

The Integration boundary is an application adapter, not a second financial domain.

## 2. Normative references and precedence

The following documents govern this baseline:

- Symbeon Financial Core — **RSBUILD Integration Contract v0.1** (provider-owned, private, proposed; implementation and governance acceptance pending).
- RSBUILD Finance — `docs/INTEGRATION_CONTRACT.md`.
- RSBUILD Finance — `docs/IMPLEMENTATION_PLAN.md`.
- RSBUILD Finance — `docs/MVP_READINESS_HANDOFF.md`.
- RSBUILD Finance — `docs/ROADMAP.md`.

If this document conflicts with the provider's approved, versioned consumer contract, the contract takes precedence for Core semantics and exchange behavior. Application-owned concerns remain governed here.

**Important status rule:** the provider contract v0.1 is currently marked Proposed. This architecture records the intended boundary; it does not imply that the provider contract, methodology criteria, implementation or any capability has been approved or released. I01 contract/methodology alignment is an explicit gate.

This document does not copy provider internals, proprietary methodology instruments, private implementation details or Core source code into the RSBUILD repository. Only the minimum consumer-facing contract and capability metadata may be used under the agreed access and licensing scope.

## 3. System context

### 3.1 External actors and systems

- **Business user:** views authorized company data and performs permitted operational tasks.
- **Company administrator:** manages organization-scoped users, memberships and approved configuration.
- **RSBUILD platform administrator:** manages platform-level configuration and tenant lifecycle under a separately authorized role.
- **Financial Core provider:** supplies versioned financial capabilities through the approved contract.
- **Approved financial sources:** bank statements and other source systems explicitly enabled for a tenant and capability.
- **ERP systems:** initially read-only targets/sources where separately approved; no write-back is implied.
- **Identity provider:** authenticates users and provides trusted identity/session claims.
- **Persistence and object storage:** store application-owned operational data and protected source artifacts.

### 3.2 Context diagram

```text
                  BUSINESS USERS / ADMINS
                            |
                    Identity Provider
                            |
                    RSBUILD Application
             +--------------+----------------+
             |              |                |
          Finance        Tenant &         Operations
          Workflows      Access           / Admin UI
             |              |                |
             +--------------+----------------+
                            |
                  Application Service Layer
                            |
                 Core Integration Boundary
             (versioned DTOs / adapters / guards)
                            |
               Approved Financial Core Contract
                            |
                  Symbeon Financial Core
                  (provider-owned boundary)

        RSBUILD-owned persistence:
        relational operational data + private artifact storage

        Approved sources / ERP:
        accessed only through scoped, versioned adapters

        4TL4S:
        governance/evidence references only; not a runtime dependency
```

### 3.3 Explicit non-goals

The following are not part of this architecture baseline:

- Reimplementing Core parsing, canonical semantics, financial calculations, validation or reconciliation.
- Importing Core private source files or depending on its internal folder structure.
- Direct access to the Core database or private storage.
- Making 4TL4S a runtime dependency.
- Automatic payment, transfer, write-off, settlement approval or ERP write-back.
- Treating AI output, parsing success, a dashboard status or a successful build as financial approval.
- Microservices, event streaming infrastructure or distributed orchestration without an approved ADR and measured need.
- Combining Finance and Logistics domain models. Existing Logistics capabilities remain a separate application module and are not part of the Financial Core contract.

## 4. Bounded contexts and ownership

| Context | Owner | Responsibilities | Must not own |
|---|---|---|---|
| Identity & Access | RSBUILD | Authentication integration, sessions, user identity, roles and permission checks | Financial meaning or client-side privilege claims |
| Organization & Membership | RSBUILD | Tenant lifecycle, membership, organization configuration and isolation | Core financial rules |
| Finance Experience | RSBUILD | Screens, navigation, filters, workflow orchestration and presentation | Canonical calculations or parser semantics |
| Source Intake Experience | RSBUILD | Upload UX, source selection, consent, metadata capture and progress display | Format parsing or financial interpretation |
| Core Integration | RSBUILD | Contract-version checks, request/response DTOs, translation, correlation and adapter errors | Duplicate Core algorithms or proprietary methodology |
| Operational Persistence | RSBUILD | Tenant-scoped persistence, query projections, application workflow state and retention enforcement | Redefinition of canonical financial truth |
| Audit & Decisions | RSBUILD | Actor-attributed application events, review decisions and authorization evidence | Rewriting provider validation evidence |
| Financial Semantics | Symbeon Financial Core | Canonical model, source interpretation, financial invariants, validation and reusable financial capabilities | RSBUILD UI, tenant sessions or deployment credentials |
| Methodology Governance | Symbeon Financial Core | Reusable methodology and evaluation instruments; exposes only agreed references/outcomes | Client-specific UI implementation |
| Logistics | RSBUILD application, separate context | Orders, delivery proofs, logistics workflows and their own contracts | Financial Core domain entities unless an explicit contract maps a use case |

### 4.1 Dependency direction

Allowed direction:

```text
UI -> Application Use Cases -> Application Ports
                         |
                         v
              Core Integration Adapter
                         |
             Versioned Consumer Contract

Application Use Cases -> Application Persistence Ports
Application Use Cases -> Authorization Policy Ports

Infrastructure implements application ports.
```

Prohibited dependencies:

- UI components importing Core implementation modules.
- Application code importing private Core paths, internal database models or provider persistence adapters.
- Core importing RSBUILD code, Supabase/Next.js SDKs, tenant credentials or UI types.
- Finance modules importing Logistics domain entities as a shortcut.
- Browser clients directly invoking privileged database operations or provider credentials.

## 5. Target application structure

The following is a logical organization target, not an instruction to perform a bulk folder migration. Existing paths may remain until an approved implementation PR moves them with tests and traceable behavior.

```text
app/
  (auth)/                     # sign-in and session entry points
  (workspace)/                # authenticated application shell
  api/                         # narrowly scoped server endpoints, if required
  components/                  # shared presentation primitives

modules/
  identity/
    application/
    domain/
    infrastructure/
  organizations/
    application/
    domain/
    infrastructure/
  finance/
    presentation/
    application/
    domain/                    # app workflow types only, not Core semantics
    integration/
      contracts/               # approved consumer DTOs only
      adapters/
      mappers/
      capability-registry/
    persistence/
      repositories/
      projections/
    audit/
  logistics/                   # independent bounded context

shared/
  authorization/
  errors/
  observability/
  validation/
  ids/
  time/

tests/
  unit/
  contract/
  integration/
  security/
  fixtures/                    # anonymized/synthetic only

docs/
  architecture and decision records
```

Rules:
- The exact folder structure is introduced incrementally through implementation PRs.
- Do not create a local `core/` directory that mirrors provider internals.
- App-specific workflow types must be named and documented as projections/DTOs, not canonical financial entities.
- Keep infrastructure details behind ports so provider, database and identity decisions can be tested independently.

## 6. Application runtime layers

### 6.1 Presentation layer

Responsible for rendering the workspace and collecting user intent. It must not decide authorization, financial validity, settlement eligibility or canonical status.

Presentation reads application query models and displays their freshness, scope, provenance summary and state. It must distinguish demonstration data from persisted operational data.

### 6.2 Application use cases

Orchestrate authorized workflows such as:

- Create an import request.
- Request a source artifact upload.
- Start a Core processing operation through the approved contract.
- Review an import outcome.
- Query tenant-scoped movements.
- Request reconciliation candidates.
- Record an authorized human decision.
- Prepare a read-only/export package where explicitly supported.

Use cases validate the caller's organization membership and permission before accessing tenant data or invoking a provider capability. They coordinate ports; they do not implement financial algorithms.

### 6.3 Domain layer

Contains RSBUILD-owned concepts only: organization membership, workflow orchestration state, user decisions, tenant configuration and application-level policies.

The application may maintain a read/query projection of Core outputs. Such a projection must preserve the source contract version, provider outcome, evidence references and mapping version. It cannot silently become an alternative canonical model.

### 6.4 Integration layer

The Core Integration Adapter is the only application boundary allowed to communicate with Financial Core capabilities.

It is responsible for:

- Declaring supported contract versions and capability versions.
- Validating incoming and outgoing envelopes.
- Translating application commands into consumer-contract requests.
- Mapping provider responses into application query/read models without semantic loss.
- Preserving correlation IDs, provider identifiers, schema/adapter/mapping versions and evidence references.
- Translating transport failures separately from business/validation outcomes.
- Rejecting unknown incompatible versions and unsupported capabilities.
- Preventing tenant or actor identity from being trusted solely because it came from the browser.

The adapter may be in-process initially if that is the approved distribution model. The contract boundary must remain stable if transport later changes to a private service. No network service is required merely to claim separation.

### 6.5 Persistence layer

RSBUILD owns its operational persistence and authorization enforcement. The selected database/provider remains an explicit architecture decision; PostgreSQL with row-level security is the intended target if approved by the persistence ADR.

Persistence responsibilities include:

- Organization-scoped records and references.
- User memberships and role assignments.
- Source registrations and approved capability configuration.
- Import request/batch lifecycle as an application projection.
- Private source artifact references and checksums.
- Versioned Core response/projection metadata.
- User review decisions and append-only audit events.
- Query indexes and read models for the UI.

The persistence adapter must not change the financial meaning of provider records. Persist complete contract-required data or reject/block the capability; never silently discard fields that cannot be represented.

## 7. Identity, authorization and tenant isolation

### 7.1 Trust model

- Authentication is performed by a trusted identity provider.
- Server-side code verifies session/token validity and derives the actor identity from trusted claims.
- Authorization is checked for every protected use case and every tenant-scoped data operation.
- Client-supplied email, role, organization ID, actor ID, localStorage values or hidden UI controls are untrusted input.
- Superadmin/platform privileges are granted only by server-controlled policy and trusted role assignments.
- A UI restriction is usability, not a security boundary.

### 7.2 Tenant isolation

Every tenant-owned object, source, batch, artifact, record projection, decision and audit reference must carry an organization scope.

Required invariants:

1. A user can access an organization only through an active membership and an allowed role.
2. Cross-tenant references fail closed.
3. Object storage paths are tenant-scoped and access is authorized server-side.
4. Database policies are enforced independently of UI filtering.
5. Service-to-service calls use explicit tenant scope and a trusted service identity.
6. Tenant identifiers are not treated as secrets or as proof of authorization.
7. Tests cover read, write, list, export, artifact access and reference resolution across tenants.

If PostgreSQL RLS is selected, policies must be tested using real application roles and service roles; an administrative service key must never be exposed to the browser.

### 7.3 Roles and permission model

Role names and exact policy matrix remain an ADR decision. At minimum, distinguish:

- Platform administrator.
- Organization administrator.
- Finance operator.
- Finance reviewer/approver.
- Read-only viewer.

Separate permissions for upload, view, export, review, approve, manage members and configure sources. Approval authority must not be inferred from a generic administrator label.

## 8. Data architecture and financial evidence

### 8.1 Ownership of truth

- Source systems remain authoritative for the data they originate.
- Original source payloads/bytes are evidence and are preserved under explicit retention controls.
- Financial Core owns reusable financial interpretation and canonical semantics.
- RSBUILD owns tenant access, application workflow state, user decisions and presentation projections.
- A dashboard projection is not an authoritative financial record merely because it is stored locally.

### 8.2 Evidence chain

For every imported or processed item, preserve the available chain:

```text
Organization + Source Registration
             |
Import Request / Receipt
             |
Original Artifact Reference + SHA-256
             |
Provider Processing / Contract Version
             |
Source Record / Canonical Output Reference
             |
Validation Outcome + Evidence Reference
             |
Application Projection / Review Decision
             |
Actor + Timestamp + Audit Event
```

A retry is a new processing attempt linked to the original receipt. It must not overwrite the original artifact or erase prior outcomes.

### 8.3 Monetary and temporal integrity

- Financial calculations use integer minor units or an explicitly specified exact-decimal representation.
- Binary floating point is prohibited for financial arithmetic.
- Currency is explicit using ISO 4217; it is never silently inferred.
- Rounding mode and scale are explicit at each permitted boundary.
- Event date, posting date and settlement date remain distinct when provided by the contract.
- Time values are timezone-aware; date-only financial concepts remain date-only.
- Missing or unsupported fields remain explicitly missing/unsupported, not guessed.

### 8.4 No lossy persistence

Before a Core capability is enabled, the application must demonstrate that all required fields and provenance can be persisted and retrieved without semantic loss. If the current relational projection is insufficient, use a versioned validated payload alongside indexed fields or block the capability pending an approved schema decision.

Do not equate application statuses such as `pendente`, `conciliado` or `ignorado` with provider outcomes. Maintain provider outcome and application workflow state as separate dimensions.

## 9. Import and processing lifecycle

### 9.1 Application workflow

```text
User selects approved source and artifact
                |
Server authenticates actor and tenant scope
                |
Artifact validation and private storage receipt
                |
Create application import request
                |
Invoke approved Core capability/version
                |
Receive structured outcome and diagnostics
                |
Persist provider references and application projection
                |
Show accepted / partial / rejected / failed result
                |
Authorized user reviews exceptions
```

### 9.2 State separation

The application maintains its own workflow states, while retaining the provider's semantic result as a separate field.

Minimum application processing states to be finalized in the state ADR:

- `RECEIVED`
- `QUEUED` (only if a queue is actually used)
- `PROCESSING`
- `PERSISTED`
- `REVIEW_REQUIRED`
- `COMPLETED`
- `FAILED`
- `CANCELLED`

Provider processing outcomes are not renamed or collapsed into these states. Unknown provider outcomes are rejected or quarantined until compatibility is defined.

### 9.3 Idempotency and retries

- Idempotency scope includes organization and registered source, plus the approved idempotency key.
- Payload hash is evidence of exact bytes, not the sole definition of logical duplicate.
- Repeated requests return or reference the existing receipt/outcome where policy requires; they do not silently create duplicate financial effects.
- Retry creates a traceable attempt and preserves prior attempt outcomes.
- Partial acceptance reports accepted, rejected and skipped items with stable diagnostics.
- Structural corruption, tenant mismatch or integrity mismatch blocks processing.

### 9.4 Source capability registry

A source is not supported merely because its file extension is recognized. Enablement requires a declared provider capability, contract/schema version, supported subset, mapping profile and passing conformance fixtures.

The UI may display only capabilities whose status is explicitly available for the current environment and tenant.

## 10. Reconciliation and human decisions

Reconciliation is a provider-owned financial capability exposed through the approved contract. RSBUILD owns the human review experience, permission enforcement, decision record and application audit.

Required principles:

- Candidate generation is not confirmation.
- A document/reference match does not override a material amount or currency divergence.
- Ambiguous and conflicting relationships remain unresolved.
- One-to-one, one-to-many and many-to-one relationships are supported only when explicitly covered by the provider contract and conformance evidence.
- A user decision records actor, organization, timestamp, reason, selected relationship, evidence references and contract/rule version.
- Decisions are append-only; corrections create superseding events rather than erasing history.
- No autonomous settlement, write-off or ERP mutation is enabled by this architecture.

The application may expose an approval action only after its permission matrix, decision lifecycle and provider semantics are approved and tested.

## 11. Audit, observability and error handling

### 11.1 Audit events

Application audit records are append-only and server-generated. At minimum they identify:

- Event ID and event type.
- Organization and target object scope.
- Trusted actor or service identity.
- Occurrence timestamp.
- Action and result.
- Correlation/request ID.
- Relevant contract, schema, adapter and mapping versions.
- Evidence references and reason where applicable.

Do not log credentials, access tokens, full bank payloads or unnecessary personal data. Audit evidence is not replaced by ordinary application logs.

### 11.2 Operational observability

Record structured, privacy-safe events for upload, processing, persistence, provider calls, retries, review and export. Include correlation IDs and durations. Track failure counts, unsupported capabilities, partial results, stale data and tenant authorization denials.

Provider downtime must be surfaced as integration unavailability, not as a financial rejection. 4TL4S unavailability must not interrupt application runtime.

### 11.3 Error taxonomy

Keep distinct:
- Authentication failure.
- Authorization/tenant-scope denial.
- Invalid request or unsupported contract version.
- Unsupported source/capability.
- Artifact integrity/format failure.
- Provider validation outcome.
- Provider/transport unavailable or timeout.
- Persistence failure.
- Idempotency conflict.
- Human-review required.
- Unknown/unclassified failure.

Errors shown to users must be actionable without disclosing secrets or internal provider implementation.

## 12. ERP and external-system boundary

- Omie is read-only in the initial contract scope.
- No create/update/delete/settle/write-off operation is implied.
- Export preparation is not equivalent to ERP acceptance.
- Any future write-back requires a separate capability contract, permission, approval, homologation, idempotency, rollback/recovery design and acceptance gate.
- Each source/ERP adapter declares its own supported operations and version.
- Credentials are stored and used server-side with least privilege and environment separation.

## 13. AI and decision authority

AI may assist with extraction, classification suggestions, explanation, anomaly triage and narrative summaries only when the underlying capability and evidence are available.

AI must not:
- Create or alter canonical facts without validation.
- Convert uncertain values into confirmed facts.
- approve reconciliation or settlement.
- authorize access or bypass tenant policy.
- trigger ERP write operations.
- present generated prose as a deterministic calculation or verified finding.

Every AI-assisted output must expose its evidence basis, uncertainty and the human action required. Deterministic financial totals and state transitions remain reproducible without AI.

## 14. Security, privacy and operational controls

- Separate development, test/staging and production environments and credentials.
- No real customer financial data, secrets, tokens or bank credentials in Git or test fixtures.
- Use synthetic or anonymized fixtures with documented provenance.
- Protect uploads against size abuse, malformed content, path traversal, MIME spoofing and unsafe file handling.
- Restrict artifact download by tenant and permission; use short-lived access where appropriate.
- Define retention, deletion, backup and recovery before operational data is accepted.
- Apply dependency, secret and vulnerability scanning in CI.
- Require review for changes to authorization, persistence policies, contract versions and financial workflows.
- Treat logs, exports, generated reports and support bundles as potentially sensitive data.

## 15. Testing and evidence strategy

Each implementation PR must provide tests appropriate to the layer it changes.

| Test layer | Required evidence |
|---|---|
| Unit | Application policy, DTO mapping, state transitions, exact arithmetic at app boundaries |
| Contract | Supported contract versions, valid/invalid envelopes, unknown versions, provider outcomes and diagnostics |
| Integration | Identity, tenant-scoped persistence, artifact storage, provider adapter and retry behavior |
| Security | Cross-tenant read/write/list/export denial, privilege escalation denial, server-side role enforcement |
| Workflow | Import lifecycle, partial/rejected cases, review decisions and append-only audit |
| Regression | Existing finance and logistics behavior remains isolated and stable |
| Operational | Backup/restore, retention, failure recovery and observability evidence before production claims |

Fixtures must be synthetic or anonymized and must not reveal provider internals. Contract tests must be based on the approved consumer-facing schemas and provider-approved examples, not copied internal implementation tests.

A passing build or unit suite alone is not acceptance.

## 16. Delivery sequence and architecture gates

The sequence below formalizes the existing W01–W07 plan and the provider integration gates. A later phase cannot bypass an earlier security or semantic dependency.

### A00 — Architecture and contract alignment (this document)

Deliver:
- Reviewed application architecture.
- Approved ownership and dependency boundaries.
- Consumer contract version and capability scope.
- Decision register with owners and evidence.
- Explicit unresolved decisions and implementation exclusions.

Exit:
- Product/application owner accepts application scope.
- Core/domain owner accepts consumer semantics and contract version.
- Methodology owner accepts applicable criterion references.
- No undocumented semantic duplication or lossy mapping remains.

### A01 — Identity and tenant trust boundary

Deliver:
- Real identity/session integration.
- Server-derived actor identity.
- Organization membership and permission matrix.
- Server-side authorization on every protected use case.
- Tenant isolation tests.

Exit:
- Unauthenticated and unauthorized access fails closed.
- Cross-tenant tests pass for data, artifacts and exports.
- Client-side state cannot grant roles or privileges.

### A02 — Persistence and evidence boundary

Deliver:
- Approved database and private artifact storage decision.
- Tenant-scoped repositories and policies.
- Import receipts, artifact hash/reference and lifecycle persistence.
- Contract/schema version and provenance persistence.
- Retention, backup and recovery policy.

Exit:
- Data survives independent sessions.
- Complete required contract data round-trips without loss.
- Retry/idempotency behavior is tested.
- Backup/restore and access isolation are evidenced.

### A03 — Thin vertical ingestion slice

Deliver:
- One approved OFX or mapped-CSV capability.
- Source registration and upload.
- Receipt preservation.
- Core invocation through the approved contract.
- Validation result and diagnostics.
- Persisted, tenant-scoped projection and UI.

Exit:
- Representative approved fixtures pass.
- Totals and key fields are independently verified.
- Invalid, partial, duplicate and unsupported cases are explicit.
- No source mutation or unapproved data disclosure occurs.

### A04 — Reliable financial views

Deliver:
- Query models built from validated persisted data.
- Real filters and reproducible totals.
- Source coverage, period, freshness and uncertainty indicators.
- Exact arithmetic at application aggregation boundaries.

Exit:
- Every displayed total traces to the selected data set and calculation definition.
- Demo and operational data are visibly distinct.

### A05 — Human reconciliation workflow

Deliver:
- Candidate and exception presentation from provider outcomes.
- Permission-checked review.
- Append-only decision records and evidence linkage.
- Reproducible decision history.

Exit:
- Ambiguous/conflicting cases remain unresolved until authorized review.
- Amount/currency divergence cannot be bypassed by document matching.
- No automatic settlement or write-back.

### A06 — Reporting and controlled interoperability

Deliver:
- Versioned report definitions and reproducible metrics.
- Read-only ERP/source integration only after separate access approval.
- Export preparation with explicit validation and target mapping status.

Exit:
- Reports disclose definitions, sources, periods and limitations.
- Export preparation is clearly distinct from target-system acceptance.
- No unsupported or lossy field mapping is silently emitted.

### A07 — Operational readiness

Deliver:
- Security review, backup/restore evidence, monitoring and incident procedures.
- Environment separation and secret management.
- Support and retention policies.
- Reproducible demo and documented limitations.

Exit:
- All mandatory acceptance gates have named evidence and authorized approval.
- Production readiness is not claimed while any critical gate remains open.

## 17. Decision register

The following decisions remain open and must be recorded as ADRs before the affected implementation starts.

| ID | Decision | Proposed direction | Owner(s) | Required before |
|---|---|---|---|---|
| ADR-001 | Identity provider and session model | Trusted provider; server-verified sessions | RSBUILD platform/security | A01 |
| ADR-002 | Tenant and membership schema | Organization + explicit membership + role/permission matrix | RSBUILD product/security | A01 |
| ADR-003 | Persistence technology and RLS | PostgreSQL-compatible persistence; RLS if selected and tested | RSBUILD platform | A02 |
| ADR-004 | Artifact storage and retention | Private immutable artifact references; policy-controlled lifecycle | RSBUILD platform/security | A02 |
| ADR-005 | Core distribution/transport | Start with approved in-process package or private API; decide from provider contract | Core + RSBUILD | A03 |
| ADR-006 | Contract version negotiation | Explicit supported version range; reject unknown major versions | Core + RSBUILD | A03 |
| ADR-007 | Canonical projection strategy | Versioned validated payload plus indexed projections if relational schema is incomplete | Core + RSBUILD | A02/A03 |
| ADR-008 | Monetary boundary representation | Integer minor units or exact decimal; explicit currency and rounding | Core + RSBUILD | A03/A04 |
| ADR-009 | Application/provider state mapping | Preserve provider semantic outcome separately from app workflow state | Core + RSBUILD | A03/A05 |
| ADR-010 | Audit event schema and retention | Append-only, server-generated, actor/evidence-linked | RSBUILD security/product | A01/A02 |
| ADR-011 | Human decision authority | Explicit reviewer/approver permissions and correction/supersession model | RSBUILD product + client owner | A05 |
| ADR-012 | 4TL4S evidence linkage | References only; no runtime dependency or sensitive payload transfer | 4TL4S governance + RSBUILD | A00/A07 |
| ADR-013 | Logistics coexistence | Separate bounded context and independent data contracts | RSBUILD product | Before cross-module integration |
| ADR-014 | Environment, backup and recovery | Separate environments; tested recovery objectives | RSBUILD platform/operations | A02/A07 |

Every ADR must include context, options, decision, consequences, owner, date, status and links to validation evidence. An unresolved ADR blocks only the implementation that depends on it; it must not be silently decided in code.

## 18. Pull request and change governance

Implementation proceeds in small, reviewable PRs. Each PR must:

1. Reference an architecture section, ADR and workstream.
2. State scope, exclusions and affected bounded contexts.
3. Preserve the Core/RSBUILD ownership boundary.
4. Include migration and rollback notes when persistence changes.
5. Include tests and evidence for changed behavior.
6. Update relevant contract/capability documentation.
7. Identify security, privacy, data-loss and compatibility risks.
8. Avoid unrelated visual, logistics or Core changes.
9. Be reviewed before merge; no direct implementation commits to `main`.
10. Keep each PR independently understandable and revertible where practical.

Suggested PR sequence:
- PR-A00: architecture baseline and decision register (documentation only).
- PR-A01: identity/session and authorization design decisions, then implementation.
- PR-A02: tenant persistence and artifact-storage decisions, then migrations/adapters.
- PR-A03: one vertical ingestion capability through the approved Core contract.
- PR-A04: reliable read models and financial views.
- PR-A05: reconciliation review and decision audit.
- PR-A06: reporting and read-only interoperability.
- PR-A07: operational readiness evidence.

A PR may update documentation before code, but it must not claim a gate is closed until the required evidence and owner approval exist.

## 19. Current implementation gap — baseline observation

The current `main` branch is an early application demonstrator, not an implementation of this target architecture. The reviewed baseline includes browser-local session persistence, a client-stored email used for privilege presentation, client-side workflow orchestration, and financial parsing/reconciliation helpers inside the application repository.

These are recorded as implementation gaps, not accepted architectural patterns. In particular:

- Browser storage is not the operational financial system of record.
- Client-supplied identity or role is not authorization.
- UI hiding is not access control.
- Application parser/helper logic must not silently become a competing implementation of Core capabilities.
- A document/reference match must not automatically authorize a financial settlement.
- A narrative generated from deterministic formulas must not be represented as a verified AI decision.

The implementation sequence must replace these gaps incrementally without changing the Core contract or merging unrelated Logistics work.

## 20. Architecture acceptance checklist

- [ ] Application, Integration and Core ownership boundaries approved.
- [ ] Consumer contract version and status explicitly acknowledged.
- [ ] Methodology criterion references and approval owners identified without copying proprietary instruments.
- [ ] Identity/session and role model approved.
- [ ] Tenant isolation and server-side authorization model approved.
- [ ] Persistence and artifact retention decisions approved.
- [ ] No-loss canonical projection strategy approved.
- [ ] Exact-money and currency rules preserved.
- [ ] Import lifecycle, idempotency and retry semantics agreed.
- [ ] Provider outcomes and application workflow states kept separate.
- [ ] Reconciliation remains candidate + human decision, not automatic settlement.
- [ ] Audit, observability and privacy controls approved.
- [ ] Logistics remains a separate bounded context.
- [ ] Delivery gates and PR review protocol accepted.

**Architecture status:** Proposed. No implementation gate is closed by this document alone.
