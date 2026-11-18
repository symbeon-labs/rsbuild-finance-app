-- Atomic, owner-only capability license changes with an append-only event.

-- Holding owner can list organization identities for licensing administration;
-- this does not grant access to tenant operational data.
drop policy if exists "RSBUILD owners read organization directory" on public.organizations;
create policy "RSBUILD owners read organization directory"
  on public.organizations for select to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = '0269fe05-0990-41a8-a28c-2919691eaf0f'::uuid
        and m.user_id = (select auth.uid())
        and m.role = 'owner'::public.rsbuild_member_role
    )
  );



-- Institutional owner must inspect all tenant entitlements from the holding workspace.
drop policy if exists "RSBUILD owners read all capability licenses" on public.organization_capability_licenses;
create policy "RSBUILD owners read all capability licenses"
  on public.organization_capability_licenses for select to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      join public.organizations o on o.id = m.organization_id
      where o.slug = 'rsbuild'
        and m.user_id = (select auth.uid())
        and m.role = 'owner'::public.rsbuild_member_role
    )
  );


create or replace function public.set_organization_capability_license(
  p_organization_id uuid,
  p_capability_key text,
  p_license_status text,
  p_operational_status text,
  p_reason text default null
)
returns public.organization_capability_licenses
language plpgsql
security invoker
set search_path = public
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

  if not exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = v_actor
      and m.role = 'owner'::public.rsbuild_member_role
  ) then
    raise exception 'Only the RSBUILD institutional owner may manage capability licenses'
      using errcode = '42501';
  end if;

  if p_license_status not in ('blocked', 'granted', 'suspended', 'revoked') then
    raise exception 'Invalid license status';
  end if;
  if p_operational_status not in ('not_implemented', 'in_development', 'available', 'active') then
    raise exception 'Invalid operational status';
  end if;

  select * into v_previous
  from public.organization_capability_licenses
  where organization_id = p_organization_id
    and capability_key = p_capability_key
  for update;

  insert into public.organization_capability_licenses (
    organization_id, capability_key, license_status, operational_status,
    granted_by, granted_at, updated_by, updated_at, notes
  ) values (
    p_organization_id, p_capability_key, p_license_status, p_operational_status,
    case when p_license_status = 'granted' then v_actor else null end,
    case when p_license_status = 'granted' then now() else null end,
    v_actor, now(), nullif(trim(coalesce(p_reason, '')), '')
  )
  on conflict (organization_id, capability_key) do update set
    license_status = excluded.license_status,
    operational_status = excluded.operational_status,
    granted_by = case when excluded.license_status = 'granted'
      then coalesce(organization_capability_licenses.granted_by, v_actor)
      else organization_capability_licenses.granted_by end,
    granted_at = case when excluded.license_status = 'granted'
      then coalesce(organization_capability_licenses.granted_at, now())
      else organization_capability_licenses.granted_at end,
    updated_by = v_actor,
    updated_at = now(),
    notes = coalesce(excluded.notes, organization_capability_licenses.notes)
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
    to_jsonb(v_next),
    nullif(trim(coalesce(p_reason, '')), '')
  );

  return v_next;
end;
$$;

revoke all on function public.set_organization_capability_license(uuid, text, text, text, text) from public;
grant execute on function public.set_organization_capability_license(uuid, text, text, text, text) to authenticated;
