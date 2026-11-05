-- D02: tenant-scoped, idempotent financial import.
-- Storage upload remains an external side effect; failed compensations are logged
-- by the API and must be reconciled using the tenant-scoped imports prefix.
create unique index if not exists financial_records_org_dedup_key_uidx
  on public.financial_records (organization_id, deduplication_key)
  where deduplication_key is not null;

create or replace function public.commit_financial_import(
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
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_batch_id uuid;
  v_inserted integer := 0;
  v_total integer := 0;
  v_duplicates integer := 0;
  v_rejected integer := 0;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = v_user_id
      and m.role in ('owner','admin','operator')
  ) then
    raise exception 'organization access denied' using errcode = '42501';
  end if;

  if p_original_filename is null
     or length(p_original_filename) not between 1 and 255
     or p_file_sha256 is null
     or length(p_file_sha256) <> 64
     or translate(p_file_sha256, '0123456789abcdef', '') <> ''
     or p_file_size_bytes is null
     or p_file_size_bytes < 1\n     or p_file_size_bytes > 10485760 then
    raise exception 'invalid import metadata' using errcode = '22023';
  end if;

  if p_records is null or jsonb_typeof(p_records) is distinct from 'array' then
    raise exception 'import records must be a JSON array' using errcode = '22023';
  end if;
  v_total := jsonb_array_length(p_records);
  if v_total < 1 or v_total > 5000 then
    raise exception 'import record count out of range' using errcode = '22023';
  end if;

  if p_storage_path is null
     or split_part(p_storage_path, '/', 1) <> p_organization_id::text then
    raise exception 'invalid tenant storage path' using errcode = '42501';
  end if;

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'rsbuild-source-artifacts'
      and o.name = p_storage_path
  ) then
    raise exception 'uploaded source artifact not found' using errcode = '23503';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_records) as item(value)
    where jsonb_typeof(item.value) <> 'object'
       or coalesce(item.value->>'amount_minor','') = ''
       or translate(coalesce(item.value->>'amount_minor',''), '0123456789', '') <> ''\n       or case when coalesce(item.value->>'amount_minor','') ~ '^\\d+
       or length(coalesce(item.value->>'transaction_date','')) <> 10
       or coalesce(item.value->>'transaction_date','') !~ '^\d{4}-\d{2}-\d{2}$'
       or length(coalesce(item.value->>'description','')) not between 1 and 500
       or coalesce(item.value->>'direction','') not in ('entrada','saída')
       or length(coalesce(item.value->>'deduplication_key','')) <> 64
       or translate(coalesce(item.value->>'deduplication_key',''), '0123456789abcdef', '') <> ''
       or length(coalesce(item.value->>'category','')) not between 1 and 120
       or length(coalesce(item.value->>'currency','BRL')) <> 3
       or translate(coalesce(item.value->>'currency','BRL'), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '') <> ''
       or jsonb_typeof(coalesce(item.value->'raw_payload','{}'::jsonb)) <> 'object'
  ) then
    raise exception 'one or more import records are invalid' using errcode = '22023';
  end if;

  insert into public.import_batches
    (organization_id, original_filename, file_sha256, file_size_bytes, metadata)
  values
    (p_organization_id, p_original_filename, p_file_sha256, p_file_size_bytes,
     jsonb_build_object('source','rsbuild-finance-app','version','d02'))
  returning id into v_batch_id;

  insert into public.source_artifacts
    (organization_id, import_batch_id, storage_bucket, storage_path, media_type, file_sha256, file_size_bytes)
  values
    (p_organization_id, v_batch_id, 'rsbuild-source-artifacts', p_storage_path,
     case when lower(p_original_filename) like '%.ofx' then 'application/x-ofx' else 'text/csv' end,
     p_file_sha256, p_file_size_bytes);

  insert into public.financial_records
    (organization_id, import_batch_id, source_record_id, transaction_date, description, amount_minor,
     currency, direction, category, deduplication_key, raw_payload)
  select
    p_organization_id,
    v_batch_id,
    item.value->'raw_payload'->>'source_record_id',
    (item.value->>'transaction_date')::date,
    left(item.value->>'description', 500),
    (item.value->>'amount_minor')::bigint,
    coalesce(nullif(item.value->>'currency',''), 'BRL')::char(3),
    (item.value->>'direction')::public.rsbuild_record_direction,
    coalesce(nullif(item.value->>'category',''), 'Não classificado'),
    item.value->>'deduplication_key',
    coalesce(item.value->'raw_payload','{}'::jsonb)
  from jsonb_array_elements(p_records) as item(value)
  on conflict (organization_id, deduplication_key)
    where deduplication_key is not null do nothing;

  get diagnostics v_inserted = row_count;
  v_duplicates := v_total - v_inserted;
  -- This endpoint rejects malformed source files before invoking the RPC.
  -- Duplicates are not rejected records and are reported separately.
  v_rejected := 0;

  update public.import_batches
  set status = 'committed',
      record_count = v_total,
      accepted_count = v_inserted,
      rejected_count = v_rejected,
      metadata = metadata || jsonb_build_object(
        'inserted_count', v_inserted,
        'duplicate_count', v_duplicates,
        'rejected_count', v_rejected
      ),
      committed_at = now()
  where id = v_batch_id and organization_id = p_organization_id;

  insert into public.audit_events
    (organization_id, event_type, entity_type, entity_id, metadata)
  values
    (p_organization_id, 'financial_import_committed', 'import_batch', v_batch_id::text,
     jsonb_build_object(
       'inserted',v_inserted,
       'duplicates',v_duplicates,
       'rejected',v_rejected,
       'file_sha256',p_file_sha256
     ));

  return query select v_batch_id, v_inserted, v_duplicates, v_rejected;
end;
$function$;

revoke all on function public.commit_financial_import(uuid,text,text,bigint,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.commit_financial_import(uuid,text,text,bigint,text,jsonb)
  to authenticated;

drop policy if exists "tenant operators delete source files" on storage.objects;
create policy "tenant operators delete source files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'rsbuild-source-artifacts'
  and exists (
    select 1 from public.organization_memberships m
    where m.user_id = (select auth.uid())
      and m.organization_id::text = (storage.foldername(name))[1]
      and m.role in ('owner','admin','operator')
  )
);
\n          then (item.value->>'amount_minor')::numeric > 9007199254740991\n          else true end
       or length(coalesce(item.value->>'transaction_date','')) <> 10
       or coalesce(item.value->>'transaction_date','') !~ '^\d{4}-\d{2}-\d{2}$'
       or length(coalesce(item.value->>'description','')) not between 1 and 500
       or coalesce(item.value->>'direction','') not in ('entrada','saída')
       or length(coalesce(item.value->>'deduplication_key','')) <> 64
       or translate(coalesce(item.value->>'deduplication_key',''), '0123456789abcdef', '') <> ''
       or length(coalesce(item.value->>'category','')) not between 1 and 120
       or length(coalesce(item.value->>'currency','BRL')) <> 3
       or translate(coalesce(item.value->>'currency','BRL'), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '') <> ''
       or jsonb_typeof(coalesce(item.value->'raw_payload','{}'::jsonb)) <> 'object'
  ) then
    raise exception 'one or more import records are invalid' using errcode = '22023';
  end if;

  insert into public.import_batches
    (organization_id, original_filename, file_sha256, file_size_bytes, metadata)
  values
    (p_organization_id, p_original_filename, p_file_sha256, p_file_size_bytes,
     jsonb_build_object('source','rsbuild-finance-app','version','d02'))
  returning id into v_batch_id;

  insert into public.source_artifacts
    (organization_id, import_batch_id, storage_bucket, storage_path, media_type, file_sha256, file_size_bytes)
  values
    (p_organization_id, v_batch_id, 'rsbuild-source-artifacts', p_storage_path,
     case when lower(p_original_filename) like '%.ofx' then 'application/x-ofx' else 'text/csv' end,
     p_file_sha256, p_file_size_bytes);

  insert into public.financial_records
    (organization_id, import_batch_id, source_record_id, transaction_date, description, amount_minor,
     currency, direction, category, deduplication_key, raw_payload)
  select
    p_organization_id,
    v_batch_id,
    item.value->'raw_payload'->>'source_record_id',
    (item.value->>'transaction_date')::date,
    left(item.value->>'description', 500),
    (item.value->>'amount_minor')::bigint,
    coalesce(nullif(item.value->>'currency',''), 'BRL')::char(3),
    (item.value->>'direction')::public.rsbuild_record_direction,
    coalesce(nullif(item.value->>'category',''), 'Não classificado'),
    item.value->>'deduplication_key',
    coalesce(item.value->'raw_payload','{}'::jsonb)
  from jsonb_array_elements(p_records) as item(value)
  on conflict (organization_id, deduplication_key)
    where deduplication_key is not null do nothing;

  get diagnostics v_inserted = row_count;
  v_duplicates := v_total - v_inserted;
  -- This endpoint rejects malformed source files before invoking the RPC.
  -- Duplicates are not rejected records and are reported separately.
  v_rejected := 0;

  update public.import_batches
  set status = 'committed',
      record_count = v_total,
      accepted_count = v_inserted,
      rejected_count = v_rejected,
      metadata = metadata || jsonb_build_object(
        'inserted_count', v_inserted,
        'duplicate_count', v_duplicates,
        'rejected_count', v_rejected
      ),
      committed_at = now()
  where id = v_batch_id and organization_id = p_organization_id;

  insert into public.audit_events
    (organization_id, event_type, entity_type, entity_id, metadata)
  values
    (p_organization_id, 'financial_import_committed', 'import_batch', v_batch_id::text,
     jsonb_build_object(
       'inserted',v_inserted,
       'duplicates',v_duplicates,
       'rejected',v_rejected,
       'file_sha256',p_file_sha256
     ));

  return query select v_batch_id, v_inserted, v_duplicates, v_rejected;
end;
$function$;

revoke all on function public.commit_financial_import(uuid,text,text,bigint,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.commit_financial_import(uuid,text,text,bigint,text,jsonb)
  to authenticated;

drop policy if exists "tenant operators delete source files" on storage.objects;
create policy "tenant operators delete source files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'rsbuild-source-artifacts'
  and exists (
    select 1 from public.organization_memberships m
    where m.user_id = (select auth.uid())
      and m.organization_id::text = (storage.foldername(name))[1]
      and m.role in ('owner','admin','operator')
  )
);
