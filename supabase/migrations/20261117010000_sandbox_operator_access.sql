-- Grant RSBUILD operators access only to sandbox organizations they are explicitly assigned to.
-- Owners/admins retain the existing cross-sandbox oversight access.

-- Sandbox organization directory: operators see only organizations they belong to.
drop policy if exists "RSBUILD team reads sandbox organizations" on sandbox.organizations;
create policy "RSBUILD members read assigned sandbox organizations"
on sandbox.organizations for select to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild' and m.user_id = (select auth.uid())
      and (
        m.role in ('owner', 'admin')
        or (m.role = 'operator' and exists (
          select 1 from sandbox.organization_memberships sm
          where sm.organization_id = sandbox.organizations.id
            and sm.user_id = (select auth.uid())
        ))
      )
  )
);

-- Operators can see their own sandbox membership rows; administrators retain oversight.
drop policy if exists "RSBUILD team reads sandbox memberships" on sandbox.organization_memberships;
create policy "RSBUILD members read authorized sandbox memberships"
on sandbox.organization_memberships for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild' and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin', 'operator')
  )
  or exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild' and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  )
);

-- Apply the same per-organization scope to all synthetic operational records.
drop policy if exists "RSBUILD team reads sandbox accounts" on sandbox.financial_accounts;
create policy "RSBUILD members read assigned sandbox accounts"
on sandbox.financial_accounts for select to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild' and m.user_id = (select auth.uid())
      and (
        m.role in ('owner', 'admin')
        or (m.role = 'operator' and exists (
          select 1 from sandbox.organization_memberships sm
          where sm.organization_id = financial_accounts.organization_id
            and sm.user_id = (select auth.uid())
        ))
      )
  )
);

drop policy if exists "RSBUILD team reads sandbox records" on sandbox.financial_records;
create policy "RSBUILD members read assigned sandbox records"
on sandbox.financial_records for select to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild' and m.user_id = (select auth.uid())
      and (
        m.role in ('owner', 'admin')
        or (m.role = 'operator' and exists (
          select 1 from sandbox.organization_memberships sm
          where sm.organization_id = financial_records.organization_id
            and sm.user_id = (select auth.uid())
        ))
      )
  )
);

drop policy if exists "RSBUILD team reads sandbox titles" on sandbox.receivable_titles;
create policy "RSBUILD members read assigned sandbox titles"
on sandbox.receivable_titles for select to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild' and m.user_id = (select auth.uid())
      and (
        m.role in ('owner', 'admin')
        or (m.role = 'operator' and exists (
          select 1 from sandbox.organization_memberships sm
          where sm.organization_id = receivable_titles.organization_id
            and sm.user_id = (select auth.uid())
        ))
      )
  )
);

drop policy if exists "RSBUILD team reads sandbox proofs" on sandbox.delivery_proofs;
create policy "RSBUILD members read assigned sandbox proofs"
on sandbox.delivery_proofs for select to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild' and m.user_id = (select auth.uid())
      and (
        m.role in ('owner', 'admin')
        or (m.role = 'operator' and exists (
          select 1 from sandbox.organization_memberships sm
          where sm.organization_id = delivery_proofs.organization_id
            and sm.user_id = (select auth.uid())
        ))
      )
  )
);

drop policy if exists "RSBUILD team reads sandbox audit" on sandbox.audit_events;
create policy "RSBUILD members read assigned sandbox audit"
on sandbox.audit_events for select to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild' and m.user_id = (select auth.uid())
      and (
        m.role in ('owner', 'admin')
        or (m.role = 'operator' and exists (
          select 1 from sandbox.organization_memberships sm
          where sm.organization_id = audit_events.organization_id
            and sm.user_id = (select auth.uid())
        ))
      )
  )
);

-- Validation catalogue is shared; operators need at least one explicit sandbox membership.
drop policy if exists "RSBUILD team reads validation cases" on sandbox.validation_cases;
create policy "RSBUILD members with sandbox access read validation cases"
on sandbox.validation_cases for select to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild' and m.user_id = (select auth.uid())
      and (
        m.role in ('owner', 'admin')
        or (m.role = 'operator' and exists (
          select 1 from sandbox.organization_memberships sm
          where sm.user_id = (select auth.uid())
        ))
      )
  )
);

-- Operators see only their own validation history; owners/admins retain oversight.
drop policy if exists "RSBUILD team reads validation runs" on sandbox.validation_runs;
create policy "RSBUILD members read authorized validation runs"
on sandbox.validation_runs for select to authenticated
using (
  (actor_id = (select auth.uid()) and exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild' and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin', 'operator')
  ))
  or exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild' and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  )
);

-- RPC remains SECURITY DEFINER but performs an explicit role + sandbox-membership check.
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
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild' and m.user_id = v_uid
      and (
        m.role in ('owner', 'admin')
        or (m.role = 'operator' and exists (
          select 1 from sandbox.organization_memberships sm
          where sm.user_id = v_uid
        ))
      )
  ) then
    raise exception 'sandbox_validation_forbidden';
  end if;

  select * into v_case from sandbox.validation_cases
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

revoke all on function public.sandbox_record_validation_run(text, text, text, jsonb) from public, anon;
grant execute on function public.sandbox_record_validation_run(text, text, text, jsonb) to authenticated;
