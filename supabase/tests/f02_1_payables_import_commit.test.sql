begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

select has_column('public', 'payable_titles', 'recurrence_reference', 'payable titles preserve recurrence source reference');
select has_column('public', 'payable_titles', 'source_sheet_name', 'payable titles preserve workbook sheet provenance');
select has_column('public', 'payable_titles', 'source_row_number', 'payable titles preserve source row provenance');
select ok(to_regprocedure('public.commit_payable_import_trusted(uuid,uuid,text,text,bigint,text,text,text,text,integer,integer,integer,jsonb)') is not null,
  'trusted payable import RPC is exposed');
select ok(has_function_privilege('service_role',
  'public.commit_payable_import_trusted(uuid,uuid,text,text,bigint,text,text,text,text,integer,integer,integer,jsonb)', 'EXECUTE'),
  'service role can execute trusted payable import');
select ok(not has_function_privilege('authenticated',
  'public.commit_payable_import_trusted(uuid,uuid,text,text,bigint,text,text,text,text,integer,integer,integer,jsonb)', 'EXECUTE'),
  'authenticated clients cannot execute trusted payable import');
select ok(not has_function_privilege('anon',
  'public.commit_payable_import_trusted(uuid,uuid,text,text,bigint,text,text,text,text,integer,integer,integer,jsonb)', 'EXECUTE'),
  'anonymous clients cannot execute trusted payable import');

select * from finish();
rollback;
