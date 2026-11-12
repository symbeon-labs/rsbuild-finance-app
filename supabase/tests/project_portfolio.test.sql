begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(30);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','00000000-0000-0000-0000-000000000000','authenticated','authenticated','portfolio-rs@test.invalid','',now(),now(),now()),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','00000000-0000-0000-0000-000000000000','authenticated','authenticated','portfolio-mundo@test.invalid','',now(),now(),now()),
 ('ffffffff-ffff-4fff-8fff-ffffffffffff','00000000-0000-0000-0000-000000000000','authenticated','authenticated','portfolio-hub@test.invalid','',now(),now(),now()),
 ('99999999-9999-4999-8999-999999999999','00000000-0000-0000-0000-000000000000','authenticated','authenticated','portfolio-noaccess@test.invalid','',now(),now(),now())
on conflict (id) do nothing;

insert into public.organizations (id,legal_name,display_name,slug)
values
 ('11111111-1111-4111-8111-111111111111','RSBUILD Inovação Ltda','RSBUILD Inovação','rsbuild'),
 ('22222222-2222-4222-8222-222222222222','Mundo do Sabor Ltda','Mundo do Sabor','mundo_sabor'),
 ('33333333-3333-4333-8333-333333333333','Hub Açaí Ltda','Hub Açaí','hub_acai'),
 ('44444444-4444-4444-8444-444444444444','No Access Ltda','No Access','no_access')
on conflict (id) do nothing;

insert into public.organization_memberships (organization_id,user_id,role)
values
 ('11111111-1111-4111-8111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddddd','owner'),
 ('22222222-2222-4222-8222-222222222222','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','viewer'),
 ('33333333-3333-4333-8333-333333333333','ffffffff-ffff-4fff-8fff-ffffffffffff','viewer'),
 ('44444444-4444-4444-8444-444444444444','99999999-9999-4999-8999-999999999999','viewer')
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

insert into public.project_organization_access (
  project_id,managing_organization_id,client_organization_id,access_level
)
select id,managing_organization_id,client_organization_id,'viewer'
from public.projects where project_key in ('rls-mundo-sabor','rls-hub-acai')
on conflict (project_id,client_organization_id) do nothing;

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

-- RSBUILD manages and sees both client projects.
set local role authenticated;
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
select is((select count(*)::int from public.projects where project_key like 'rls-%'),2,'RSBUILD owner sees both managed test projects');
select is((select count(*)::int from public.project_organization_access pa join public.projects p on p.id=pa.project_id where p.project_key like 'rls-%'),2,'RSBUILD owner sees both organization-level grants');
select is((select count(*)::int from public.project_sprints s join public.projects p on p.id=s.project_id where p.project_key like 'rls-%'),2,'RSBUILD owner sees sprints from both projects');
select is((select count(*)::int from public.project_dependencies d join public.projects p on p.id=d.project_id where p.project_key like 'rls-%'),2,'RSBUILD owner sees dependencies from both projects');
select is((select count(*)::int from public.project_deliverables d join public.projects p on p.id=d.project_id where p.project_key like 'rls-%'),2,'RSBUILD owner sees deliverables from both projects');
select lives_ok($sql$insert into public.project_deliverables (project_id,title) select id,'Deliverable created by RSBUILD' from public.projects where project_key='rls-mundo-sabor'$sql$,'RSBUILD owner can register a deliverable');
select lives_ok($sql$insert into public.project_sprints (project_id,sprint_number,title) select id,2,'Sprint criada pela RSBUILD' from public.projects where project_key='rls-mundo-sabor'$sql$,'RSBUILD owner can create a sprint');
select lives_ok($sql$update public.project_sprints set status='active' where project_id=(select id from public.projects where project_key='rls-mundo-sabor') and sprint_number=1$sql$,'RSBUILD owner can update sprint status');
reset role;

-- Mundo do Sabor sees its own project only, in its own workspace.
set local role authenticated;
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
select is((select count(*)::int from public.projects where project_key like 'rls-%'),1,'Mundo do Sabor sees one project');
select is((select project_key from public.projects where project_key like 'rls-%'),'rls-mundo-sabor','Mundo do Sabor cannot see Hub Açaí project');
select is((select count(*)::int from public.project_sprints s join public.projects p on p.id=s.project_id where p.project_key like 'rls-%'),2,'Mundo do Sabor sees only its own sprints');
select is((select count(*)::int from public.project_tasks t join public.projects p on p.id=t.project_id where p.project_key like 'rls-%'),1,'Mundo do Sabor sees only its own tasks');
select is((select count(*)::int from public.project_dependencies d join public.projects p on p.id=d.project_id where p.project_key like 'rls-%'),1,'Mundo do Sabor sees only its own dependencies');
select is((select count(*)::int from public.project_deliverables d join public.projects p on p.id=d.project_id where p.project_key like 'rls-%'),2,'Mundo do Sabor sees only its own deliverables');
select throws_ok($sql$insert into public.project_sprints (project_id,sprint_number,title) select id,9,'Client forbidden' from public.projects where project_key='rls-mundo-sabor'$sql$,'42501',null,'client viewer cannot create sprints');
select throws_ok($sql$insert into public.project_dependencies (project_id,title) select id,'Client forbidden' from public.projects where project_key='rls-mundo-sabor'$sql$,'42501',null,'client viewer cannot create dependencies');
select throws_ok($sql$insert into public.project_deliverables (project_id,title) select id,'Client forbidden' from public.projects where project_key='rls-mundo-sabor'$sql$,'42501',null,'client viewer cannot register deliverables');
select lives_ok($sql$update public.project_tasks set status='done' where id=(select t.id from public.project_tasks t join public.projects p on p.id=t.project_id where p.project_key='rls-mundo-sabor' limit 1)$sql$,'client task status update is filtered by RLS');
select is((select t.status from public.project_tasks t join public.projects p on p.id=t.project_id where p.project_key='rls-mundo-sabor' limit 1),'todo','client cannot change task execution status');
reset role;

-- Hub Açaí sees its own project only.
set local role authenticated;
select set_config('request.jwt.claim.sub','ffffffff-ffff-4fff-8fff-ffffffffffff',true);
select is((select count(*)::int from public.projects where project_key like 'rls-%'),1,'Hub Açaí sees one project');
select is((select project_key from public.projects where project_key like 'rls-%'),'rls-hub-acai','Hub Açaí cannot see Mundo do Sabor project');
select is((select count(*)::int from public.project_sprints s join public.projects p on p.id=s.project_id where p.project_key like 'rls-%'),1,'Hub Açaí sees only its own sprints');
select is((select count(*)::int from public.project_tasks t join public.projects p on p.id=t.project_id where p.project_key like 'rls-%'),1,'Hub Açaí sees only its own tasks');
select is((select count(*)::int from public.project_dependencies d join public.projects p on p.id=d.project_id where p.project_key like 'rls-%'),1,'Hub Açaí sees only its own dependencies');
select is((select count(*)::int from public.project_deliverables d join public.projects p on p.id=d.project_id where p.project_key like 'rls-%'),1,'Hub Açaí sees only its own deliverables');
reset role;

-- An organization without a project grant sees nothing.
set local role authenticated;
select set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',true);
select is((select count(*)::int from public.projects where project_key like 'rls-%'),0,'unassigned organization sees no projects');
select is((select count(*)::int from public.project_sprints),0,'unassigned organization sees no sprints');
select is((select count(*)::int from public.project_tasks),0,'unassigned organization sees no tasks');
select is((select count(*)::int from public.project_dependencies),0,'unassigned organization sees no dependencies');
select is((select count(*)::int from public.project_deliverables),0,'unassigned organization sees no deliverables');
reset role;

select * from finish();
rollback;
