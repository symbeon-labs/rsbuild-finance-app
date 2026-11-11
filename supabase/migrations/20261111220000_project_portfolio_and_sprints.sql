-- RSBUILD OS: central portfolio with explicit tenant-scoped project access.
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  managing_organization_id uuid not null references public.organizations(id) on delete restrict,
  client_organization_id uuid not null references public.organizations(id) on delete restrict,
  client_display_name text not null,
  project_key text not null,
  name text not null,
  description text not null default '',
  status text not null default 'planning'
    check (status in ('planning','active','blocked','completed','archived')),
  start_date date,
  target_date date,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (managing_organization_id, client_organization_id, project_key),
  unique (id, managing_organization_id),
  check (managing_organization_id <> client_organization_id),
  check (project_key ~ '^[a-z][a-z0-9-]{1,62}$')
);

create index projects_managing_org_status_idx
  on public.projects(managing_organization_id, status, updated_at desc);
create index projects_client_org_idx on public.projects(client_organization_id);

create table public.project_memberships (
  project_id uuid not null,
  managing_organization_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_level text not null default 'viewer'
    check (access_level in ('viewer','contributor')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id),
  foreign key (project_id, managing_organization_id)
    references public.projects(id, managing_organization_id) on delete cascade
);
create index project_memberships_user_idx on public.project_memberships(user_id, project_id);

create table public.project_sprints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  sprint_number integer not null check (sprint_number > 0),
  title text not null,
  objective text not null default '',
  status text not null default 'planned'
    check (status in ('planned','active','blocked','completed','cancelled')),
  start_date date,
  end_date date,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, sprint_number),
  unique (project_id, id),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index project_sprints_project_order_idx
  on public.project_sprints(project_id, sort_order, sprint_number);

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  sprint_id uuid not null,
  title text not null,
  description text not null default '',
  acceptance_criteria text not null default '',
  status text not null default 'todo'
    check (status in ('todo','in_progress','blocked','review','done','cancelled')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','critical')),
  assignee_user_id uuid references auth.users(id) on delete set null,
  due_date date,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, sprint_id)
    references public.project_sprints(project_id, id) on delete cascade
);
create index project_tasks_sprint_status_idx on public.project_tasks(sprint_id, status, sort_order);
create index project_tasks_project_idx on public.project_tasks(project_id, due_date);

create table public.project_deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  sprint_id uuid,
  title text not null,
  description text not null default '',
  resource_url text,
  status text not null default 'draft'
    check (status in ('draft','submitted','accepted','changes_requested','archived')),
  submitted_by uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, sprint_id)
    references public.project_sprints(project_id, id)
);
create index project_deliverables_project_idx on public.project_deliverables(project_id, created_at desc);

alter table public.projects enable row level security;
alter table public.project_memberships enable row level security;
alter table public.project_sprints enable row level security;
alter table public.project_tasks enable row level security;
alter table public.project_deliverables enable row level security;

-- RSBUILD members can see the managed portfolio. Client-side access is granted per project/user.
create policy "portfolio members and project members read projects"
on public.projects for select to authenticated
using (
  exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = projects.managing_organization_id
      and o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.project_memberships pm
    where pm.project_id = projects.id and pm.user_id = (select auth.uid())
  )
);

create policy "RSBUILD owners and admins create projects"
on public.projects for insert to authenticated
with check (
  exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = projects.managing_organization_id
      and o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
);

create policy "RSBUILD managers update projects"
on public.projects for update to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = projects.managing_organization_id
      and o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
)
with check (
  exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = projects.managing_organization_id
      and o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
);

create policy "RSBUILD owners archive or delete projects"
on public.projects for delete to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = projects.managing_organization_id
      and o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  )
);

-- A project member can read only their own grant. RSBUILD managers can administer grants
-- without recursively querying projects (managing_organization_id is stored on the grant).
create policy "users read own project grants and RSBUILD managers read grants"
on public.project_memberships for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = project_memberships.managing_organization_id
      and o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
);
create policy "RSBUILD managers grant project access"
on public.project_memberships for insert to authenticated
with check (
  exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = project_memberships.managing_organization_id
      and o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
);
create policy "RSBUILD managers revoke project access"
on public.project_memberships for delete to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = project_memberships.managing_organization_id
      and o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
);

-- Sprints, tasks and deliverables are visible to RSBUILD portfolio members and
-- explicitly granted client users. Mutations are controlled by RSBUILD operators.
create policy "project readers read sprints"
on public.project_sprints for select to authenticated
using (exists (select 1 from public.projects p where p.id = project_sprints.project_id));

create policy "RSBUILD operators manage sprints"
on public.project_sprints for all to authenticated
using (
  exists (
    select 1 from public.projects p
    join public.organization_memberships m on m.organization_id = p.managing_organization_id
    join public.organizations o on o.id = m.organization_id
    where p.id = project_sprints.project_id
      and o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin','operator')
  )
)
with check (
  exists (
    select 1 from public.projects p
    join public.organization_memberships m on m.organization_id = p.managing_organization_id
    join public.organizations o on o.id = m.organization_id
    where p.id = project_sprints.project_id
      and o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin','operator')
  )
);

create policy "project readers read tasks"
on public.project_tasks for select to authenticated
using (exists (select 1 from public.projects p where p.id = project_tasks.project_id));

create policy "RSBUILD operators manage tasks"
on public.project_tasks for all to authenticated
using (
  exists (
    select 1 from public.projects p
    join public.organization_memberships m on m.organization_id = p.managing_organization_id
    join public.organizations o on o.id = m.organization_id
    where p.id = project_tasks.project_id
      and o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin','operator')
  )
)
with check (
  exists (
    select 1 from public.projects p
    join public.organization_memberships m on m.organization_id = p.managing_organization_id
    join public.organizations o on o.id = m.organization_id
    where p.id = project_tasks.project_id
      and o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin','operator')
  )
);

create policy "project readers read deliverables"
on public.project_deliverables for select to authenticated
using (exists (select 1 from public.projects p where p.id = project_deliverables.project_id));

create policy "RSBUILD operators manage deliverables"
on public.project_deliverables for all to authenticated
using (
  exists (
    select 1 from public.projects p
    join public.organization_memberships m on m.organization_id = p.managing_organization_id
    join public.organizations o on o.id = m.organization_id
    where p.id = project_deliverables.project_id
      and o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin','operator')
  )
)
with check (
  exists (
    select 1 from public.projects p
    join public.organization_memberships m on m.organization_id = p.managing_organization_id
    join public.organizations o on o.id = m.organization_id
    where p.id = project_deliverables.project_id
      and o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin','operator')
  )
);

grant select, insert, update, delete on public.projects,
  public.project_memberships, public.project_sprints,
  public.project_tasks, public.project_deliverables to authenticated;

-- Initial portfolio entries are keyed by canonical organization slugs, not generated UUIDs.
insert into public.projects (
  managing_organization_id, client_organization_id, client_display_name,
  project_key, name, description, status
)
select rs.id, client.id, client.display_name, seed.project_key,
       seed.name, seed.description, 'planning'
from public.organizations rs
cross join (values
  ('mundo-do-sabor', 'mundo_sabor', 'Mundo do Sabor', 'Projeto de estruturação operacional e integração dos dados da empresa.'),
  ('hub-acai', 'hub_acai', 'Hub Açaí', 'Projeto de estruturação operacional e integração dos dados da empresa.')
) as seed(project_key, client_slug, name, description)
join public.organizations client on client.slug = seed.client_slug
where rs.slug = 'rsbuild'
on conflict (managing_organization_id, client_organization_id, project_key) do nothing;
