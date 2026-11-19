-- F02.1: transactional commit for payable imports.
-- Depends on F02 payable_titles and D02 import_batches/source_artifacts.

alter table public.payable_titles
  add column if not exists recurrence_reference text,
  add column if not exists source_sheet_name text,
  add column if not exists source_row_number integer;

alter table public.payable_titles
  add constraint payable_titles_source_row_number_check
  check (source_row_number is null or source_row_number > 0);

create or replace function private.commit_payable_import(
  p_organization_id uuid,
  p_actor_id uuid,
  p_original_filename text,
  p_file_sha256 text,
  p_file_size_bytes bigint,
  p_storage_path text,
  p_media_type text,
  p_sheet_name text,
  p_parser_version text,
  p_parsed_count integer,
  p_rejected_count integer,
  p_in_file_duplicate_count integer,
  p_records jsonb
)
returns table(batch_id uuid, inserted_count integer, duplicate_count integer, rejected_count integer)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_batch_id uuid;
  v_inserted integer := 0;
  v_candidate_count integer := 0;
  v_db_duplicates integer := 0;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_actor_id is null or p_actor_id is distinct from auth.uid() then
    raise exception 'actor attribution mismatch' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = p_actor_id
      and m.role in ('owner','admin','operator')
  ) then
    raise exception 'organization access denied' using errcode = '42501';
  end if;

  if p_original_filename is null or length(p_original_filename) not between 1 and 120
    or p_file_sha256 is null or length(p_file_sha256) <> 64
    or translate(p_file_sha256, '0123456789abcdef', '') <> ''
    or p_file_size_bytes is null or p_file_size_bytes < 1 or p_file_size_bytes > 10485760
    or p_media_type is null or p_media_type not in ('text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    or length(coalesce(p_sheet_name, '')) > 120\n    or p_parser_version is null or length(p_parser_version) not between 1 and 40
    or p_parsed_count is null or p_parsed_count < 1 or p_parsed_count > 5000
    or p_rejected_count is null or p_rejected_count < 0
    or p_in_file_duplicate_count is null or p_in_file_duplicate_count < 0
  then
    raise exception 'invalid payable import metadata' using errcode = '22023';
  end if;

  if p_records is null or jsonb_typeof(p_records) is distinct from 'array' then
    raise exception 'payable import records must be a JSON array' using errcode = '22023';
  end if;
  v_candidate_count := jsonb_array_length(p_records);
  if v_candidate_count < 1 or v_candidate_count > 5000
    or v_candidate_count + p_rejected_count + p_in_file_duplicate_count <> p_parsed_count
  then
    raise exception 'payable import counts are inconsistent' using errcode = '22023';
  end if;

  if p_storage_path is null or split_part(p_storage_path, '/', 1) <> p_organization_id::text
    or not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'rsbuild-source-artifacts' and o.name = p_storage_path
    )
  then
    raise exception 'payable source artifact not found for tenant' using errcode = '42501';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_records) item(value)
    where jsonb_typeof(item.value) <> 'object'
      or length(coalesce(item.value->>'supplier_name','')) not between 1 and 200
      or length(coalesce(item.value->>'document_number','')) not between 1 and 100
      or coalesce(item.value->>'due_date','') !~ '^\d{4}-\d{2}-\d{2}$'
      or coalesce(item.value->>'amount_minor','') !~ '^[0-9]+$'
      or case when coalesce(item.value->>'amount_minor','') ~ '^[0-9]+$'
        then (item.value->>'amount_minor')::numeric <= 0
          or (item.value->>'amount_minor')::numeric > 9007199254740991
        else true end
      or coalesce(item.value->>'deduplication_key','') !~ '^[a-f0-9]{64}$'
      or coalesce(item.value->>'source_row_number','') !~ '^[1-9][0-9]*$'
      or length(coalesce(item.value->>'source_sheet_name','')) > 120
      or length(coalesce(item.value->>'supplier_document','')) > 30
      or length(coalesce(item.value->>'category','')) > 120
      or length(coalesce(item.value->>'cost_center','')) > 120
      or length(coalesce(item.value->>'bank_account','')) > 120
      or length(coalesce(item.value->>'payment_method','')) > 80
      or length(coalesce(item.value->>'recurrence_reference','')) > 160
      or (nullif(item.value->>'issue_date','') is not null and (item.value->>'issue_date') !~ '^\d{4}-\d{2}-\d{2}$')
  ) then
    raise exception 'one or more payable import rows are invalid' using errcode = '22023';
  end if;

  insert into public.import_batches(
    organization_id, status, original_filename, file_sha256, file_size_bytes,
    record_count, accepted_count, rejected_count, received_by, metadata
  ) values (
    p_organization_id, 'received', p_original_filename, p_file_sha256, p_file_size_bytes,
    p_parsed_count, v_candidate_count, p_rejected_count, p_actor_id,
    jsonb_build_object(
      'source', 'rsbuild-finance-app',
      'parser_version', p_parser_version,
      'sheet_name', p_sheet_name,
      'in_file_duplicate_count', p_in_file_duplicate_count,
      'media_type', p_media_type
    )
  ) returning id into v_batch_id;

  insert into public.source_artifacts(
    organization_id, import_batch_id, storage_bucket, storage_path,
    media_type, file_sha256, file_size_bytes, created_by
  ) values (
    p_organization_id, v_batch_id, 'rsbuild-source-artifacts', p_storage_path,
    p_media_type, p_file_sha256, p_file_size_bytes, p_actor_id
  );

  insert into public.payable_titles(
    organization_id, import_batch_id, supplier_name, supplier_document,
    document_number, issue_date, due_date, amount_minor, currency,
    category, cost_center, bank_account, payment_method, recurrence_reference,
    source_system, source_reference, source_sheet_name, source_row_number,
    deduplication_key, status, created_by
  )
  select
    p_organization_id, v_batch_id,
    item.value->>'supplier_name',
    nullif(item.value->>'supplier_document',''),
    item.value->>'document_number',
    nullif(item.value->>'issue_date','')::date,
    (item.value->>'due_date')::date,
    (item.value->>'amount_minor')::bigint,
    'BRL',
    nullif(item.value->>'category',''),
    nullif(item.value->>'cost_center',''),
    nullif(item.value->>'bank_account',''),
    nullif(item.value->>'payment_method',''),
    nullif(item.value->>'recurrence_reference',''),
    'rsbuild-finance-app',
    p_file_sha256 || ':' || coalesce(nullif(item.value->>'source_sheet_name',''), '') || ':' || (item.value->>'source_row_number'),
    nullif(item.value->>'source_sheet_name',''),
    (item.value->>'source_row_number')::integer,
    item.value->>'deduplication_key',
    'open',
    p_actor_id
  from jsonb_array_elements(p_records) item(value)
  on conflict do nothing;

  get diagnostics v_inserted = row_count;
  v_db_duplicates := v_candidate_count - v_inserted;

  update public.import_batches
  set status = 'committed',
      accepted_count = v_inserted,
      rejected_count = p_rejected_count,
      committed_at = now(),
      metadata = metadata || jsonb_build_object(
        'inserted_count', v_inserted,
        'database_duplicate_count', v_db_duplicates,
        'duplicate_count', p_in_file_duplicate_count + v_db_duplicates,
        'rejected_count', p_rejected_count
      )
  where id = v_batch_id and organization_id = p_organization_id;

  insert into public.audit_events(organization_id, actor_id, event_type, entity_type, entity_id, metadata)
  values (
    p_organization_id, p_actor_id, 'payable_import_committed', 'import_batch', v_batch_id::text,
    jsonb_build_object(
      'inserted_count', v_inserted,
      'duplicate_count', p_in_file_duplicate_count + v_db_duplicates,
      'rejected_count', p_rejected_count,
      'file_sha256', p_file_sha256,
      'parser_version', p_parser_version
    )
  );

  return query select v_batch_id, v_inserted, p_in_file_duplicate_count + v_db_duplicates, p_rejected_count;
end;
$function$;

create or replace function private.commit_payable_import_trusted(
  p_actor_id uuid,
  p_organization_id uuid,
  p_original_filename text,
  p_file_sha256 text,
  p_file_size_bytes bigint,
  p_storage_path text,
  p_media_type text,
  p_sheet_name text,
  p_parser_version text,
  p_parsed_count integer,
  p_rejected_count integer,
  p_in_file_duplicate_count integer,
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

  return query select * from private.commit_payable_import(
    p_organization_id, p_actor_id, p_original_filename, p_file_sha256,
    p_file_size_bytes, p_storage_path, p_media_type, p_sheet_name,
    p_parser_version, p_parsed_count, p_rejected_count,
    p_in_file_duplicate_count, p_records
  );
end;
$trusted$;

create or replace function public.commit_payable_import_trusted(
  p_actor_id uuid,
  p_organization_id uuid,
  p_original_filename text,
  p_file_sha256 text,
  p_file_size_bytes bigint,
  p_storage_path text,
  p_media_type text,
  p_sheet_name text,
  p_parser_version text,
  p_parsed_count integer,
  p_rejected_count integer,
  p_in_file_duplicate_count integer,
  p_records jsonb
)
returns table(batch_id uuid, inserted_count integer, duplicate_count integer, rejected_count integer)
language sql
security invoker
set search_path = pg_catalog, public, private
as $wrapper$
  select * from private.commit_payable_import_trusted(
    p_actor_id, p_organization_id, p_original_filename, p_file_sha256,
    p_file_size_bytes, p_storage_path, p_media_type, p_sheet_name,
    p_parser_version, p_parsed_count, p_rejected_count,
    p_in_file_duplicate_count, p_records
  );
$wrapper$;

revoke all on function private.commit_payable_import(uuid,uuid,text,text,bigint,text,text,text,text,integer,integer,integer,jsonb) from public, anon, authenticated;
revoke all on function private.commit_payable_import_trusted(uuid,uuid,text,text,bigint,text,text,text,text,integer,integer,integer,jsonb) from public, anon, authenticated;
revoke all on function public.commit_payable_import_trusted(uuid,uuid,text,text,bigint,text,text,text,text,integer,integer,integer,jsonb) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.commit_payable_import_trusted(uuid,uuid,text,text,bigint,text,text,text,text,integer,integer,integer,jsonb) to service_role;
grant execute on function public.commit_payable_import_trusted(uuid,uuid,text,text,bigint,text,text,text,text,integer,integer,integer,jsonb) to service_role;
