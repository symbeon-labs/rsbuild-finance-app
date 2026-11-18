-- Separate technical agent governance and decision authority from organization admin.
-- Only the institutional RSBUILD owner may inspect/manage the global registry and grants.
-- Tenant owners may read/decide proposals for their own organization only.

drop policy if exists "RSBUILD members read agents" on public.agents;
drop policy if exists "RSBUILD members read agent grants" on public.agent_organization_grants;
drop policy if exists "governance and tenant read proposals" on public.agent_action_proposals;
drop policy if exists "RSBUILD admins manage agents" on public.agents;
drop policy if exists "RSBUILD admins manage agent grants" on public.agent_organization_grants;
drop policy if exists "governance decides proposals" on public.agent_action_proposals;

create policy "RSBUILD owner reads agents"
on public.agents for select to authenticated
using (exists (
  select 1
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  where o.slug = 'rsbuild'
    and m.user_id = (select auth.uid())
    and m.role = 'owner'
));

create policy "RSBUILD owner reads agent grants"
on public.agent_organization_grants for select to authenticated
using (exists (
  select 1
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  where o.slug = 'rsbuild'
    and m.user_id = (select auth.uid())
    and m.role = 'owner'
));

create policy "owner governance and tenant read proposals"
on public.agent_action_proposals for select to authenticated
using (
  exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  )
  or exists (
    select 1
    from public.organization_memberships tm
    where tm.organization_id = agent_action_proposals.organization_id
      and tm.user_id = (select auth.uid())
  )
);

create policy "RSBUILD owner manages agents"
on public.agents for all to authenticated
using (exists (
  select 1
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  where o.slug = 'rsbuild'
    and m.user_id = (select auth.uid())
    and m.role = 'owner'
))
with check (exists (
  select 1
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  where o.slug = 'rsbuild'
    and m.user_id = (select auth.uid())
    and m.role = 'owner'
));

create policy "RSBUILD owner manages agent grants"
on public.agent_organization_grants for all to authenticated
using (exists (
  select 1
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  where o.slug = 'rsbuild'
    and m.user_id = (select auth.uid())
    and m.role = 'owner'
))
with check (exists (
  select 1
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  where o.slug = 'rsbuild'
    and m.user_id = (select auth.uid())
    and m.role = 'owner'
));

create policy "owners decide agent proposals"
on public.agent_action_proposals for update to authenticated
using (
  exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  )
  or exists (
    select 1
    from public.organization_memberships tm
    where tm.organization_id = agent_action_proposals.organization_id
      and tm.user_id = (select auth.uid())
      and tm.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  )
  or exists (
    select 1
    from public.organization_memberships tm
    where tm.organization_id = agent_action_proposals.organization_id
      and tm.user_id = (select auth.uid())
      and tm.role = 'owner'
  )
);

-- Limit authenticated proposal updates to the decision fields used by the
-- server endpoint. RLS controls which row can be decided; column grants
-- prevent direct clients from rewriting proposal content or ownership.
revoke update on public.agent_action_proposals from authenticated, anon;
grant update (status, decided_by, decided_at, decision_reason, updated_at)
on public.agent_action_proposals to authenticated;
