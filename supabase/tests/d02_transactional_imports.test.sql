begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(5);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','00000000-0000-0000-0000-000000000000','authenticated','authenticated','import-a@test.invalid','',now(),now(),now()),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','00000000-0000-0000-0000-000000000000','authenticated','authenticated','import-b@test.invalid','',now(),now(),now())
on conflict (id) do nothing;

insert into public.organizations (id,legal_name,display_name)
values
 ('55555555-5555-4555-8555-555555555555','Import A Ltda','Import A'),
 ('66666666-6666-4666-8666-666666666666','Import B Ltda','Import B')
on conflict (id) do nothing;

insert into public.organization_memberships (organization_id,user_id,role)
values
 ('55555555-5555-4555-8555-555555555555','dddddddd-dddd-4ddd-8ddd-dddddddddddd','operator'),
 ('66666666-6666-4666-8666-666666666666','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','operator')
on conflict do nothing;

insert into storage.objects (bucket_id,name,metadata)
values
 ('rsbuild-source-artifacts','55555555-5555-4555-8555-555555555555/imports/sample.csv','{"mimetype":"text/csv"}'),
 ('rsbuild-source-artifacts','55555555-5555-4555-8555-555555555555/imports/sample-again.csv','{"mimetype":"text/csv"}'),
 ('rsbuild-source-artifacts','55555555-5555-4555-8555-555555555555/imports/invalid.csv','{"mimetype":"text/csv"}');

set local role authenticated;
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);

select is(
 (select inserted_count from public.commit_financial_import(
  '55555555-5555-4555-8555-555555555555',
  'sample.csv',repeat('a',64),10,
  '55555555-5555-4555-8555-555555555555/imports/sample.csv',
  '[{"transaction_date":"2026-11-04","description":"Teste idempotente","amount_minor":"1234","direction":"entrada","category":"Teste","deduplication_key":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","raw_payload":{}}]'::jsonb
 )),
 1,
 'authorized operator can commit an import atomically'
);

select is(
 (select count(*)::int from public.financial_records
  where organization_id='55555555-5555-4555-8555-555555555555'
    and deduplication_key=repeat('a',64)),
 1,
 'financial row is persisted exactly once'
);

select is(
 (select inserted_count from public.commit_financial_import(
  '55555555-5555-4555-8555-555555555555',
  'sample-again.csv',repeat('b',64),10,
  '55555555-5555-4555-8555-555555555555/imports/sample-again.csv',
  '[{"transaction_date":"2026-11-04","description":"Teste idempotente","amount_minor":"1234","direction":"entrada","category":"Teste","deduplication_key":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","raw_payload":{}}]'::jsonb
 )),
 0,
 're-import of the same business record is idempotent'
);

select throws_ok(
 $$select * from public.commit_financial_import(
  '55555555-5555-4555-8555-555555555555',
  'invalid.csv',repeat('d',64),10,
  '55555555-5555-4555-8555-555555555555/imports/invalid.csv',
  '[{"transaction_date":"not-a-date","description":"Bad row","amount_minor":"100","direction":"entrada","category":"Teste","deduplication_key":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","raw_payload":{}}]'::jsonb
 )$$,
 '22023',
 null,
 'malformed import records are rejected before any batch is committed'
);

select throws_ok(
 $$select * from public.commit_financial_import(
  '66666666-6666-4666-8666-666666666666',
  'foreign.csv',repeat('c',64),10,
  '66666666-6666-4666-8666-666666666666/imports/foreign.csv',
  '[{"transaction_date":"2026-11-04","description":"Tenant B","amount_minor":"100","direction":"entrada","category":"Teste","deduplication_key":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","raw_payload":{}}]'::jsonb
 )$$,
 '42501',
 null,
 'operator from tenant A cannot commit an import for tenant B'
);

select * from finish();
rollback;
