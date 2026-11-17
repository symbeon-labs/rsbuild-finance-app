-- RSBUILD OS: explicit project-scoped collaboration grants
-- Flavio is an operational contributor only on projects explicitly assigned to him.
-- This migration intentionally does not grant access to client production workspaces.

begin;

create or replace function public.can_read_rsbuild_project(target_project_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.projects p
      join public.organization_memberships m on m.organization_id=p.managing_organization_id
      join public.organizations o on o.id=m.organization_id
      where p.id=target_project_id and o.slug='rsbuild'
        and m.user_id=auth.uid() and m.role in ('owner','admin')
    )
    or exists (
      select 1 from public.project_memberships pm
      where pm.project_id=target_project_id and pm.user_id=auth.uid()
        and pm.access_level in ('viewer','contributor')
    )
    or exists (
      select 1 from public.project_organization_access pa
      join public.organization_memberships cm on cm.organization_id=pa.client_organization_id
      where pa.project_id=target_project_id and cm.user_id=auth.uid()
    );
$$;

create or replace function public.can_operate_rsbuild_project(target_project_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.projects p
      join public.organization_memberships m on m.organization_id=p.managing_organization_id
      join public.organizations o on o.id=m.organization_id
      where p.id=target_project_id and o.slug='rsbuild'
        and m.user_id=auth.uid() and m.role in ('owner','admin')
    )
    or exists (
      select 1 from public.project_memberships pm
      where pm.project_id=target_project_id and pm.user_id=auth.uid()
        and pm.access_level='contributor'
    );
$$;

revoke all on function public.can_read_rsbuild_project(uuid) from public;
revoke all on function public.can_operate_rsbuild_project(uuid) from public;
grant execute on function public.can_read_rsbuild_project(uuid) to authenticated;
grant execute on function public.can_operate_rsbuild_project(uuid) to authenticated;

update public.organization_memberships
set role='operator'::public.rsbuild_member_role
where user_id='d4bc4a75-8271-41d7-b992-543b4da7d502'
  and organization_id=(select id from public.organizations where slug='rsbuild');

delete from public.organization_memberships
where user_id='d4bc4a75-8271-41d7-b992-543b4da7d502'
  and organization_id in (
    select id from public.organizations where slug in ('hub_acai_qa','mundo_sabor_qa')
  );

insert into public.project_memberships
  (project_id,managing_organization_id,user_id,access_level,created_by)
select p.id,p.managing_organization_id,
       'd4bc4a75-8271-41d7-b992-543b4da7d502'::uuid,
       'contributor',
       '7378d4ff-97ea-431c-8d78-1e5af14cb946'::uuid
from public.projects p
where p.project_key in ('hub-acai','mundo-do-sabor')
on conflict (project_id,user_id)
do update set access_level='contributor',
              managing_organization_id=excluded.managing_organization_id;

drop policy if exists "portfolio members and project members read projects" on public.projects;
create policy "authorized users read scoped projects"
on public.projects for select to authenticated
using (public.can_read_rsbuild_project(id));

drop policy if exists "project readers read sprints" on public.project_sprints;
drop policy if exists "RSBUILD operators manage sprints" on public.project_sprints;
create policy "authorized project members read sprints"
on public.project_sprints for select to authenticated
using (public.can_read_rsbuild_project(project_id));
create policy "authorized project contributors manage sprints"
on public.project_sprints for all to authenticated
using (public.can_operate_rsbuild_project(project_id))
with check (public.can_operate_rsbuild_project(project_id));

drop policy if exists "project readers read tasks" on public.project_tasks;
drop policy if exists "RSBUILD operators manage tasks" on public.project_tasks;
create policy "authorized project members read tasks"
on public.project_tasks for select to authenticated
using (public.can_read_rsbuild_project(project_id));
create policy "authorized project contributors manage tasks"
on public.project_tasks for all to authenticated
using (public.can_operate_rsbuild_project(project_id))
with check (public.can_operate_rsbuild_project(project_id));

drop policy if exists "project readers read deliverables" on public.project_deliverables;
drop policy if exists "RSBUILD operators manage deliverables" on public.project_deliverables;
create policy "authorized project members read deliverables"
on public.project_deliverables for select to authenticated
using (public.can_read_rsbuild_project(project_id));
create policy "authorized project contributors manage deliverables"
on public.project_deliverables for all to authenticated
using (public.can_operate_rsbuild_project(project_id))
with check (public.can_operate_rsbuild_project(project_id));

drop policy if exists "project readers read dependencies" on public.project_dependencies;
drop policy if exists "RSBUILD operators manage dependencies" on public.project_dependencies;
create policy "authorized project members read dependencies"
on public.project_dependencies for select to authenticated
using (public.can_read_rsbuild_project(project_id));
create policy "authorized project contributors manage dependencies"
on public.project_dependencies for all to authenticated
using (public.can_operate_rsbuild_project(project_id))
with check (public.can_operate_rsbuild_project(project_id));

commit;
