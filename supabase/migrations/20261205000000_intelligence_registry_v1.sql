-- RSBUILD Intelligence Registry V1
-- A neutral catalog for agents, language models and decision engines (e.g. JEV).
-- Registration does not grant execution or tenant access.

create table if not exists public.intelligence_registry (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  intelligence_type text not null check (intelligence_type in ('agent','llm','decision_engine')),
  provider text not null check (provider in ('openai','anthropic','google','xai','local','custom','internal','mcp')),
  model text,
  source_uri text,
  runtime text,
  config jsonb not null default '{}'::jsonb,
  credential_encrypted text,
  credential_hint text,
  status text not null default 'registered' check (status in ('registered','disabled','error')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intelligence_registry_name_nonempty check (length(trim(name)) > 0),
  constraint intelligence_registry_source_https check (source_uri is null or source_uri ~ '^https://')
);

create index if not exists intelligence_registry_type_status_idx
  on public.intelligence_registry(intelligence_type, status, updated_at desc);

alter table public.intelligence_registry enable row level security;
revoke all on public.intelligence_registry from public, anon, authenticated;

comment on table public.intelligence_registry is
  'Platform-level catalog of registered intelligence assets. Registration is not authorization to execute.';
comment on column public.intelligence_registry.intelligence_type is
  'agent: trained/hosted agent; llm: language model; decision_engine: deterministic or specialized decision system such as JEV.';
comment on column public.intelligence_registry.config is
  'Non-secret, type-specific configuration and input/output contract metadata.';
