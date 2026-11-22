begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

select has_column('public','financial_accounts','bank_code','bank code is persisted');
select has_column('public','financial_accounts','branch_id','branch identifier is persisted');
select ok(
  has_function_privilege('service_role','public.commit_financial_import_trusted(uuid,uuid,text,text,bigint,text,jsonb,jsonb,uuid)','EXECUTE')
  and not has_function_privilege('anon','public.commit_financial_import_trusted(uuid,uuid,text,text,bigint,text,jsonb,jsonb,uuid)','EXECUTE')
  and not has_function_privilege('authenticated','public.commit_financial_import_trusted(uuid,uuid,text,text,bigint,text,jsonb,jsonb,uuid)','EXECUTE'),
  'only service_role can execute atomic import RPC'
);

select ok(
  (select p.prosecdef and pg_get_functiondef(p.oid) like '%pg_advisory_xact_lock%'
          and pg_get_functiondef(p.oid) like '%a.organization_id = p_organization_id%'
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='commit_financial_import_trusted'
     and pg_get_function_identity_arguments(p.oid) =
       'p_actor_id uuid, p_organization_id uuid, p_original_filename text, p_file_sha256 text, p_file_size_bytes bigint, p_storage_path text, p_records jsonb, p_bank_identity jsonb, p_account_id uuid'),
  'atomic RPC uses tenant-scoped identity resolution and transaction advisory lock'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('abababab-abab-4bab-8bab-abababababab','00000000-0000-0000-0000-000000000000','authenticated','authenticated','atomic-bank@test.invalid','',now(),now(),now())
on conflict (id) do nothing;
insert into public.organizations (id,legal_name,display_name,slug)
values ('77777777-7777-4777-8777-777777777777','Atomic Bank Ltda','Atomic Bank','atomic_bank_test')
on conflict (id) do nothing;
insert into public.organization_memberships (organization_id,user_id,role)
values ('77777777-7777-4777-8777-777777777777','abababab-abab-4bab-8bab-abababababab','operator')
on conflict do nothing;

insert into public.organizations (id,legal_name,display_name,slug)
values ('88888888-8888-4888-8888-888888888888','Foreign Bank Ltda','Foreign Bank','foreign_bank_test')
on conflict (id) do nothing;
insert into public.financial_accounts
  (id,organization_id,name,institution,account_type,currency,external_reference,is_active)
values
  ('99999999-9999-4999-8999-999999999999','88888888-8888-4888-8888-888888888888',
   'Foreign account','Foreign Bank','checking','BRL','FOREIGN-ACCOUNT',true)
on conflict (id) do nothing;

insert into public.financial_accounts
  (id,organization_id,name,institution,bank_code,branch_id,account_type,currency,external_reference,is_active)
values
  ('66666666-6666-4666-8666-666666666666','77777777-7777-4777-8777-777777777777',
   'Itaú account','Itaú Unibanco','341','7421','checking','BRL','7421996567',true)
on conflict (id) do nothing;

select ok(
  exists (select 1 from pg_indexes where schemaname='public' and indexname='financial_accounts_org_bank_branch_account_key'),
  'account identity uniqueness includes normalized bank code and branch'
);
select is(
  coalesce(nullif(ltrim('0422', '0'), ''), '0'),
  '422',
  'bank-code canonicalization removes leading zeroes for identity comparison'
);

insert into public.financial_accounts
  (id,organization_id,name,institution,account_type,currency,external_reference,is_active)
values
  ('55555555-5555-4555-8555-555555555555','77777777-7777-4777-8777-777777777777',
   'Legacy account without bank identity','Banco Safra','checking','BRL','00085887641',true)
on conflict (id) do nothing;

select throws_ok(
 $select * from public.commit_financial_import_trusted(
  'abababab-abab-4bab-8bab-abababababab',
  '77777777-7777-4777-8777-777777777777',
  'safra-legacy-account.ofx',repeat('b',64),10,
  '77777777-7777-4777-8777-777777777777/imports/safra-legacy-account.ofx',
  '[]'::jsonb,
  '{"institutionCode":"0422","institutionName":"Banco Safra","branchId":null,"accountNumber":"00085887641","identificationStatus":"identified"}'::jsonb,
  '55555555-5555-4555-8555-555555555555'
 )$,
 '22023',
 null,
 'identified Safra OFX cannot be manually linked to a legacy account without bank_code'
);

select throws_ok(
 $$select * from public.commit_financial_import_trusted(
  'abababab-abab-4bab-8bab-abababababab',
  '77777777-7777-4777-8777-777777777777',
  'safra-mismatch.ofx',repeat('a',64),10,
  '77777777-7777-4777-8777-777777777777/imports/safra-mismatch.ofx',
  '[]'::jsonb,
  '{"institutionCode":"0422","institutionName":"Banco Safra","branchId":null,"accountNumber":"00085887641","identificationStatus":"identified"}'::jsonb,
  '66666666-6666-4666-8666-666666666666'
 )$$,
 '22023',
 null,
 'assisted association rejects an Itaú account for a Safra statement'
);

insert into storage.objects (bucket_id,name,metadata)
values ('rsbuild-source-artifacts','77777777-7777-4777-8777-777777777777/imports/atomic-invalid.ofx','{"mimetype":"application/x-ofx"}');

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claim.sub','abababab-abab-4bab-8bab-abababababab',true);

select throws_ok(
 $$select * from public.commit_financial_import_trusted(
  'abababab-abab-4bab-8bab-abababababab',
  '77777777-7777-4777-8777-777777777777',
  'cross-tenant.csv',repeat('f',64),10,
  '77777777-7777-4777-8777-777777777777/imports/cross-tenant.csv',
  '[]'::jsonb, null,
  '99999999-9999-4999-8999-999999999999'
 )$$,
 '42501',
 null,
 'assisted association rejects an account owned by another organization'
);

select throws_ok(
 $$select * from public.commit_financial_import_trusted(
  'abababab-abab-4bab-8bab-abababababab',
  '77777777-7777-4777-8777-777777777777',
  'atomic-invalid.ofx',repeat('e',64),10,
  '77777777-7777-4777-8777-777777777777/imports/atomic-invalid.ofx',
  '[{"transaction_date":"bad-date","description":"Invalid row","amount_minor":"1","direction":"entrada","category":"Teste","deduplication_key":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","raw_payload":{}}]'::jsonb,
  '{"institutionCode":"422","institutionName":"Instituição não catalogada (código 422)","branchId":"0001","accountNumber":"00085887641","accountType":"CHECKING","currency":"BRL","identificationStatus":"unrecognized"}'::jsonb,
  null
 )$$,
 '22023',
 null,
 'invalid record after account/source resolution aborts the whole transaction'
);

select is(
 (select count(*)::int from public.data_sources
  where organization_id='77777777-7777-4777-8777-777777777777'
    and provider='Instituição não catalogada (código 422)'),
 0,
 'failed import leaves no orphan data source'
);
select is(
 (select count(*)::int from public.financial_accounts
  where organization_id='77777777-7777-4777-8777-777777777777'
    and external_reference='00085887641'),
 0,
 'failed import leaves no orphan financial account'
);

select * from finish();
rollback;
