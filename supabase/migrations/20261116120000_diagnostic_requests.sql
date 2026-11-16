-- Diagnostic requests: leads qualificadas da página pública /institucional.
-- Escrita exclusiva via service role (API route pública validada);
-- leitura restrita a membros RSBUILD (owner/admin/operator).

create table public.diagnostic_requests (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  segment text not null default '',
  contact_name text not null,
  contact_role text not null default '',
  contact_email text not null,
  contact_phone text not null default '',
  units_count text not null default '',
  systems_used text not null default '',
  erp_used text not null default '',
  areas_involved text not null default '',
  needs text[] not null default '{}',
  priority_process text not null default '',
  problem_frequency text not null default '',
  problem_impact text not null default '',
  current_process text not null default '',
  expected_result text not null default '',
  intention text not null default '',
  status text not null default 'new'
    check (status in ('new','in_review','qualified','disqualified','converted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index diagnostic_requests_status_idx
  on public.diagnostic_requests(status, created_at desc);

alter table public.diagnostic_requests enable row level security;

-- Somente service role escreve (a API pública valida e insere via admin client).
-- Membros RSBUILD owner/admin/operator podem ler para qualificação comercial.
create policy "RSBUILD team reads diagnostic requests"
on public.diagnostic_requests for select to authenticated
using (
  exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin','operator')
  )
);

create policy "RSBUILD managers update diagnostic request status"
on public.diagnostic_requests for update to authenticated
using (
  exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
)
with check (
  exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where o.slug = 'rsbuild'
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
);

create trigger diagnostic_requests_touch_updated_at
  before update on public.diagnostic_requests
  for each row execute function private.touch_updated_at();

grant select, update on public.diagnostic_requests to authenticated;
grant select, insert, update on public.diagnostic_requests to service_role;
