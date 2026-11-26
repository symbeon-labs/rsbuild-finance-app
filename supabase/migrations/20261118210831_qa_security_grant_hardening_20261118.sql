-- RSBUILD QA security hardening: client roles must not receive anonymous table
-- access or table-wide privileges that bypass row-level policies.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON ALL TABLES IN SCHEMA public FROM authenticated;

-- ALTER DEFAULT PRIVILEGES is scoped to the object-creating role. We can only
-- change defaults for the current role (the one running this migration), not
-- for other roles like postgres or supabase_admin.
DO $$
DECLARE
  current_role text;
BEGIN
  SELECT current_user INTO current_role;
  
  -- Only alter defaults if the current role is one of the known Supabase roles
  IF current_role IN ('postgres', 'supabase_admin') THEN
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM anon',
      current_role
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON TABLES FROM authenticated',
      current_role
    );
  END IF;
END $$;

-- Verify current table grants and the defaults used by the current role.
-- We can only verify defaults we actually changed (current_user).
DO $$
DECLARE
  unsafe_table text;
  unsafe_default text;
  current_role text;
BEGIN
  SELECT current_user INTO current_role;
  
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

  -- Check for unsafe defaults owned by the current role
  SELECT format('%I default %s privilege for %I',
                pg_get_userbyid(d.defaclrole), d.defaclobjtype,
                CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END)
    INTO unsafe_default
  FROM pg_default_acl d
  JOIN pg_namespace n ON n.oid = d.defaclnamespace
  CROSS JOIN LATERAL aclexplode(d.defaclacl) x
  WHERE n.nspname = 'public'
    AND pg_get_userbyid(d.defaclrole) = current_role
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
