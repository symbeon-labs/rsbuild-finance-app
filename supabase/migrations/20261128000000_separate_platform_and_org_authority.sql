-- RSBUILD OS — separate platform authority from organization ownership.
-- Fail-closed bootstrap: no platform administrator is created automatically.
-- Provision the first Symbeon platform administrator out-of-band using the
-- Supabase SQL editor/service-role process after verifying the human identity.

create table if not exists public.platform_administrators (
  user_id uuid primary key references auth.users(id) on delete restrict,
  granted_by uuid references auth.users(id) on delete set null,
  reason text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  constraint platform_admin_reason_nonempty check (length(trim(reason)) > 0)
);

create index if not exists platform_administrators_active_idx
  on public.platform_administrators(user_id) where revoked_at is null;

alter table public.platform_administrators enable row level security;
revoke all on public.platform_administrators from public, anon, authenticated;
grant select on public.platform_administrators to authenticated;

drop policy if exists "Platform administrators read own grant" on public.platform_administrators;
create policy "Platform administrators read own grant"
  on public.platform_administrators for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.is_platform_administrator()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_administrators pa
    where pa.user_id = (select auth.uid())
      and pa.revoked_at is null
  );
$$;

revoke all on function public.is_platform_administrator() from public, anon;
grant execute on function public.is_platform_administrator() to authenticated;

-- Platform administrators need the minimal organization directory required
-- by the SECURITY INVOKER licensing RPC. This does not grant tenant data access.
-- Remove the former institutional-owner directory grant. Platform identity
-- metadata is now visible only to explicit platform administrators.
drop policy if exists "RSBUILD owners read organization directory" on public.organizations;

drop policy if exists "Platform administrators read organization directory" on public.organizations;
create policy "Platform administrators read organization directory"
  on public.organizations for select to authenticated
  using ((select public.is_platform_administrator()));



-- Scope every license explicitly to environments and an optional validity window.
alter table public.organization_capability_licenses
  add column if not exists entitled_environments text[] not null default '{}'::text[],
  add column if not exists expires_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.organization_capability_licenses'::regclass
      and conname = 'organization_capability_licenses_environment_scope_check'
  ) then
    alter table public.organization_capability_licenses
      add constraint organization_capability_licenses_environment_scope_check
      check (entitled_environments <@ array['qa','sandbox','production']::text[]);
  end if;
end;
$$;

-- Link each synthetic sandbox organization to its real tenant identity.
-- This is metadata only; it does not copy production data into Sandbox.
alter table sandbox.organizations
  add column if not exists organization_id uuid;

update sandbox.organizations so
set organization_id = o.id
from public.organizations o
where so.organization_id is null
  and so.slug = replace(o.slug, '_', '-') || '-sandbox';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'sandbox.organizations'::regclass
      and conname = 'sandbox_organizations_tenant_fk'
  ) then
    alter table sandbox.organizations
      add constraint sandbox_organizations_tenant_fk
      foreign key (organization_id) references public.organizations(id) on delete restrict;
  end if;
end;
$$;

create index if not exists sandbox_organizations_tenant_idx
  on sandbox.organizations(organization_id);

-- Refresh the security-invoker view so the server can resolve the tenant link.
create or replace view public.sandbox_organizations
with (security_invoker = on) as
select * from sandbox.organizations;

-- Narrow boolean check for sandbox entitlement. It returns no license data and
-- does not grant platform administration or tenant membership.
create or replace function app_private.has_sandbox_capability_entitlements(
  p_sandbox_organization_id uuid,
  p_capability_keys text[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tenant_organization_id uuid;
begin
  if v_uid is null or p_sandbox_organization_id is null
    or p_capability_keys is null or cardinality(p_capability_keys) = 0 then
    return false;
  end if;

  -- p_sandbox_organization_id is the synthetic Sandbox organization ID. Resolve the
  -- tenant link from the nullable FK first, then by deterministic slug mapping.
  select coalesce(so.organization_id, o.id)
    into v_tenant_organization_id
  from sandbox.organizations so
  left join public.organizations o
    on so.slug = replace(o.slug, '_', '-') || '-sandbox'
  where so.id = p_sandbox_organization_id;

  if v_tenant_organization_id is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = v_uid
      and (
        m.role in ('owner', 'admin')
        or (
          m.role = 'operator'
          and exists (
            select 1
            from sandbox.organizations so
            join sandbox.organization_memberships sm on sm.organization_id = so.id
            where so.id = p_sandbox_organization_id
              and sm.user_id = v_uid
          )
        )
      )
  ) then
    return false;
  end if;

  return not exists (
    select 1
    from unnest(p_capability_keys) as requested(capability_key)
    where requested.capability_key not in ('finance', 'reconciliation', 'logistics', 'audit')
      or not exists (
        select 1
        from public.organization_capability_licenses l
        where l.organization_id = v_tenant_organization_id
          and l.capability_key = requested.capability_key
          and l.license_status = 'granted'
          and l.operational_status = 'active'
          and l.entitled_environments @> array['sandbox']::text[]
          and (l.expires_at is null or l.expires_at > now())
      )
  );
end;
$$;

revoke all on function app_private.has_sandbox_capability_entitlements(uuid, text[]) from public, anon;
grant execute on function app_private.has_sandbox_capability_entitlements(uuid, text[]) to authenticated;

-- Public PostgREST entry point is INVOKER; privileged lookup stays private.
create or replace function public.has_sandbox_capability_entitlements(
  p_sandbox_organization_id uuid,
  p_capability_keys text[]
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select app_private.has_sandbox_capability_entitlements(p_sandbox_organization_id, p_capability_keys);
$$;
revoke all on function public.has_sandbox_capability_entitlements(uuid, text[]) from public, anon;
grant execute on function public.has_sandbox_capability_entitlements(uuid, text[]) to authenticated;


-- Move project authorization predicates out of the exposed API schema.
create or replace function app_private.can_operate_rsbuild_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.projects p
      join public.organization_memberships m on m.organization_id = p.managing_organization_id
      join public.organizations o on o.id = m.organization_id
      where p.id = target_project_id and o.slug = 'rsbuild'
        and m.user_id = (select auth.uid()) and m.role in ('owner', 'admin')
    )
    or exists (
      select 1 from public.project_memberships pm
      where pm.project_id = target_project_id and pm.user_id = (select auth.uid())
        and pm.access_level = 'contributor'
    );
$$;
revoke all on function app_private.can_operate_rsbuild_project(uuid) from public, anon;
grant execute on function app_private.can_operate_rsbuild_project(uuid) to authenticated;

create or replace function public.can_operate_rsbuild_project(target_project_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select app_private.can_operate_rsbuild_project(target_project_id);
$$;
revoke all on function public.can_operate_rsbuild_project(uuid) from public, anon;
grant execute on function public.can_operate_rsbuild_project(uuid) to authenticated;

create or replace function app_private.can_read_rsbuild_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.projects p
      join public.organization_memberships m on m.organization_id = p.managing_organization_id
      join public.organizations o on o.id = m.organization_id
      where p.id = target_project_id and o.slug = 'rsbuild'
        and m.user_id = (select auth.uid()) and m.role in ('owner', 'admin')
    )
    or exists (
      select 1 from public.project_memberships pm
      where pm.project_id = target_project_id and pm.user_id = (select auth.uid())
        and pm.access_level in ('viewer', 'contributor')
    )
    or exists (
      select 1 from public.project_organization_access pa
      join public.organization_memberships cm on cm.organization_id = pa.client_organization_id
      where pa.project_id = target_project_id and cm.user_id = (select auth.uid())
    );
$$;
revoke all on function app_private.can_read_rsbuild_project(uuid) from public, anon;
grant execute on function app_private.can_read_rsbuild_project(uuid) to authenticated;

create or replace function public.can_read_rsbuild_project(target_project_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select app_private.can_read_rsbuild_project(target_project_id);
$$;
revoke all on function public.can_read_rsbuild_project(uuid) from public, anon;
grant execute on function public.can_read_rsbuild_project(uuid) to authenticated;

-- Rebuild Sandbox reset behind a private DEFINER implementation. The public
-- RPC is INVOKER and the synthetic organizations retain their tenant mapping.
create or replace function app_private.sandbox_reset()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_owner boolean;
begin
  select exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild' and m.user_id = v_uid and m.role = 'owner'
  ) into v_is_owner;

  if v_uid is null or not v_is_owner then
    raise exception 'sandbox_reset_forbidden' using errcode = '42501';
  end if;

  delete from sandbox.audit_events;
  delete from sandbox.delivery_proofs;
  delete from sandbox.receivable_titles;
  delete from sandbox.financial_records;
  delete from sandbox.financial_accounts;
  delete from sandbox.organization_memberships;
  delete from sandbox.organizations;

  insert into sandbox.organizations (slug, display_name, description, organization_id)
  select seed.slug, seed.display_name, seed.description, o.id
  from (values
    ('hub-acai-sandbox', 'Hub Açaí Sandbox', 'Ambiente de testes para Hub Açaí - dados sintéticos', 'hub_acai'),
    ('mundo-sabor-sandbox', 'Mundo do Sabor Sandbox', 'Ambiente de testes para Mundo do Sabor - dados sintéticos', 'mundo_sabor'),
    ('rsbuild-sandbox', 'RSBUILD Sandbox', 'Ambiente de testes interno RSBUILD - dados sintéticos', 'rsbuild')
  ) as seed(slug, display_name, description, tenant_slug)
  join public.organizations o on o.slug = seed.tenant_slug;

  if (select count(*) from sandbox.organizations) <> 3 then
    raise exception 'sandbox_tenant_mapping_missing';
  end if;

  insert into sandbox.organization_memberships (organization_id, user_id, role, custom_title)
  select o.id, '00000000-0000-0000-0000-000000000001'::uuid, 'owner', 'Sandbox Admin'
  from sandbox.organizations o where o.slug = 'rsbuild-sandbox';

  insert into sandbox.organization_memberships (organization_id, user_id, role, custom_title)
  select o.id, '00000000-0000-0000-0000-000000000002'::uuid, 'admin', 'Test Admin'
  from sandbox.organizations o where o.slug = 'hub-acai-sandbox';

  insert into sandbox.organization_memberships (organization_id, user_id, role, custom_title)
  select o.id, '00000000-0000-0000-0000-000000000003'::uuid, 'operator', 'Test Operator'
  from sandbox.organizations o where o.slug = 'mundo-sabor-sandbox';

  insert into sandbox.financial_accounts (organization_id, name, institution, account_type, currency)
  select o.id, 'Conta Corrente Sandbox', 'Banco Teste', 'checking', 'BRL'
  from sandbox.organizations o where o.slug = 'hub-acai-sandbox';

  insert into sandbox.financial_accounts (organization_id, name, institution, account_type, currency)
  select o.id, 'Conta Poupança Sandbox', 'Banco Teste', 'savings', 'BRL'
  from sandbox.organizations o where o.slug = 'mundo-sabor-sandbox';

  insert into sandbox.financial_records (organization_id, account_id, direction, amount_cents, description, transaction_date)
  select fa.organization_id, fa.id, 'entrada', 150000, 'Venda Sandbox - Pedido #12345', current_date - 1
  from sandbox.financial_accounts fa
  join sandbox.organizations o on o.id = fa.organization_id
  where o.slug = 'hub-acai-sandbox';

  insert into sandbox.financial_records (organization_id, account_id, direction, amount_cents, description, transaction_date)
  select fa.organization_id, fa.id, 'saída', 50000, 'Pagamento Sandbox - Fornecedor', current_date - 2
  from sandbox.financial_accounts fa
  join sandbox.organizations o on o.id = fa.organization_id
  where o.slug = 'mundo-sabor-sandbox';

  insert into sandbox.receivable_titles (organization_id, title_number, customer_name, amount_cents, due_date, status)
  select o.id, 'TIT-SANDBOX-001', 'Cliente Teste Sandbox', 250000, current_date + 7, 'pending'
  from sandbox.organizations o where o.slug = 'hub-acai-sandbox';

  insert into sandbox.receivable_titles (organization_id, title_number, customer_name, amount_cents, due_date, status)
  select o.id, 'TIT-SANDBOX-002', 'Cliente Teste Sandbox 2', 180000, current_date + 14, 'pending'
  from sandbox.organizations o where o.slug = 'mundo-sabor-sandbox';

  insert into sandbox.delivery_proofs (organization_id, order_number, customer_name, delivery_date, status)
  select o.id, 'PED-SANDBOX-001', 'Cliente Teste Sandbox', current_date - 1, 'delivered'
  from sandbox.organizations o where o.slug = 'hub-acai-sandbox';

  insert into sandbox.delivery_proofs (organization_id, order_number, customer_name, delivery_date, status)
  select o.id, 'PED-SANDBOX-002', 'Cliente Teste Sandbox 2', current_date, 'pending'
  from sandbox.organizations o where o.slug = 'mundo-sabor-sandbox';

  insert into sandbox.audit_events (organization_id, actor_id, actor_email, event_type, entity_type, entity_id, metadata)
  select o.id, '00000000-0000-0000-0000-000000000001'::uuid,
    'sandbox-admin@test.com', 'sandbox.test.created', 'sandbox_organization', o.id,
    jsonb_build_object('test', true, 'timestamp', now())
  from sandbox.organizations o where o.slug = 'rsbuild-sandbox';

  return jsonb_build_object('success', true, 'message', 'Sandbox reset with synthetic data');
end;
$$;
revoke all on function app_private.sandbox_reset() from public, anon;
grant execute on function app_private.sandbox_reset() to authenticated;

create or replace function public.sandbox_reset()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app_private.sandbox_reset();
$$;
revoke all on function public.sandbox_reset() from public, anon;
grant execute on function public.sandbox_reset() to authenticated;


-- Manual homologation writes must enforce the same Sandbox entitlements even
-- when the RPC is called directly, outside the Next.js route.
create or replace function app_private.sandbox_record_validation_run(
  p_case_code text,
  p_status text,
  p_summary text,
  p_result jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_case sandbox.validation_cases%rowtype;
  v_run_id uuid;
  v_sandbox_org_id uuid;
  v_tenant_org_id uuid;
begin
  if v_uid is null or p_status is null or p_status not in ('passed', 'failed', 'blocked') then
    raise exception 'invalid_validation_request' using errcode = '22023';
  end if;

  select so.id, coalesce(so.organization_id, o.id)
    into v_sandbox_org_id, v_tenant_org_id
  from sandbox.organizations so
  left join public.organizations o
    on so.slug = replace(o.slug, '_', '-') || '-sandbox'
  where so.slug = 'mundo-sabor-sandbox';

  if v_sandbox_org_id is null or v_tenant_org_id is null then
    raise exception 'sandbox_tenant_mapping_missing';
  end if;

  if not exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild' and m.user_id = v_uid
      and (
        m.role in ('owner', 'admin')
        or (
          m.role = 'operator'
          and exists (
            select 1
            from sandbox.organization_memberships sm
            where sm.organization_id = v_sandbox_org_id
              and sm.user_id = v_uid
          )
        )
      )
  ) then
    raise exception 'sandbox_validation_forbidden' using errcode = '42501';
  end if;

  if not app_private.has_sandbox_capability_entitlements(
    v_sandbox_org_id, array['finance', 'reconciliation', 'logistics', 'audit']::text[]
  ) then
    raise exception 'sandbox_capability_not_entitled' using errcode = '42501';
  end if;

  select * into v_case
  from sandbox.validation_cases
  where case_code = p_case_code and enabled;

  if not found then raise exception 'validation_case_not_found'; end if;

  select email into v_email from auth.users where id = v_uid;
  insert into sandbox.validation_runs (
    case_id, case_code, status, summary, result, actor_id, actor_email
  ) values (
    v_case.id, v_case.case_code, p_status, left(coalesce(p_summary, ''), 1000),
    coalesce(p_result, '{}'::jsonb), v_uid, v_email
  ) returning id into v_run_id;

  insert into sandbox.audit_events (
    organization_id, actor_id, actor_email, event_type, entity_type, entity_id, metadata
  )
  select id, v_uid, v_email, 'sandbox.validation.executed', 'validation_run', v_run_id,
    jsonb_build_object('case_code', p_case_code, 'status', p_status)
  from sandbox.organizations where slug = 'rsbuild-sandbox';

  return jsonb_build_object('success', true, 'run_id', v_run_id);
end;
$$;
revoke all on function app_private.sandbox_record_validation_run(text, text, text, jsonb) from public, anon;
grant execute on function app_private.sandbox_record_validation_run(text, text, text, jsonb) to authenticated;

create or replace function public.sandbox_record_validation_run(
  p_case_code text,
  p_status text,
  p_summary text,
  p_result jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app_private.sandbox_record_validation_run(p_case_code, p_status, p_summary, p_result);
$$;
revoke all on function public.sandbox_record_validation_run(text, text, text, jsonb) from public, anon;
grant execute on function public.sandbox_record_validation_run(text, text, text, jsonb) to authenticated;

-- Remove organization-owner authority over platform-wide licensing.
drop policy if exists "RSBUILD owners manage capability licenses" on public.organization_capability_licenses;
drop policy if exists "RSBUILD owners read all capability licenses" on public.organization_capability_licenses;
drop policy if exists "RSBUILD owners read capability license events" on public.capability_license_events;
drop policy if exists "RSBUILD owners append capability license events" on public.capability_license_events;

drop policy if exists "Platform administrators manage capability licenses" on public.organization_capability_licenses;
drop policy if exists "Platform administrators read all capability licenses" on public.organization_capability_licenses;
create policy "Platform administrators read all capability licenses"
  on public.organization_capability_licenses for select to authenticated
  using ((select public.is_platform_administrator()));

-- All license mutations must pass through the audited RPC. Direct client DML
-- would bypass the atomic event write, even if an RLS policy allowed it.
revoke insert, update, delete on public.organization_capability_licenses from public, anon, authenticated;
revoke insert, update, delete on public.capability_license_events from public, anon, authenticated;
drop policy if exists "Platform administrators append capability license events" on public.capability_license_events;

drop policy if exists "Platform administrators read capability license events" on public.capability_license_events;

create policy "Platform administrators read capability license events"
  on public.capability_license_events for select to authenticated
  using ((select public.is_platform_administrator()));


-- Replace the licensing RPC authorization boundary. The transaction and
-- append-only event remain atomic; authority and environment scope are checked
-- server-side. Drop the previous signature to avoid an ambiguous overload.
drop function if exists public.set_organization_capability_license(uuid, text, text, text, text);

create function app_private.set_organization_capability_license(
  p_organization_id uuid,
  p_capability_key text,
  p_license_status text,
  p_operational_status text,
  p_reason text default null,
  p_entitled_environments text[] default '{}'::text[],
  p_expires_at timestamptz default null
)
returns public.organization_capability_licenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_previous public.organization_capability_licenses;
  v_next public.organization_capability_licenses;
  v_event text;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_platform_administrator() then
    raise exception 'Only a Symbeon platform administrator may manage capability licenses'
      using errcode = '42501';
  end if;

  if p_license_status is null or p_license_status not in ('blocked', 'granted', 'suspended', 'revoked') then
    raise exception 'Invalid license status' using errcode = '22023';
  end if;
  if p_operational_status is null or p_operational_status not in ('not_implemented', 'in_development', 'available', 'active') then
    raise exception 'Invalid operational status' using errcode = '22023';
  end if;
  if p_entitled_environments is null
    or exists (
      select 1 from unnest(p_entitled_environments) as env
      where env not in ('qa', 'sandbox', 'production')
    ) then
    raise exception 'Invalid environment entitlement' using errcode = '22023';
  end if;
  if p_license_status = 'granted' and cardinality(p_entitled_environments) = 0 then
    raise exception 'A granted license requires at least one entitled environment' using errcode = '22023';
  end if;
  if p_license_status = 'granted' and p_expires_at is not null and p_expires_at <= now() then
    raise exception 'License expiration must be in the future' using errcode = '22023';
  end if;
  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'Organization not found';
  end if;
  if not exists (select 1 from public.capability_catalog where capability_key = p_capability_key) then
    raise exception 'Capability not found';
  end if;

  select * into v_previous
  from public.organization_capability_licenses
  where organization_id = p_organization_id and capability_key = p_capability_key
  for update;

  insert into public.organization_capability_licenses (
    organization_id, capability_key, license_status, operational_status,
    granted_by, granted_at, updated_by, updated_at, notes,
    entitled_environments, expires_at
  ) values (
    p_organization_id, p_capability_key, p_license_status, p_operational_status,
    case when p_license_status = 'granted' then v_actor else null end,
    case when p_license_status = 'granted' then now() else null end,
    v_actor, now(), nullif(trim(coalesce(p_reason, '')), ''),
    p_entitled_environments, p_expires_at
  )
  on conflict (organization_id, capability_key) do update set
    license_status = excluded.license_status,
    operational_status = excluded.operational_status,
    granted_by = case
      when excluded.license_status = 'granted'
        and organization_capability_licenses.license_status <> 'granted' then v_actor
      else organization_capability_licenses.granted_by end,
    granted_at = case
      when excluded.license_status = 'granted'
        and organization_capability_licenses.license_status <> 'granted' then now()
      else organization_capability_licenses.granted_at end,
    updated_by = v_actor,
    updated_at = now(),
    notes = coalesce(excluded.notes, organization_capability_licenses.notes),
    entitled_environments = excluded.entitled_environments,
    expires_at = excluded.expires_at
  returning * into v_next;

  v_event := case
    when v_previous.id is null then 'created'
    when p_license_status = 'granted' and v_previous.license_status <> 'granted' then 'granted'
    when p_license_status = 'suspended' and v_previous.license_status <> 'suspended' then 'suspended'
    when p_license_status = 'revoked' and v_previous.license_status <> 'revoked' then 'revoked'
    when p_operational_status <> v_previous.operational_status then 'status_changed'
    else 'updated'
  end;

  insert into public.capability_license_events (
    organization_id, capability_key, actor_id, event_type,
    previous_state, new_state, reason
  ) values (
    p_organization_id, p_capability_key, v_actor, v_event,
    case when v_previous.id is null then null else to_jsonb(v_previous) end,
    to_jsonb(v_next), nullif(trim(coalesce(p_reason, '')), '')
  );

  return v_next;
end;
$$;


-- Public RPC remains INVOKER; mutation is isolated in app_private.
create or replace function public.set_organization_capability_license(
  p_organization_id uuid,
  p_capability_key text,
  p_license_status text,
  p_operational_status text,
  p_reason text default null,
  p_entitled_environments text[] default '{}'::text[],
  p_expires_at timestamptz default null
)
returns public.organization_capability_licenses
language sql
security invoker
set search_path = ''
as $$
  select app_private.set_organization_capability_license(
    p_organization_id, p_capability_key, p_license_status,
    p_operational_status, p_reason, p_entitled_environments, p_expires_at
  );
$$;
revoke all on function app_private.set_organization_capability_license(uuid, text, text, text, text, text[], timestamptz) from public, anon;
grant execute on function app_private.set_organization_capability_license(uuid, text, text, text, text, text[], timestamptz) to authenticated;
revoke all on function public.set_organization_capability_license(uuid, text, text, text, text, text[], timestamptz) from public, anon;
grant execute on function public.set_organization_capability_license(uuid, text, text, text, text, text[], timestamptz) to authenticated;
