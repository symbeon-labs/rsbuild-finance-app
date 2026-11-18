-- Allow the Finance QA evaluation flow in both explicitly designated QA tenants.
-- Application authorization additionally checks active finance entitlement and membership role.
drop policy if exists "QA evaluators can submit in Mundo do Sabor QA" on public.qa_evaluations;

create policy "QA evaluators can submit in authorized finance QA tenants"
on public.qa_evaluations
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = qa_evaluations.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin', 'operator')
      and o.slug in ('mundo_sabor_qa', 'hub_acai_qa')
      and o.status = 'active'
  )
);
