-- RSBUILD QA security hardening: client roles must not have anonymous table access
-- or table-wide privileges that bypass row-level policies.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM authenticated;

-- Ensure future tables created by the migration owner do not reintroduce broad anon grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM authenticated;

DO $$
DECLARE unsafe_table text;
BEGIN
  SELECT format('%I.%I', n.nspname, c.relname) INTO unsafe_table
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')
    AND (has_table_privilege('anon',c.oid,'SELECT')
      OR has_table_privilege('anon',c.oid,'INSERT')
      OR has_table_privilege('anon',c.oid,'UPDATE')
      OR has_table_privilege('anon',c.oid,'DELETE')
      OR has_table_privilege('anon',c.oid,'TRUNCATE')
      OR has_table_privilege('authenticated',c.oid,'TRUNCATE')
      OR has_table_privilege('authenticated',c.oid,'TRIGGER')
      OR has_table_privilege('authenticated',c.oid,'REFERENCES'))
  LIMIT 1;
  IF unsafe_table IS NOT NULL THEN
    RAISE EXCEPTION 'Unsafe client table privilege remains on %', unsafe_table;
  END IF;
END $$;
