-- Security hardening: remove unsafe grants from client roles.
-- RLS does not protect TRUNCATE; table-level TRUNCATE bypasses row policies.
-- Anonymous clients must not access application tables directly.
revoke all privileges on all tables in schema public from anon;

-- Keep existing authenticated DML grants where required by RLS policies,
-- but prohibit table-wide destructive and schema-shaping privileges.
revoke truncate, trigger, references on all tables in schema public from authenticated;

-- Defense-in-depth: fail if any current application table still exposes TRUNCATE.
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
