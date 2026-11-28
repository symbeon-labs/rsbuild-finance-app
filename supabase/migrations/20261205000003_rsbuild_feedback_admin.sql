-- RSBUILD FEEDBACK MANAGEMENT
-- Admin panel in ControlTower to manage client feedback

-- View for RSBUILD team to see all feedback across organizations
create or replace view public.all_client_feedback as
select
  f.id,
  f.organization_id,
  o.name as organization_name,
  o.slug as organization_slug,
  f.user_id,
  u.email as user_email,
  f.category,
  f.severity,
  f.description,
  f.status,
  f.response_text,
  f.responded_by,
  f.responded_at,
  f.metadata,
  f.created_at,
  f.updated_at
from public.client_feedback f
left join public.organizations o on f.organization_id = o.id
left join auth.users u on f.user_id = u.id;

-- View for feedback analytics
create or replace view public.feedback_analytics as
select
  organization_id,
  category,
  severity,
  status,
  count(*) as count,
  avg(extract(epoch from (responded_at - created_at))/3600) as avg_response_hours
from public.client_feedback
where responded_at is not null
group by organization_id, category, severity, status;

-- Policy: RSBUILD admins can view all feedback
create policy "RSBUILD admins can view all feedback"
  on public.client_feedback for select to authenticated
  using (
    exists (
      select 1 from public.platform_administrators pa
      where pa.user_id = (select auth.uid())
    )
  );

-- Policy: RSBUILD admins can insert responses
create policy "RSBUILD admins can respond to feedback"
  on public.client_feedback for update to authenticated
  using (
    exists (
      select 1 from public.platform_administrators pa
      where pa.user_id = (select auth.uid())
    )
  );

-- Table to track feedback responses by RSBUILD team
create table if not exists public.feedback_responses (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.client_feedback(id) on delete cascade,
  responded_by uuid references auth.users(id) on delete set null,
  response_text text not null,
  response_type text not null check (response_type in ('acknowledgment', 'update', 'resolution', 'rejection')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists feedback_responses_feedback_idx
  on public.feedback_responses (feedback_id, created_at desc);

-- RLS for feedback_responses
alter table public.feedback_responses enable row level security;

create policy "RSBUILD admins can view responses"
  on public.feedback_responses for select to authenticated
  using (
    exists (
      select 1 from public.platform_administrators pa
      where pa.user_id = (select auth.uid())
    )
  );

create policy "RSBUILD admins can create responses"
  on public.feedback_responses for insert to authenticated
  with check (
    exists (
      select 1 from public.platform_administrators pa
      where pa.user_id = (select auth.uid())
    )
  );

comment on view public.all_client_feedback is
  'Aggregated view of all client feedback for RSBUILD team management';
comment on view public.feedback_analytics is
  'Analytics on feedback volume, categories, and response times';
comment on table public.feedback_responses is
  'History of responses given by RSBUILD team to client feedback';
