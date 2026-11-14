-- Reconcile client-role table privileges on the current mainline.
-- RLS does not protect TRUNCATE. Anonymous access to application tables is
-- intentionally disabled; authenticated DML remains governed by RLS.
--
-- This migration records the already-verified remote hardening state in the
-- repository migration chain. It does NOT change ALTER DEFAULT PRIVILEGES:
-- that operation requires the owning administrative role and remains a
-- separately tracked platform-configuration task.

revoke all privileges on all tables in schema public from anon;
revoke truncate, trigger, references on all tables in schema public from authenticated;

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
