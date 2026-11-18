# RSBUILD OS — G01 Rollout Runbook

**Status:** required before production activation  
**Scope:** platform administrator bootstrap, capability entitlements and controlled application cutover

## 1. Preconditions

- Confirm migrations `20261126000000_capability_licensing_governance` and `20261127000000_atomic_capability_license_changes` are present in the target database history.
- Review and apply `20261128000000_separate_platform_and_org_authority` in an isolated staging database first.
- Verify the three Sandbox tenant mappings: `hub-acai-sandbox → hub_acai`, `mundo-sabor-sandbox → mundo_sabor`, `rsbuild-sandbox → rsbuild`.
- Confirm the migration has created `public.platform_administrators`, added `entitled_environments` and `expires_at`, and replaced public privileged RPCs with SECURITY INVOKER wrappers.
- Do not run `sandbox_reset()` as part of the rollout.

## 2. Bootstrap the first Symbeon platform administrator

The migration intentionally creates no administrator. A human identity must be verified out-of-band.

1. Obtain the intended administrator's `auth.users.id` from a trusted administrative process.
2. Record the approver and reason.
3. In a privileged SQL session, insert the grant:

```sql
insert into public.platform_administrators (user_id, granted_by, reason)
values (
  '<VERIFIED_PLATFORM_ADMIN_USER_UUID>'::uuid,
  '<VERIFIED_APPROVER_USER_UUID>'::uuid,
  'G01 initial Symbeon platform administrator bootstrap'
);
```

Never use an organization role, email claim, browser metadata or client-provided UUID as proof of platform authority. Do not bootstrap the RSBUILD Owner by default.

## 3. Approve the entitlement matrix before cutover

The connected database currently has no capability-license rows. Because the API guards fail closed, every capability-protected endpoint will deny access until its tenant has an active grant for the environment being used.

Complete and approve this matrix before deploying the enforcement code:

| Tenant | Capability | QA | Sandbox | Production | Expiry | Approval / reason |
|---|---|---:|---:|---:|---|---|
| Mundo do Sabor | Finance | pending | pending | pending | pending | pending |
| Mundo do Sabor | Reconciliação | pending | pending | pending | pending | pending |
| Mundo do Sabor | Logística | pending | pending | pending | pending | pending |
| Mundo do Sabor | Auditoria | pending | pending | pending | pending | pending |
| Hub Açaí | Finance | pending | pending | pending | pending | pending |
| Hub Açaí | Reconciliação | pending | pending | pending | pending | pending |
| Hub Açaí | Logística | pending | pending | pending | pending | pending |
| Hub Açaí | Auditoria | pending | pending | pending | pending | pending |

Only approved cells should be granted. QA, Sandbox and Production are separate entitlements; do not infer one from another. Include RSBUILD/QA lanes only if their capability usage is explicitly approved.

## 4. Cutover order

1. Apply the G01 migration to staging.
2. Bootstrap the verified Symbeon administrator.
3. Deploy the application to staging.
4. Use `/platform-admin` to record the approved tenant/capability/environment grants and reasons.
5. Validate positive and negative cases:
   - RSBUILD Owner can administer RSBUILD but cannot grant platform licenses.
   - Platform administrator can manage licenses but has no tenant membership by virtue of that grant.
   - QA grant does not authorize Sandbox or Production.
   - Sandbox API and direct manual-validation RPC both reject missing/expired/suspended entitlements.
   - Revocation blocks subsequent use.
6. For production, schedule a controlled cutover window. Apply the migration, bootstrap the administrator, deploy the enforcement code, and enter the pre-approved entitlement matrix before reopening capability-protected workflows.
7. Re-run the negative tests and review the audit event trail.

## 5. Rollback / break-glass

- Do not delete platform administrator or license history rows to roll back a decision; revoke grants and preserve events.
- Break-glass access must be separately approved, time-bounded and logged.
- Any temporary bypass must be implemented as a reviewed server-side control with an expiry; never use a client-supplied flag.
- If entitlement data is unavailable, API guards return a denial rather than silently allowing access.

## 6. Current validation boundary

- The G01 migration and tests are in PR #88 and have not been applied to the connected database.
- The pgTAP suite contains 18 assertions; it still needs execution in isolated staging.
- The latest Vercel READY preview found during this sprint is older than the current branch head. It is not evidence that the current branch builds successfully.
