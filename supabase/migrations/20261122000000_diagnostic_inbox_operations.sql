-- Minimal operational layer for the RSBUILD institutional inbox.
-- Per-user read state, team assignment and append-only internal notes.

create table if not exists public.diagnostic_request_reads (
  request_id uuid not null references public.diagnostic_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

create table if not exists public.diagnostic_request_assignments (
  request_id uuid primary key references public.diagnostic_requests(id) on delete cascade,
  assigned_to uuid not null references auth.users(id) on delete restrict,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table if not exists public.diagnostic_request_notes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.diagnostic_requests(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists diagnostic_request_notes_request_created_idx
  on public.diagnostic_request_notes (request_id, created_at desc);

alter table public.diagnostic_request_reads enable row level security;
alter table public.diagnostic_request_assignments enable row level security;
alter table public.diagnostic_request_notes enable row level security;

grant select, insert, update on public.diagnostic_request_reads to authenticated;
grant select, insert, update on public.diagnostic_request_assignments to authenticated;
grant select, insert on public.diagnostic_request_notes to authenticated;

-- A read receipt belongs to the signed-in RSBUILD member only.
create policy "RSBUILD members manage own diagnostic read receipts"
on public.diagnostic_request_reads
for all to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role::text in ('owner', 'admin', 'operator')
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role::text in ('owner', 'admin', 'operator')
  )
);

-- Assignment visibility and changes are restricted to RSBUILD team members.
create policy "RSBUILD members read diagnostic assignments"
on public.diagnostic_request_assignments
for select to authenticated
using (
  exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role::text in ('owner', 'admin', 'operator')
  )
);

create policy "RSBUILD members create diagnostic assignments"
on public.diagnostic_request_assignments
for insert to authenticated
with check (
  assigned_by = (select auth.uid())
  and exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role::text in ('owner', 'admin', 'operator')
  )
  and exists (
    select 1
    from public.organization_memberships target
    join public.organizations target_org on target_org.id = target.organization_id
    where target_org.slug = 'rsbuild'
      and target.user_id = assigned_to
      and target.role::text in ('owner', 'admin', 'operator')
  )
);

create policy "RSBUILD members update diagnostic assignments"
on public.diagnostic_request_assignments
for update to authenticated
using (
  exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role::text in ('owner', 'admin', 'operator')
  )
)
with check (
  assigned_by = (select auth.uid())
  and exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role::text in ('owner', 'admin', 'operator')
  )
  and exists (
    select 1
    from public.organization_memberships target
    join public.organizations target_org on target_org.id = target.organization_id
    where target_org.slug = 'rsbuild'
      and target.user_id = assigned_to
      and target.role::text in ('owner', 'admin', 'operator')
  )
);

-- Notes are private to the RSBUILD team and append-only for authenticated clients.
create policy "RSBUILD members read diagnostic internal notes"
on public.diagnostic_request_notes
for select to authenticated
using (
  exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role::text in ('owner', 'admin', 'operator')
  )
);

create policy "RSBUILD members add diagnostic internal notes"
on public.diagnostic_request_notes
for insert to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role::text in ('owner', 'admin', 'operator')
  )
);

-- Keep assignment/read/notes metadata inaccessible to public form submissions.
revoke all on public.diagnostic_request_reads from anon;
revoke all on public.diagnostic_request_assignments from anon;
revoke all on public.diagnostic_request_notes from anon;
