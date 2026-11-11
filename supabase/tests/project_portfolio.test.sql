begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','00000000-0000-0000-0000-000000000000','authenticated','authenticated','portfolio-rs@test.invalid','',now(),now(),now()),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','00000000-0000-0000-0000-000000000000','authenticated','authenticated','portfolio-client-a@test.invalid','',now(),now(),now()),
 ('ffffffff-ffff-4fff-8fff-ffffffffffff','00000000-0000-0000-0000-000000000000','authenticated','authenticated','portfolio-client-b@test.invalid','',now(),now(),now())
on conflict (id) do nothing;

insert into public.organizations (id,legal_name,display_name,slug)
values
 ('11111111-1111-4111-8111-111111111111','RSBUILD Inovação Ltda','RSBUILD Inovação','rsbuild'),
 ('22222222-2222-4222-8222-222222222222','Mundo do Sabor Ltda','Mundo do Sabor','mundo_sabor'),
 ('33333333-3333-4333-8333-333333333333','Hub Açaí Ltda','Hub Açaí','hub_acai')
on conflict (id) do nothing;

insert into public.organization_memberships (organization_id,user_id,role)
select id, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'owner'
from public.organizations where slug='rsbuild'
on conflict do nothing;

insert into public.organization_memberships (organization_id,user_id,role)
select id, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'viewer'
from public.organizations where slug='mundo_sabor'
on conflict do nothing;

insert into public.organization_memberships (organization_id,user_id,role)
select id, 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'viewer'
from public.organizations where slug='hub_acai'
on conflict do nothing;

insert into public.projects (
  managing_organization_id, client_organization_id, client_display_name,
  project_key, name, description, status
)
select rs.id, client.id, client.display_name, seed.project_key, seed.name, 'RLS test', 'planning'
from public.organizations rs
cross join (values
 ('rls-mundo-sabor','mundo_sabor','Projeto teste Mundo do Sabor'),
 ('rls-hub-acai','hub_acai','Projeto teste Hub Açaí')
) as seed(project_key,client_slug,name)
join public.organizations client on client.slug=seed.client_slug
where rs.slug='rsbuild'
on conflict (managing_organization_id,client_organization_id,project_key) do nothing;

insert into public.project_memberships (project_id,managing_organization_id,user_id,access_level)
select p.id,p.managing_organization_id,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','viewer'
from public.projects p where p.project_key='rls-mundo-sabor'
on conflict do nothing;

insert into public.project_sprints (project_id,sprint_number,title,objective)
select id,1,'Sprint RLS','Validar o isolamento do portfólio'
from public.projects where project_key in ('rls-mundo-sabor','rls-hub-acai')
on conflict (project_id,sprint_number) do nothing;

insert into public.project_tasks (project_id,sprint_id,title)
select s.project_id,s.id,'Atividade de validação'
from public.project_sprints s
join public.projects p on p.id=s.project_id
where p.project_key in ('rls-mundo-sabor','rls-hub-acai')
on conflict do nothing;

insert into public.project_dependencies (project_id,title,dependency_type)
select id,'Insumo de teste','client_input'
from public.projects where project_key in ('rls-mundo-sabor','rls-hub-acai');

insert into public.project_deliverables (project_id,sprint_id,title)
select p.id,s.id,'Entregável RLS'
from public.projects p join public.project_sprints s on s.project_id=p.id
where p.project_key in ('rls-mundo-sabor','rls-hub-acai');

set local role authenticated;
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
select is((select count(*)::int from public.projects where project_key like 'rls-%'),2,'RSBUILD owner sees both managed test projects');
select is((select count(*)::int from public.project_sprints s join public.projects p on p.id=s.project_id where p.project_key like 'rls-%'),2,'RSBUILD owner sees sprints from both projects');
select is((select count(*)::int from public.project_dependencies d join public.projects p on p.id=d.project_id where p.project_key like 'rls-%'),2,'RSBUILD owner sees dependencies from both projects');
select is((select count(*)::int from public.project_deliverables d join public.projects p on p.id=d.project_id where p.project_key like 'rls-%'),2,'RSBUILD owner sees deliverables from both projects');
select lives_ok($sql$insert into public.project_deliverables (project_id,title) select id,'Deliverable created by RSBUILD' from public.projects where project_key='rls-mundo-sabor'$sql$,'RSBUILD owner can register a deliverable');
select lives_ok($$insert into public.project_sprints (project_id,sprint_number,title) select id,2,'Sprint criada pela RSBUILD' from public.projects where project_key='rls-mundo-sabor'$$,'RSBUILD owner can create a sprint');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
select is((select count(*)::int from public.projects where project_key like 'rls-%'),1,'client user sees only the explicitly granted project');
select is((select count(*)::int from public.project_sprints s join public.projects p on p.id=s.project_id where p.project_key like 'rls-%'),2,'client user sees sprints only in the granted project');
select is((select count(*)::int from public.project_tasks t join public.projects p on p.id=t.project_id where p.project_key like 'rls-%'),1,'client user sees tasks only in the granted project');
select is((select count(*)::int from public.project_dependencies d join public.projects p on p.id=d.project_id where p.id in (select project_id from public.project_memberships where user_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')),1,'client user sees dependencies only in the granted project');
select is((select count(*)::int from public.project_deliverables d join public.projects p on p.id=d.project_id where p.project_key like 'rls-%'),2,'client user sees deliverables only in the granted project');
select throws_ok($sql$insert into public.project_sprints (project_id,sprint_number,title) select id,9,'Client forbidden' from public.projects where project_key='rls-mundo-sabor'$sql$,'42501',null,'client viewer cannot create sprints');
select throws_ok($sql$insert into public.project_dependencies (project_id,title) select id,'Client forbidden' from public.projects where project_key='rls-mundo-sabor'$sql$,'42501',null,'client viewer cannot create dependencies');
select throws_ok($sql$insert into public.project_deliverables (project_id,title) select id,'Client forbidden' from public.projects where project_key='rls-mundo-sabor'$sql$,'42501',null,'client viewer cannot register deliverables');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','ffffffff-ffff-4fff-8fff-ffffffffffff',true);
select is((select count(*)::int from public.projects where project_key like 'rls-%'),0,'client without project grant sees no portfolio projects');
select is((select count(*)::int from public.project_sprints),0,'client without project grant sees no sprints');
select is((select count(*)::int from public.project_tasks),0,'client without project grant sees no tasks');
select is((select count(*)::int from public.project_dependencies),0,'client without project grant sees no dependencies');
select is((select count(*)::int from public.project_deliverables),0,'client without project grant sees no deliverables');
reset role;

select * from finish();
rollback;
