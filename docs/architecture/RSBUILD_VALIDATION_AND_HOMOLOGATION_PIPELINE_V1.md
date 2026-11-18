# RSBUILD Validation & Homologation Pipeline (VHP) v1.0

**Status:** Architecture specification — proposed  
**Scope:** RSBUILD OS institutional layer and authorized client workspaces  
**Version:** 1.0  
**Date:** 2026-11-17

## 1. Purpose

The Validation & Homologation Pipeline (VHP) defines a controlled, auditable lifecycle for turning test executions into reusable evidence, reproducible experiments, formal homologation decisions, and authorized releases.

The pipeline connects four distinct stages:

1. **QA** executes controlled tests and produces evidence.
2. **Sandbox** receives approved evidence packages and supports isolated reproduction, experimentation, and regression analysis.
3. **Homologation** evaluates explicit acceptance criteria and records an authorized decision.
4. **Production** receives only an explicitly approved release candidate through a controlled promotion process.

The pipeline is a governance and evidence layer. It does not make QA, Sandbox, Homologation, or Production interchangeable environments.

## 2. Normative principles

- **Isolation by default:** environments remain logically and technically isolated.
- **Evidence before claims:** no test or release is considered validated without traceable evidence.
- **Explicit authorization:** transfers, approvals, and promotions require an authorized actor or policy.
- **No implicit promotion:** a passing QA run does not automatically approve Sandbox, homologation, or production.
- **Tenant boundaries:** evidence and artifacts are scoped to an organization, project, environment, and permitted audience.
- **Data minimization:** raw customer or personal data is not copied between environments by default.
- **Reproducibility:** every test result records the version, configuration, inputs or input references, and execution context needed to reproduce it safely.
- **Append-only audit trail:** decisions and evidence history are retained; corrections create new records or superseding events rather than silently rewriting history.
- **Human accountability:** AI-assisted interpretation may support analysis but cannot independently grant release approval.
- **Fail closed:** missing, conflicting, invalid, or insufficient evidence blocks progression.

## 3. Environment responsibilities

### 3.1 QA — controlled execution

QA is the execution environment for functional, integration, regression, security, performance, and acceptance tests.

QA responsibilities:
- execute versioned test cases and test suites;
- record test runs and individual results;
- collect logs, metrics, artifacts, and evidence references;
- register defects and deviations;
- identify the exact build, schema, configuration, and test data profile;
- produce a Validation Evidence Package (VEP).

QA is not the source of production truth and does not authorize releases by itself.

### 3.2 Sandbox — isolated experimentation

Sandbox is a separate laboratory environment. It may consume approved QA evidence packages to reproduce failures, compare versions, test hypotheses, run regression scenarios, and evaluate proposed corrections.

Sandbox responsibilities:
- receive VEPs through an explicit, auditable transfer;
- validate package integrity and provenance;
- reproduce scenarios using synthetic, anonymized, or separately authorized data;
- record experiment runs and their relationship to the source QA run;
- compare baseline and candidate behavior;
- generate additional evidence and findings.

Sandbox must not silently import QA databases, credentials, secrets, or raw customer data. A transfer of executable artifacts or data requires an explicit allowlist and policy check.

### 3.3 Homologation — formal acceptance gate

Homologation evaluates whether a release candidate meets declared acceptance criteria.

Responsibilities:
- define and version acceptance criteria;
- verify required QA and Sandbox evidence;
- evaluate unresolved defects, risks, exceptions, and dependencies;
- record approvals, rejections, or requests for further evidence;
- identify the release candidate and its immutable version reference.

A homologation decision must identify the approver, scope, timestamp, criteria version, evidence set, and decision rationale.

### 3.4 Production — authorized operation

Production is the operational environment of the organization. It receives a release only after the required homologation decision and explicit promotion authorization.

Production promotion must preserve the release identity and link back to the homologation record. Rollback or emergency changes must also be recorded as auditable events.

## 4. Canonical lifecycle

The VHP lifecycle is:

`CREATED → EXECUTED → EVIDENCE_CAPTURED → TRANSFERRED_TO_SANDBOX → REPRODUCED → VALIDATED → APPROVED_FOR_RELEASE`

This is a conceptual happy path, not a requirement that every test follow every state. A run may be rejected, inconclusive, or require additional evidence.

### 4.1 Canonical states

| State | Meaning |
|---|---|
| `CREATED` | Test run or validation request registered |
| `EXECUTED` | Execution finished and results recorded |
| `EVIDENCE_CAPTURED` | Required evidence references collected and integrity checked |
| `TRANSFER_PENDING` | Transfer requested and awaiting policy/authorization |
| `TRANSFERRED_TO_SANDBOX` | Evidence package accepted by Sandbox |
| `REPRODUCED` | Scenario reproduced in Sandbox with recorded conditions |
| `VALIDATED` | Declared validation criteria satisfied |
| `INCONCLUSIVE` | Evidence insufficient to reach a conclusion |
| `CONFLICTING_EVIDENCE` | Evidence sources disagree materially |
| `REJECTED` | Test, package, candidate, or gate rejected |
| `HOMOLOGATION_PENDING` | Candidate submitted for formal acceptance |
| `APPROVED_FOR_RELEASE` | Authorized homologation approval recorded |
| `RELEASED` | Approved candidate promoted to target production |
| `ROLLED_BACK` | Release reverted under a recorded rollback event |

State transitions must be validated server-side. Clients must not be able to set privileged states by directly updating a row.

## 5. Validation Evidence Package (VEP)

A VEP is the canonical, versioned unit of evidence transferred from QA to Sandbox and referenced by homologation.

Minimum logical fields:

| Field | Description |
|---|---|
| `vep_id` | Globally unique package identifier |
| `organization_id` | Tenant/organization boundary |
| `project_id` | Project or product scope |
| `source_environment_id` | QA environment identifier |
| `target_environment_id` | Authorized Sandbox destination |
| `test_run_id` | Source execution identifier |
| `test_suite_version` | Test definition version |
| `application_version` | Commit, build, or immutable release identifier |
| `schema_version` | Relevant database/schema version |
| `configuration_fingerprint` | Non-secret configuration fingerprint |
| `result_summary` | Pass/fail/inconclusive counts and summary |
| `evidence_manifest` | Typed list of evidence references and checksums |
| `data_classification` | Classification and handling requirements |
| `redaction_profile` | Sanitization method/version, when applicable |
| `created_by` | Actor or service identity |
| `created_at` | Creation timestamp |
| `integrity_digest` | Digest over canonical manifest and metadata |
| `signature_reference` | Optional signature/attestation reference |
| `transfer_status` | Transfer lifecycle state |

A VEP should reference large logs and artifacts in controlled object storage rather than embedding them in database rows. Secrets must never be included in the package.

## 6. Evidence types

The evidence manifest may reference:
- test case definitions and versions;
- test run summaries and individual results;
- application logs and structured events;
- metrics and performance measurements;
- screenshots, recordings, and generated reports;
- defect records and reproduction instructions;
- API contract and integration test results;
- security test reports;
- data fixtures or synthetic datasets;
- build, commit, dependency, and schema references;
- human review notes and approval records.

Each evidence item should include a stable identifier, media/type, origin, timestamp, checksum, classification, retention policy, and access scope.

## 7. Transfer contract: QA → Sandbox

Transfer is an explicit operation, not an automatic database replication.

Before accepting a package, the receiving service must verify:
1. the source QA environment is registered and authorized;
2. the destination Sandbox belongs to the same authorized organization/project scope, or has an explicit cross-scope grant;
3. the actor/service has transfer permission;
4. package schema and version are supported;
5. manifest and artifact checksums are valid;
6. data classification permits transfer;
7. required redaction/sanitization has been completed;
8. no secret, credential, or prohibited raw data is present;
9. the transfer event is written to the audit trail.

On failure, the package remains quarantined or rejected; it must not become available to Sandbox consumers.

### 7.1 What is transferred

Default allowed:
- test metadata and results;
- sanitized logs and reports;
- checksums and provenance;
- synthetic fixtures;
- explicitly approved, non-sensitive artifacts.

Not allowed by default:
- full QA database snapshots;
- production customer data;
- access tokens, passwords, private keys, or connection strings;
- unrestricted object-storage copies;
- personal data without an approved legal and security basis.

## 8. Homologation decision model

A homologation decision is made against a versioned criteria set.

Possible decisions:
- `APPROVED`: all mandatory criteria satisfied and evidence sufficient;
- `REJECTED`: one or more mandatory criteria failed or risk is unacceptable;
- `NEEDS_EVIDENCE`: evidence is missing, insufficient, stale, or inconclusive;
- `APPROVED_WITH_EXCEPTIONS`: only where policy explicitly allows exceptions, with documented risk acceptance, owner, expiry, and compensating controls.

Minimum decision record:
- candidate and target environment;
- criteria-set version;
- evidence package IDs;
- test and defect summary;
- unresolved risks and exceptions;
- decision and rationale;
- approver identity and role;
- timestamp;
- optional signature/attestation reference.

The person who authors a change should not be the sole approver for a high-risk release where separation of duties is required by policy.

## 9. Roles and permissions

Permissions must be scoped by organization, project, environment, and action. A global institutional role must not imply automatic access to client financial or operational data.

| Capability | QA operator | Sandbox operator | Homologation approver | Workspace admin | Platform owner |
|---|---:|---:|---:|---:|---:|
| Execute QA tests | Yes | No | No | Policy-bound | Policy-bound |
| Read QA results | Scoped | Via accepted VEP | Scoped | Scoped | Governed |
| Request VEP transfer | Yes, scoped | No | No | Yes, scoped | Yes |
| Accept/reject VEP | No | Yes, scoped | No | Policy-bound | Governed |
| Run Sandbox experiments | No | Yes, scoped | No | Policy-bound | Governed |
| Define acceptance criteria | No | Contribute | Yes | Policy-bound | Governed |
| Approve homologation | No | No | Yes | Only if explicitly delegated | Governed |
| Promote to production | No | No | Separate authorized release role | Only if explicitly delegated | Governed |
| Audit pipeline history | Scoped | Scoped | Scoped | Scoped | Governed |

This table is a capability model, not a grant of permissions to existing users. Actual grants must be mapped to the current RSBUILD RBAC and tested against RLS.

## 10. Tenant isolation and security requirements

- Every VEP, test run, experiment, artifact, decision, and release must carry an organization scope.
- Project scope must be validated against organization scope.
- Cross-tenant reads and writes must be denied by default.
- Storage paths and signed URLs must enforce the same scope as database records.
- API authorization must be enforced server-side; hiding navigation is not a security boundary.
- State transitions must use authorized server-side operations.
- Service credentials must be isolated by environment and rotated.
- Audit events must record actor, action, target, result, timestamp, and correlation ID.
- Retention and deletion must respect legal, contractual, and customer policies while preserving required audit metadata.
- AI-generated summaries or classifications must be marked as machine-generated and remain distinguishable from human approvals.

## 11. Audit event model

The audit trail should capture at least:
- `TEST_RUN_CREATED`
- `TEST_RUN_EXECUTED`
- `EVIDENCE_CAPTURED`
- `VEP_TRANSFER_REQUESTED`
- `VEP_TRANSFER_ACCEPTED`
- `VEP_TRANSFER_REJECTED`
- `SANDBOX_REPRODUCTION_STARTED`
- `SANDBOX_REPRODUCTION_COMPLETED`
- `VALIDATION_CRITERIA_EVALUATED`
- `HOMOLOGATION_SUBMITTED`
- `HOMOLOGATION_APPROVED`
- `HOMOLOGATION_REJECTED`
- `RELEASE_PROMOTION_AUTHORIZED`
- `RELEASE_PROMOTED`
- `RELEASE_ROLLED_BACK`

Events should be append-only from the application perspective and linked through a correlation identifier.

## 12. Workspace information architecture

The institutional Workspace should expose a **Validation & Homologation** area with these views:

1. **Pipeline Overview** — current stage counts, blocked items, recent activity, and environment health.
2. **QA Runs** — test suites, executions, results, defects, and evidence completeness.
3. **Evidence Packages** — VEP registry, provenance, integrity status, transfer state, and access scope.
4. **Sandbox Experiments** — reproductions, comparisons, regression runs, and findings.
5. **Homologation Gates** — criteria, pending decisions, approvals, rejections, and exceptions.
6. **Releases** — approved candidates, promotion history, deployment references, and rollbacks.
7. **Audit Trail** — searchable event history with actor and correlation details.
8. **Policies** — transfer rules, data classifications, retention, approval thresholds, and role mappings.

The institutional workspace may observe pipeline metadata across authorized projects. It must not expose client payloads or operational records merely because a user has an institutional role.

## 13. Initial data model (logical)

The first implementation may use these logical entities; physical schema and migrations require a separate reviewed design:

- `validation_environments`
- `validation_test_suites`
- `validation_test_cases`
- `validation_test_runs`
- `validation_test_results`
- `validation_evidence_packages`
- `validation_evidence_items`
- `validation_transfers`
- `sandbox_experiments`
- `homologation_criteria_sets`
- `homologation_decisions`
- `release_candidates`
- `release_promotions`
- `validation_audit_events`

All records require explicit ownership/scope, timestamps, and lifecycle constraints. Use foreign keys and database constraints to prevent mismatched organization/project/environment references. Avoid implementing this entire schema in one migration without staged review.

## 14. Failure handling

- **Missing evidence:** mark `INCONCLUSIVE` or `NEEDS_EVIDENCE`; block approval.
- **Checksum mismatch:** quarantine package and raise an integrity event.
- **Cross-tenant scope mismatch:** reject transfer and emit a security audit event.
- **Failed reproduction:** retain the original QA evidence; record the Sandbox failure as a separate result.
- **Conflicting evidence:** require human review and explicit resolution; do not average away conflicts.
- **Expired approval:** require re-evaluation against current candidate and criteria.
- **New commit/build after approval:** invalidate the prior approval for the changed candidate unless policy explicitly proves the approved artifact is unchanged.
- **Promotion failure:** retain approval, record failed promotion, and prevent false `RELEASED` state.
- **Rollback:** create a new event and release record; do not erase the original promotion history.

## 15. Acceptance criteria for VHP v1.0

The VHP v1.0 implementation is acceptable only when:

1. QA test runs can be registered with immutable version/context references.
2. Results and evidence references are captured and queryable within authorized scope.
3. A VEP can be generated with a deterministic manifest and integrity digest.
4. Transfer to Sandbox is explicit, authorized, and auditable.
5. Sandbox can accept or reject a VEP after validating scope, schema, and integrity.
6. A Sandbox experiment can reference its source VEP and record reproduction outcome.
7. Homologation criteria are versioned and evaluated against a specific candidate.
8. Approval, rejection, and needs-evidence decisions record actor, rationale, and evidence.
9. Production promotion is blocked without the required approval and explicit authorization.
10. RLS/API/Storage tests prove cross-tenant isolation for reads, writes, transfers, and artifact access.
11. State transitions reject unauthorized or invalid transitions.
12. Audit history supports reconstruction of the full path from QA run to release or rejection.
13. AI-assisted analysis is distinguishable from human decisions and cannot bypass approval gates.

## 16. Delivery roadmap

### Phase 0 — Governance and contract
- approve this specification;
- define environment registry and organization/project scope;
- define data classifications, transfer allowlists, and role mapping;
- define homologation criteria ownership.

### Phase 1 — QA evidence foundation
- register test suites, runs, results, and evidence references;
- implement VEP manifest and integrity checks;
- implement QA execution dashboard and evidence registry.

### Phase 2 — Controlled Sandbox intake
- implement transfer request, policy validation, quarantine, and acceptance;
- implement Sandbox experiment records and source VEP linkage;
- support reproducibility and regression comparison.

### Phase 3 — Homologation gates
- implement versioned criteria sets;
- implement human approval/rejection/needs-evidence workflow;
- enforce separation of duties and exception expiry.

### Phase 4 — Release governance
- register release candidates;
- bind approval to immutable artifact/build identity;
- implement authorized promotion, deployment evidence, and rollback history.

### Phase 5 — Hardening and assurance
- complete RLS, API, Storage, and tenant-isolation test matrix;
- add integrity, retention, and audit verification;
- run end-to-end negative and adversarial tests;
- document operational runbooks and incident procedures.

## 17. Explicit non-goals for v1.0

V1.0 does not imply:
- automatic copying or synchronization of QA and Sandbox databases;
- automatic deployment to production after tests pass;
- AI as autonomous release approver;
- unrestricted cross-tenant evidence sharing;
- a claim that any existing RSBUILD environment is already connected to this pipeline;
- a claim that the pipeline is implemented merely because this specification exists.

## 18. Current implementation status

At specification time, the RSBUILD institutional Workspace and module-visibility changes are being proposed in PR #73. The VHP workflow described here is an architectural specification, not an implemented pipeline. Existing QA and Sandbox environments must be inventoried and their actual access, data, and integration boundaries verified before any transfer automation is enabled.

## 19. Versioning

Changes to lifecycle states, transfer contracts, evidence integrity requirements, tenant boundaries, or approval semantics require a new minor/major specification version and migration plan. Additive clarifications that do not alter behavior may be recorded as patch revisions.
