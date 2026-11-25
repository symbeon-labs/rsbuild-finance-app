-- Promoção Oficial: Homologação Ciclo 01 -> Mundo do Sabor Operacional (Produção)
-- Provisiona contas bancárias oficiais (Itaú e Safra) e habilita a esteira operacional
-- Registra o evento de auditoria de governança da promoção de QA para Produção

do $$
declare
  v_ms_prod_id uuid;
  v_itau_acc_id uuid;
  v_safra_acc_id uuid;
begin
  -- 1. IDENTIFICAR ORGANIZAÇÃO OPERACIONAL MUNDO DO SABOR
  select id into v_ms_prod_id
  from public.organizations
  where slug in ('mundo_sabor', 'mundo-do-sabor')
  limit 1;

  if v_ms_prod_id is null then
    -- Se não existir, provisiona o tenant operacional com slug oficial
    v_ms_prod_id := 'c5356414-adce-4fdc-941b-15cfe26b991e'::uuid;
    insert into public.organizations (id, legal_name, display_name, slug, status, created_at, updated_at)
    values (v_ms_prod_id, 'Mundo do Sabor Alimentos Ltda', 'Mundo do Sabor', 'mundo_sabor', 'active', now(), now())
    on conflict (id) do update
    set legal_name = excluded.legal_name,
        display_name = excluded.display_name,
        slug = excluded.slug,
        status = 'active',
        updated_at = now();
  else
    update public.organizations
    set status = 'active', updated_at = now()
    where id = v_ms_prod_id;
  end if;

  -- 2. PROVISIONAR CONTAS BANCÁRIAS HOMOLOGADAS NO AMBIENTE OPERACIONAL
  -- Conta 1: Itaú Unibanco (0341) - Agência 0341 / Conta 12345-6
  select id into v_itau_acc_id
  from public.financial_accounts
  where organization_id = v_ms_prod_id and bank_code = '0341'
  limit 1;

  if v_itau_acc_id is null then
    insert into public.financial_accounts (
      id, organization_id, name, institution, bank_code, branch_id,
      account_type, currency, external_reference, is_active, created_at, updated_at
    ) values (
      gen_random_uuid(), v_ms_prod_id, 'Itaú Unibanco · Conta Principal', 'Itaú Unibanco', '0341', '0341',
      'checking', 'BRL', '12345-6', true, now(), now()
    );
  else
    update public.financial_accounts
    set is_active = true, updated_at = now()
    where id = v_itau_acc_id;
  end if;

  -- Conta 2: Banco Safra (0422) - Conta 00987654-3
  select id into v_safra_acc_id
  from public.financial_accounts
  where organization_id = v_ms_prod_id and bank_code = '0422'
  limit 1;

  if v_safra_acc_id is null then
    insert into public.financial_accounts (
      id, organization_id, name, institution, bank_code, branch_id,
      account_type, currency, external_reference, is_active, created_at, updated_at
    ) values (
      gen_random_uuid(), v_ms_prod_id, 'Banco Safra · Cobrança e Títulos', 'Banco Safra', '0422', '0001',
      'checking', 'BRL', '00987654-3', true, now(), now()
    );
  else
    update public.financial_accounts
    set is_active = true, updated_at = now()
    where id = v_safra_acc_id;
  end if;

  -- 3. REGISTRAR EVENTO NA TRILHA DE AUDITORIA FORMAL (RS Guardião / JEV)
  insert into public.audit_events (
    organization_id, actor_id, event_type, entity_type, entity_id,
    occurred_at, correlation_id, metadata
  ) values (
    v_ms_prod_id,
    null,
    'governance.qa_promotion_to_production',
    'organization',
    v_ms_prod_id,
    now(),
    gen_random_uuid(),
    jsonb_build_object(
      'source_model', 'mundo_sabor_qa',
      'cycle', 'Ciclo 01',
      'homologation_attendees', array['Flávio', 'Vitor'],
      'executive_approval', 'Raquel (Diretoria)',
      'governance_rule', 'Regra Raquel - Alçadas e Segregação de Baixas',
      'promoted_modules', array['finance', 'reconciliation', 'logistics', 'audit'],
      'homologated_banks', array['Itaú (0341)', 'Safra (0422)'],
      'tested_titles_volume', 423
    )
  );

  raise notice 'Mundo do Sabor Operacional promovido com sucesso a partir do modelo QA.';
end $$;
