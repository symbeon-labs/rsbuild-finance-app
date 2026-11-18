begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('77777777-7777-4777-8777-777777777777','00000000-0000-0000-0000-000000000000','authenticated','authenticated','audit-actor@test.invalid','',now(),now(),now())
on conflict (id) do nothing;

insert into public.organizations (id, legal_name, display_name, slug)
values ('88888888-8888-4888-8888-888888888888','Audit Test Ltda','Audit Test','audit_test')
on conflict (id) do nothing;

insert into public.organization_memberships (organization_id,user_id,role)
values ('88888888-8888-4888-8888-888888888888','77777777-7777-4777-8777-777777777777','operator')
on conflict do nothing;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',true);

insert into public.financial_records (
  id, organization_id, transaction_date, description, amount_minor, currency, direction, category, status, created_by
) values (
  '99999999-9999-4999-8999-999999999991','88888888-8888-4888-8888-888888888888',
  '2026-11-18','Audit test record',12500,'BRL','entrada','Recebimentos','pendente',
  '77777777-7777-4777-8777-777777777777'
);
update public.financial_records set status='conciliado', updated_at=now()
where id='99999999-9999-4999-8999-999999999991';

select is(
  (select event_type from public.audit_events where entity_id='99999999-9999-4999-8999-999999999991' order by id desc limit 1),
  'financial_record.updated',
  'financial record status update emits a row-level audit event'
);
select is(
  (select metadata->'before'->>'status' from public.audit_events where entity_id='99999999-9999-4999-8999-999999999991' order by id desc limit 1),
  'pendente',
  'financial record audit stores the previous status'
);
select is(
  (select metadata->'after'->>'status' from public.audit_events where entity_id='99999999-9999-4999-8999-999999999991' order by id desc limit 1),
  'conciliado',
  'financial record audit stores the new status'
);
select is(
  (select actor_id::text from public.audit_events where entity_id='99999999-9999-4999-8999-999999999991' order by id desc limit 1),
  '77777777-7777-4777-8777-777777777777',
  'audit event identifies the authenticated actor'
);

insert into public.receivable_titles (
  id, organization_id, document_number, customer_name, amount_minor, due_date, status, created_by
) values (
  '99999999-9999-4999-8999-999999999992','88888888-8888-4888-8888-888888888888',
  'QA-1028','Cliente Teste',25000,'2026-11-30','pendente','77777777-7777-4777-8777-777777777777'
);
update public.receivable_titles set status='baixado', updated_at=now()
where id='99999999-9999-4999-8999-999999999992';
select is(
  (select metadata->'before'->>'status' from public.audit_events where entity_id='99999999-9999-4999-8999-999999999992' order by id desc limit 1),
  'pendente',
  'title transition records its previous status'
);

insert into public.delivery_proofs (
  id, organization_id, nfe_number, customer_name, status, created_by
) values (
  '99999999-9999-4999-8999-999999999993','88888888-8888-4888-8888-888888888888',
  'NF-QA-1028','Cliente Teste','pendente_entrega','77777777-7777-4777-8777-777777777777'
);
update public.delivery_proofs set status='comprovado', updated_at=now()
where id='99999999-9999-4999-8999-999999999993';
select is(
  (select metadata->'after'->>'status' from public.audit_events where entity_id='99999999-9999-4999-8999-999999999993' order by id desc limit 1),
  'comprovado',
  'delivery proof transition records its new status'
);

insert into public.reconciliation_decisions (
  id, organization_id, financial_record_id, decision_type, justification, actor_id
) values (
  '99999999-9999-4999-8999-999999999994','88888888-8888-4888-8888-888888888888',
  '99999999-9999-4999-8999-999999999991','manual_match','Conferido no cenário de QA',
  '77777777-7777-4777-8777-777777777777'
);
select is(
  (select event_type from public.audit_events where entity_id='99999999-9999-4999-8999-999999999994' order by id desc limit 1),
  'reconciliation_decision.created',
  'each reconciliation decision is recorded with its own entity ID'
);
select is(
  (select metadata->'after'->>'financial_record_id' from public.audit_events where entity_id='99999999-9999-4999-8999-999999999994' order by id desc limit 1),
  '99999999-9999-4999-8999-999999999991',
  'reconciliation decision audit links to the financial record'
);

select * from finish();
rollback;
