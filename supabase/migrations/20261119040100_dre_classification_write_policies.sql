-- Allow the invoker-rights RPC to persist classifications only for tenant operators.
grant insert, update on public.dre_classifications to authenticated;
grant insert on public.dre_classification_events to authenticated;

drop policy if exists "operators insert DRE classifications" on public.dre_classifications;
create policy "operators insert DRE classifications" on public.dre_classifications
for insert to authenticated with check (
  exists (select 1 from public.organization_memberships m
    where m.organization_id = dre_classifications.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin','operator'))
);

drop policy if exists "operators update DRE classifications" on public.dre_classifications;
create policy "operators update DRE classifications" on public.dre_classifications
for update to authenticated
using (exists (select 1 from public.organization_memberships m
  where m.organization_id = dre_classifications.organization_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin','operator')))
with check (exists (select 1 from public.organization_memberships m
  where m.organization_id = dre_classifications.organization_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin','operator')));

drop policy if exists "operators append DRE classification events" on public.dre_classification_events;
create policy "operators append DRE classification events" on public.dre_classification_events
for insert to authenticated with check (
  actor_id = (select auth.uid())
  and exists (select 1 from public.organization_memberships m
    where m.organization_id = dre_classification_events.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin','operator'))
);
