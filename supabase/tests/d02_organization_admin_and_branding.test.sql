begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(7);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('77777777-7777-4777-8777-777777777777','00000000-0000-0000-0000-000000000000','authenticated','authenticated','brand-owner@test.invalid','',now(),now(),now())
on conflict (id) do nothing;
insert into public.organizations (id,legal_name,display_name,slug)
values ('88888888-8888-4888-8888-888888888888','Brand Tenant Ltda','Brand Tenant','brand_tenant')
on conflict (id) do nothing;
insert into public.organization_memberships (organization_id,user_id,role)
values ('88888888-8888-4888-8888-888888888888','77777777-7777-4777-8777-777777777777','owner')
on conflict do nothing;

select ok(
  has_table_privilege('authenticated','public.organization_branding','SELECT')
  and not has_table_privilege('authenticated','public.organization_branding','INSERT')
  and not has_table_privilege('authenticated','public.organization_branding','UPDATE'),
  'members can read branding but cannot write it directly'
);
select ok(
  has_table_privilege('authenticated','public.organization_invitations','SELECT')
  and not has_table_privilege('authenticated','public.organization_invitations','INSERT')
  and not has_table_privilege('authenticated','public.organization_invitations','UPDATE'),
  'browser clients cannot forge or mutate invitation audit records'
);
select ok(
  exists (select 1 from pg_policies where schemaname='public' and tablename='organization_branding' and policyname='members read organization branding' and cmd='SELECT'),
  'branding reads are protected by organization membership RLS'
);
select ok(
  exists (select 1 from pg_policies where schemaname='public' and tablename='organization_invitations' and policyname='organization admins read invitations' and cmd='SELECT'),
  'invitation audit reads are restricted to organization admins'
);
select ok(
  exists (select 1 from storage.buckets where id='rsbuild-organization-branding' and public=true and file_size_limit=10485760),
  'organization banner bucket is public-read and size limited'
);
select ok(
  exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='public read organization banners' and cmd='SELECT'),
  'only public read policy is added for organization banner objects'
);
select ok(
  not has_table_privilege('anon','public.organization_invitations','SELECT')
  and not has_table_privilege('anon','public.organization_branding','SELECT'),
  'anonymous clients cannot read tenant branding metadata or invitations'
);

select * from finish();
rollback;
