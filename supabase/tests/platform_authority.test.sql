begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
 ('c1111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','g01-owner@test.invalid','',now(),now(),now()),
 ('c2222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','g01-platform@test.invalid','',now(),now(),now())
on conflict (id) do nothing;

insert into public.organizations (id, legal_name, display_name, slug)
values ('d1111111-1111-4111-8111-111111111111','RSBUILD G01 Ltda','RSBUILD G01','rsbuild')
on conflict (slug) do nothing;

insert into public.organizations (id, legal_name, display_name, slug)
values ('d2222222-2222-4222-8222-222222222222','Tenant G01 Ltda','Tenant G01','g01_tenant')
on conflict (id) do nothing;

-- Sandbox homologation resolves its tenant to the matching QA organization.
insert into public.organizations (id, legal_name, display_name, slug)
values ('d5555555-5555-4555-8555-555555555555','Tenant G01 QA Ltda','Tenant G01 QA','g01_tenant_qa')
on conflict (id) do nothing;

insert into public.organization_memberships (organization_id,user_id,role)
select id, 'c1111111-1111-4111-8111-111111111111', 'owner'::public.rsbuild_member_role
from public.organizations where slug='rsbuild'
on conflict do nothing;

insert into public.capability_catalog (capability_key, display_name, description)
values ('finance','Finance','pgTAP fixture')
on conflict (capability_key) do nothing;

insert into sandbox.organizations (id, slug, display_name, organization_id)
values ('d3333333-3333-4333-8333-333333333333','g01-tenant-sandbox','G01 Tenant Sandbox','d2222222-2222-4222-8222-222222222222')
on conflict (slug) do nothing;

insert into sandbox.organizations (id, slug, display_name, organization_id)
values ('d4444444-4444-4444-8444-444444444444','mundo-sabor-sandbox','Mundo do Sabor Sandbox','d2222222-2222-4222-8222-222222222222')
on conflict (slug) do update set organization_id = excluded.organization_id;

insert into public.platform_administrators (user_id, granted_by, reason)
values ('c2222222-2222-4222-8222-222222222222','c2222222-2222-4222-8222-222222222222','G01 pgTAP fixture')
on conflict (user_id) do update set revoked_at = null, revoked_by = null;

-- Organization owner retains tenant authority but is not a platform administrator.
set local role authenticated;
select set_config('request.jwt.claim.sub','c1111111-1111-4111-8111-111111111111',true);
select ok(not public.is_platform_administrator(), 'RSBUILD owner is not implicitly a platform administrator');
select throws_ok(
  $sql$select public.set_organization_capability_license('d2222222-2222-4222-8222-222222222222','finance','granted','active','owner must not grant')$sql$,
  '42501', null, 'RSBUILD owner cannot grant capability licenses'
);
select is(
  (select count(*)::int from public.organizations where id='d2222222-2222-4222-8222-222222222222'),
  0, 'RSBUILD owner cannot inspect unrelated tenant directory through platform policy'
);
select ok(
  not public.has_sandbox_capability_entitlements(
    'd3333333-3333-4333-8333-333333333333', array['finance']::text[]
  ),
  'RSBUILD owner without a sandbox entitlement cannot access the capability in Sandbox'
);
select throws_ok(
  $sql$select public.sandbox_record_validation_run('A1.4-G01','passed','manual homologation evidence','{}'::jsonb)$sql$,
  '42501', 'sandbox_capability_not_entitled',
  'direct validation RPC cannot bypass Sandbox capability entitlements'
);
reset role;

-- Platform administrator has platform licensing authority without tenant membership.
set local role authenticated;
select set_config('request.jwt.claim.sub','c2222222-2222-4222-8222-222222222222',true);
select ok(public.is_platform_administrator(), 'explicit platform grant enables platform authority');
select is(
  (select count(*)::int from public.organization_memberships where user_id='c2222222-2222-4222-8222-222222222222'),
  0, 'platform authority does not create tenant membership'
);
select is(
  (select count(*)::int from public.organizations where id='d2222222-2222-4222-8222-222222222222'),
  1, 'platform administrator can resolve tenant identity for licensing'
);
select lives_ok(
  $sql$select public.set_organization_capability_license('d5555555-5555-4555-8555-555555555555','finance','granted','active','G01 QA authorized grant',array['qa'],null)$sql$,
  'platform administrator can grant a QA capability through the audited RPC'
);
select ok(
  not has_table_privilege('authenticated','public.organization_capability_licenses','INSERT')
  and not has_table_privilege('authenticated','public.organization_capability_licenses','UPDATE')
  and not has_table_privilege('authenticated','public.organization_capability_licenses','DELETE')
  and not has_table_privilege('anon','public.organization_capability_licenses','INSERT')
  and not has_table_privilege('anon','public.organization_capability_licenses','UPDATE')
  and not has_table_privilege('anon','public.organization_capability_licenses','DELETE')
  and not has_table_privilege('authenticated','public.platform_administrators','INSERT')
  and not has_table_privilege('authenticated','public.platform_administrators','UPDATE')
  and not has_table_privilege('authenticated','public.platform_administrators','DELETE'),
  'client roles cannot mutate licenses or self-provision platform authority'
);
select ok(
  not has_table_privilege('authenticated','public.capability_license_events','INSERT')
  and not has_table_privilege('authenticated','public.capability_license_events','UPDATE')
  and not has_table_privilege('authenticated','public.capability_license_events','DELETE')
  and not has_table_privilege('anon','public.capability_license_events','INSERT')
  and not has_table_privilege('anon','public.capability_license_events','UPDATE')
  and not has_table_privilege('anon','public.capability_license_events','DELETE'),
  'license event history cannot be directly altered by client roles'
);
select ok(
  not has_function_privilege('anon','public.can_operate_rsbuild_project(uuid)','EXECUTE')
  and not has_function_privilege('anon','public.can_read_rsbuild_project(uuid)','EXECUTE')
  and not has_function_privilege('anon','public.sandbox_reset()','EXECUTE')
  and not has_function_privilege('anon','public.is_platform_administrator()','EXECUTE')
  and not has_function_privilege('anon','public.has_sandbox_capability_entitlements(uuid,text[])','EXECUTE')
  and not has_function_privilege('anon','public.sandbox_record_validation_run(text,text,text,jsonb)','EXECUTE')
  and not has_function_privilege('anon','public.set_organization_capability_license(uuid,text,text,text,text,text[],timestamp with time zone)','EXECUTE')
  and not (
    select bool_or(p.prosecdef)
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in (
        'can_operate_rsbuild_project','can_read_rsbuild_project','sandbox_reset',
        'is_platform_administrator','has_sandbox_capability_entitlements',
        'set_organization_capability_license','sandbox_record_validation_run'
      )
  ),
  'privileged public RPC wrappers are invoker-only and unavailable to anon'
);
select throws_ok(
  $sql$select public.set_organization_capability_license('d2222222-2222-4222-8222-222222222222','finance','granted','active','missing environment',array[]::text[],null)$sql$,
  '22023', null, 'granted license without environment scope is rejected'
);
select throws_ok(
  $sql$select public.set_organization_capability_license('d2222222-2222-4222-8222-222222222222','finance','granted','active','expired license',array['qa'],now() - interval '1 hour')$sql$,
  '22023', null, 'expired license grant is rejected'
);
select is(
  (select count(*)::int from public.capability_license_events where organization_id='d5555555-5555-4555-8555-555555555555' and capability_key='finance'),
  1, 'license mutation appends one audit event and rejected grants append none'
);
select lives_ok(
  $sql$select public.set_organization_capability_license('d2222222-2222-4222-8222-222222222222','finance','granted','active','G01 sandbox grant',array['sandbox'],null)$sql$,
  'platform administrator can explicitly grant Sandbox scope'
);
reset role;

-- A tenant operator/owner may use the Sandbox entitlement without platform rights.
set local role authenticated;
select set_config('request.jwt.claim.sub','c1111111-1111-4111-8111-111111111111',true);
select ok(
  public.has_sandbox_capability_entitlements(
    'd3333333-3333-4333-8333-333333333333', array['finance']::text[]
  ),
  'RSBUILD owner can access Sandbox when the linked QA tenant has an active entitlement'
);
reset role;

update public.platform_administrators
set revoked_at=now(), revoked_by='c1111111-1111-4111-8111-111111111111'
where user_id='c2222222-2222-4222-8222-222222222222';

set local role authenticated;
select set_config('request.jwt.claim.sub','c2222222-2222-4222-8222-222222222222',true);
select ok(not public.is_platform_administrator(), 'revocation immediately removes platform authority');
reset role;

select * from finish();
rollback;
