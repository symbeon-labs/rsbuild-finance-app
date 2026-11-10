-- Canonical tenant slugs for the three provisioned RSBUILD Finance organizations.
-- Existing organization UUIDs remain the primary keys and are not recreated.

alter table public.organizations
  add column if not exists slug text;

update public.organizations
set slug = case id
  when '0269fe05-0990-41a8-a28c-2919691eaf0f'::uuid then 'rsbuild'
  when 'ff3cdab7-3b25-4ea7-aabf-5ae4f9cd9a76'::uuid then 'hub_acai'
  when 'c5356414-adce-4fdc-941b-15cfe26b991e'::uuid then 'mundo_sabor'
  else slug
end
where id in (
  '0269fe05-0990-41a8-a28c-2919691eaf0f'::uuid,
  'ff3cdab7-3b25-4ea7-aabf-5ae4f9cd9a76'::uuid,
  'c5356414-adce-4fdc-941b-15cfe26b991e'::uuid
);

do $$
begin
  if (select count(*) from public.organizations where slug in ('rsbuild','hub_acai','mundo_sabor')) <> 3 then
    raise exception 'Expected all three provisioned RSBUILD Finance organizations to receive canonical slugs';
  end if;
  if exists (select 1 from public.organizations where slug is null) then
    raise exception 'Every organization must have a canonical slug before this migration can enforce NOT NULL';
  end if;
end;
$$;

alter table public.organizations
  alter column slug set not null,
  add constraint organizations_slug_format_check
    check (slug ~ '^[a-z][a-z0-9_]{1,62}$');

create unique index if not exists organizations_slug_unique_idx
  on public.organizations (slug);

comment on column public.organizations.slug is
  'Stable application identifier for tenant routing; UUID remains the authorization and relational key.';
