begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','00000000-0000-0000-0000-000000000000','authenticated','authenticated','import-a@test.invalid','',now(),now(),now()),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','00000000-0000-0000-0000-000000000000','authenticated','authenticated','import-b@test.invalid','',now(),now(),now())
on conflict (id) do nothing;

insert into public.organizations (id,legal_name,display_name,slug)
values
 ('55555555-5555-4555-8555-555555555555','Import A Ltda','Import A','import_a'),
 ('66666666-6666-4666-8666-666666666666','Import B Ltda','Import B','import_b')
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

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);

select is(
 (select inserted_count from public.commit_financial_import_trusted(
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
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
 (select duplicate_count from public.commit_financial_import_trusted(
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '55555555-5555-4555-8555-555555555555',
  'sample-again.csv',repeat('b',64),10,
  '55555555-5555-4555-8555-555555555555/imports/sample-again.csv',
  '[{"transaction_date":"2026-11-04","description":"Teste idempotente","amount_minor":"1234","direction":"entrada","category":"Teste","deduplication_key":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","raw_payload":{}}]'::jsonb
 )),
 1,
 're-import of the same business record is idempotent and increments duplicate_count'
);

select is(
 (select rejected_count from public.import_batches
  where organization_id='55555555-5555-4555-8555-555555555555'
  order by received_at desc limit 1),
 0,
 'a duplicate is not persisted as a rejected record'
);

select throws_ok(
 $$select * from public.commit_financial_import_trusted(
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
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
 $$select * from public.commit_financial_import_trusted(
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '66666666-6666-4666-8666-666666666666',
  'foreign.csv',repeat('c',64),10,
  '66666666-6666-4666-8666-666666666666/imports/foreign.csv',
  '[{"transaction_date":"2026-11-04","description":"Tenant B","amount_minor":"100","direction":"entrada","category":"Teste","deduplication_key":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","raw_payload":{}}]'::jsonb
 )$$,
 '42501',
 null,
 'operator from tenant A cannot commit an import for tenant B'
);

select ok(
  not has_function_privilege('anon','private.commit_financial_import(uuid,text,text,bigint,text,jsonb)','EXECUTE')
  and not has_function_privilege('authenticated','private.commit_financial_import(uuid,text,text,bigint,text,jsonb)','EXECUTE'),
  'browser roles cannot execute the private privileged import implementation'
);

select ok(
  not has_function_privilege('anon','public.commit_financial_import(uuid,text,text,bigint,text,jsonb)','EXECUTE')
  and not has_function_privilege('authenticated','public.commit_financial_import(uuid,text,text,bigint,text,jsonb)','EXECUTE'),
  'browser roles cannot invoke the legacy public import RPC'
);

select ok(
  has_function_privilege('service_role','public.commit_financial_import_trusted(uuid,uuid,text,text,bigint,text,jsonb)','EXECUTE')
  and not has_function_privilege('anon','public.commit_financial_import_trusted(uuid,uuid,text,text,bigint,text,jsonb)','EXECUTE')
  and not has_function_privilege('authenticated','public.commit_financial_import_trusted(uuid,uuid,text,text,bigint,text,jsonb)','EXECUTE'),
  'only trusted backend role can execute the trusted import entrypoint'
);

select ok(
  not (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'commit_financial_import'
  ),
  'legacy public RPC entrypoint is an invoker wrapper, not SECURITY DEFINER'
);

select * from finish();
rollback;
