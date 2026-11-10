# Tenant onboarding — RSBUILD Finance

**Status:** implementation branch in review; no production migration or deployment executed.

## Canonical organization mapping

The linked Supabase project `rsbuild-finance-app` was queried on 2026-11-10. It contains exactly three active organizations, and the authenticated owner account has an `owner` membership in each.

| Application slug | Supabase display name | Existing organization UUID |
|---|---|---|
| `rsbuild` | RSBUILD Inovação | `0269fe05-0990-41a8-a28c-2919691eaf0f` |
| `hub_acai` | Hub Açaí Salvador | `ff3cdab7-3b25-4ea7-aabf-5ae4f9cd9a76` |
| `mundo_sabor` | Mundo do Sabor Alimentos | `c5356414-adce-4fdc-941b-15cfe26b991e` |

These are existing tenants. Do not create replacement organizations or change their UUID primary keys.

## Implementation in this branch

- Adds a canonical `organizations.slug` column with uniqueness and format constraints.
- Backfills the three existing organization records using their verified UUIDs.
- Loads `slug` alongside `id` and `display_name` in the server-rendered workspace entry point.
- Passes the canonical slug to `EnterpriseWorkspace`; removes the client-side organization-name heuristic.
- Retains UUID as the relational and authorization identifier. Membership checks remain server-side and continue to gate the organization selection.

## Migration and deployment gate

The Supabase project migration history currently includes migrations through `20261110004255_d02_trusted_import_boundary`. It does **not** include `20261110013000_d02_organization_admin_and_branding`, which exists on the D02 integration branch and is a prerequisite in this code lineage.

Do not apply this branch's slug migration to production in isolation. First reconcile and validate the complete D02 migration chain, including the organization-admin/branding migration, then apply migrations in order in a non-production environment and verify all three slug-to-UUID mappings plus cross-tenant access controls.

## Explicit non-goals

- No new organization creation.
- No membership changes or role changes.
- No migration of localStorage operational data.
- No changes to receivables, delivery proofs, or sales-order persistence yet.
- No production migration, deployment, or remote data mutation.
