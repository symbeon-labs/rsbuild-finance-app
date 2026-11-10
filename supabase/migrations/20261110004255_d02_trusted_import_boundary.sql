-- Trusted import boundary: authenticated browsers cannot call privileged import RPCs
-- or delete historical source artifacts. The Next.js server validates identity,
-- membership and file parsing before invoking this service-role-only entrypoint.

create or replace function private.commit_financial_import_trusted(
  p_actor_id uuid,
  p_organization_id uuid,
  p_original_filename text,
  p_file_sha256 text,
  p_file_size_bytes bigint,
  p_storage_path text,
  p_records jsonb
)
returns table(batch_id uuid, inserted_count integer, duplicate_count integer, rejected_count integer)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $trusted$
begin
  if auth.role() <> 'service_role' then
    raise exception 'trusted backend role required' using errcode = '42501';
  end if;
  if p_actor_id is null then
    raise exception 'verified actor is required' using errcode = '42501';
  end if;

  perform set_config('request.jwt.claim.sub', p_actor_id::text, true);

  if not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = p_actor_id
      and m.role in ('owner','admin','operator')
  ) then
    raise exception 'organization access denied' using errcode = '42501';
  end if;

  return query
    select * from private.commit_financial_import(
      p_organization_id, p_original_filename, p_file_sha256,
      p_file_size_bytes, p_storage_path, p_records
    );
end;
$trusted$;

-- PostgREST exposes public, not the private schema. This invoker wrapper is
-- callable only with the service-role JWT and delegates to the private definer.
create or replace function public.commit_financial_import_trusted(
  p_actor_id uuid,
  p_organization_id uuid,
  p_original_filename text,
  p_file_sha256 text,
  p_file_size_bytes bigint,
  p_storage_path text,
  p_records jsonb
)
returns table(batch_id uuid, inserted_count integer, duplicate_count integer, rejected_count integer)
language sql
security invoker
set search_path = pg_catalog, public, private
as $wrapper$
  select * from private.commit_financial_import_trusted(
    p_actor_id, p_organization_id, p_original_filename, p_file_sha256,
    p_file_size_bytes, p_storage_path, p_records
  );
$wrapper$;

revoke all on function private.commit_financial_import(uuid,text,text,bigint,text,jsonb) from public, anon, authenticated;
revoke all on function public.commit_financial_import(uuid,text,text,bigint,text,jsonb) from public, anon, authenticated;
revoke all on function private.commit_financial_import_trusted(uuid,uuid,text,text,bigint,text,jsonb) from public, anon, authenticated;
revoke all on function public.commit_financial_import_trusted(uuid,uuid,text,text,bigint,text,jsonb) from public, anon, authenticated;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.commit_financial_import_trusted(uuid,uuid,text,text,bigint,text,jsonb) to service_role;
grant execute on function public.commit_financial_import_trusted(uuid,uuid,text,text,bigint,text,jsonb) to service_role;

drop policy if exists "tenant operators delete source files" on storage.objects;
