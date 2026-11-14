begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(7);
select ok(has_function_privilege('service_role','public.accept_organization_invitation(uuid,uuid,text)','EXECUTE'),'service role can accept invitations');
select ok(not has_function_privilege('authenticated','public.accept_organization_invitation(uuid,uuid,text)','EXECUTE'),'authenticated cannot execute acceptance');
select ok(not has_function_privilege('anon','public.accept_organization_invitation(uuid,uuid,text)','EXECUTE'),'anon cannot execute acceptance');
select ok(has_table_privilege('authenticated','public.organization_invitations','SELECT')
  and not has_table_privilege('authenticated','public.organization_invitations','INSERT')
  and not has_table_privilege('authenticated','public.organization_invitations','UPDATE')
  and not has_table_privilege('authenticated','public.organization_invitations','DELETE'),'browser roles are read-only');
select ok(exists(select 1 from pg_constraint where conrelid='public.organization_invitations'::regclass and conname='organization_invitations_status_check'),'invitation states are constrained');
select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='organization_invitations' and column_name='expires_at'),'expiry is recorded');
select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='organization_invitations' and column_name='accepted_at')
 and exists(select 1 from information_schema.columns where table_schema='public' and table_name='organization_invitations' and column_name='revoked_at'),'acceptance and revocation are auditable');
select * from finish();
rollback;
