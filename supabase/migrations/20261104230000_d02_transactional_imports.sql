-- D02: atomic, tenant-scoped and idempotent financial import.
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
returns table(batch_id uuid, inserted_count integer, duplicate_count integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_batch_id uuid;
  v_inserted integer := 0;
  v_total integer := 0;
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

  if p_original_filename is null or length(p_original_filename) not between 1 and 255
     or p_file_sha256 !~ '^[a-f0-9]{64}$'
     or p_file_size_bytes < 0
     or p_records is null or jsonb_typeof(p_records) <> 'array'
     or jsonb_array_length(p_records) > 5000 then
    raise exception 'invalid import payload' using errcode = '22023';
  end if;

  if p_storage_path is null
     or split_part(p_storage_path, '/', 1) <> p_organization_id::text then
    raise exception 'invalid tenant storage path' using errcode = '42501';
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
    (organization_id, import_batch_id, transaction_date, description, amount_minor,
     currency, direction, category, deduplication_key, raw_payload)
  select
    p_organization_id,
    v_batch_id,
    (r->>'transaction_date')::date,
    left(r->>'description', 500),
    (r->>'amount_minor')::bigint,
    coalesce(nullif(r->>'currency',''), 'BRL')::char(3),
    (r->>'direction')::public.rsbuild_record_direction,
    coalesce(nullif(r->>'category',''), 'Não classificado'),
    r->>'deduplication_key',
    coalesce(r->'raw_payload','{}'::jsonb)
  from jsonb_array_elements(p_records) r
  where (r->>'amount_minor') ~ '^[0-9]+$'
    and (r->>'transaction_date') ~ '^\d{4}-\d{2}-\d{2}$'
    and length(coalesce(r->>'description','')) between 1 and 500
    and r->>'direction' in ('entrada','saída')
    and r->>'deduplication_key' is not null
  on conflict (organization_id, deduplication_key)
    where deduplication_key is not null do nothing;

  get diagnostics v_inserted = row_count;
  select jsonb_array_length(p_records) into v_total;

  update public.import_batches
  set status = 'committed',
      record_count = v_total,
      accepted_count = v_inserted,
      rejected_count = v_total - v_inserted,
      committed_at = now()
  where id = v_batch_id and organization_id = p_organization_id;

  insert into public.audit_events
    (organization_id, event_type, entity_type, entity_id, metadata)
  values
    (p_organization_id, 'financial_import_committed', 'import_batch', v_batch_id::text,
     jsonb_build_object('inserted',v_inserted,'duplicates',v_total-v_inserted,'file_sha256',p_file_sha256));

  return query select v_batch_id, v_inserted, v_total - v_inserted;
end;
$function$;

revoke all on function public.commit_financial_import(uuid,text,text,bigint,text,jsonb) from public, anon, authenticated;
grant execute on function public.commit_financial_import(uuid,text,text,bigint,text,jsonb) to authenticated;
