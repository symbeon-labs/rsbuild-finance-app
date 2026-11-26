begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(29);

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

select ok(
  not has_table_privilege('authenticated','public.intelligence_registry','SELECT')
  and not has_table_privilege('authenticated','public.intelligence_registry','INSERT')
  and not has_table_privilege('authenticated','public.intelligence_registry','UPDATE')
  and not has_table_privilege('authenticated','public.intelligence_registry','DELETE')
  and not has_table_privilege('anon','public.intelligence_registry','SELECT')
  and not has_table_privilege('anon','public.intelligence_registry','INSERT'),
  'global intelligence registry has no direct client-role privileges'
);
select ok(
  (select relrowsecurity from pg_class where oid='public.intelligence_registry'::regclass),
  'global intelligence registry enforces row-level security'
);
select ok(
  (select count(*) = 2 from pg_constraint
   where conrelid='public.intelligence_registry'::regclass
     and conname in ('intelligence_registry_name_nonempty','intelligence_registry_source_https')),
  'intelligence registry validates names and HTTPS source references'
);

select ok(
  not has_table_privilege('authenticated','public.intelligence_assignments','SELECT')
  and not has_table_privilege('authenticated','public.intelligence_assignments','INSERT')
  and not has_table_privilege('authenticated','public.intelligence_assignments','UPDATE')
  and not has_table_privilege('authenticated','public.intelligence_assignments','DELETE')
  and not has_table_privilege('anon','public.intelligence_assignments','SELECT'),
  'intelligence assignments have no direct client-role privileges'
);
select ok(
  (select relrowsecurity from pg_class where oid='public.intelligence_assignments'::regclass),
  'intelligence assignments enforce row-level security'
);
select ok(
  (select count(*) = 3 from pg_constraint
   where conrelid='public.intelligence_assignments'::regclass
     and conname in ('intelligence_assignments_environments','intelligence_assignments_production_contractual','intelligence_assignments_approval_state')),
  'assignments enforce environment, production and approval constraints'
);
select ok(
  has_function_privilege('authenticated','public.create_intelligence_assignment(uuid,uuid,text,text[],timestamp with time zone)','EXECUTE')
  and not has_function_privilege('anon','public.create_intelligence_assignment(uuid,uuid,text,text[],timestamp with time zone)','EXECUTE')
  and has_function_privilege('authenticated','public.revoke_intelligence_assignment(uuid)','EXECUTE')
  and not has_function_privilege('anon','public.revoke_intelligence_assignment(uuid)','EXECUTE'),
  'assignment mutation RPCs are authenticated-only'
);

select ok(
  has_function_privilege('authenticated','public.register_intelligence(text,text,text,text,text,text,text,jsonb,text,text)','EXECUTE')
  and not has_function_privilege('anon','public.register_intelligence(text,text,text,text,text,text,text,jsonb,text,text)','EXECUTE')
  and has_function_privilege('authenticated','public.save_agent_integration(uuid,uuid,text,text,text,text,text,text)','EXECUTE')
  and not has_function_privilege('anon','public.save_agent_integration(uuid,uuid,text,text,text,text,text,text)','EXECUTE'),
  'registry and connection mutation RPCs are authenticated-only'
);

select ok(
  not has_table_privilege('authenticated','public.intelligence_connections','SELECT')
  and not has_table_privilege('authenticated','public.intelligence_connections','INSERT')
  and not has_table_privilege('authenticated','public.intelligence_connections','UPDATE')
  and not has_table_privilege('authenticated','public.intelligence_connections','DELETE')
  and not has_table_privilege('anon','public.intelligence_connections','SELECT')
  and (select relrowsecurity from pg_class where oid='public.intelligence_connections'::regclass)
  and has_function_privilege('authenticated','public.save_intelligence_connection(uuid,uuid,text,text,text,text,text,text)','EXECUTE')
  and not has_function_privilege('anon','public.save_intelligence_connection(uuid,uuid,text,text,text,text,text,text)','EXECUTE'),
  'canonical connections are protected by RLS and authenticated-only RPCs'
);

insert into public.intelligence_registry(
 id,name,intelligence_type,provider,config,status,legacy_agent_id
) values (
 'e6666666-6666-4666-8666-666666666666','Agent V1 Assignment Fixture',
 'agent','openai','{}'::jsonb,'registered','e4444444-4444-4444-8444-444444444444'
) on conflict(id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub','e1111111-1111-4111-8111-111111111111',true);
select throws_ok(
 $q$select public.save_intelligence_connection(
   'e6666666-6666-4666-8666-666666666666',
   'e3333333-3333-4333-8333-333333333333',
   'openai','Canonical fixture','https://api.example.test','fixture-model',
   'encrypted-test-credential-value','****value'
 )$q$,
 '42501', null,
 'canonical connection cannot be configured without an active assignment'
);
select throws_ok(
 $q$select public.save_agent_integration(
   'e4444444-4444-4444-8444-444444444444',
   'e3333333-3333-4333-8333-333333333333',
   'openai','Fixture','https://api.example.test','fixture-model',
   'encrypted-test-credential-value','****value'
 )$q$,
 '42501', null,
 'connection cannot be configured without an active intelligence assignment'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','e2222222-2222-4222-8222-222222222222',true);
select lives_ok(
 $q$select public.register_intelligence(
   'Registry Audit Fixture',null,'llm','openai',null,null,null,'{}'::jsonb,null,null
 )$q$,
 'platform administrator can register an intelligence'
);
select is(
 (select count(*)::int from public.audit_events
  where event_type='intelligence.registered'
    and entity_type='intelligence_registry'),
 1,
 'registry creation and audit event are committed together'
);
select lives_ok(
 $q$select public.create_intelligence_assignment(
   'e6666666-6666-4666-8666-666666666666',
   'e3333333-3333-4333-8333-333333333333',
   'beta',array['qa']::text[],null
 )$q$,
 'platform administrator can authorize an intelligence for a tenant'
);
select lives_ok(
 $q$select public.save_intelligence_connection(
   'e6666666-6666-4666-8666-666666666666',
   'e3333333-3333-4333-8333-333333333333',
   'openai','Canonical fixture','https://api.example.test','fixture-model',
   'encrypted-test-credential-value','****value'
 )$q$,
 'active assignment permits a canonical intelligence connection'
);
select is(
 (select count(*)::int from public.audit_events
  where event_type='intelligence.connection.configured'
    and entity_type='intelligence_connection'),
 1,
 'canonical connection and audit event are committed together'
);
select lives_ok(
 $q$select public.save_agent_integration(
   'e4444444-4444-4444-8444-444444444444',
   'e3333333-3333-4333-8333-333333333333',
   'openai','Fixture','https://api.example.test','fixture-model',
   'encrypted-test-credential-value','****value'
 )$q$,
 'active assignment permits credential configuration'
);
select is(
 (select count(*)::int from public.audit_events
  where event_type='agent.integration.configured'
    and entity_type='agent_integration'),
 1,
 'connection configuration writes an audit event in the same transaction'
);
select lives_ok(
 $q$select public.revoke_intelligence_assignment((
   select id from public.intelligence_assignments
   where intelligence_id='e6666666-6666-4666-8666-666666666666'
     and organization_id='e3333333-3333-4333-8333-333333333333'
 ))$q$,
 'revoking assignment succeeds'
);
select is(
 (select status from public.intelligence_connections
  where intelligence_id='e6666666-6666-4666-8666-666666666666'
    and organization_id='e3333333-3333-4333-8333-333333333333'
    and provider='openai'),
 'disabled',
 'revoking assignment automatically disables its stored connection'
);
reset role;

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
