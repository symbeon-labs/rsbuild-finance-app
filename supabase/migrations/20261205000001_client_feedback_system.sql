-- RSBUILD FEEDBACK & SUGGESTIONS
-- Client-facing channel for feedback, improvement suggestions, and bug reports
create table if not exists public.client_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  category text not null check (category in ('bug', 'improvement', 'compliment', 'other')),
  severity text check (severity in ('high', 'medium', 'low')),
  description text not null check (length(description) between 1 and 1000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'rejected')),
  response_text text,
  responded_by uuid references auth.users(id) on delete set null,
  responded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_feedback_org_user_idx
  on public.client_feedback (organization_id, user_id, created_at desc);
create index if not exists client_feedback_org_status_idx
  on public.client_feedback (organization_id, status, created_at desc);
create index if not exists client_feedback_category_idx
  on public.client_feedback (category, created_at desc);

-- Append-only table for feedback screenshots
create table if not exists public.feedback_screenshots (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.client_feedback(id) on delete cascade,
  storage_bucket text not null default 'feedback-screenshots',
  storage_path text not null,
  file_name text not null,
  file_size_bytes bigint not null,
  media_type text not null,
  uploaded_at timestamptz not null default now
);

create index if not exists feedback_screenshots_feedback_idx
  on public.feedback_screenshots (feedback_id, uploaded_at desc);

alter table public.client_feedback enable row level security;
alter table public.feedback_screenshots enable row level security;

-- Organization members can create feedback
create policy "Organization members can create feedback"
  on public.client_feedback for insert to authenticated
  with check (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = client_feedback.organization_id
      and m.user_id = (select auth.uid())
  ));

-- Organization members can read feedback
create policy "Organization members can read feedback"
  on public.client_feedback for select to authenticated
  using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = client_feedback.organization_id
      and m.user_id = (select auth.uid())
  ));

-- Users can update their own feedback (status change by RSBUILD team only)
create policy "Users can update their own feedback"
  on public.client_feedback for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- RSBUILD platform admins can update any feedback (status, response)
-- This is for the development team only, not workspace admins
create policy "RSBUILD admins can update any feedback"
  on public.client_feedback for update to authenticated
  using (
    exists (
      select 1 from public.platform_administrators pa
      where pa.user_id = (select auth.uid())
    )
  );

-- Screenshots RLS
create policy "Organization members can read screenshots"
  on public.feedback_screenshots for select to authenticated
  using (exists (
    select 1 from public.client_feedback f
    where f.id = feedback_screenshots.feedback_id
      and f.organization_id in (
        select organization_id from public.organization_memberships m
        where m.user_id = (select auth.uid())
      )
  ));

-- Storage bucket for screenshots
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feedback-screenshots',
  'feedback-screenshots',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.client_feedback is
  'Client-facing feedback channel for bugs, improvements, and compliments. Screenshots are stored separately.';
comment on table public.feedback_screenshots is
  'Screenshots attached to feedback submissions. Max 5MB per image.';
