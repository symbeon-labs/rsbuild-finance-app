-- RSBUILD SUGGESTION REWARDS
-- Track approved suggestions and grant permanent recognition
create table if not exists public.suggestion_rewards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  feedback_id uuid references public.client_feedback(id) on delete cascade,
  reward_type text not null check (reward_type in ('badge', 'point', 'tier')),
  reward_value text not null,
  status text not null default 'granted' check (status in ('granted', 'pending', 'revoked')),
  granted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists suggestion_rewards_org_user_idx
  on public.suggestion_rewards (organization_id, user_id);
create index if not exists suggestion_rewards_feedback_idx
  on public.suggestion_rewards (feedback_id);

-- User suggestion stats view
create or replace view public.user_suggestion_stats as
select
  f.organization_id,
  f.user_id,
  count(distinct f.id) as total_suggestions,
  count(distinct case when f.category = 'improvement' then f.id end) as improvement_suggestions,
  count(distinct case when f.status = 'resolved' then f.id end) as resolved_suggestions,
  count(distinct sr.id) as total_rewards,
  array_agg(distinct sr.reward_value) filter (where sr.reward_value is not null) as rewards
from public.client_feedback f
left join public.suggestion_rewards sr on f.id = sr.feedback_id
where f.user_id is not null
group by f.organization_id, f.user_id;

-- RLS policies
alter table public.suggestion_rewards enable row level security;

create policy "Organization members can view rewards"
  on public.suggestion_rewards for select to authenticated
  using (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = suggestion_rewards.organization_id
      and m.user_id = (select auth.uid())
  ));

create policy "Admins can create rewards"
  on public.suggestion_rewards for insert to authenticated
  with check (exists (
    select 1 from public.organization_memberships m
    where m.organization_id = suggestion_rewards.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  ));

-- Grant reward when feedback is resolved
create or replace function public.grant_suggestion_reward()
returns trigger as $$
begin
  -- Only grant rewards for improvement category
  if old.status != 'resolved' and new.status = 'resolved' and new.category = 'improvement' then
    -- Determine reward tier based on response time
    declare
      response_days integer;
      reward_type text;
      reward_value text;
    begin
      response_days := extract(day from (new.responded_at - new.created_at));
      
      if response_days <= 7 then
        reward_type := 'badge';
        reward_value := 'improvement-hero';
      elsif response_days <= 30 then
        reward_type := 'badge';
        reward_value := 'improvement-champion';
      else
        reward_type := 'point';
        reward_value := 'improvement-voter';
      end if;
      
      insert into public.suggestion_rewards (
        organization_id,
        user_id,
        feedback_id,
        reward_type,
        reward_value,
        metadata
      ) values (
        new.organization_id,
        new.user_id,
        new.id,
        reward_type,
        reward_value,
        jsonb_build_object(
          'response_days', response_days,
          'category', new.category,
          'description', new.description
        )
      ) on conflict do nothing;
    end;
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger
create or replace trigger grant_reward_on_resolve
  after update on public.client_feedback
  for each row
  execute function public.grant_suggestion_reward();

comment on table public.suggestion_rewards is
  'Permanent recognition for approved suggestions. Grants badges/points/tier upgrades.';
