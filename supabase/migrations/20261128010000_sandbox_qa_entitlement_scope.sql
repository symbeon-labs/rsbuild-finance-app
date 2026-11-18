-- Align the internal Mundo do Sabor sandbox with the capabilities enabled for QA.
-- Sandbox contains synthetic data; it must not require production licenses or modules
-- that are not part of the current finance homologation scope.

create or replace function app_private.has_sandbox_capability_entitlements(
  p_sandbox_organization_id uuid,
  p_capability_keys text[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_tenant_organization_id uuid;
  v_qa_organization_id uuid;
begin
  if v_uid is null
    or p_sandbox_organization_id is null
    or p_capability_keys is null
    or cardinality(p_capability_keys) = 0 then
    return false;
  end if;

  -- Resolve the synthetic sandbox to its owning tenant.
  select so.organization_id
    into v_tenant_organization_id
  from sandbox.organizations so
  where so.id = p_sandbox_organization_id;

  if v_tenant_organization_id is null then
    return false;
  end if;

  -- Sandbox homologation follows the corresponding QA tenant, never production.
  select qa.id
    into v_qa_organization_id
  from public.organizations tenant
  join public.organizations qa
    on qa.slug = tenant.slug || '_qa'
  where tenant.id = v_tenant_organization_id;

  if v_qa_organization_id is null then
    return false;
  end if;

  -- RSBUILD owners/admins may oversee the sandbox. Operators must also
  -- have an explicit membership in the requested sandbox organization.
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
            from sandbox.organization_memberships sm
            where sm.organization_id = p_sandbox_organization_id
              and sm.user_id = v_uid
          )
        )
      )
  ) then
    return false;
  end if;

  -- Every requested capability must be active in QA. This intentionally
  -- does not unlock production or grant unrequested modules.
  return not exists (
    select 1
    from unnest(p_capability_keys) as requested(capability_key)
    where requested.capability_key not in ('finance', 'reconciliation', 'logistics', 'audit')
      or not exists (
        select 1
        from public.organization_capability_licenses l
        where l.organization_id = v_qa_organization_id
          and l.capability_key = requested.capability_key
          and l.license_status = 'granted'
          and l.operational_status = 'active'
          and l.entitled_environments @> array['qa']::text[]
          and (l.expires_at is null or l.expires_at > now())
      )
  );
end;
$function$;
