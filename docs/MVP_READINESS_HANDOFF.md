# RSBUILD Finance — MVP Readiness Handoff

## Purpose
This document is the execution handoff for taking the current RSBUILD Finance application from its initial demonstrator state to a validated MVP suitable for presentation to the initiative.

This is an execution plan and acceptance framework. It is not a claim that listed capabilities are implemented, production-ready, or included in a commercial commitment.

## Current baseline
The application currently provides a financial overview based on imported records, CSV and OFX selection and preview, session-level import, and search over imported movements. Accounts and reports remain placeholders.

Known limitations:
- Imported records are held in browser session state and are lost on reload.
- No authentication, organization boundary, or tenant-level data isolation.
- No database persistence or operational backup strategy.
- Period selector is not yet applied consistently to dashboard calculations and movement views.
- No live bank, Omie, acquirer, or point-of-sale integration.
- No reconciliation workflow or auditable human decision trail.
- Duplicate detection and idempotent import are not yet implemented.
- CSV and OFX parsers require automated tests and representative, anonymized fixtures.
- No evidence currently establishes production readiness.

## Execution workstreams

### W01 — Import integrity
- Establish explicit CSV header and delimiter rules.
- Validate calendar dates and monetary values; reject ambiguous input.
- Preserve import batch and source-record identifiers where supplied.
- Add anonymized fixtures for Brazilian CSV variants and OFX statements.
- Test malformed rows, quoted descriptions, negative values, decimal/grouping separators, missing fields, repeated FITID, and malformed OFX.
- Define duplicate detection behavior; never discard a movement solely because date and amount match.
**Acceptance:** automated tests pass; accepted and rejected rows are explained; repeated imports have deterministic, documented behavior.

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

### W04 — Financial management
- Define accounts, payables, receivables, and cash-flow semantics.
- Separate realized from projected values.
- Add reports only after source definitions and calculation rules are accepted.
**Acceptance:** each indicator has a documented definition, source, period, and validation example.

### W05 — Source integrations
- Start with read-only access and approved credentials.
- Define contracts, scopes, rate limits, error handling, and idempotency per source.
- Validate against representative data before enabling an integration.
**Acceptance:** source ownership, permissions, failure modes, and data provenance are documented and tested.

### W06 — Reconciliation and auditability
- Suggest candidate matches without silently changing financial state.
- Support human review, exceptions, and explicit decisions.
- Record who decided what, when, and on which evidence.
**Acceptance:** no autonomous settlement or write-back; decisions are traceable and reversible where applicable.

### W07 — Presentation and operational readiness
- Apply the approved RSBUILD visual identity consistently.
- Prepare a demo dataset with no real personal or confidential financial data.
- Prepare a scripted demonstration with known expected outputs.
- Document known limitations, dependencies, and next milestones.
**Acceptance:** the demo can be reproduced from a clean environment; claims are backed by observable behavior; limitations are disclosed.

## MVP exit gate
The MVP may be presented as a validated MVP only when all mandatory gates below are evidenced:
1. npm ci completes reproducibly.
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
**Status: execution handoff opened; MVP readiness not yet established.**

The first execution priority is W01 — Import integrity. W02 — Persistence and organization boundary follows before any use with real company financial data.