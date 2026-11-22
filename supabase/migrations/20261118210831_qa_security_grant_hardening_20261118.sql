-- RSBUILD QA security hardening: client roles must not receive anonymous table
-- access or table-wide privileges that bypass row-level policies.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON ALL TABLES IN SCHEMA public FROM authenticated;

-- ALTER DEFAULT PRIVILEGES is scoped to the object-creating role. Supabase
-- migrations may create objects as postgres or supabase_admin, so cover both
-- owners when present rather than silently hardening only the current role.
DO $$
DECLARE
  owner_role text;
BEGIN
  FOREACH owner_role IN ARRAY ARRAY['postgres', 'supabase_admin']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = owner_role) THEN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM anon',
        owner_role
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON TABLES FROM authenticated',
        owner_role
      );
    END IF;
  END LOOP;
END $$;

-- Verify current table grants and the defaults used by the known Supabase
-- object owners. Existing authenticated DML grants remain available to RLS.
DO $$
DECLARE
  unsafe_table text;
  unsafe_default text;
BEGIN
  SELECT format('%I.%I', n.nspname, c.relname) INTO unsafe_table
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND (
      has_table_privilege('anon', c.oid, 'SELECT')
      OR has_table_privilege('anon', c.oid, 'INSERT')
      OR has_table_privilege('anon', c.oid, 'UPDATE')
      OR has_table_privilege('anon', c.oid, 'DELETE')
      OR has_table_privilege('anon', c.oid, 'TRUNCATE')
      OR has_table_privilege('authenticated', c.oid, 'TRUNCATE')
      OR has_table_privilege('authenticated', c.oid, 'TRIGGER')
      OR has_table_privilege('authenticated', c.oid, 'REFERENCES')
      OR has_table_privilege('authenticated', c.oid, 'MAINTAIN')
    )
  LIMIT 1;

  IF unsafe_table IS NOT NULL THEN
    RAISE EXCEPTION 'Unsafe client table privilege remains on %', unsafe_table;
  END IF;

  SELECT format('%I default %s privilege for %I',
                pg_get_userbyid(d.defaclrole), d.defaclobjtype,
                CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END)
    INTO unsafe_default
  FROM pg_default_acl d
  JOIN pg_namespace n ON n.oid = d.defaclnamespace
  CROSS JOIN LATERAL aclexplode(d.defaclacl) x
  WHERE n.nspname = 'public'
    AND pg_get_userbyid(d.defaclrole) IN ('postgres', 'supabase_admin')
    AND (
      (pg_get_userbyid(x.grantee) = 'anon' AND d.defaclobjtype = 'r')
      OR
      (pg_get_userbyid(x.grantee) = 'authenticated'
       AND d.defaclobjtype = 'r'
       AND x.privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES', 'MAINTAIN'))
    )
  LIMIT 1;

  IF unsafe_default IS NOT NULL THEN
    RAISE EXCEPTION 'Unsafe client default table privilege remains: %', unsafe_default;
  END IF;
END $$;
