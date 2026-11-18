-- RSBUILD OS: project-scoped authorization for project metadata.
-- Institutional roles and tenant financial-data access remain separate.
-- This migration does not modify user memberships or grant client-production access.

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

-- Memberships are managed independently from this policy migration.
-- Keep the RSBUILD institutional role and explicit QA/Sandbox grants intact.
-- No client-production organization membership is created here.

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
