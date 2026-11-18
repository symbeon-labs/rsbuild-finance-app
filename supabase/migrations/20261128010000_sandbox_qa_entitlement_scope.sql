-- Align sandbox capability checks with QA entitlements and institutional authority.
-- Internal RSBUILD sandbox: institutional owner/admin of the RSBUILD tenant.
-- Client sandboxes: RSBUILD institutional authority (or explicit sandbox
-- membership for operators) plus active QA tenant licenses. Synthetic data
-- only; never requires production licenses.

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
  v_tenant_slug text;
  v_qa_organization_id uuid;
  v_is_rsbuild_admin boolean := false;
begin
  if v_uid is null
    or p_sandbox_organization_id is null
    or p_capability_keys is null
    or cardinality(p_capability_keys) = 0 then
    return false;
  end if;

  if exists (
    select 1
    from unnest(p_capability_keys) as requested(capability_key)
    where requested.capability_key not in ('finance', 'reconciliation', 'logistics', 'audit')
  ) then
    return false;
  end if;

  select so.organization_id
    into v_tenant_organization_id
  from sandbox.organizations so
  where so.id = p_sandbox_organization_id;

  if v_tenant_organization_id is null then
    return false;
  end if;

  select o.slug
    into v_tenant_slug
  from public.organizations o
  where o.id = v_tenant_organization_id;

  if v_tenant_slug is null then
    return false;
  end if;

  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = v_tenant_organization_id
      and m.user_id = v_uid
      and m.role in ('owner', 'admin')
  ) into v_is_rsbuild_admin;

  -- Internal RSBUILD sandbox: only institutional owner/admin.
  if v_tenant_slug = 'rsbuild' then
    return v_is_rsbuild_admin;
  end if;

  -- Client sandboxes: require RSBUILD institutional authority or explicit
  -- sandbox membership for an operator, plus an active QA entitlement.
  if not exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = (select id from public.organizations where slug = 'rsbuild')
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

  select qa.id
    into v_qa_organization_id
  from public.organizations qa
  where qa.slug = v_tenant_slug || '_qa';

  if v_qa_organization_id is null then
    return false;
  end if;

  return not exists (
    select 1
    from unnest(p_capability_keys) as requested(capability_key)
    where not exists (
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
