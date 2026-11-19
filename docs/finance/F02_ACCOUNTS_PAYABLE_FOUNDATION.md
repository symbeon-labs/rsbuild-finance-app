# F02 — Accounts Payable: foundation and implementation contract

**Status:** Draft PR foundation. The migration is not applied to any Supabase environment.
**Scope:** First-class supplier obligations and payment allocations, preserving the existing receivables contract.

## Why this is needed

The current finance schema has `receivable_titles`, but no payable-title entity. `app/api/titles` reads and writes only `receivable_titles`. The current `settlements` table also references `receivable_title_id` and is receipt-oriented.

`financial_records` is a bank-movement ledger (`entrada` / `saída`), not an accounts-payable subledger. A debit on a statement does not by itself prove which supplier obligation it settles, whether it is partial, or whether one bank debit paid several invoices.

The existing bidirectional matching engine (PR #105, now merged) can propose matches for both directions, but it does not persist payable titles or authorize payments.

## Data model introduced in this foundation

### `payable_titles`

One row per supplier obligation. It captures:

- Tenant identity and source import batch.
- Supplier name and optional tax identifier.
- Document number, issue date and due date.
- Original amount in integer BRL centavos.
- Category, cost center, bank account and payment method.
- Recurrence series/rule and installment metadata.
- Source-system reference and idempotency key.
- Open/cancelled lifecycle state and audit metadata.

Overdue, partially paid and paid are derived states, not independent mutable flags. The open balance is:

`amount_minor - SUM(confirmed payable_payment_allocations.amount_minor)`

This avoids a stored balance drifting away from its payment history.

### `payable_payment_allocations`

One row allocates a payment amount to one payable title. This supports:

- Partial payments: several allocations over time against one title.
- Grouped payments: one bank movement allocated to multiple titles.
- Reconciliation evidence through an optional FK to `financial_records`.
- Idempotency keys and retained reversal metadata.

A payment allocation is not a command to execute a bank transfer. It records a payment already confirmed by the operator/source system.

## Audit and actor attribution

Both entities install the existing database-level actor attribution and operational audit triggers. `payable_titles.updated_at` is maintained by the shared `private.touch_updated_at()` trigger. Inserts and updates (including allocation reversals) emit operational audit events. The shared audit function records only its configured allowlisted fields; it is not a full snapshot of supplier or payment details.

The foundation intentionally has no authenticated write policies. The current pgTAP checks are structural; they do not simulate two authenticated tenants or prove runtime RLS behavior. Tenant-isolation behavior remains a required isolated-database integration test before remote application.

## Security boundary

The foundation enables RLS and tenant-scoped member reads. It intentionally adds **no authenticated INSERT/UPDATE/DELETE policies**. The next implementation slice must add validated server-side commands / transactional RPCs before any write UI is exposed.

Required write invariants:

1. The actor must be an authorized member of the target organization with the finance capability.
2. A linked bank movement must belong to the same organization and have direction `saída`.
3. The allocation total may not exceed the payable title's original amount, considering all confirmed allocations.
4. One bank movement may be allocated across multiple payable titles, but the same movement/title pair cannot be duplicated.
5. Reversal must retain history and restore the derived open balance; no hard delete.
6. All writes must be atomic, idempotent and audited.
7. A title cannot be cancelled while it has confirmed allocations unless those allocations are reversed first.
8. Tenant IDs must come from the authorized server context, not be trusted from client payloads.

## Import contract

Use the existing source-artifact pipeline where possible: SHA-256, tenant-scoped Storage path, `import_batches`, `source_artifacts`, parser version and audit event.

Do not treat every file as a bank statement:

| Source | Intended destination | Current support found |
|---|---|---|
| Bank OFX | `financial_records` | Parser and persistent import endpoint exist |
| Bank CSV | `financial_records` | Parser and persistent import endpoint exist; header mapping must be verified per bank |
| Accounts-payable CSV | `payable_titles` | Not implemented |
| Accounts-payable XLSX | `payable_titles` | Not implemented; current upload endpoint accepts CSV/OFX only |
| Bank / ERP PDF | Evidence or controlled extraction | Not implemented in current import endpoint |
| Recurring-payables workbook | Recurrence metadata for existing obligations | Must not create duplicate payable titles |

For Mundo do Sabor, the recurring-payables workbook overlaps the open-payables workbook. Treat it as recurrence metadata and reconcile it to open titles; do not import the same obligation twice. Paid titles must be imported with historical payment evidence where available, without fabricating a bank movement when no matching statement record exists.

## Required follow-up implementation slices

### F02.1 — Payable command and query layer
- Tenant-scoped list/detail/create/update/cancel endpoints.
- Import preview, row-level validation and explicit commit.
- XLSX parser with tested Brazilian number/date formats and sheet selection.
- CSV column mapping with persisted mapping profile per source.
- Duplicate preview and conflict report before commit.

### F02.2 — Payment ledger
- Atomic allocation command and reversal command.
- Derived states: open, overdue, partially paid, paid, cancelled.
- Partial and grouped payments.
- Link to an outgoing bank movement; never infer settlement from amount/date alone.
- Audit events for create, allocate, reverse and cancel.

### F02.3 — Finance UI
- Accounts Payable view: open, overdue, paid, recurring, cancelled.
- Supplier, due date, category/cost center, amount and remaining balance.
- Import review and error report.
- Payment allocation/reversal with approval boundaries.
- No session-only state for data presented as persisted.

### F02.4 — Bidirectional reconciliation integration
- Feed payable titles as `saída` into the merged conservative reconciliation engine.
- Preserve `pending_review` for ambiguity or amount differences.
- Keep matching proposals separate from payment confirmation.

## Current module audit — code inspection on 2026-11-19

### Confirmed working paths in code
- `POST /api/imports` authenticates the actor, checks organization finance access, validates file size/type, decodes text, parses CSV/OFX, computes SHA-256, stores the source artifact and calls the trusted transactional import RPC.
- The import RPC validates tenant-scoped metadata and rows, inserts a batch and source artifact, persists `financial_records`, deduplicates by organization/key and writes an audit event.
- `GET /api/imports` reads persisted bank movements, capped at 5,000 rows.
- Monetary persistence uses integer centavos.
- Tests exist for CSV/OFX parsing and finance persistence helpers.

### Gaps and risks found
- No payable-title table/API existed before this foundation migration.
- `/api/titles` is receivables-only despite its generic name.
- The current title upload UI accepts CSV only; no XLSX support.
- The bank import UI accepts CSV/OFX only; no PDF or XLSX support.
- The current `parseOfx` parser reports non-chronological records as an error; the import endpoint rejects the whole file whenever any parser error exists. Real bank exports must be checked against this behavior.
- The title settlement UI explicitly says titles and decisions are temporary in the current session. Its persistence endpoints do not by themselves prove that this UI path uses them.
- The legacy `matchTitlesWithRecords` routine is receipt-only and uses first-fit matching; the newer merged bidirectional engine is more conservative, but its PR scope explicitly did not integrate it into the import/settlement flow.
- The import API's source artifact upload occurs before the DB RPC. It attempts cleanup on RPC failure, but cleanup failure leaves an orphaned object that needs operational monitoring.
- API read is limited to the latest 5,000 financial records and reports truncation; pagination is needed for larger workspaces.

### Validation not yet performed
- No real customer workbook or PDF has been imported.
- No XLSX or PDF parser exists in this path.
- No end-to-end QA upload was executed as part of this PR.
- Behavioral multi-tenant RLS simulation and full migration execution remain pending; structural pgTAP assertions are not a substitute.
- The migration has not been applied to QA or production.

## Acceptance criteria before enabling real payables ingestion

- [ ] Migration applies cleanly in an isolated test database and pgTAP passes.
- [ ] Isolated integration tests prove tenant isolation, member read-only access, and authenticated write denial. The current pgTAP file is structural and does not claim this behavioral proof.
- [ ] Server commands prove operator/admin boundaries and atomic allocation limits.
- [ ] Reimporting the same file creates no duplicate titles or allocations.
- [ ] XLSX fixtures cover all received workbook layouts, Brazilian dates/decimals, empty rows, formulas and multiple sheets.
- [ ] Recurring workbook rows are linked to existing open titles rather than duplicated.
- [ ] Paid historical titles are distinguishable from current bank movements.
- [ ] Partial and grouped payment tests pass.
- [ ] Ambiguous reconciliation never creates a payment allocation.
- [ ] QA evidence shows source file hash, parsed/accepted/rejected/duplicate counts and persisted row counts.
- [ ] No production data or customer data is used in automated fixtures.

## Explicit non-goals

- No automatic bank payment execution.
- No automatic settlement from a matching suggestion.
- No changes to existing receivables schema or API contracts.
- No import of customer files in this foundation PR.
- No deployment or remote migration application.
