begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
 ('c1111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','g01-owner@test.invalid','',now(),now(),now()),
 ('c2222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','g01-platform@test.invalid','',now(),now(),now())
on conflict (id) do nothing;

insert into public.organizations (id, legal_name, display_name, slug)
values ('d2222222-2222-4222-8222-222222222222','Tenant G01 Ltda','Tenant G01','g01_tenant')
on conflict (id) do nothing;

insert into public.organization_memberships (organization_id,user_id,role)
select id, 'c1111111-1111-4111-8111-111111111111', 'owner'::public.rsbuild_member_role
from public.organizations where slug='rsbuild'
on conflict do nothing;

insert into public.capability_catalog (capability_key, display_name, description)
values ('g01_test','G01 Test Capability','pgTAP fixture')
on conflict (capability_key) do nothing;

insert into public.platform_administrators (user_id, granted_by, reason)
values ('c2222222-2222-4222-8222-222222222222','c2222222-2222-4222-8222-222222222222','G01 pgTAP fixture')
on conflict (user_id) do update set revoked_at = null, revoked_by = null;

-- Organization owner retains tenant authority but is not a platform administrator.
set local role authenticated;
select set_config('request.jwt.claim.sub','c1111111-1111-4111-8111-111111111111',true);
select ok(not public.is_platform_administrator(), 'RSBUILD owner is not implicitly a platform administrator');
select throws_ok(
  $sql$select public.set_organization_capability_license('d2222222-2222-4222-8222-222222222222','g01_test','granted','active','owner must not grant')$sql$,
  '42501', null, 'RSBUILD owner cannot grant capability licenses'
);
select is(
  (select count(*)::int from public.organizations where id='d2222222-2222-4222-8222-222222222222'),
  0, 'RSBUILD owner cannot inspect unrelated tenant directory through platform policy'
);
reset role;

-- Platform administrator has platform licensing authority without tenant membership.
set local role authenticated;
select set_config('request.jwt.claim.sub','c2222222-2222-4222-8222-222222222222',true);
select ok(public.is_platform_administrator(), 'explicit platform grant enables platform authority');
select is(
  (select count(*)::int from public.organization_memberships where user_id='c2222222-2222-4222-8222-222222222222'),
  0, 'platform authority does not create tenant membership'
);
select is(
  (select count(*)::int from public.organizations where id='d2222222-2222-4222-8222-222222222222'),
  1, 'platform administrator can resolve tenant identity for licensing'
);
select lives_ok(
  $sql$select public.set_organization_capability_license('d2222222-2222-4222-8222-222222222222','g01_test','granted','active','G01 authorized grant')$sql$,
  'platform administrator can grant a capability through the audited RPC'
);
select is(
  (select count(*)::int from public.capability_license_events where organization_id='d2222222-2222-4222-8222-222222222222' and capability_key='g01_test'),
  1, 'license mutation appends one audit event'
);
reset role;

update public.platform_administrators
set revoked_at=now(), revoked_by='c1111111-1111-4111-8111-111111111111'
where user_id='c2222222-2222-4222-8222-222222222222';

set local role authenticated;
select set_config('request.jwt.claim.sub','c2222222-2222-4222-8222-222222222222',true);
select ok(not public.is_platform_administrator(), 'revocation immediately removes platform authority');
reset role;

select * from finish();
rollback;
