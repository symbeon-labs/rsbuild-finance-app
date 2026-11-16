-- RSBUILD OS — Custom member titles for organizational roles
-- Allows admins to define custom titles (e.g., "CTO", "Head of Engineering")
-- that override the default role labels in the UI.

alter table public.organization_memberships
  add column if not exists custom_title text;

-- Add check constraint to prevent excessively long titles
alter table public.organization_memberships
  add constraint organization_memberships_custom_title_length
  check (custom_title is null or char_length(custom_title) <= 100);

comment on column public.organization_memberships.custom_title is
  'Custom title override for the member role (e.g., CTO, Head of Engineering). Displayed instead of the default role label when set.';
