begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(4);
select ok(to_regprocedure('public.confirm_receivable_settlements(uuid,jsonb)') is not null,
  'atomic receivables settlement RPC exists');
select ok(has_function_privilege('authenticated',
  'public.confirm_receivable_settlements(uuid,jsonb)', 'EXECUTE'),
  'authenticated role can execute settlement RPC');
select ok(not has_function_privilege('anon',
  'public.confirm_receivable_settlements(uuid,jsonb)', 'EXECUTE'),
  'anonymous role cannot execute settlement RPC');
select ok((select relrowsecurity from pg_class where oid = 'public.receivable_titles'::regclass),
  'receivable titles remain protected by RLS');
select * from finish();
rollback;
