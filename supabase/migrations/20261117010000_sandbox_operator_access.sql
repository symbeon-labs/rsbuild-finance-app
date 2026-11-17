-- Allow explicitly provisioned RSBUILD operators to use the validation sandbox.
-- Operators must have a separate membership in at least one sandbox organization.
-- They can read only their own validation runs; owners/admins retain oversight access.

drop policy if exists "RSBUILD team reads validation cases" on sandbox.validation_cases;
create policy "RSBUILD members with sandbox access read validation cases"
on sandbox.validation_cases
for select to authenticated
using (
  exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and (
        m.role in ('owner', 'admin')
        or (
          m.role = 'operator'
          and exists (
            select 1
            from sandbox.organization_memberships sm
            where sm.user_id = (select auth.uid())
          )
        )
      )
  )
);

drop policy if exists "RSBUILD team reads validation runs" on sandbox.validation_runs;
create policy "RSBUILD members read authorized validation runs"
on sandbox.validation_runs
for select to authenticated
using (
  actor_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin', 'operator')
  )
  or exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  )
);

create or replace function public.sandbox_record_validation_run(
  p_case_code text,
  p_status text,
  p_summary text,
  p_result jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, sandbox
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_case sandbox.validation_cases%rowtype;
  v_run_id uuid;
begin
  if v_uid is null or p_status not in ('passed', 'failed', 'blocked') then
    raise exception 'invalid_validation_request';
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
            from sandbox.organization_memberships sm
            where sm.user_id = v_uid
          )
        )
      )
  ) then
    raise exception 'sandbox_validation_forbidden';
  end if;

  select *
  into v_case
  from sandbox.validation_cases
  where case_code = p_case_code
    and enabled;

  if not found then
    raise exception 'validation_case_not_found';
  end if;

  select email into v_email from auth.users where id = v_uid;

  insert into sandbox.validation_runs (
    case_id, case_code, status, summary, result, actor_id, actor_email
  )
  values (
    v_case.id,
    v_case.case_code,
    p_status,
    left(coalesce(p_summary, ''), 1000),
    coalesce(p_result, '{}'::jsonb),
    v_uid,
    v_email
  )
  returning id into v_run_id;

  insert into sandbox.audit_events (
    organization_id, actor_id, actor_email, event_type, entity_type, entity_id, metadata
  )
  select
    id,
    v_uid,
    v_email,
    'sandbox.validation.executed',
    'validation_run',
    v_run_id,
    jsonb_build_object('case_code', p_case_code, 'status', p_status)
  from sandbox.organizations
  where slug = 'rsbuild-sandbox';

  return jsonb_build_object('success', true, 'run_id', v_run_id);
end;
$$;

revoke all on function public.sandbox_record_validation_run(text, text, text, jsonb) from public, anon;
grant execute on function public.sandbox_record_validation_run(text, text, text, jsonb) to authenticated;
