# RSBUILD Security Operations

This runbook defines two manually triggered GitHub Actions workflows for the D02 security gates.

## Workflows

- **RSBUILD Security Audit** (`.github/workflows/security-audit.yml`): read-only inspection of roles, schema privileges, sensitive function execution, default ACLs, RLS/storage policies and pgTAP availability.
- **RSBUILD Security Remediation** (`.github/workflows/security-remediation.yml`): narrowly scoped revocation of future default privileges for objects created by `postgres` and `supabase_admin` in `public`, followed by an ACL assertion.

Neither workflow applies migrations, modifies business data, deploys the application, changes existing object grants, or configures Supabase Auth.

## Required GitHub configuration

### Repository Actions secret

Create `SUPABASE_DB_URL_READONLY` as a repository Actions secret. It must be a PostgreSQL connection string for the target Supabase project using a read-only database role. Do not use a service-role API key here.

### Protected environment

Create GitHub Environment `production-security` and configure required reviewers / prevent self-review where supported by the repository plan. Add `SUPABASE_DB_URL_ADMIN` as an **environment secret**. Its database identity must be explicitly authorized to manage default privileges for both owner roles.

The remediation job additionally requires the manual input `confirm=APPLY`. The workflow checks role membership before making changes and fails closed if the connection is not authorized. GitHub Environment protection is a separate control and must be configured in repository settings; merely naming an environment in YAML does not create required reviewers.

Use a dedicated credential with the minimum ownership/membership needed. Never put connection strings in workflow inputs, source files, artifacts, or logs. Rotate credentials after suspected exposure.

## Execution

1. Open **Actions → RSBUILD Security Audit → Run workflow** and provide a reason.
2. Inspect the uploaded report. Confirm the target database and connected role.
3. Configure and test the protected `production-security` environment.
4. Open **Actions → RSBUILD Security Remediation → Run workflow**. Supply `APPLY` and a change reference (for example, PR #32).
5. Review the job logs and download the 90-day remediation evidence artifact.
6. Run the read-only audit again and attach both reports to the security review / PR.

## Important limits

- PostgreSQL default privileges affect future objects created by the named owner roles; they do not retroactively change existing tables, sequences, or functions.
- The workflow does not attempt `SET ROLE` or bypass ownership checks.
- If the connection cannot administer defaults for either owner, the preflight aborts before any changes.
- Leaked Password Protection is an Auth configuration setting and is intentionally excluded. Enable it through the Supabase Dashboard (Authentication → Settings → Password Security) and record a separate screenshot/evidence.
- The audit can report whether pgTAP is installed, but clean-environment pgTAP execution remains the responsibility of the existing Database Tests / Full Verification workflows.
- Do not merge PR #32 or declare D02 production-homologated solely because these workflows exist or pass. Review actual outputs and close the remaining Auth, invitation/session, storage, two-tenant and migration/CI gates.

## Expected secrets

| Name | Scope | Purpose |
|---|---|---|
| `SUPABASE_DB_URL_READONLY` | Repository Actions secret | Read-only audit |
| `SUPABASE_DB_URL_ADMIN` | `production-security` environment secret | Approved default-ACL remediation |
