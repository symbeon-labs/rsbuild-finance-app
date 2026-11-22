-- Atomic bank/source/account association for trusted financial imports.
-- The original seven-argument RPC remains available for legacy callers.
alter table public.financial_accounts
  add column if not exists bank_code text,
  add column if not exists branch_id text;

-- Account numbers may repeat across institutions; retain tenant-scoped identity uniqueness.
alter table public.financial_accounts
  drop constraint if exists financial_accounts_organization_id_external_reference_key;
-- Fail with an explicit diagnostic rather than silently choosing between accounts
-- that become identical after canonicalizing bank-code leading zeroes.
do $preflight$
begin
  if exists (
    select 1
    from public.financial_accounts
    where external_reference is not null
    group by organization_id,
      coalesce(nullif(ltrim(bank_code, '0'), ''), '0'),
      coalesce(branch_id, ''),
      external_reference
    having count(*) > 1
  ) then
    raise exception 'duplicate financial account identities after bank-code normalization';
  end if;
end;
$preflight$;

create unique index if not exists financial_accounts_org_bank_branch_account_key
  on public.financial_accounts (
    organization_id,
    coalesce(nullif(ltrim(bank_code, '0'), ''), '0'),
    coalesce(branch_id, ''),
    external_reference
  )
  where external_reference is not null;

create or replace function public.commit_financial_import_trusted(
  p_actor_id uuid,
  p_organization_id uuid,
  p_original_filename text,
  p_file_sha256 text,
  p_file_size_bytes bigint,
  p_storage_path text,
  p_records jsonb,
  p_bank_identity jsonb,
  p_account_id uuid default null
)
returns table(batch_id uuid, inserted_count integer, duplicate_count integer, rejected_count integer)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_result record;
  v_source_id uuid;
  v_account_id uuid;
  v_bank_code text;
  v_branch_id text;
  v_account_number text;
  v_institution text;
  v_selected_bank_code text;
  v_selected_branch_id text;
  v_selected_account_number text;
  v_source_type text := case
    when lower(p_original_filename) like '%.ofx' then 'ofx'
    else 'csv'
  end;
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

  if p_account_id is not null and not exists (
    select 1 from public.financial_accounts a
    where a.id = p_account_id and a.organization_id = p_organization_id
  ) then
    raise exception 'selected account does not belong to organization' using errcode = '42501';
  end if;

  v_bank_code := nullif(trim(p_bank_identity->>'institutionCode'), '');
  v_branch_id := nullif(trim(p_bank_identity->>'branchId'), '');
  v_account_number := nullif(trim(p_bank_identity->>'accountNumber'), '');
  v_institution := coalesce(
    nullif(trim(p_bank_identity->>'institutionName'), ''),
    case when v_bank_code is not null
      then 'Instituição não catalogada (código ' || v_bank_code || ')'
      when p_account_id is not null then 'Importação CSV'
      else 'Instituição não identificada' end
  );

  -- Assisted selection must match the source identity; never silently cross-link banks.
  if p_account_id is not null and p_bank_identity is not null then
    select a.bank_code, a.branch_id, a.external_reference
      into v_selected_bank_code, v_selected_branch_id, v_selected_account_number
    from public.financial_accounts a
    where a.id = p_account_id and a.organization_id = p_organization_id;
    if v_bank_code is not null
       and coalesce(nullif(ltrim(v_selected_bank_code, '0'), ''), '0')
           is distinct from coalesce(nullif(ltrim(v_bank_code, '0'), ''), '0') then
      raise exception 'selected account bank identity does not match source' using errcode = '22023';
    end if;
    if v_branch_id is not null and v_selected_branch_id is distinct from v_branch_id then
      raise exception 'selected account branch does not match source' using errcode = '22023';
    end if;
    if v_account_number is not null and v_selected_account_number is distinct from v_account_number then
      raise exception 'selected account number does not match source' using errcode = '22023';
    end if;
  end if;

  -- Serialize resolution per tenant + source identity.
  if p_bank_identity is not null or p_account_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(
      p_organization_id::text || ':' || v_source_type || ':' ||
      coalesce(nullif(ltrim(v_bank_code, '0'), ''), '0') || ':' || coalesce(v_branch_id,'?') || ':'
      coalesce(v_account_number,'?'), 0
    ));
  end if;

  -- Resolve source by tenant, format and institution code, not display name alone.
  -- This prevents two institutions with similar/unknown labels from sharing a source.
  if p_bank_identity is not null or p_account_id is not null then
    select ds.id into v_source_id
    from public.data_sources ds
    where ds.organization_id = p_organization_id
      and ds.source_type = v_source_type
      and ds.provider = v_institution
      and coalesce(nullif(ltrim(ds.configuration->>'institution_code', '0'), ''), '0')
          is not distinct from coalesce(nullif(ltrim(v_bank_code, '0'), ''), '0')
    order by ds.created_at asc
    limit 1;

    if v_source_id is null then
      insert into public.data_sources
        (organization_id, source_type, provider, display_name, configuration, status)
      values
        (p_organization_id, v_source_type, v_institution, v_institution,
         jsonb_build_object(
           'institution_code', v_bank_code,
           'institution_name', v_institution,
           'branch_id', v_branch_id,
           'identification_status', p_bank_identity->>'identificationStatus'
         ), 'active')
      returning id into v_source_id;
    end if;
  end if;

  -- An explicitly selected account is the assisted-association path.
  -- Otherwise resolve by tenant + institution + branch + account number.
  v_account_id := p_account_id;
  if v_account_id is null and p_bank_identity is not null and v_account_number is not null then
    select a.id into v_account_id
    from public.financial_accounts a
    where a.organization_id = p_organization_id
      and a.external_reference = v_account_number
      and coalesce(nullif(ltrim(a.bank_code, '0'), ''), '0')
          is not distinct from coalesce(nullif(ltrim(v_bank_code, '0'), ''), '0')
      and a.branch_id is not distinct from v_branch_id
    order by a.created_at asc
    limit 1;

    if v_account_id is null then
      insert into public.financial_accounts
        (organization_id, name, institution, bank_code, branch_id,
         account_type, currency, external_reference, is_active)
      values
        (p_organization_id,
         coalesce(nullif(trim(p_bank_identity->>'displayAccountName'), ''),
                  v_institution || ' • ' || right(v_account_number, 4)),
         v_institution, v_bank_code, v_branch_id,
         coalesce(nullif(lower(p_bank_identity->>'accountType'), ''), 'checking'),
         coalesce(nullif(p_bank_identity->>'currency', ''), 'BRL'),
         v_account_number, true)
      returning id into v_account_id;
    end if;
  end if;

  -- Execute the original trusted import routine. Any failure below rolls back
  -- the batch, source, account, artifacts, records and audit rows together.
  select * into v_result
  from private.commit_financial_import_trusted(
    p_actor_id, p_organization_id, p_original_filename, p_file_sha256,
    p_file_size_bytes, p_storage_path, p_records
  );

  if v_source_id is not null then
    update public.import_batches
    set data_source_id = v_source_id,
        metadata = metadata || jsonb_build_object(
          'bank_identity', coalesce(p_bank_identity, '{}'::jsonb),
          'account_id', v_account_id,
          'association_mode', case
            when p_account_id is not null then 'assisted'
            when v_account_id is not null then 'automatic'
            else 'source_only'
          end
        )
    where id = v_result.batch_id and organization_id = p_organization_id;

    update public.financial_records
    set data_source_id = v_source_id,
        account_id = v_account_id
    where organization_id = p_organization_id
      and import_batch_id = v_result.batch_id;
  end if;

  return query select v_result.batch_id, v_result.inserted_count,
                      v_result.duplicate_count, v_result.rejected_count;
end;
$function$;

revoke all on function public.commit_financial_import_trusted(uuid,uuid,text,text,bigint,text,jsonb,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.commit_financial_import_trusted(uuid,uuid,text,text,bigint,text,jsonb,jsonb,uuid) to service_role;

comment on function public.commit_financial_import_trusted(uuid,uuid,text,text,bigint,text,jsonb,jsonb,uuid) is
  'Trusted import with tenant-scoped bank identity resolution and atomic account association.';
