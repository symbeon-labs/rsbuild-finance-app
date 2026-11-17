-- Scope manual validation writes to the Mundo do Sabor sandbox.
-- The validation_runs.environment column intentionally remains 'sandbox';
-- the specific target environment is preserved in result JSON.
create or replace function public.sandbox_record_validation_run(
  p_case_code text,
  p_status text,
  p_summary text,
  p_result jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_case sandbox.validation_cases%rowtype;
  v_mundo_org_id uuid;
  v_run_id uuid;
begin
  if v_uid is null
     or p_status is null
     or p_status not in ('passed', 'failed', 'blocked') then
    raise exception 'invalid_validation_request';
  end if;

  if p_summary is null
     or length(btrim(p_summary)) < 5
     or length(p_summary) > 1000 then
    raise exception 'invalid_validation_summary';
  end if;

  if jsonb_typeof(p_result) is distinct from 'object'
     or p_result ->> 'mode' is distinct from 'manual'
     or p_result ->> 'target_environment' is distinct from 'mundo-sabor-sandbox'
     or p_result ->> 'homologation_version' is distinct from 'mundo-sabor-manual-v1'
     or jsonb_typeof(p_result -> 'observed') is distinct from 'string'
     or jsonb_typeof(p_result -> 'evidenceRef') is distinct from 'string'
     or length(p_result ->> 'observed') > 2000
     or length(p_result ->> 'evidenceRef') > 500 then
    raise exception 'invalid_manual_validation_payload';
  end if;

  select id into v_mundo_org_id
  from sandbox.organizations
  where slug = 'mundo-sabor-sandbox';

  if v_mundo_org_id is null then
    raise exception 'mundo_sabor_sandbox_not_configured';
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
            where sm.organization_id = v_mundo_org_id
              and sm.user_id = v_uid
          )
        )
      )
  ) then
    raise exception 'sandbox_validation_forbidden';
  end if;

  select * into v_case
  from sandbox.validation_cases
  where case_code = p_case_code
    and project_key = 'mundo-do-sabor'
    and enabled;

  if not found then
    raise exception 'validation_case_not_found';
  end if;

  select email into v_email from auth.users where id = v_uid;

  insert into sandbox.validation_runs (
    case_id, case_code, status, summary, result, actor_id, actor_email
  ) values (
    v_case.id,
    v_case.case_code,
    p_status,
    btrim(p_summary),
    p_result,
    v_uid,
    v_email
  ) returning id into v_run_id;

  insert into sandbox.audit_events (
    organization_id, actor_id, actor_email, event_type, entity_type, entity_id, metadata
  ) values (
    v_mundo_org_id,
    v_uid,
    v_email,
    'sandbox.validation.executed',
    'validation_run',
    v_run_id,
    jsonb_build_object(
      'case_code', p_case_code,
      'status', p_status,
      'mode', 'manual',
      'environment', 'mundo-sabor-sandbox'
    )
  );

  return jsonb_build_object('success', true, 'run_id', v_run_id);
end;
$$;

revoke all on function public.sandbox_record_validation_run(text, text, text, jsonb) from public, anon;
grant execute on function public.sandbox_record_validation_run(text, text, text, jsonb) to authenticated;
