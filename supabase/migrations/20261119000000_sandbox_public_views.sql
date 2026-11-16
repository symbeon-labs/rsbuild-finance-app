-- RSBUILD OS — Expose sandbox via public views + RPC (no schema exposure needed)
-- The sandbox schema stays hidden from PostgREST; only curated public views
-- (security_invoker, so base-table RLS still applies) and one guarded RPC
-- are reachable. Non-RSBUILD users get zero rows / exception.

-- Views: one per sandbox table, all security_invoker so RLS on sandbox.* applies
create or replace view public.sandbox_organizations
with (security_invoker = on) as
select * from sandbox.organizations;

create or replace view public.sandbox_organization_memberships
with (security_invoker = on) as
select * from sandbox.organization_memberships;

create or replace view public.sandbox_financial_accounts
with (security_invoker = on) as
select * from sandbox.financial_accounts;

create or replace view public.sandbox_financial_records
with (security_invoker = on) as
select * from sandbox.financial_records;

create or replace view public.sandbox_receivable_titles
with (security_invoker = on) as
select * from sandbox.receivable_titles;

create or replace view public.sandbox_delivery_proofs
with (security_invoker = on) as
select * from sandbox.delivery_proofs;

create or replace view public.sandbox_audit_events
with (security_invoker = on) as
select * from sandbox.audit_events;

grant select on public.sandbox_organizations to authenticated;
grant select on public.sandbox_organization_memberships to authenticated;
grant select on public.sandbox_financial_accounts to authenticated;
grant select on public.sandbox_financial_records to authenticated;
grant select on public.sandbox_receivable_titles to authenticated;
grant select on public.sandbox_delivery_proofs to authenticated;
grant select on public.sandbox_audit_events to authenticated;

-- Guarded reset: only RSBUILD owner may run; re-seeds synthetic data.
create or replace function public.sandbox_reset()
returns jsonb
language plpgsql
security definer
set search_path = public, sandbox
as $$
declare
  uid uuid := auth.uid();
  is_owner boolean;
begin
  select exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = uid
      and m.role = 'owner'
  ) into is_owner;

  if not is_owner then
    raise exception 'sandbox_reset_forbidden';
  end if;

  -- Clear sandbox tables (children before parents)
  delete from sandbox.audit_events;
  delete from sandbox.delivery_proofs;
  delete from sandbox.receivable_titles;
  delete from sandbox.financial_records;
  delete from sandbox.financial_accounts;
  delete from sandbox.organization_memberships;
  delete from sandbox.organizations;

  -- Re-seed synthetic organizations
  insert into sandbox.organizations (slug, display_name, description) values
    ('hub-acai-sandbox', 'Hub Açaí Sandbox', 'Ambiente de testes para Hub Açaí - dados sintéticos'),
    ('mundo-sabor-sandbox', 'Mundo do Sabor Sandbox', 'Ambiente de testes para Mundo do Sabor - dados sintéticos'),
    ('rsbuild-sandbox', 'RSBUILD Sandbox', 'Ambiente de testes interno RSBUILD - dados sintéticos');

  -- Members
  insert into sandbox.organization_memberships (organization_id, user_id, role, custom_title)
  select o.id, '00000000-0000-0000-0000-000000000001'::uuid, 'owner', 'Sandbox Admin'
  from sandbox.organizations o where o.slug = 'rsbuild-sandbox';

  insert into sandbox.organization_memberships (organization_id, user_id, role, custom_title)
  select o.id, '00000000-0000-0000-0000-000000000002'::uuid, 'admin', 'Test Admin'
  from sandbox.organizations o where o.slug = 'hub-acai-sandbox';

  insert into sandbox.organization_memberships (organization_id, user_id, role, custom_title)
  select o.id, '00000000-0000-0000-0000-000000000003'::uuid, 'operator', 'Test Operator'
  from sandbox.organizations o where o.slug = 'mundo-sabor-sandbox';

  -- Financial accounts
  insert into sandbox.financial_accounts (organization_id, name, institution, account_type, currency)
  select o.id, 'Conta Corrente Sandbox', 'Banco Teste', 'checking', 'BRL'
  from sandbox.organizations o where o.slug = 'hub-acai-sandbox';

  insert into sandbox.financial_accounts (organization_id, name, institution, account_type, currency)
  select o.id, 'Conta Poupança Sandbox', 'Banco Teste', 'savings', 'BRL'
  from sandbox.organizations o where o.slug = 'mundo-sabor-sandbox';

  -- Financial records
  insert into sandbox.financial_records (organization_id, account_id, direction, amount_cents, description, transaction_date)
  select fa.organization_id, fa.id, 'entrada', 150000,
         'Venda Sandbox - Pedido #12345', current_date - 1
  from sandbox.financial_accounts fa
  join sandbox.organizations o on o.id = fa.organization_id
  where o.slug = 'hub-acai-sandbox';

  insert into sandbox.financial_records (organization_id, account_id, direction, amount_cents, description, transaction_date)
  select fa.organization_id, fa.id, 'saída', 50000,
         'Pagamento Sandbox - Fornecedor', current_date - 2
  from sandbox.financial_accounts fa
  join sandbox.organizations o on o.id = fa.organization_id
  where o.slug = 'mundo-sabor-sandbox';

  -- Receivable titles
  insert into sandbox.receivable_titles (organization_id, title_number, customer_name, amount_cents, due_date, status)
  select o.id, 'TIT-SANDBOX-001', 'Cliente Teste Sandbox', 250000,
         current_date + 7, 'pending'
  from sandbox.organizations o where o.slug = 'hub-acai-sandbox';

  insert into sandbox.receivable_titles (organization_id, title_number, customer_name, amount_cents, due_date, status)
  select o.id, 'TIT-SANDBOX-002', 'Cliente Teste Sandbox 2', 180000,
         current_date + 14, 'pending'
  from sandbox.organizations o where o.slug = 'mundo-sabor-sandbox';

  -- Delivery proofs
  insert into sandbox.delivery_proofs (organization_id, order_number, customer_name, delivery_date, status)
  select o.id, 'PED-SANDBOX-001', 'Cliente Teste Sandbox',
         current_date - 1, 'delivered'
  from sandbox.organizations o where o.slug = 'hub-acai-sandbox';

  insert into sandbox.delivery_proofs (organization_id, order_number, customer_name, delivery_date, status)
  select o.id, 'PED-SANDBOX-002', 'Cliente Teste Sandbox 2',
         current_date, 'pending'
  from sandbox.organizations o where o.slug = 'mundo-sabor-sandbox';

  -- Audit events
  insert into sandbox.audit_events (organization_id, actor_id, actor_email, event_type, entity_type, entity_id, metadata)
  select o.id, '00000000-0000-0000-0000-000000000001'::uuid,
         'sandbox-admin@test.com', 'sandbox.test.created',
         'sandbox_organization', o.id,
         jsonb_build_object('test', true, 'timestamp', now())
  from sandbox.organizations o where o.slug = 'rsbuild-sandbox';

  return jsonb_build_object('success', true, 'message', 'Sandbox reset with synthetic data');
end;
$$;

revoke all on function public.sandbox_reset() from public;
grant execute on function public.sandbox_reset() to authenticated;

comment on view public.sandbox_organizations is 'Read-only view over sandbox.organizations; RLS of base table applies (RSBUILD owner/admin only).';
comment on function public.sandbox_reset() is 'Resets sandbox schema to synthetic seed. RSBUILD owner only.';
