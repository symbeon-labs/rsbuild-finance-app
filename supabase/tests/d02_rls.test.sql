begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

-- Deterministic fixtures: two tenants, two operators and one viewer.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rsbuild-a-operator@test.invalid','',now(),now(),now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rsbuild-b-operator@test.invalid','',now(),now(),now()),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rsbuild-a-viewer@test.invalid','',now(),now(),now())
on conflict (id) do nothing;

insert into public.organizations (id, legal_name, display_name)
values
  ('11111111-1111-4111-8111-111111111111','Tenant A Ltda','Tenant A'),
  ('22222222-2222-4222-8222-222222222222','Tenant B Ltda','Tenant B')
on conflict (id) do nothing;

insert into public.organization_memberships (organization_id,user_id,role)
values
  ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','operator'),
  ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','operator'),
  ('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc','viewer')
on conflict do nothing;

insert into public.financial_accounts (id,organization_id,name)
values
  ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Conta A'),
  ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','Conta B')
on conflict (id) do nothing;

insert into storage.objects (bucket_id,name,metadata)
values
  ('rsbuild-source-artifacts','11111111-1111-4111-8111-111111111111/a/file-a.csv','{"mimetype":"text/csv"}'),
  ('rsbuild-source-artifacts','22222222-2222-4222-8222-222222222222/b/file-b.csv','{"mimetype":"text/csv"}')
on conflict (bucket_id,name) do nothing;

-- Operator A sees only Tenant A and cannot insert into Tenant B.
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select is(
  (select count(*)::int from public.organizations),
  1,
  'operator sees only the organization they belong to'
);
select is(
  (select count(*)::int from storage.objects where bucket_id='rsbuild-source-artifacts'),
  1,
  'operator sees only source objects under their tenant prefix'
);
select lives_ok(
  $$insert into public.financial_records
    (organization_id,account_id,transaction_date,description,amount_minor,direction,created_by)
    values ('11111111-1111-4111-8111-111111111111',
            '33333333-3333-4333-8333-333333333333',
            '2026-11-04','Test record',1250,'entrada',
            'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$$,
  'operator can insert a financial record in their tenant'
);
select is(
  (select created_by::text from public.financial_records
   where description='Test record'),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'created_by is derived from auth.uid(), not client input'
);
select throws_ok(
  $$insert into public.financial_records
    (organization_id,account_id,transaction_date,description,amount_minor,direction)
    values ('22222222-2222-4222-8222-222222222222',
            '44444444-4444-4444-8444-444444444444',
            '2026-11-04','Cross tenant',100,'entrada')$$,
  '42501',
  null,
  'operator cannot insert a financial record into another tenant'
);
select throws_ok(
  $$insert into public.source_artifacts
    (organization_id,storage_bucket,storage_path,file_sha256,file_size_bytes)
    values ('11111111-1111-4111-8111-111111111111',
            'rsbuild-source-artifacts',
            '22222222-2222-4222-8222-222222222222/foreign/file.csv',
            repeat('a',64),10)$$,
  '23514',
  null,
  'artifact storage path must start with its own tenant UUID'
);
reset role;

-- Tenant B cannot read Tenant A data.
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
select is(
  (select count(*)::int from public.financial_records),
  0,
  'tenant B cannot read tenant A financial records'
);
reset role;

-- Viewer has read access but cannot write.
set local role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
select is(
  (select count(*)::int from public.financial_accounts),
  1,
  'viewer can read accounts in their tenant'
);
select throws_ok(
  $$insert into public.financial_accounts (organization_id,name)
    values ('11111111-1111-4111-8111-111111111111','Viewer forbidden')$$,
  '42501',
  null,
  'viewer cannot insert financial accounts'
);
reset role;

select ok(
  not has_table_privilege('authenticated','public.financial_records','DELETE'),
  'authenticated role has no DELETE privilege on financial records'
);
select ok(
  not has_table_privilege('authenticated','public.import_batches','UPDATE'),
  'authenticated role cannot mutate import workflow state'
);
select ok(
  not has_table_privilege('authenticated','public.audit_events','INSERT'),
  'authenticated role cannot forge audit events'
);

select * from finish();
rollback;
