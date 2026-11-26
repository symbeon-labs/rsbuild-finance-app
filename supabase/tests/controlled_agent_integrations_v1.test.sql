begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
 ('e1111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','agent-owner@test.invalid','',now(),now(),now()),
 ('e2222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','agent-platform@test.invalid','',now(),now(),now())
on conflict (id) do nothing;

insert into public.organizations (id, legal_name, display_name, slug)
values ('e3333333-3333-4333-8333-333333333333','Agent tenant Ltda','Agent tenant','agent_v1_tenant')
on conflict (id) do nothing;

insert into public.organization_memberships (organization_id,user_id,role)
values ('e3333333-3333-4333-8333-333333333333','e1111111-1111-4111-8111-111111111111','owner'::public.rsbuild_member_role)
on conflict do nothing;

insert into public.agents (id,slug,display_name,kind,status,version,capabilities,protocol)
values ('e4444444-4444-4444-8444-444444444444','agent-v1-fixture','Agent V1 Fixture','cognitive','active','1.0.0','[]'::jsonb,'api')
on conflict (id) do nothing;

insert into public.agent_organization_grants (id,agent_id,organization_id,capabilities,status)
values ('e5555555-5555-4555-8555-555555555555','e4444444-4444-4444-8444-444444444444','e3333333-3333-4333-8333-333333333333','[]'::jsonb,'active')
on conflict (agent_id,organization_id) do nothing;

insert into public.platform_administrators (user_id,granted_by,reason)
values ('e2222222-2222-4222-8222-222222222222','e2222222-2222-4222-8222-222222222222','Agent V1 pgTAP fixture')
on conflict (user_id) do update set revoked_at=null,revoked_by=null;

select is(
  (select access_mode from public.agent_organization_grants where agent_id='e4444444-4444-4444-8444-444444444444'),
  'internal', 'existing grants receive internal mode by default'
);
select is(
  (select entitled_environments from public.agent_organization_grants where agent_id='e4444444-4444-4444-8444-444444444444'),
  array['qa']::text[], 'existing grants are restricted to QA by default'
);
select ok(
  not has_table_privilege('authenticated','public.agent_integrations','SELECT')
  and not has_table_privilege('authenticated','public.agent_integrations','INSERT')
  and not has_table_privilege('authenticated','public.agent_integrations','UPDATE')
  and not has_table_privilege('authenticated','public.agent_integrations','DELETE')
  and not has_table_privilege('anon','public.agent_integrations','SELECT'),
  'agent integration credentials have no direct client-role privileges'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','e1111111-1111-4111-8111-111111111111',true);
select ok(not public.is_platform_administrator(), 'tenant owner does not inherit platform authority');
select is((select count(*)::int from public.agents where id='e4444444-4444-4444-8444-444444444444'),0,
  'tenant owner cannot inspect the global agent registry');
select is((select count(*)::int from public.agent_organization_grants where agent_id='e4444444-4444-4444-8444-444444444444'),0,
  'tenant owner cannot inspect global agent grants');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','e2222222-2222-4222-8222-222222222222',true);
select ok(public.is_platform_administrator(), 'explicit platform administrator retains agent governance authority');
select is((select count(*)::int from public.agents where id='e4444444-4444-4444-8444-444444444444'),1,
  'platform administrator can inspect the global agent registry');
select is((select count(*)::int from public.agent_organization_grants where agent_id='e4444444-4444-4444-8444-444444444444'),1,
  'platform administrator can inspect agent grants');
reset role;

update public.platform_administrators set revoked_at=now() where user_id='e2222222-2222-4222-8222-222222222222';
select * from finish();
rollback;
