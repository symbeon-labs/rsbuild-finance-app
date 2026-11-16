-- RSBUILD OS — Sandbox Seed Data
-- Synthetic test data for safe component testing.
-- No real client data - all data is mock/synthetic.

-- Create sandbox organizations (mirroring real client structures)
insert into sandbox.organizations (slug, display_name, description) values
  ('hub-acai-sandbox', 'Hub Açaí Sandbox', 'Ambiente de testes para Hub Açaí - dados sintéticos'),
  ('mundo-sabor-sandbox', 'Mundo do Sabor Sandbox', 'Ambiente de testes para Mundo do Sabor - dados sintéticos'),
  ('rsbuild-sandbox', 'RSBUILD Sandbox', 'Ambiente de testes interno RSBUILD - dados sintéticos');

-- Create sandbox organization members (synthetic users)
insert into sandbox.organization_memberships (organization_id, user_id, role, custom_title)
select o.id, '00000000-0000-0000-0000-000000000001'::uuid, 'owner', 'Sandbox Admin'
from sandbox.organizations o
where o.slug = 'rsbuild-sandbox';

insert into sandbox.organization_memberships (organization_id, user_id, role, custom_title)
select o.id, '00000000-0000-0000-0000-000000000002'::uuid, 'admin', 'Test Admin'
from sandbox.organizations o
where o.slug = 'hub-acai-sandbox';

insert into sandbox.organization_memberships (organization_id, user_id, role, custom_title)
select o.id, '00000000-0000-0000-0000-000000000003'::uuid, 'operator', 'Test Operator'
from sandbox.organizations o
where o.slug = 'mundo-sabor-sandbox';

-- Create sandbox financial accounts (synthetic bank accounts)
insert into sandbox.financial_accounts (organization_id, name, institution, account_type, currency)
select o.id, 'Conta Corrente Sandbox', 'Banco Teste', 'checking', 'BRL'
from sandbox.organizations o
where o.slug = 'hub-acai-sandbox';

insert into sandbox.financial_accounts (organization_id, name, institution, account_type, currency)
select o.id, 'Conta Poupança Sandbox', 'Banco Teste', 'savings', 'BRL'
from sandbox.organizations o
where o.slug = 'mundo-sabor-sandbox';

-- Create sandbox financial records (synthetic transactions)
insert into sandbox.financial_records (organization_id, account_id, direction, amount_cents, description, transaction_date)
select 
  fa.organization_id,
  fa.id,
  'entrada',
  150000, -- R$ 1.500,00
  'Venda Sandbox - Pedido #12345',
  current_date - interval '1 day'
from sandbox.financial_accounts fa
join sandbox.organizations o on o.id = fa.organization_id
where o.slug = 'hub-acai-sandbox';

insert into sandbox.financial_records (organization_id, account_id, direction, amount_cents, description, transaction_date)
select 
  fa.organization_id,
  fa.id,
  'saída',
  50000, -- R$ 500,00
  'Pagamento Sandbox - Fornecedor',
  current_date - interval '2 days'
from sandbox.financial_accounts fa
join sandbox.organizations o on o.id = fa.organization_id
where o.slug = 'mundo-sabor-sandbox';

-- Create sandbox receivable titles (synthetic accounts receivable)
insert into sandbox.receivable_titles (organization_id, title_number, customer_name, amount_cents, due_date, status)
select 
  o.id,
  'TIT-SANDBOX-001',
  'Cliente Teste Sandbox',
  250000, -- R$ 2.500,00
  current_date + interval '7 days',
  'pending'
from sandbox.organizations o
where o.slug = 'hub-acai-sandbox';

insert into sandbox.receivable_titles (organization_id, title_number, customer_name, amount_cents, due_date, status)
select 
  o.id,
  'TIT-SANDBOX-002',
  'Cliente Teste Sandbox 2',
  180000, -- R$ 1.800,00
  current_date + interval '14 days',
  'pending'
from sandbox.organizations o
where o.slug = 'mundo-sabor-sandbox';

-- Create sandbox delivery proofs (synthetic delivery records)
insert into sandbox.delivery_proofs (organization_id, order_number, customer_name, delivery_date, status)
select 
  o.id,
  'PED-SANDBOX-001',
  'Cliente Teste Sandbox',
  current_date - interval '1 day',
  'delivered'
from sandbox.organizations o
where o.slug = 'hub-acai-sandbox';

insert into sandbox.delivery_proofs (organization_id, order_number, customer_name, delivery_date, status)
select 
  o.id,
  'PED-SANDBOX-002',
  'Cliente Teste Sandbox 2',
  current_date,
  'pending'
from sandbox.organizations o
where o.slug = 'mundo-sabor-sandbox';

-- Create sandbox audit events (for testing audit trails)
insert into sandbox.audit_events (organization_id, actor_id, actor_email, event_type, entity_type, entity_id, metadata)
select 
  o.id,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'sandbox-admin@test.com',
  'sandbox.test.created',
  'sandbox_organization',
  o.id,
  jsonb_build_object('test', true, 'timestamp', now())
from sandbox.organizations o
where o.slug = 'rsbuild-sandbox';

comment on table sandbox.organizations is 'Synthetic organizations for safe testing. No real client data.';
comment on table sandbox.financial_records is 'Synthetic financial transactions for testing. All data is mock.';
