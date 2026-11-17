begin;

select plan(8);

select has_schema('sandbox', 'sandbox schema exists after migrations');
select has_table('sandbox', 'organizations', 'sandbox organizations table exists');
select has_table('sandbox', 'organization_memberships', 'sandbox memberships table exists');
select has_table('sandbox', 'validation_cases', 'validation cases table exists');
select has_table('sandbox', 'validation_runs', 'validation runs table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'sandbox.organizations'::regclass),
  'sandbox organizations enforce RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'sandbox.organization_memberships'::regclass),
  'sandbox memberships enforce RLS'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.sandbox_record_validation_run(text,text,text,jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.sandbox_record_validation_run(text,text,text,jsonb)',
    'EXECUTE'
  ),
  'validation RPC is executable by authenticated users only'
);

select * from finish();
rollback;
