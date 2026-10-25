-- READ ONLY: exports structure/permissions, not customer rows or credential values.
-- Run in SQL Editor, Export CSV, and share the resulting file for compatibility review.
SELECT jsonb_agg(to_jsonb(inventory) ORDER BY kind, object_name) AS backend_schema
FROM (
SELECT 'column' AS kind, c.table_name AS object_name,
  jsonb_build_object('name', c.column_name, 'type', c.udt_name, 'nullable', c.is_nullable,
    'default', CASE
      WHEN c.column_name ~* '(password|token|secret|credential|api_key|access_key|private_key)' THEN NULL
      WHEN c.column_default IS NULL THEN NULL
      WHEN c.column_name IN ('role','status','listing_type','access_type','visibility','channel','agent_status','tl_review_status','negotiation_status') THEN c.column_default
      WHEN c.column_default ~* '^(gen_random_uuid\(\)|uuid_generate_v4\(\)|now\(\)|CURRENT_TIMESTAMP|nextval\()' THEN c.column_default
      WHEN c.column_default ~* '^(-?[0-9]+(\.[0-9]+)?|true|false)(::.*)?$' THEN c.column_default
      ELSE '<redacted default>' END) AS details
FROM information_schema.columns c WHERE c.table_schema = 'public'
UNION ALL
SELECT 'constraint', conrelid::regclass::text,
  jsonb_build_object('name', conname, 'definition', pg_get_constraintdef(oid))
FROM pg_constraint WHERE connamespace = 'public'::regnamespace
UNION ALL
SELECT 'policy', schemaname || '.' || tablename,
  jsonb_build_object('name', policyname, 'roles', roles, 'command', cmd, 'using', qual, 'check', with_check)
FROM pg_policies WHERE schemaname IN ('public', 'storage')
UNION ALL
SELECT 'rls', n.nspname || '.' || c.relname,
  jsonb_build_object('enabled', c.relrowsecurity, 'forced', c.relforcerowsecurity)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p')
UNION ALL
SELECT 'trigger', tgrelid::regclass::text,
  jsonb_build_object('name', tgname, 'definition', pg_get_triggerdef(oid))
FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (
  SELECT oid FROM pg_class WHERE relnamespace IN ('public'::regnamespace, 'auth'::regnamespace))
UNION ALL
SELECT 'function', p.oid::regprocedure::text,
  jsonb_build_object('returns', pg_get_function_result(p.oid), 'security_definer', p.prosecdef,
    'owner', pg_get_userbyid(p.proowner), 'permissions', p.proacl)
FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind='f'
UNION ALL
SELECT 'grant', table_schema || '.' || table_name,
  jsonb_build_object('role', grantee, 'privilege', privilege_type)
FROM information_schema.role_table_grants WHERE table_schema IN ('public','storage')
UNION ALL
SELECT 'bucket', id, jsonb_build_object('public', public, 'size_limit', file_size_limit, 'mime_types', allowed_mime_types)
FROM storage.buckets

) inventory;
