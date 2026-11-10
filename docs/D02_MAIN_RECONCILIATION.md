# D02 × Main — reconciliation record

**Status:** integration in progress; not approved for merge or production.
**Target base:** `main` (snapshot inspected: `c5b78fd6915cdab3dfda586fd628879b308f82c1`).
**D02 source inspected:** `integration/d02-reconciled-main-2026-11-07` (head `b1eff366fd2db7c9291e258cf833359179bcb3bc`).

## Integration invariant

D02 persistence must be introduced as an infrastructure/data layer beneath the current main application. It must not replace the current `EnterpriseWorkspace` with the narrower D02 `FinanceWorkspace`. Existing finance, reconciliation, logistics, audit, proof/receipt, order-entry and white-label capabilities on main remain in scope and must continue to work.

## Confirmed contract differences

- Main finance domain uses `amount` in major currency units (BRL decimal values).
- D02 persistence uses `amount_minor` as integer minor units (centavos).
- The integration must use an explicit adapter at the persistence boundary. No implicit conversion, mixed-unit arithmetic, or silent rounding is acceptable.
- Main's `app/page.tsx` renders `EnterpriseWorkspace`; D02's page replaces it with authenticated `FinanceWorkspace`. Integration must preserve the former and add server-derived identity/organization context around it.
- Main login is client-side/local state; D02 adds Supabase SSR auth. The authenticated shell must be introduced without deleting existing workspace modules.

## Security blockers to resolve before enabling imports

1. The D02 migration `20261109130004_d02_transactional_imports.sql` revokes EXECUTE on both import functions from `authenticated` and then grants EXECUTE back to `authenticated`. This does not close direct client invocation.
2. The API route currently calls the RPC using the user-scoped Supabase client. Moving execution to a privileged backend client requires explicit server-side authentication and organization-membership validation, explicit actor attribution, and least-privilege grants. Do not assume `auth.uid()` is populated for service-role requests.
3. The same migration creates a Storage DELETE policy for tenant operators, conflicting with the earlier security-hardening migration's no-client-delete/immutable-artifact invariant.
4. The database tests currently assert that the public RPC is an invoker wrapper and that anonymous cannot execute the private implementation; they do not assert that authenticated cannot execute either function. Add explicit privilege assertions for `anon`, `authenticated`, and the trusted backend role.

## Required implementation sequence

1. Preserve main's workspace and module composition; integrate SSR auth and organization selection at the server boundary.
2. Implement a typed money adapter between major units in the existing UI and integer minor units in persistence. Add round-trip, negative, precision, and maximum-safe-value tests.
3. Move file parsing and privileged commit to a server-only path. Validate the authenticated user and tenant membership before using a service-role client. Attribute all records/audit events to the verified actor; never accept actor IDs or normalized records from the browser as authoritative.
4. Remove client-side Storage DELETE capability. Define a narrow server-side compensation path for the exact object uploaded by the same request and document retention.
5. Reconcile migrations against the actual remote migration history before applying anything. Do not duplicate an already-applied migration timestamp or edit an applied migration in place; add a forward corrective migration.
6. Update pgTAP and application tests, then run lint, typecheck, unit tests, production build, local Supabase migrations and pgTAP.
7. Run two-tenant end-to-end tests for login/session refresh, membership revocation, import, duplicate handling, pagination, Storage access, audit attribution and cross-tenant denial.
8. Record the exact tested commit SHA and CI run evidence. Keep the PR draft until every gate is satisfied.

## Current verification limits

This record documents source inspection only. It is not evidence that the application has been built, that migrations have been applied, that pgTAP or end-to-end tests pass, or that remote Supabase configuration has been verified. No production migration, merge, or deployment is authorized by this record.


## Implemented slice on the integration branch

- Supabase SSR client, server-only service client, sign-in/sign-out actions and an authenticated organization-membership gate are now present.
- The main `EnterpriseWorkspace` and its modules remain in place; the D02 replacement workspace was not copied over.
- `POST /api/imports` parses CSV/OFX on the server, checks membership using the user's session, stores the original artifact using the server secret, and calls a service-role-only trusted RPC.
- The trusted RPC sets transaction-local actor attribution only after validating the service-role claim and rechecking the actor's tenant role. The legacy RPCs and private schema are revoked from browser roles.
- Storage client-side DELETE policy is removed.
- `lib/finance-persistence.ts` is the explicit major-unit/centavo boundary.
- Node CI passed at commit `337a0c0` and earlier at `ecccd23`: `npm ci`, `npm audit --audit-level=high`, `npm test`, typecheck and production build.
- pgTAP found and corrected a test-plan count mismatch. A rerun is in progress on the current head; do not treat database tests as passed until that run completes.

## Remaining integration work

- Pass the verified organization UUID and authenticated user context into the existing workspace modules; remove reliance on localStorage identity and simulated superadmin email lists.
- Connect the existing import UI to `POST /api/imports` and hydrate persisted records through tenant-filtered queries.
- Migrate reconciliation, receipts/proofs, orders and operational datasets from localStorage to tenant-scoped persistence without changing their business behavior.
- Add two-tenant end-to-end coverage and verify remote migration history/configuration before any deployment.
