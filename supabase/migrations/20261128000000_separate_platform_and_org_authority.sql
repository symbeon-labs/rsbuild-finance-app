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
revoke all on public.platform_administrators from anon, authenticated;
grant select on public.platform_administrators to authenticated;

drop policy if exists "Platform administrators read own grant" on public.platform_administrators;
create policy "Platform administrators read own grant"
  on public.platform_administrators for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.is_platform_administrator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_administrators pa
    where pa.user_id = (select auth.uid())
      and pa.revoked_at is null
  );
$$;

revoke all on function public.is_platform_administrator() from public;
grant execute on function public.is_platform_administrator() to authenticated;

-- Platform administrators need the minimal organization directory required
-- by the SECURITY INVOKER licensing RPC. This does not grant tenant data access.
drop policy if exists "Platform administrators read organization directory" on public.organizations;
create policy "Platform administrators read organization directory"
  on public.organizations for select to authenticated
  using ((select public.is_platform_administrator()));

-- Scope every license explicitly to environments and an optional validity window.
alter table public.organization_capability_licenses
  add column if not exists entitled_environments text[] not null default '{}'::text[],
  add column if not exists expires_at timestamptz;

do $
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
$;

-- Remove organization-owner authority over platform-wide licensing.
drop policy if exists "RSBUILD owners manage capability licenses" on public.organization_capability_licenses;
drop policy if exists "RSBUILD owners read all capability licenses" on public.organization_capability_licenses;
drop policy if exists "RSBUILD owners read capability license events" on public.capability_license_events;
drop policy if exists "RSBUILD owners append capability license events" on public.capability_license_events;

create policy "Platform administrators manage capability licenses"
  on public.organization_capability_licenses for all to authenticated
  using ((select public.is_platform_administrator()))
  with check ((select public.is_platform_administrator()));

create policy "Platform administrators read capability license events"
  on public.capability_license_events for select to authenticated
  using ((select public.is_platform_administrator()));

create policy "Platform administrators append capability license events"
  on public.capability_license_events for insert to authenticated
  with check (
    actor_id = (select auth.uid())
    and (select public.is_platform_administrator())
  );

-- Replace the licensing RPC authorization boundary. The transaction and
-- append-only event remain atomic; authority and environment scope are checked
-- server-side. Drop the previous signature to avoid an ambiguous overload.
drop function if exists public.set_organization_capability_license(uuid, text, text, text, text);

create function public.set_organization_capability_license(
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

  if not public.is_platform_administrator() then
    raise exception 'Only a Symbeon platform administrator may manage capability licenses'
      using errcode = '42501';
  end if;

  if p_license_status not in ('blocked', 'granted', 'suspended', 'revoked') then
    raise exception 'Invalid license status';
  end if;
  if p_operational_status not in ('not_implemented', 'in_development', 'available', 'active') then
    raise exception 'Invalid operational status';
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
    granted_by = case when excluded.license_status = 'granted'
      then coalesce(organization_capability_licenses.granted_by, v_actor)
      else organization_capability_licenses.granted_by end,
    granted_at = case when excluded.license_status = 'granted'
      then coalesce(organization_capability_licenses.granted_at, now())
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

revoke all on function public.set_organization_capability_license(uuid, text, text, text, text, text[], timestamptz) from public;
grant execute on function public.set_organization_capability_license(uuid, text, text, text, text, text[], timestamptz) to authenticated;
