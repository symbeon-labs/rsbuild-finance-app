# RSBUILD OS — Hybrid Data Architecture & Contracts

**Document ID:** RSBUILD-OS-ARCH-DATA-001  
**Version:** 1.0.0  
**Status:** Proposed — architecture and contract review required  
**Architecture decision:** B — Hybrid processing  
**Tenant model:** Independent companies (one tenant per independent company)  
**Depends on:** `RSBUILD_OS_ENTERPRISE_GOVERNANCE_v1.0.md`  
**Repository:** `symbeon-labs/rsbuild-finance-app`

---

## 1. Executive decision

RSBUILD OS adopts a **hybrid data architecture**:

1. Each company retains custody and authoritative control of its original operational data in its own systems and infrastructure.
2. A company-side Edge Agent performs local capture, validation, classification, minimization, buffering and approved processing.
3. RSBUILD receives only data products, events, indicators, references and evidence explicitly authorized by the tenant's data-sharing policy.
4. RSBUILD may perform complementary central processing over the authorized data it has received. It must not silently reconstruct or mirror the company's entire operational database.
5. The Operations Center reads governed operational data products through tenant-aware APIs and authorization policies.
6. When a computation can be performed locally without transferring source data, a future federated-query capability may be used. It is an optional extension, not a prerequisite for v1.

**Short principle:** distributed custody, hybrid computation, centralized governance, tenant-scoped visibility.

This is an architectural target. It does not assert that the Edge Agent, ingestion APIs, data store or security controls already exist.

## 2. Goals and non-goals

### Goals
- Preserve independent company/tenant boundaries.
- Keep source systems authoritative.
- Minimize central collection of personal, confidential and high-volume source data.
- Support useful central analytics on approved data.
- Operate through intermittent connectivity and recover without silent loss or duplication.
- Provide versioned, testable contracts between company infrastructure and RSBUILD.
- Allow modules to consume consistent data products without direct coupling to source systems.
- Keep the architecture deployable initially as a modular monolith plus independently deployed Edge Agent.

### Non-goals
- Replicate every source database centrally.
- Replace company ERPs, banks, POS or accounting systems.
- Require a permanent inbound network connection to company machines.
- Allow the platform to execute arbitrary commands on company infrastructure.
- Make the Edge Agent a competing system of record.
- Enable autonomous payments, transfers, settlement, accounting write-back or ERP mutation.
- Treat AI-generated interpretations as authoritative financial facts.
- Introduce microservices or a streaming platform before volume and operational evidence justify them.

## 3. Reference architecture

### 3.1 Logical flow

```text
COMPANY A — independent tenant                    COMPANY B — independent tenant
+----------------------------------+               +----------------------------------+
| Source systems                   |               | Source systems                   |
| ERP / bank exports / POS / files  |               | ERP / bank exports / POS / files  |
+----------------+-----------------+               +----------------+-----------------+
                 |                                                    |
                 v                                                    v
+----------------------------------+               +----------------------------------+
| Company Edge Agent               |               | Company Edge Agent               |
| - source adapters                |               | - source adapters                |
| - local validation               |               | - local validation               |
| - classification/minimization    |               | - classification/minimization    |
| - local rules and computation    |               | - local rules and computation    |
| - encrypted durable outbox       |               | - encrypted durable outbox       |
+----------------+-----------------+               +----------------+-----------------+
                 | outbound authenticated TLS/mTLS                                  |
                 +-----------------------------+------------------------------------+
                                               |
                                               v
                                +-------------------------------+
                                | RSBUILD Ingestion Gateway    |
                                | authenticate / authorize      |
                                | validate / rate limit         |
                                | idempotency / schema registry |
                                +---------------+---------------+
                                                |
                                                v
                                +-------------------------------+
                                | Operational Data Layer        |
                                | raw event envelope (limited)  |
                                | normalized data products      |
                                | process state and evidence    |
                                | tenant-scoped read models     |
                                +---------------+---------------+
                                                |
                           +--------------------+--------------------+
                           |                                         |
                           v                                         v
                +----------------------+                 +----------------------+
                | Hybrid Compute       |                 | Governance & Audit   |
                | approved analytics   |                 | policies / lineage   |
                | aggregation / rules  |                 | access / approvals   |
                +----------+-----------+                 +----------+-----------+
                           |                                         |
                           +--------------------+--------------------+
                                                |
                                                v
                                +-------------------------------+
                                | RSBUILD Operations Center     |
                                | modular dashboards and APIs    |
                                | tenant-aware authorization     |
                                +-------------------------------+
```

The diagram is logical. The first implementation may use the existing Next.js application and managed PostgreSQL/Supabase direction, subject to D02 reconciliation and security acceptance.

### 3.2 Three execution locations

| Location | Owns / performs | Must not do |
|---|---|---|
| Company source systems | Original records and authoritative business state | Delegate ownership to RSBUILD by integration |
| Company Edge | Local capture, parsing, validation, minimization, local rules, durable queue | Expand its own scope or transmit unapproved fields |
| RSBUILD central | Validate received events, store approved products, run permitted analytics, present governed views | Assume unrestricted access to company source data |

### 3.3 Hybrid compute placement rule

Choose the execution location per workload, not by ideology:

- **Local-first:** sensitive source parsing, PII-rich transformations, source-specific rules, high-volume aggregation and offline-critical operations.
- **Central complementary:** cross-process monitoring within one tenant, dashboard projections, approved KPI aggregation, exception queues and comparisons over authorized data.
- **Federated (later):** computations that can return a bounded result without moving underlying records. Requires query allowlists, local approval, resource budgets, signed responses and explicit output disclosure review.

A workload's location must be recorded in its data product definition and architecture decision record.

## 4. Data classification and egress policy

Every source field and derived data product must be classified before transmission.

Suggested classes:

| Class | Examples | Default central treatment |
|---|---|---|
| C0 — Public | Published business metadata | May be shared if tenant policy allows |
| C1 — Operational | Process status, integration health, aggregate counts | Share only for defined platform/tenant purpose |
| C2 — Confidential business | Transaction totals, categories, supplier metrics, margin | Tenant-scoped; explicit data product authorization |
| C3 — Personal / sensitive | Names, CPF, contact details, payroll, bank account identifiers | Keep local by default; transfer only when necessary, lawful and specifically authorized |
| C4 — Secret / credential | API keys, passwords, tokens, private keys | Never transmit as business data; use secret management and credential exchange mechanisms |

Classification is not itself a legal basis. For personal data, each flow needs a defined purpose, lawful basis, controller/operator allocation, retention, data-subject handling and incident procedure. Re-identification risk must be assessed even for pseudonymous or aggregated data.

### 4.1 Egress policy object

Each tenant integration must have an approved policy version with:
- tenant and environment;
- source connector and source scope;
- allowed fields and data product IDs;
- denied fields and transformations;
- purpose and legal/commercial reference;
- processing location (edge, central, federated);
- retention and deletion schedule;
- allowed recipients and dashboard scopes;
- effective date, expiry/review date and approver;
- policy version and revocation status.

Default is **deny**. An unclassified field, unknown schema version, missing policy, expired entitlement or revoked integration is not transmitted.

### 4.2 Data minimization examples

A financial movement may be represented centrally by:
- source-generated opaque record reference;
- date or approved time bucket;
- amount and currency if required for an enabled Finance data product;
- direction and normalized category;
- account alias rather than account number;
- validation and reconciliation status;
- source provenance reference;
- policy and transformation version.

Customer name, CPF, full bank description, raw statement, full account number and original file are excluded unless a separately approved use case requires them. Amount/date/category combinations may still identify a person and must be assessed for re-identification risk.

## 5. Company Edge Agent

### 5.1 Responsibilities

The Edge Agent is a tenant-bound software component installed in infrastructure controlled by the company or its designated provider.

Modules:
1. **Agent Runtime:** lifecycle, configuration, health and version.
2. **Source Adapters:** read-only connectors to approved local sources.
3. **Local Processing:** parsing, schema mapping, validation and deterministic calculations.
4. **Policy Enforcement:** field allowlists, minimization and egress decisions.
5. **Durable Outbox:** encrypted local queue with bounded retention and backpressure.
6. **Transport Client:** outbound authenticated delivery and acknowledgement handling.
7. **Local Audit:** record of source capture, transformation, transmission and policy decision.
8. **Update Verifier:** signed package and configuration verification.

### 5.2 Deployment model

- Prefer a company-controlled server, VM, container host or managed gateway over employee personal workstations.
- Use a least-privilege OS account and isolated runtime.
- Do not expose an inbound management port to the public internet.
- Initiate outbound connections to the approved RSBUILD endpoint.
- Keep source credentials in a local secret manager or OS-protected credential store.
- Separate dev, staging and production agent identities and endpoints.
- Use a tenant-specific installation/bootstrap credential that is single-use and exchanged for a scoped agent identity.
- Pin supported versions and support revocation and controlled upgrades.
- Provide local health, disk, queue-depth and last-sync monitoring without exposing business payloads.

### 5.3 Local storage

The outbox is persistent storage, not RAM-only memory. RAM may be used for transient processing and caches, but it is not a durable record.

Minimum requirements:
- encrypted storage at rest;
- per-tenant agent key material protected by OS/secret manager;
- bounded queue and retention;
- atomic state transitions;
- integrity checks;
- retry metadata;
- deletion after acknowledged delivery and retention expiry, subject to local audit/legal policy;
- safe behavior on restart, power loss and disk exhaustion.

The Edge Agent does not delete or modify original source records.

### 5.4 Agent states

`UNENROLLED → ENROLLING → ACTIVE → DEGRADED → SUSPENDED → REVOKED`

- `ACTIVE`: valid identity and current policy.
- `DEGRADED`: local processing may continue only within cached policy validity; transmission may be delayed.
- `SUSPENDED`: no new data transmission; local queue behavior follows tenant retention policy.
- `REVOKED`: credentials rejected; agent must stop transmission and require re-enrollment.

Policy cache expiry must be bounded. If the agent cannot establish whether a policy remains valid after its expiry, it must fail closed for transmission.

## 6. Contract catalogue

All contracts are versioned independently and use backward-compatible evolution where possible. Breaking changes require a new major version, a migration window and explicit consumer acceptance.

| Contract | Direction | Purpose |
|---|---|---|
| C-EDGE-IDENTITY | RSBUILD → Edge during enrollment; Edge → RSBUILD during authentication | Bind an agent to exactly one tenant, environment and approved integration |
| C-EDGE-POLICY | RSBUILD → Edge | Deliver signed, versioned egress and processing policy |
| C-SOURCE-ADAPTER | Source → Edge | Normalize source-specific records into local canonical inputs |
| C-DATA-PRODUCT | Edge/central processor → governed store | Define approved, purpose-bound output datasets |
| C-EVENT-ENVELOPE | Edge → ingestion | Standard event identity, tenant scope, provenance and schema metadata |
| C-INGESTION-API | Edge → RSBUILD | Authenticate, submit, receive acknowledgement and retry |
| C-ACK-ERROR | RSBUILD → Edge | Deterministic acceptance, duplicate, retry and rejection semantics |
| C-READ-MODEL | Operational Store → module/dashboard | Expose authorized, versioned views for UI and analytics |
| C-PROCESS-STATE | Edge/central workflow → process registry | Track bounded process state and lineage |
| C-AUDIT-EVIDENCE | Each execution plane → audit service | Record security-relevant actions and verification references |

## 7. Contract C-EDGE-IDENTITY — agent identity and enrollment

### Enrollment
1. A tenant administrator requests an agent installation for a specific tenant, environment, source and approved scope.
2. RSBUILD creates a short-lived, single-use enrollment grant bound to that tenant and environment.
3. The agent presents the grant over TLS and proves possession of its generated key.
4. RSBUILD validates the grant, creates a service principal and binds it to one tenant, environment and integration.
5. The agent receives a scoped credential/certificate and policy version.
6. The enrollment grant is consumed and cannot be reused.

### Identity claims (logical)
```json
{
  "agent_id": "agt_opaque_id",
  "tenant_id": "ten_opaque_id",
  "environment": "production",
  "integration_id": "int_opaque_id",
  "scopes": ["events:submit", "policy:read", "health:report"],
  "credential_id": "cred_opaque_id",
  "issued_at": "2026-11-11T12:00:00Z",
  "expires_at": "2026-11-11T13:00:00Z"
}
```

These claims are illustrative. Tokens must be signed by an approved issuer, audience-restricted, short-lived and never accepted based solely on client-supplied JSON. Agent identity must not include broad tenant-data read or arbitrary command execution scopes.

## 8. Contract C-EDGE-POLICY — signed policy delivery

A policy document contains:
```json
{
  "policy_id": "pol_opaque_id",
  "policy_version": 3,
  "tenant_id": "ten_opaque_id",
  "environment": "production",
  "integration_id": "int_opaque_id",
  "allowed_data_products": ["finance.movement.summary.v1"],
  "field_allowlist": ["event_id", "occurred_at", "amount_minor", "currency", "direction", "category_code", "source_ref"],
  "denied_fields": ["customer_name", "cpf", "bank_account_number", "raw_description", "credential"],
  "processing_location": {
    "source_parse": "edge",
    "pii_transform": "edge",
    "kpi_aggregation": "central",
    "cross_tenant_aggregation": "disabled"
  },
  "retention": {
    "edge_outbox_days": 14,
    "central_event_days": 90
  },
  "valid_from": "2026-11-11T12:00:00Z",
  "valid_until": "2026-12-11T12:00:00Z",
  "policy_digest": "sha256:...",
  "signing_key_id": "policy-key-2026-02"
}
```

- Policy must be signed by a trusted RSBUILD policy issuer.
- Agent verifies signature, tenant binding, version monotonicity and validity.
- Older policies cannot replace newer policies (anti-rollback).
- A policy change is audited and cannot silently widen data egress.
- Widening egress requires explicit tenant authorization and a new approval reference.
- The JSON above is a contract example, not a production-ready key format.

## 9. Contract C-DATA-PRODUCT — canonical data product definition

Every centrally consumable dataset is a named, versioned product with a clear owner and semantic contract.

Required metadata:
- `data_product_id` and semantic version;
- tenant scope and source integration;
- purpose and owner;
- schema and field definitions;
- classification per field;
- source-of-truth declaration;
- transformation and validation version;
- processing location;
- freshness and completeness semantics;
- retention and deletion behavior;
- allowed consumer modules/roles;
- aggregation and re-identification constraints;
- quality tests and acceptance thresholds.

Initial candidate product:
`finance.movement.summary.v1`

This product contains only fields required for approved financial monitoring. It is not a general-purpose copy of the source ledger. Exact field semantics, currency, precision, date basis, reversals and pending/settled definitions must be accepted by Finance domain owners before implementation.

## 10. Contract C-EVENT-ENVELOPE — event structure

All events submitted by an Edge Agent use a common envelope. Domain payloads are governed by their data-product schema.

Illustrative event:
```json
{
  "spec_version": "1.0",
  "event_id": "evt_01J...unique",
  "event_type": "finance.movement.validated",
  "event_version": 1,
  "tenant_id": "ten_opaque_id",
  "environment": "production",
  "agent_id": "agt_opaque_id",
  "integration_id": "int_opaque_id",
  "occurred_at": "2026-11-11T12:00:00Z",
  "produced_at": "2026-11-11T12:00:03Z",
  "sequence": 1842,
  "idempotency_key": "sha256:...",
  "correlation_id": "cor_opaque_id",
  "causation_id": "evt_previous_or_null",
  "data_product": {
    "id": "finance.movement.summary.v1",
    "schema_version": 1
  },
  "provenance": {
    "source_system": "erp_adapter",
    "source_record_ref": "opaque_source_reference",
    "transformation_version": "finance-normalizer/1.2.0",
    "validation_status": "accepted"
  },
  "policy": {
    "policy_id": "pol_opaque_id",
    "policy_version": 3,
    "digest": "sha256:..."
  },
  "payload": {
    "amount_minor": 125000,
    "currency": "BRL",
    "direction": "outflow",
    "category_code": "supplies",
    "status": "pending"
  }
}
```

Rules:
- Amounts use integer minor units, not binary floating-point. Currency exponent must be defined; BRL uses two decimal places.
- Timestamps use RFC 3339 UTC. Business dates/time zones must be explicit where relevant.
- `tenant_id` and `agent_id` in the payload are consistency assertions only; authenticated server-side identity is authoritative.
- Source references should be opaque and must not contain personal data or secrets.
- `event_id` is globally unique; `idempotency_key` is stable for the same source fact and transformation scope.
- Corrections and reversals are new linked events, not silent mutation of accepted history.
- Payload must pass the allowlist and schema validation before submission.
- Unknown event types, schema versions or fields are rejected or quarantined; they are not silently accepted.

## 11. Contract C-INGESTION-API — transport

Initial transport recommendation: HTTPS REST over TLS 1.2+ (prefer TLS 1.3), with mTLS or equivalent strong workload identity. The specific provider and implementation must be selected after review of current deployment and secret-management capabilities.

Logical endpoint:
`POST /v1/tenants/{tenant_id}/events:batch`

Requirements:
- authenticated service principal;
- tenant binding checked against credential, not trusted from URL/body;
- environment and integration scope validated;
- request size and batch count limits;
- schema validation and policy version check;
- per-agent and per-tenant rate limits;
- idempotent event persistence;
- correlation/request IDs;
- no sensitive payloads in ordinary application logs;
- TLS certificate and credential rotation/revocation;
- bounded response body with per-event result.

The endpoint is outbound-initiated by the Edge Agent. RSBUILD does not need an inbound connection to company infrastructure for normal ingestion.

## 12. Contract C-ACK-ERROR — acknowledgement and retry semantics

Per-event outcomes:

| Outcome | Meaning | Agent behavior |
|---|---|---|
| ACCEPTED | Event durably committed to the central ingestion boundary | Mark delivered; retain local evidence per policy |
| DUPLICATE | Same idempotency identity already committed | Mark delivered; do not create another record |
| RETRY | Temporary failure or backpressure | Retry with exponential backoff and jitter |
| REJECTED | Permanent schema, scope or policy violation | Quarantine locally; do not retry unchanged |
| UNAUTHORIZED | Credential expired, revoked or tenant binding failed | Stop delivery; re-enroll or contact authorized admin |
| POLICY_STALE | Agent policy version is no longer accepted | Fetch/verify new policy before retry |

HTTP-level guidance:
- 2xx: request accepted for per-event processing; inspect each event result.
- 400/422: malformed request or permanent validation failure.
- 401/403: authentication/authorization failure; stop retries until identity/policy is repaired.
- 409: idempotency conflict or incompatible duplicate identity; quarantine for investigation.
- 413: payload too large; split batch according to documented limits.
- 429: rate limit; respect `Retry-After`.
- 5xx / network timeout: retry with exponential backoff and jitter.

An HTTP 2xx response does not mean every event was accepted. The agent only deletes/compacts a queue item after a durable per-event ACCEPTED or DUPLICATE acknowledgement. Exactly-once delivery is not assumed; the system provides at-least-once transport with idempotent processing.

## 13. Contract C-READ-MODEL — dashboard consumption

The dashboard must never query a company Edge Agent or a company source database directly.

Modules consume tenant-aware read APIs backed by governed central projections.

Logical endpoint:
`GET /v1/tenants/{tenant_id}/data-products/finance.movement.summary.v1`

Query parameters:
- time range and timezone;
- approved dimensions and filters;
- pagination cursor;
- requested projection/version;
- freshness metadata request.

Authorization is evaluated on every request:
1. authenticated user;
2. active tenant membership or explicit approved platform scope;
3. role/attribute permission;
4. enabled tenant entitlement;
5. data-product consumer authorization;
6. field-level classification and purpose;
7. environment and approval constraints.

Response includes:
- data and schema version;
- tenant context;
- generated-at timestamp;
- source freshness watermark;
- completeness/quality indicators;
- aggregation definition/version;
- warnings and known gaps.

A dashboard must label stale, incomplete, estimated or delayed data. It must not present a successful synchronization timestamp as proof that source data is complete.

## 14. Contract C-PROCESS-STATE — process registry

Central process records track execution and state, not full source payloads.

Suggested fields:
- `process_id`, `tenant_id`, `process_type`, `process_version`;
- `source_ref` and `correlation_id`;
- `state`: RECEIVED, VALIDATING, ACCEPTED, PROCESSING, COMPLETED, NEEDS_REVIEW, FAILED, EXPIRED;
- `started_at`, `updated_at`, `completed_at`;
- `edge_execution_ref`, `central_execution_ref`;
- `policy_version`, `data_product_version`;
- `result_ref`, `evidence_refs`, `error_code`;
- `actor/service_principal` and audit correlation.

State transitions must be explicit and validated. A process may not jump from RECEIVED to COMPLETED without the required validation and evidence. Financial approval and reconciliation decisions remain human-controlled where required by the Finance domain.

## 15. Operational Data Layer — storage boundaries

Separate central storage into logical classes:

1. **Ingress ledger:** limited event envelope, delivery status and idempotency identity.
2. **Operational event store:** approved normalized events with tenant scope and retention.
3. **Data product store:** validated projections and aggregates consumed by modules.
4. **Process registry:** process state, execution references and exceptions.
5. **Evidence registry:** hashes, references, validation results and authorized artifacts.
6. **Audit store:** security and governance events with restricted mutation and separate retention policy.
7. **Observability store:** health, latency, queue depth and technical metrics with payload minimization.

Do not store source documents centrally by default. If an approved use case requires an artifact, store it in a private tenant-scoped location with explicit retention, access policy, malware scanning where applicable and immutable provenance. A hash proves integrity relative to a known artifact; it does not prove the artifact is true.

### Logical persistence entities (conceptual only)
- `edge_agents`
- `edge_agent_credentials` (credential references/metadata only)
- `tenant_integrations`
- `egress_policies`
- `data_product_catalog`
- `tenant_data_product_grants`
- `ingestion_batches`
- `ingestion_events`
- `event_idempotency`
- `process_runs`
- `data_product_records`
- `evidence_references`
- `sync_cursors`
- `platform_audit_events`
- `tenant_audit_events`

All tenant-owned records include non-null `tenant_id`; composite constraints prevent cross-tenant references. Platform metadata and tenant business data have separate policies and access paths. This list is not a migration instruction.

## 16. Consistency, ordering and idempotency

- The Edge Agent uses a durable outbox and monotonically increasing local sequence per agent/integration stream.
- Delivery order is not guaranteed across batches or reconnects. Consumers use event time, sequence and causation links where required.
- The central gateway deduplicates by tenant + agent/integration + idempotency key within a documented retention window.
- Event IDs and idempotency keys are not substitutes for business-level duplicate detection.
- Domain reconciliation handles business duplicates separately from transport duplicates.
- Late and out-of-order events are accepted only according to each data product's correction policy.
- A central projection records its source watermark and last successfully processed event.
- Reprocessing uses deterministic transformation versions and preserves prior result lineage.
- A correction is appended as a new event and updates projections through an auditable rebuild.

## 17. Offline behavior and recovery

When the company loses connectivity:
1. Edge continues only permitted local operations.
2. Events are written to encrypted durable outbox.
3. Queue capacity and retention are enforced.
4. The agent raises a local health warning before storage exhaustion.
5. On reconnect, it resumes delivery with backoff and idempotency.
6. Central acknowledgements reconcile queue state.
7. Unrecoverable events are quarantined and surfaced for operator review.

Recovery requirements:
- no silent queue truncation;
- no deletion before durable acknowledgement;
- bounded disk use and explicit backpressure;
- restart/power-loss tests;
- backup/recovery of agent configuration and key material according to company policy;
- documented re-enrollment and key-revocation procedure;
- replay and duplicate-delivery tests;
- clock drift monitoring and safe timestamp handling.

## 18. Security threat model and controls

| Threat | Required control |
|---|---|
| Stolen agent credential | Short-lived credentials, mTLS/workload identity, revocation and rotation |
| Tenant spoofing | Server-side tenant binding to credential; ignore client tenant claim as authority |
| Malicious or compromised Edge host | Least privilege, host hardening, signed updates, local audit, scoped source credentials |
| Egress policy tampering | Signed policy, anti-rollback version, fail-closed enforcement |
| Replay/duplicate delivery | Idempotency, timestamp/sequence checks and bounded replay controls |
| Cross-tenant data leakage | RLS, composite constraints, tenant-scoped APIs and negative tests |
| Central over-collection | Field allowlists, data-product contracts, classification and retention |
| Payload injection/malware | Schema validation, size limits, safe parsing, quarantine and scanning where relevant |
| Unauthorized central analytics | Purpose-bound entitlements, field-level policies and audit |
| Dashboard privilege escalation | Server-side authorization on every read and export |
| Supply-chain compromise | Signed builds, dependency controls, provenance and staged rollout |
| Central outage | Durable outbox, retry, backpressure and recovery drills |

No single control is sufficient. RLS does not replace API authorization; mTLS does not replace tenant authorization; signatures do not prove business truth; encryption does not prevent authorized misuse.

## 19. Privacy, retention and data lifecycle

Each data product must specify:
- purpose and necessity;
- classification and personal-data status;
- legal basis and controller/operator roles where applicable;
- data subject and source lineage where applicable;
- central and local retention periods;
- deletion, correction and export procedures;
- backup expiration behavior;
- access and disclosure logs;
- incident escalation owner.

Retention values in sample policies are illustrative only. No global number of days is approved by this document. Contractual and legal requirements determine the schedule.

Deletion requests must propagate to operational projections, caches and derived data where applicable, with documented handling for immutable audit records and legally required retention. Backups expire under a defined schedule and must not silently reintroduce deleted operational data.

## 20. Observability and service objectives

Initial telemetry should include:
- agent version and lifecycle state;
- last successful heartbeat and synchronization;
- outbox depth and oldest queued event age;
- accepted/rejected/duplicate/retry counts;
- ingestion latency and processing latency;
- schema/policy mismatch counts;
- connector health and source freshness;
- central projection watermark;
- tenant-scoped error codes.

Avoid payload-level logging by default.

Service-level objectives must be set after pilot measurements. Do not promise real-time synchronization before latency, network availability, queue behavior and source refresh characteristics have been measured.

## 21. Dashboard and module contract

The Operations Center is a consumer, not a privileged data source.

Every module declares:
- data products consumed;
- required tenant entitlement;
- required user permissions;
- field and aggregation scope;
- freshness expectations;
- error and stale-state presentation;
- export permissions;
- audit events generated.

Example modules:
- **Finance:** approved movement summaries, cash-flow projections with clear estimate labels, reconciliation exceptions.
- **Operations:** process status, throughput and exception queues.
- **Integrations:** connector health, freshness and synchronization failures.
- **Governance:** tenant lifecycle, entitlements, policy status and access history.
- **Audit:** authorized evidence and event lineage.

A module cannot query another tenant's products merely because the UI offers a company selector. Cross-tenant reporting requires a separate, tenant-approved aggregation product and policy.

## 22. Delivery plan

This workstream is proposed and must be sequenced after existing D02 reconciliation and GOV-01 tenant-model review.

| Work item | Deliverable | Acceptance gate |
|---|---|---|
| EDGE-00 | Architecture and threat-model acceptance | Governance boundary and data-flow review |
| EDGE-01 | Data classification and egress policy | Tenant-approved field/purpose/retention matrix |
| EDGE-02 | Versioned event and data-product contracts | Schema tests and compatibility policy |
| EDGE-03 | Edge Agent technical spike | Enroll, local parse, policy enforcement, durable outbox |
| EDGE-04 | Ingestion Gateway | Auth, tenant binding, schema validation, idempotent ACK |
| EDGE-05 | Operational Data Layer | Tenant RLS, lineage, retention and replay controls |
| EDGE-06 | Hybrid compute and read models | Deterministic calculations, source watermark and access checks |
| EDGE-07 | Operations Center integration | Modular dashboards with stale/quality indicators |
| EDGE-08 | Resilience and security validation | Offline, replay, revocation, negative tenant tests and recovery drill |
| EDGE-09 | Controlled tenant pilot | Explicit tenant consent, synthetic or approved data, rollback and acceptance |

### Mandatory sequence
1. Reconcile D02 implementation and migration history; do not create parallel schema.
2. Review existing tenant-onboarding and RBAC branches.
3. Accept GOV-01 tenant model and the data ownership boundary.
4. Define first Finance data product and its source semantics.
5. Approve field classification, egress policy and retention with the tenant.
6. Prototype Edge Agent with synthetic data only.
7. Validate enrollment, policy enforcement, outbox, ingestion and idempotency.
8. Validate RLS and negative cross-tenant tests.
9. Integrate a dashboard read model.
10. Run a limited pilot only after security, privacy and operational acceptance.

## 23. Initial pilot scope

Recommended pilot:
- one tenant at a time;
- one read-only source adapter;
- one data product: `finance.movement.summary.v1`;
- synthetic fixtures first;
- no write-back;
- no source-document upload to central by default;
- bounded event volume and queue size;
- observable synchronization status;
- manual review of rejected/quarantined events;
- rollback and credential revocation drill.

Do not onboard HUB and Mundo simultaneously as the first validation. Prove the isolation boundary with two synthetic tenants before connecting any real company data.

## 24. Acceptance criteria

- [ ] Hybrid processing model accepted.
- [ ] Company source systems remain authoritative.
- [ ] Edge Agent is tenant- and environment-bound.
- [ ] Egress policy is default-deny and signed.
- [ ] Data products are purpose-bound, versioned and classified.
- [ ] Event envelope and ingestion acknowledgement are versioned.
- [ ] Transport is authenticated, encrypted and revocable.
- [ ] Durable outbox survives restart and offline periods.
- [ ] At-least-once delivery plus idempotent ingestion is tested.
- [ ] Tenant isolation is enforced in API and database.
- [ ] Central read models expose freshness, completeness and lineage.
- [ ] Dashboard never connects directly to company Edge/source systems.
- [ ] Retention, deletion, backup and incident responsibilities are defined.
- [ ] No real data pilot before security and tenant approval.
- [ ] Existing D02 and GOV-01 work is reconciled before schema implementation.

## 25. Open decisions

1. Edge Agent runtime and packaging: container, service or lightweight VM, selected after company infrastructure assessment.
2. Workload identity and certificate authority/provider.
3. Initial source adapter for the first pilot.
4. Exact Finance data-product semantics and permitted fields.
5. Tenant-specific retention and legal/privacy allocation.
6. Central storage topology: shared PostgreSQL/RLS baseline versus dedicated instance for a tenant with justified requirements.
7. Event batch size, queue capacity, retry windows and SLOs, set from pilot evidence.
8. Signed update distribution and key custody model.
9. Whether any data product requires central artifact storage.
10. Conditions and query language for a later federated-compute capability.

---

**Decision summary:** RSBUILD OS uses a hybrid model: source data remains under company custody; local Edge processing prepares approved outputs; RSBUILD central validates, stores and analyzes only authorized data products; dashboards consume governed read models. Central processing is complementary, tenant-scoped and purpose-bound. No full source replication or unrestricted remote control is part of the design.

**Status:** Proposed for review. No production rollout, schema migration, source connection or real-data onboarding is authorized by this document.


## 26. Reconciliation with current D02 implementation (2026-11-11)

This section records the verified relationship between the target hybrid architecture and the current repository implementation. It supersedes any assumption that D02 is already reconciled or that Edge custody is implemented.

### 26.1 Verified baseline

The repository's current `main` contains the D02 transactional import migration `20261109130004_d02_transactional_imports.sql`, but the D02 consolidation work remains represented by open Draft PR #21. The Taskmaster issue #5 and D02.4 issue #11 retain explicit homologation/security gates.

The current D02 design documented on the integration candidate uses:
- Supabase managed PostgreSQL and private Storage;
- one logical organization per independent company;
- `organization_memberships` as the user-to-company relationship;
- tenant-scoped RLS;
- central Storage for original uploaded CSV/OFX artifacts;
- server-side parsing and transactional persistence of normalized financial records;
- integer minor units for money;
- source provenance, validation, audit and import batch records.

This is a valid current application persistence pattern, but it is **not the same as the target Edge-first source-custody pattern**. In the current import workflow, original source files are uploaded to the central private bucket. The hybrid target instead keeps original source files in company-controlled infrastructure by default and transmits only approved data products. These two flows must coexist as explicitly distinguished modes until a separately reviewed migration changes the import experience.

### 26.2 Domain mapping — do not rename the database prematurely

| Target architecture term | Current D02 term | Reconciliation rule |
|---|---|---|
| Tenant | `organizations` | Keep existing DB naming for now; tenant is the platform/domain concept |
| Tenant ID | `organizations.id` / `organization_id` | Use existing UUID in current schema and bind it server-side |
| Tenant membership | `organization_memberships` | Existing relationship; do not create parallel `tenant_memberships` without schema review |
| Source artifact | `source_artifacts` + private Storage | Current centralized artifact path; not the default future Edge path |
| Financial event/record | `financial_records` | Existing Finance domain entity; not a generic event envelope |
| Import batch | `import_batches` | Existing batch semantics; not interchangeable with Edge ingestion batch |
| Audit | `audit_events` | Existing tenant audit domain; platform audit and agent telemetry may require separate policy/table design |
| Data product | Not yet implemented | New logical contract; do not infer it from raw_payload or financial_records |

Do not rename `organizations` to `tenants`, create a second tenant table, or add Edge tables until GOV-01 maps the existing schema, Auth flows and policies.

### 26.3 Current D02 security and acceptance gaps

The current source files and PR/issue records establish these remaining gates:

1. **D02 consolidation is not accepted:** PR #21 is Draft and its recorded state is divergent from main. A current compare reports 7 commits ahead and 97 behind for its branch; the earlier PR body recorded a different snapshot. Treat the current compare as the latest observed Git relationship, and do not merge the branch without a fresh reconciliation.
2. **RPC execution boundary requires review:** the current transactional import migration grants `USAGE` on schema `private` and `EXECUTE` on `private.commit_financial_import` to `authenticated`. The function is SECURITY DEFINER. This conflicts with a strict claim that authenticated clients cannot invoke the privileged implementation directly. Confirm whether the schema is exposed through PostgREST and test direct invocation. Prefer revoking direct authenticated execution and exposing only a trusted server-side route or a narrowly reviewed invoker wrapper with an unbypassable boundary.
3. **Storage deletion policy conflicts with immutability language:** the transactional migration creates a tenant-scoped DELETE policy for authenticated owner/admin/operator roles. The security-hardening migration removes broad client deletion policies, but this later migration adds one again. Decide whether source artifacts are immutable to tenant clients. If compensation is required, perform exact-object deletion through a trusted backend workflow with explicit audit, not broad client delete rights.
4. **pgTAP coverage remains incomplete per issue #11:** owner/admin behavior, authenticated UPDATE/DELETE cross-tenant tests, full Storage upload/overwrite/list behavior, import batch initial state/authorship, composite FK positive/negative cases and a confirmed green clean-migration CI run are listed as pending.
5. **Remote operational acceptance remains separate:** Auth/SMTP/callbacks, real two-user/two-tenant Storage tests, invite/session lifecycle and tenant isolation have not been established by the documentary evidence reviewed here. Supabase Security Advisor history also includes a leaked-password-protection warning in the D02 consolidation record; recheck current remote configuration before acceptance.
6. **No Edge implementation is evidenced:** no reviewed source establishes an installed Edge Agent, signed egress policy, agent identity, durable outbox, ingestion gateway or central data-product store.

### 26.4 Reconciled target boundary

- The existing D02 central import route remains the current application workflow until changed through a separate approved implementation.
- The future Edge path must not call the current privileged import RPC directly or reuse the browser upload flow as an agent protocol without a security review.
- A future Edge Agent submits a versioned, minimized `C-EVENT-ENVELOPE` through a dedicated ingestion boundary. The server authenticates the agent and derives the tenant from its registered identity; a body/path tenant ID is only a consistency assertion.
- Edge-originated data must be stored as a distinct ingestion event/data product with source lineage. It must not be silently inserted as if it were a user-uploaded original artifact.
- Finance domain processing may map an accepted data product into `financial_records` only through a reviewed domain command that enforces existing amount, provenance, deduplication, audit and tenant constraints.
- Do not store original files centrally for the Edge path by default. If a tenant explicitly authorizes central artifact custody for a defined use case, record that as a distinct policy and integration mode.
- Existing `amount_minor` integer semantics are retained. The Edge event contract must align with current integer-cent representation and validate currency exponent; it must not use floating-point amounts.
- Existing `organization_id` remains the persistence key until GOV-01 approves a schema evolution.
- The central Operations Center consumes governed read models. It must not gain direct access to source files or raw payloads merely because the current D02 application stores them.

### 26.5 Reconciliation decisions and required changes

| Topic | Reconciled decision | Required action |
|---|---|---|
| Tenant model | One independent organization per tenant | GOV-01 maps existing `organizations` and memberships |
| Current D02 imports | Retain as existing workflow, explicitly central-artifact mode | Finish PR #21 reconciliation and D02 gates |
| Edge source custody | New opt-in integration path; originals local by default | Design separate ingestion API and data-product persistence |
| Agent authorization | Dedicated service principal bound to one organization/environment/integration | Do not reuse human Auth membership as agent identity |
| Ingestion persistence | Separate event envelope/idempotency/provenance from Finance records | Model after D02 acceptance; avoid premature migrations |
| Privileged RPC | No direct broad client invocation of SECURITY DEFINER function | Resolve grants/schema exposure and add direct-call negative tests |
| Artifact deletion | No broad client delete if artifacts are declared immutable | Reconcile Storage policy and compensation workflow |
| Central analytics | Only approved data products and read models | Define field classification, purpose, retention and entitlement |
| Security acceptance | CI/pgTAP plus remote two-tenant and Storage tests | Close issue #11 and record evidence |
| Production pilot | Not authorized | Require D02, GOV-01, Edge security and tenant consent gates |

### 26.6 Updated implementation sequence

1. Reconcile and accept D02 PR #21 against the actual current `main`; preserve the workspace and existing UI changes.
2. Resolve the SECURITY DEFINER direct-execution boundary and Storage DELETE/immutability contradiction.
3. Complete issue #11 test coverage and confirm clean CI/pgTAP results.
4. Complete remote Auth, membership, Storage and two-tenant isolation homologation.
5. Approve GOV-01 using existing `organizations` and `organization_memberships` as the starting point.
6. Define the first Finance data product and its mapping to `financial_records`.
7. Only then implement EDGE-00 through EDGE-03 with synthetic fixtures.

**Reconciliation status:** architecture-to-code mapping completed at documentary level; implementation reconciliation is **BLOCKED / NOT ACCEPTED** pending the D02 and GOV-01 gates above.
