# RSBUILD Finance — MVP Readiness Handoff

## Purpose
This document tracks engineering readiness. The product scope and phased roadmap are governed by [EXECUTION_BASELINE.md](./EXECUTION_BASELINE.md), aligned to the five product documents. This handoff does not expand the approved MVP.

This is an execution plan and acceptance framework. It is not a claim that listed capabilities are implemented, production-ready, or included in a commercial commitment.

## Current baseline
The application currently provides a financial overview based on imported records, CSV and OFX selection and preview, session-level import, and search over imported movements. Accounts and reports remain placeholders.

Known limitations:
- Imported records are held in browser session state and are lost on reload.
- No authentication, organization boundary, or tenant-level data isolation.
- No database persistence or operational backup strategy.
- Period selector is not yet applied consistently to dashboard calculations and movement views.
- No live bank, Omie, acquirer, or point-of-sale integration.
- No general-purpose export engine, additional XLSX/XML/JSON/PDF layouts, public API, webhooks, or ERP write-back.
- No reconciliation workflow or auditable human decision trail.
- Duplicate detection and idempotent import are not yet implemented.
- CSV and OFX parser validation is being closed through the W01 automated test suite; persistence and organization isolation remain outside this workstream.
- No evidence currently establishes production readiness.

## Execution workstreams

The current ordered workstreams and future gates are consolidated in [EXECUTION_BASELINE.md](./EXECUTION_BASELINE.md). This handoff remains the engineering evidence log; the baseline is the scope and sequencing reference.

### W01 — Import integrity
- Establish explicit CSV header and delimiter rules.
- Validate calendar dates and monetary values; reject ambiguous input.
- Preserve import batch and source-record identifiers where supplied.
- Add anonymized fixtures for Brazilian CSV variants and OFX statements.
- Cover Brazilian CSV delimiters, BOM, quoted and escaped descriptions, ISO/BR dates, invalid calendar dates, decimal/grouping formats, negative values, missing headers, malformed values, and repeated same-date/same-amount movements.
- Cover OFX credit/debit, dates, FITID provenance, malformed movements, and empty/invalid statements.
- Preserve source FITID when supplied; do not silently deduplicate by date and amount. Cross-import idempotency remains a separate requirement and is not claimed by the parser tests.
**Acceptance:** `npm test`, typecheck, and production build pass; accepted and rejected rows are explained; fixtures are anonymized and reproducible.

### W02 — Persistence and organization boundary
- Select and document the persistence model.
- Define organization/company identity and access boundary before storing financial data.
- Persist import batch metadata and source provenance.
- Define retention, deletion, backup, and recovery expectations.
- Ensure no cross-company data exposure.
**Acceptance:** data survives reload; access is authenticated; organization isolation is tested; recovery behavior is documented.

### W03 — Reliable financial view
- Apply date range filters consistently to KPIs and movement lists.
- Use deterministic monetary calculations and explicit rounding rules.
- Display source, period, import status, and data-quality warnings.
- Distinguish session/demo data from persisted operational data.
**Acceptance:** dashboard totals reconcile to the filtered movement set and are covered by tests.

### W04 — Assisted reconciliation workflow
- Define the minimum matching criteria and evidence required for candidate matches.
- Distinguish imported records, suggested matches, confirmed matches, divergences, and unresolved pending records.
- Require human review for confirmation; never mutate source financial state silently.
**Acceptance:** representative cases are tested; each decision is traceable to source records and evidence.

### W05 — Events and auditability
- Record actor, timestamp, action, evidence, reason, and outcome for relevant review decisions.
- Preserve source provenance and import-batch references.
- Make history inspectable without exposing secrets or unnecessary sensitive data.
**Acceptance:** a reviewer can reconstruct who did what, when, why, and against which source records.

Source integrations such as Omie remain a separate future gate. They require discovery, explicit authorization, a source contract, representative samples, read-only homologation, and a separately approved scope.

### W06 — Executive dashboard perspective
- Provide a director-oriented summary from the same reconciliation dataset as the operational workspace.
- Show only indicators whose definitions, sources, and calculation rules are documented.
- Support drill-down from each relevant indicator to underlying records and evidence, subject to authorization.
**Acceptance:** executive totals reconcile to the underlying filtered records; no generic cash-flow, liquidity, profitability, or forecast claims without separately validated sources and rules.

### W07 — Presentation and operational readiness
- Apply the approved RSBUILD visual identity consistently.
- Prepare a demo dataset with no real personal or confidential financial data.
- Prepare a scripted demonstration with known expected outputs.
- Document known limitations, dependencies, and next milestones.
**Acceptance:** the demo can be reproduced from a clean environment; claims are backed by observable behavior; limitations are disclosed.

## MVP exit gate
The MVP may be presented as a validated MVP only when all mandatory gates below are evidenced:
1. A committed `package-lock.json` exists and `npm ci` completes reproducibly.
2. Typecheck and production build pass.
3. Automated tests cover import parsing, monetary/date validation, and financial totals.
4. Persistence and organization isolation are implemented and tested, or the presentation is explicitly labelled as a non-production prototype.
5. No secrets or real customer financial data are committed.
6. Demo script and anonymized fixture set are reproducible.
7. Known limitations and unsupported operations are disclosed.
8. A reviewer can trace each acceptance claim to a test, artifact, or demonstration.

## Safety and scope boundaries
- Source systems remain authoritative.
- AI may assist with extraction or suggestions; it does not independently approve financial records.
- No payments, transfers, write-offs, autonomous settlement, or ERP write-back in the initial MVP.
- Any write access requires separate authorization, a reviewed contract, homologation, idempotency, rollback, least privilege, and explicit acceptance.
- Roadmap presence does not mean a capability is implemented, available, or contracted.

## Handoff protocol
For each work item, record owner and reviewer; scope and exclusions; dependencies and access; implementation commit / pull request; automated and manual validation evidence; acceptance decision; and unresolved risks.

## Current status
**Status: W01 import-integrity tests and ENG-01 reproducibility work are accepted and merged into `main`. The ENG-01 gate is closed. Overall MVP readiness is not established.**

### W01 — Import integrity
W01 provides a native Node test suite covering CSV/OFX parsing, monetary and date validation, source identifiers, and duplicate-preservation behavior. The current suite contains 9 tests. Parser tests preserve supplied FITID provenance and do not claim cross-import idempotency.

### ENG-01 — Reproducible dependency installation
ENG-01 is complete and accepted:
- PR #3 merged into `main`; merge commit: `a33e761568a5b51a658e6baff6d596e061e79912`.
- `package-lock.json` is committed (lockfileVersion 3; blob SHA: `fbab83b107ace7e4e97f3479ad48a59ac1075f02`).
- Lockfile generation/runtime baseline: Node 22.16.0 and npm 10.9.2.
- Resolved versions verified: Next.js 15.5.28, React/React DOM 19.1.7, and PostCSS 8.5.32.
- CI uses `npm ci`; the temporary lockfile-bootstrap workflow was removed.
- CI pins Node to `22.16.0` to match the lockfile-generation runtime.

### Validation evidence
The following GitHub Actions executions completed successfully:
- PR/branch validation: [run 41895819695](https://github.com/symbeon-labs/rsbuild-finance-app/actions/runs/41895819695).
- Post-merge validation on `main`: [run 41898162500](https://github.com/symbeon-labs/rsbuild-finance-app/actions/runs/41898162500).
- Post-pin validation on `main`, commit `068658b04e3f62f7871c381a71c48cbfee5c74d4`: [run 41898819499](https://github.com/symbeon-labs/rsbuild-finance-app/actions/runs/41898819499).

The post-pin run confirms successful completion of `npm ci`, `npm audit --audit-level=high`, all 9 tests, `npm run typecheck`, and `npm run build`. No high/critical audit findings blocked the configured audit gate.

### Acceptance decision and next gate
**ENG-01: ACCEPTED / CLOSED.** The issue's acceptance criteria are evidenced by the committed lockfile, pinned runtime, PR validation, post-merge validation, and post-pin validation.

**W02 — Persistence and organization boundary is now unblocked for planning and implementation.** This does not mean W02 has started or been accepted. It must define and validate persistence, authentication, organization identity/isolation, provenance, retention, backup, and recovery before operational financial data is treated as safely persisted.

**MVP readiness remains NOT ESTABLISHED.** The application still has session-only imported data, no authentication or organization isolation, no database persistence, and other limitations listed in this handoff. Passing ENG-01 is an engineering reproducibility milestone, not production readiness or MVP completion.
