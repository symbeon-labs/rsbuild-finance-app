begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa-evaluator@test.invalid','',now(),now(),now()),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa-owner@test.invalid','',now(),now(),now()),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','00000000-0000-0000-0000-000000000000','authenticated','authenticated','other-tenant@test.invalid','',now(),now(),now())
on conflict (id) do nothing;

insert into public.organizations (id,legal_name,display_name,slug,status)
values
 ('11111111-1111-4111-8111-111111111111','Mundo QA Ltda','Mundo do Sabor QA','mundo_sabor_qa','active'),
 ('22222222-2222-4222-8222-222222222222','Other Ltda','Other Tenant','other_tenant','active')
on conflict (id) do nothing;

insert into public.organization_memberships (organization_id,user_id,role)
values
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','operator'),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','owner'),
 ('22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc','operator')
on conflict do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select lives_ok(
 $$insert into public.qa_evaluations
   (organization_id,workspace_slug,environment,module_key,feature_key,assessment,observation,created_by)
   values ('11111111-1111-4111-8111-111111111111','mundo_sabor_qa','qa','finance','importacoes','Atendeu ao esperado','Importação verificada','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
 'QA evaluator can submit an evaluation in the authorized QA workspace'
);
select is((select count(*)::int from public.qa_evaluations where organization_id='11111111-1111-4111-8111-111111111111'),1,
 'evaluation is persisted in the QA tenant');
select is((select count(*)::int from public.qa_evaluations),1,
 'evaluator can read their own evaluation');
select throws_ok(
 $$insert into public.qa_evaluations
   (organization_id,workspace_slug,environment,module_key,feature_key,assessment,created_by)
   values ('22222222-2222-4222-8222-222222222222','mundo_sabor_qa','qa','finance','importacoes','Atendeu ao esperado','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
 '42501', null, 'evaluator cannot submit into another tenant'
);
select throws_ok(
 $$insert into public.qa_evaluations
   (organization_id,workspace_slug,environment,module_key,feature_key,assessment,created_by)
   values ('11111111-1111-4111-8111-111111111111','mundo_sabor_qa','qa','finance','importacoes','Atendeu ao esperado','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$$,
 '42501', null, 'evaluator cannot forge another author'
);
select throws_ok(
 $$insert into public.qa_evaluations
   (organization_id,workspace_slug,environment,module_key,feature_key,assessment,created_by)
   values ('11111111-1111-4111-8111-111111111111','mundo_sabor','qa','finance','importacoes','Atendeu ao esperado','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
 '23514', null, 'official workspace slug is rejected'
);
select ok(not has_table_privilege('authenticated','public.qa_evaluations','UPDATE'),
 'evaluations are not updateable by authenticated clients');
select ok(not has_table_privilege('authenticated','public.qa_evaluations','DELETE'),
 'evaluations are not deletable by authenticated clients');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
select is((select count(*)::int from public.qa_evaluations),1,
 'organization owner can review evaluator submissions');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
select is((select count(*)::int from public.qa_evaluations),0,
 'another tenant cannot read QA evaluations');
select throws_ok(
 $$insert into public.qa_evaluations
   (organization_id,workspace_slug,environment,module_key,feature_key,assessment,created_by)
   values ('11111111-1111-4111-8111-111111111111','mundo_sabor_qa','qa','finance','importacoes','Atendeu ao esperado','cccccccc-cccc-4ccc-8ccc-cccccccccccc')$$,
 '42501', null, 'another tenant cannot submit into Mundo do Sabor QA'
);
reset role;

select * from finish();
rollback;
