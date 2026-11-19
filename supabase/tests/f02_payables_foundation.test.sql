begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

select has_table('public', 'payable_titles', 'payable titles table exists');
select has_table('public', 'payable_payment_allocations', 'payable payment allocations table exists');

select has_column('public', 'payable_titles', 'supplier_name', 'payable title stores supplier identity');
select has_column('public', 'payable_titles', 'amount_minor', 'payable title stores integer minor units');
select has_column('public', 'payable_titles', 'due_date', 'payable title stores due date');
select has_column('public', 'payable_titles', 'deduplication_key', 'payable title supports idempotent imports');
select has_column('public', 'payable_payment_allocations', 'payable_title_id', 'allocation references payable title');
select has_column('public', 'payable_payment_allocations', 'financial_record_id', 'allocation can reference a bank movement');

select has_index('public', 'payable_titles', 'payable_titles_org_dedup_uidx', 'payable title deduplication index exists');
select has_index('public', 'payable_titles', 'payable_titles_org_due_status_idx', 'payable due-date index exists');
select has_index('public', 'payable_payment_allocations', 'payable_allocations_org_idempotency_uidx', 'payment allocation idempotency index exists');
select has_index('public', 'payable_payment_allocations', 'payable_allocations_org_record_title_uidx', 'one allocation per title and bank movement is enforced');

select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'payable_titles'),
  'payable titles has row-level security enabled'
);
select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'payable_payment_allocations'),
  'payment allocations has row-level security enabled'
);

select * from finish();
rollback;
