begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

select has_table('public','dre_classifications','current DRE classifications table exists');
select has_table('public','dre_classification_events','append-only DRE event table exists');
select has_column('public','dre_classifications','reviewed_by','manual reviewer is persisted');
select has_column('public','dre_classifications','rule_version','classification rule version is persisted');
select has_column('public','dre_classifications','allocations','unit allocations are persisted as JSON');

select ok((select relrowsecurity from pg_class where oid='public.dre_classifications'::regclass),'classifications table has RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.dre_classification_events'::regclass),'classification event table has RLS enabled');
select ok((select prosecdef from pg_proc where oid='public.save_dre_classification(uuid,uuid,text,text,numeric,text,text,text,text,jsonb)'::regprocedure),'write RPC is SECURITY DEFINER');
select ok(has_function_privilege('authenticated','public.save_dre_classification(uuid,uuid,text,text,numeric,text,text,text,text,jsonb)','EXECUTE'),'authenticated users can invoke the guarded write RPC');
select ok(not has_table_privilege('authenticated','public.dre_classifications','INSERT,UPDATE,DELETE'),'authenticated users cannot write classifications directly');
select ok(not has_table_privilege('authenticated','public.dre_classification_events','INSERT,UPDATE,DELETE'),'authenticated users cannot mutate the event history directly');
select ok(exists(select 1 from pg_constraint where conrelid='public.dre_classification_events'::regclass and conname='dre_classification_events_org_classification_fkey'),'event history enforces same-tenant classification reference');

select * from finish();
rollback;
