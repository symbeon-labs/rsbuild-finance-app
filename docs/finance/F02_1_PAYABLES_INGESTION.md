# F02.1 — Payables ingestion

**Status:** Initial implementation slice, stacked on PR #112. No database writes or remote migrations are included.

## Scope in this slice

- Deterministic CSV preview for open accounts-payable obligations.
- Authenticated preview endpoint at `POST /api/payables/import/preview`, guarded by the organization finance capability; no storage or database side effects.
- Brazilian date formats (DD/MM/YYYY and ISO date).
- Brazilian currency formats converted to integer BRL centavos.
- Required-field validation per row with stable error codes and source row numbers.
- In-file duplicate detection using a SHA-256 fingerprint of supplier, document, due date and amount.
- Optional mapping for supplier tax ID, issue date, category, cost center, bank account, payment method and recurrence reference.

## Explicit exclusions

- XLSX parsing and workbook/sheet selection are not implemented in this initial slice.
- No commit API, Storage artifact, import batch, or database persistence yet. The preview endpoint is intentionally read-only.
- No imports from paid-title or recurrence workbooks. A recurrence workbook is metadata and must not create duplicate obligations.
- No payment allocation or settlement is inferred from a title's status.
- No customer files or production data are used in tests.

## Required next implementation steps

1. Add XLSX support with a maintained parser dependency and fixtures for each received workbook layout; preserve sheet name and row provenance.
2. Add integration tests for the authenticated preview endpoint, file-size limits, origin validation and row-count limits.
3. Add explicit commit command only after #112 schema is merged and applied in an isolated QA database; use a trusted transactional RPC, tenant context from the authorized server session, deduplication and import batch/source artifact records.
4. Return accepted, rejected, duplicate and persisted counts, with bounded row-level error details.
5. Test retry/idempotency, cross-tenant isolation, authorization, and recurrence workbook non-duplication.

## Data contract

The preview emits the fields supported by `public.payable_titles`: supplier identity, document, issue/due dates, integer `amount_minor`, category, cost center, bank account, payment method, recurrence reference and `deduplication_key`.

The parser is pure: it does not read organization IDs, call Supabase, write files, or mutate application state.
