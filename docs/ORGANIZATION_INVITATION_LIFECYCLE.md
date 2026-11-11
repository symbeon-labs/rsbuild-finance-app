# Organization invitation lifecycle

## Contract

- An organization owner or admin may invite a person as viewer or operator.
- Only an owner may grant the admin role.
- Invitation rows are created before the email side effect and remain auditable as pending, sent, failed, accepted, revoked, or expired.
- Invitations expire after seven days in the application database. Supabase Auth invitation-link expiry is configured separately in the Auth project settings and must not exceed the intended onboarding window.
- A membership is created only after the recipient follows the invitation link, exchanges the Auth code, and the server verifies the authenticated user's ID and email against the exact invitation UUID.
- Existing memberships are never overwritten or demoted during invitation acceptance.
- Revoked, expired, accepted, or mismatched invitation IDs cannot provision access.
- Browser roles cannot mutate invitation audit rows. Only the trusted server client can write them.

## Required deployment sequence

1. Confirm the prerequisite migration `20261110013000_d02_organization_admin_and_branding.sql` is present in the target database.
2. Apply `20261111120000_organization_invitation_lifecycle.sql` in a non-production environment first.
3. Run `supabase/tests/organization_invitation_lifecycle.test.sql` with the project's database test harness.
4. Add the Preview and production callback URLs to Supabase Auth's allowed redirect URLs. The callback must preserve the `invitationId` query parameter.
5. Confirm the Supabase Invite User email template and SMTP delivery are configured.
6. Test create, accept, wrong-email, revoked, expired, duplicate, and cross-tenant cases with synthetic accounts.
7. Record the tested commit and evidence before production approval.

## Resend behavior

The standard Supabase Auth resend endpoint supports signup, SMS, email-change, and phone-change OTPs; it does not provide a dedicated resend operation for an existing invite. This UI therefore does not advertise a resend action. A future resend feature requires a deliberate email-delivery design, for example a custom mail provider paired with a newly generated invite action link. Do not expose generated action links or OTPs in logs or API responses.

## Partial failures and recovery

- If Auth delivery fails after the audit row is created, the row is marked failed and can be revoked. A new invitation attempt can replace a failed/revoked/expired row.
- If the email is sent but the database update of `invited_user_id` fails, the callback can still claim the pending invitation only when the verified email matches the invitation record. The RPC then binds the Auth user ID.
- If acceptance fails, the callback signs out the newly authenticated user and does not grant membership.
- A failure after the membership insert but before invitation status update is protected by the database transaction: the function runs atomically.

## Explicit limits

- Revocation blocks future acceptance. It does not remove an already accepted organization membership.
- Inviting an email that already has a confirmed Supabase Auth account is rejected by Supabase's invite endpoint. Adding existing users requires a separate verified account-selection flow; do not bypass this by creating memberships from unverified email input.
- No database migration is applied automatically by this feature branch.
