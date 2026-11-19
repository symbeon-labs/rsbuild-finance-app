# F03 — Receivables Persistence

## Objective

Make the Accounts Receivable workspace read and write its operational titles through the organization-scoped server APIs, and make settlement confirmation durable and atomic.

## Current flow

- `GET /api/titles` reads `receivable_titles` for the authenticated organization.
- `POST /api/titles` imports parsed CSV titles with the existing natural-key deduplication.
- `POST /api/settlements` confirms approved matches through `confirm_receivable_settlements`.
- The confirmation RPC inserts settlement rows and changes the corresponding receivable title to `baixado` in one database transaction.
- After import or confirmation, the workspace reloads the server-authoritative title list. Receivable titles are no longer hydrated from or written to localStorage.

## Security boundaries

- API routes retain `requireOrgContext`, organization membership checks, role checks, capability checks, and same-origin validation.
- Settlement confirmation is limited to organization owners and admins, checked both at the route boundary and inside the database function.
- The RPC is SECURITY INVOKER; table RLS remains in force. The RPC also checks the organization membership and locks each pending title before writing.
- The settlement row uses the title's canonical document number and customer name from the database, not client-supplied labels.
- A batch is transactional: an invalid, missing, already-settled, or unauthorized title causes the complete confirmation to roll back.
- The confirmation records the RSBUILD OS settlement; it does not write to or claim synchronization with the source ERP.

## Scope limits

- This PR does not implement partial settlements or a receivable balance ledger. The current title state model only supports pending, paid, and cancelled.
- The existing reconciliation matcher remains a suggestion engine. Only owner/admin confirmation persists a settlement.
- Proofs, WhatsApp orders, and Omie session data remain outside this PR and continue to use their existing temporary-session behavior.
- No QA or production migration is applied by this PR.

## Validation still required

- GitHub Actions database tests, application tests, typecheck, and build must pass for the final head.
- Confirm the RPC behavior against a disposable Supabase database, including rollback on a mixed-validity batch, cross-tenant title rejection, role denial, and repeated confirmation.
- Verify the workspace reload behavior in QA after the migration is explicitly approved and applied.
