begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

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


select ok(exists (select 1 from pg_trigger where tgrelid='public.payable_titles'::regclass and tgname='payable_titles_touch_updated_at' and not tgisinternal), 'payable titles updates updated_at automatically');
select ok(exists (select 1 from pg_trigger where tgrelid='public.payable_titles'::regclass and tgname='payable_titles_actor_guard' and not tgisinternal), 'payable titles enforces created_by attribution');
select ok(exists (select 1 from pg_trigger where tgrelid='public.payable_titles'::regclass and tgname='audit_payable_titles_insert' and not tgisinternal), 'payable title creation is audited');
select ok(exists (select 1 from pg_trigger where tgrelid='public.payable_titles'::regclass and tgname='audit_payable_titles_update' and not tgisinternal), 'payable title updates are audited');
select ok(exists (select 1 from pg_trigger where tgrelid='public.payable_payment_allocations'::regclass and tgname='payable_allocations_actor_guard' and not tgisinternal), 'payment allocations enforce created_by attribution');
select ok(exists (select 1 from pg_trigger where tgrelid='public.payable_payment_allocations'::regclass and tgname='payable_allocations_reversed_by_guard' and not tgisinternal), 'payment reversal enforces reversed_by attribution');
select ok(exists (select 1 from pg_trigger where tgrelid='public.payable_payment_allocations'::regclass and tgname='audit_payable_allocations_insert' and not tgisinternal), 'payment allocation creation is audited');
select ok(exists (select 1 from pg_trigger where tgrelid='public.payable_payment_allocations'::regclass and tgname='audit_payable_allocations_update' and not tgisinternal), 'payment allocation reversals/updates are audited');

select * from finish();
rollback;
