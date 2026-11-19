-- Persist organization brand tokens in Supabase, scoped by tenant.
alter table public.organization_branding
  add column if not exists brand_color text,
  add column if not exists brand_color_hover text,
  add column if not exists brand_color_soft text;

alter table public.organization_branding
  add constraint organization_branding_brand_color_hex_check
    check (brand_color is null or brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint organization_branding_brand_color_hover_hex_check
    check (brand_color_hover is null or brand_color_hover ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint organization_branding_brand_color_soft_hex_check
    check (brand_color_soft is null or brand_color_soft ~ '^#[0-9A-Fa-f]{6}$');

insert into public.organization_branding
  (organization_id, brand_color, brand_color_hover, brand_color_soft)
select id,
  case slug when 'hub_acai' then '#7C3AED' when 'hub_acai_qa' then '#7C3AED'
    when 'mundo_sabor' then '#E56A2F' when 'mundo_sabor_qa' then '#E56A2F'
    else '#B5583C' end,
  case slug when 'hub_acai' then '#6D28D9' when 'hub_acai_qa' then '#6D28D9'
    when 'mundo_sabor' then '#C95420' when 'mundo_sabor_qa' then '#C95420'
    else '#9A4B33' end,
  case slug when 'hub_acai' then '#F5F3FF' when 'hub_acai_qa' then '#F5F3FF'
    when 'mundo_sabor' then '#FFF1E9' when 'mundo_sabor_qa' then '#FFF1E9'
    else '#F9F3F1' end
from public.organizations
where slug in ('rsbuild','hub_acai','hub_acai_qa','mundo_sabor','mundo_sabor_qa')
on conflict (organization_id) do update set
  brand_color = excluded.brand_color,
  brand_color_hover = excluded.brand_color_hover,
  brand_color_soft = excluded.brand_color_soft,
  updated_at = now();
