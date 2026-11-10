-- Security hardening: remove unsafe default grants from client roles.
-- RLS does not protect TRUNCATE; table-level TRUNCATE bypasses row policies.
-- Anonymous clients must not have direct privileges on application tables.
revoke all privileges on all tables in schema public from anon;

-- Authenticated users access data through narrowly scoped DML grants + RLS.
-- They must never be able to truncate tables or create triggers / foreign keys.
revoke truncate, trigger, references on all tables in schema public from authenticated;

-- Prevent the same unsafe grants from returning on future tables created by
-- either owner role used by migrations and Supabase-managed workflows.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon;
alter default privileges for role supabase_admin in schema public
  revoke all privileges on tables from anon;

alter default privileges for role postgres in schema public
  revoke truncate, trigger, references on tables from authenticated;
alter default privileges for role supabase_admin in schema public
  revoke truncate, trigger, references on tables from authenticated;

-- Defense-in-depth: verify no client role retains TRUNCATE on app tables.
do $$
declare
  unsafe_table text;
begin
  select format('%I.%I', n.nspname, c.relname)
    into unsafe_table
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and (
      has_table_privilege('anon', c.oid, 'TRUNCATE')
      or has_table_privilege('authenticated', c.oid, 'TRUNCATE')
    )
  limit 1;

  if unsafe_table is not null then
    raise exception 'Unsafe TRUNCATE privilege remains on %', unsafe_table;
  end if;
end;
$$;
