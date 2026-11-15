begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

-- Fixtures: dois tenants, um operador por tenant, um viewer no tenant A, um admin no tenant A.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','00000000-0000-0000-0000-000000000000','authenticated','authenticated','f01-a-operator@test.invalid','',now(),now(),now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','00000000-0000-0000-0000-000000000000','authenticated','authenticated','f01-b-operator@test.invalid','',now(),now(),now()),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','00000000-0000-0000-0000-000000000000','authenticated','authenticated','f01-a-viewer@test.invalid','',now(),now(),now()),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','00000000-0000-0000-0000-000000000000','authenticated','authenticated','f01-a-admin@test.invalid','',now(),now(),now())
on conflict (id) do nothing;

insert into public.organizations (id, legal_name, display_name, slug)
values
  ('11111111-1111-4111-8111-111111111111','F01 Tenant A Ltda','F01 Tenant A','f01_tenant_a'),
  ('22222222-2222-4222-8222-222222222222','F01 Tenant B Ltda','F01 Tenant B','f01_tenant_b')
on conflict (id) do nothing;

insert into public.organization_memberships (organization_id,user_id,role)
values
  ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','operator'),
  ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','operator'),
  ('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc','viewer'),
  ('11111111-1111-4111-8111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddddd','admin')
on conflict do nothing;

insert into public.receivable_titles
  (id, organization_id, document_number, customer_name, amount_minor, due_date, status)
values
  ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','NF-9001','Cliente A',150000,'2026-12-01','pendente'),
  ('66666666-6666-4666-8666-666666666666','22222222-2222-4222-8222-222222222222','NF-9002','Cliente B',250000,'2026-12-05','pendente')
on conflict (id) do nothing;

insert into public.delivery_proofs
  (id, organization_id, nfe_number, customer_name, nfe_amount_minor, status)
values
  ('77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111','9001','Cliente A',150000,'pendente_entrega')
on conflict (id) do nothing;

insert into public.whatsapp_orders
  (id, organization_id, raw_message, customer_name, payment_method, total_boxes, total_amount_minor, status)
values
  ('88888888-8888-4888-8888-888888888888','11111111-1111-4111-8111-111111111111','Pedido teste','Cliente A','pix',10,50000,'confirmado')
on conflict (id) do nothing;

insert into public.erp_snapshots (id, organization_id, source_label, record_count)
values ('99999999-9999-4999-8999-999999999999','11111111-1111-4111-8111-111111111111','Omie Test',1)
on conflict (id) do nothing;

insert into public.erp_movements
  (id, organization_id, snapshot_id, movement_date, description, amount_minor, direction)
values
  ('aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','99999999-9999-4999-8999-999999999999','2026-12-01','Venda NF-9001',150000,'entrada')
on conflict (id) do nothing;

-- =====================================================================
-- Operador do tenant A
-- =====================================================================
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);

select is(
  (select count(*)::int from public.receivable_titles),
  1,
  'operator lê apenas títulos do próprio tenant'
);
select is(
  (select count(*)::int from public.delivery_proofs),
  1,
  'operator lê apenas canhotos do próprio tenant'
);
select is(
  (select count(*)::int from public.whatsapp_orders),
  1,
  'operator lê apenas pedidos do próprio tenant'
);
select is(
  (select count(*)::int from public.erp_movements),
  1,
  'operator lê apenas movimentos ERP do próprio tenant'
);

select lives_ok(
  $$insert into public.receivable_titles
    (organization_id, document_number, customer_name, amount_minor, due_date)
    values ('11111111-1111-4111-8111-111111111111','NF-9003','Novo Cliente',99000,'2026-12-10')$$,
  'operator pode inserir título no próprio tenant'
);

select throws_ok(
  $$insert into public.receivable_titles
    (organization_id, document_number, customer_name, amount_minor, due_date)
    values ('22222222-2222-4222-8222-222222222222','NF-9004','Cross Tenant',1000,'2026-12-10')$$,
  '42501',
  null,
  'operator não pode inserir título em outro tenant'
);

select throws_ok(
  $$insert into public.settlements
    (organization_id, document_number, customer_name, amount_minor, settlement_date)
    values ('11111111-1111-4111-8111-111111111111','NF-9001','Cliente A',150000,'2026-12-02')$$,
  '42501',
  null,
  'operator não pode registrar baixa (somente owner/admin)'
);

-- =====================================================================
-- Viewer do tenant A (somente leitura)
-- =====================================================================
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);

select is(
  (select count(*)::int from public.receivable_titles),
  2,
  'viewer lê títulos do próprio tenant'
);

select throws_ok(
  $$insert into public.whatsapp_orders
    (organization_id, raw_message, customer_name, payment_method)
    values ('11111111-1111-4111-8111-111111111111','teste','Cliente A','pix')$$,
  '42501',
  null,
  'viewer não pode inserir pedido'
);

-- =====================================================================
-- Admin do tenant A (pode baixar)
-- =====================================================================
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);

select lives_ok(
  $$insert into public.settlements
    (organization_id, document_number, customer_name, amount_minor, settlement_date)
    values ('11111111-1111-4111-8111-111111111111','NF-9001','Cliente A',150000,'2026-12-02')$$,
  'admin pode registrar baixa no próprio tenant'
);

-- =====================================================================
-- Operador do tenant B não vê dados do tenant A
-- =====================================================================
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);

select is(
  (select count(*)::int from public.receivable_titles where organization_id='11111111-1111-4111-8111-111111111111'),
  0,
  'operador do tenant B não enxerga títulos do tenant A'
);

select is(
  (select count(*)::int from public.settlements),
  0,
  'operador do tenant B não enxerga baixas do tenant A'
);

select * from finish();
rollback;
