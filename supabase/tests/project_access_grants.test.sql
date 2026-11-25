begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
 ('a1111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','grant-rs@test.invalid','',now(),now(),now()),
 ('a2222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','grant-mundo@test.invalid','',now(),now(),now()),
 ('a3333333-3333-4333-8333-333333333333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','grant-noaccess@test.invalid','',now(),now(),now())
on conflict (id) do nothing;

insert into public.organizations (id,legal_name,display_name,slug)
values
 ('0269fe05-0990-41a8-a28c-2919691eaf0f','RSBUILD Grant Ltda','RSBUILD Grant','rsbuild'),
 ('c5356414-adce-4fdc-941b-15cfe26b991e','Mundo Grant Ltda','Mundo Grant','mundo_sabor'),
 ('44444444-4444-4444-8444-444444444444','NoAccess Grant Ltda','NoAccess Grant','no_access')
on conflict (id) do nothing;

insert into public.organization_memberships (organization_id,user_id,role)
values
 ('0269fe05-0990-41a8-a28c-2919691eaf0f','a1111111-1111-4111-8111-111111111111','owner'),
 ('c5356414-adce-4fdc-941b-15cfe26b991e','a2222222-2222-4222-8222-222222222222','viewer'),
 ('44444444-4444-4444-8444-444444444444','a3333333-3333-4333-8333-333333333333','viewer')
on conflict do nothing;

-- Dois projetos geridos pela RSBUILD para a mesma org cliente (mundo_sabor).
insert into public.projects (
  managing_organization_id, client_organization_id, client_display_name,
  project_key, name, description, status
)
select rs.id, client.id, client.display_name, seed.project_key, seed.name, 'Grant RLS test', 'planning'
from public.organizations rs
cross join (values
 ('grant-user-test','Projeto grant individual'),
 ('grant-org-test','Projeto grant organizacional')
) as seed(project_key,name)
join public.organizations client on client.slug='mundo_sabor'
where rs.slug='rsbuild'
on conflict (managing_organization_id,client_organization_id,project_key) do nothing;

-- Baseline: usuário sem nenhum grant não vê os projetos.
set local role authenticated;
select set_config('request.jwt.claim.sub','a3333333-3333-4333-8333-333333333333',true);
select is((select count(*)::int from public.projects where project_key like 'grant-%'),0,'user without grants sees no projects');
reset role;

-- Owner RSBUILD administra grants: individual e organizacional (somente a org cliente).
set local role authenticated;
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
select lives_ok($sql$insert into public.project_memberships (project_id,managing_organization_id,user_id,access_level)
  select id,managing_organization_id,'a3333333-3333-4333-8333-333333333333','viewer'
  from public.projects where project_key='grant-user-test'$sql$,'RSBUILD owner grants individual project access');
select lives_ok($sql$insert into public.project_organization_access (project_id,managing_organization_id,client_organization_id,access_level)
  select id,managing_organization_id,'c5356414-adce-4fdc-941b-15cfe26b991e','viewer'
  from public.projects where project_key='grant-org-test'$sql$,'RSBUILD owner grants client organization access');
select throws_ok($sql$insert into public.project_memberships (project_id,managing_organization_id,user_id,access_level)
  select id,managing_organization_id,'a2222222-2222-4222-8222-222222222222','admin'
  from public.projects where project_key='grant-user-test'$sql$,'23514',null,'invalid project access level is rejected');
select throws_ok($sql$insert into public.project_organization_access (project_id,managing_organization_id,client_organization_id,access_level)
  select id,managing_organization_id,'44444444-4444-4444-8444-444444444444','viewer'
  from public.projects where project_key='grant-org-test'$sql$,'23503',null,'organization grant to non-client org violates composite FK');
reset role;

-- Grant individual: usuário de outra org vê apenas o projeto concedido.
set local role authenticated;
select set_config('request.jwt.claim.sub','a3333333-3333-4333-8333-333333333333',true);
select is((select count(*)::int from public.projects where project_key like 'grant-%'),1,'individual grant exposes only its project');
select is((select project_key from public.projects where project_key like 'grant-%'),'grant-user-test','individual grant unlocks the right project');
select is((select count(*)::int from public.project_memberships),1,'grantee reads own project grant');
reset role;

-- Grant organizacional: membros da org cliente veem o projeto; sem poder conceder.
set local role authenticated;
select set_config('request.jwt.claim.sub','a2222222-2222-4222-8222-222222222222',true);
select is((select count(*)::int from public.projects where project_key like 'grant-%'),1,'org grant exposes only its project');
select is((select project_key from public.projects where project_key like 'grant-%'),'grant-org-test','org grant unlocks the right project');
select throws_ok($sql$insert into public.project_memberships (project_id,managing_organization_id,user_id,access_level)
  select id,managing_organization_id,'a2222222-2222-4222-8222-222222222222','viewer'
  from public.projects where project_key='grant-org-test'$sql$,'42501',null,'client member cannot grant project access');
select throws_ok($sql$insert into public.project_organization_access (project_id,managing_organization_id,client_organization_id,access_level)
  select id,managing_organization_id,'c5356414-adce-4fdc-941b-15cfe26b991e','viewer'
  from public.projects where project_key='grant-org-test'$sql$,'42501',null,'client member cannot grant organization access');
select is((select count(*)::int from public.project_organization_access),1,'client member reads own org grant');
reset role;

-- Owner revoga ambos os grants.
set local role authenticated;
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
select lives_ok($sql$delete from public.project_memberships
  where project_id=(select id from public.projects where project_key='grant-user-test')
    and user_id='a3333333-3333-4333-8333-333333333333'$sql$,'RSBUILD owner revokes individual grant');
select lives_ok($sql$delete from public.project_organization_access
  where project_id=(select id from public.projects where project_key='grant-org-test')
    and client_organization_id='c5356414-adce-4fdc-941b-15cfe26b991e'$sql$,'RSBUILD owner revokes organization grant');
select is((select count(*)::int from public.project_memberships),0,'no user grants remain');
select is((select count(*)::int from public.project_organization_access),0,'no organization grants remain');
reset role;

-- Após revogação o acesso some para ambos.
set local role authenticated;
select set_config('request.jwt.claim.sub','a3333333-3333-4333-8333-333333333333',true);
select is((select count(*)::int from public.projects where project_key like 'grant-%'),0,'revoked user loses project access');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','a2222222-2222-4222-8222-222222222222',true);
select is((select count(*)::int from public.projects where project_key like 'grant-%'),0,'client member loses project access after revoke');
reset role;

select * from finish();
rollback;
