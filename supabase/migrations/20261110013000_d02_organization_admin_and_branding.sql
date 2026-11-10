-- Organization-scoped invitations and workspace branding.
create table if not exists public.organization_branding (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  banner_path text,
  banner_position_x numeric(5,2) not null default 50 check (banner_position_x between 0 and 100),
  banner_position_y numeric(5,2) not null default 50 check (banner_position_y between 0 and 100),
  banner_zoom numeric(4,2) not null default 1 check (banner_zoom between 1 and 3),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.rsbuild_member_role not null check (role in ('admin','operator','viewer')),
  invited_by uuid not null references auth.users(id),
  invited_user_id uuid references auth.users(id),
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);

alter table public.organization_branding enable row level security;
alter table public.organization_invitations enable row level security;

drop policy if exists "members read organization branding" on public.organization_branding;
create policy "members read organization branding" on public.organization_branding
for select to authenticated using (
  exists (select 1 from public.organization_memberships m
    where m.organization_id = organization_branding.organization_id
      and m.user_id = (select auth.uid()))
);

drop policy if exists "organization admins read invitations" on public.organization_invitations;
create policy "organization admins read invitations" on public.organization_invitations
for select to authenticated using (
  exists (select 1 from public.organization_memberships m
    where m.organization_id = organization_invitations.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin'))
);

revoke all on public.organization_branding, public.organization_invitations from anon, authenticated;
grant select on public.organization_branding, public.organization_invitations to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rsbuild-organization-branding','rsbuild-organization-branding',true,10485760,
  array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "public read organization banners" on storage.objects;
create policy "public read organization banners" on storage.objects
for select to public using (bucket_id = 'rsbuild-organization-branding');
