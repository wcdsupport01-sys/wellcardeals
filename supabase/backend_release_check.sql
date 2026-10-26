-- READ ONLY. Run in Supabase SQL Editor before/after the v3 release.
-- Returns ONE JSON row; no customer rows, passwords, API keys or function bodies.
-- Checks database configuration only. It does not verify Edge/Netlify deployment
-- or replace authenticated workflow tests against a restored staging copy.
WITH
required_functions(signature) AS (VALUES
 ('public.backend_car_command(text,jsonb,uuid,uuid)'),
 ('public.backend_is_staff(text[])'),
 ('public.backend_actor(uuid,text[])'),
 ('public.backend_write_car(jsonb,uuid)'),
 ('public.backend_staff_dashboard()'),
 ('public.backend_staff_bid_counts()'),
 ('public.backend_vehicle_options(text,text,text)'),
 ('public.backend_sheet_lease(uuid,boolean)')
),
command_checks AS (
 SELECT 'command_functions_present' AS name,
   bool_and(to_regprocedure(signature) IS NOT NULL) AS ok FROM required_functions
 UNION ALL SELECT 'catalog_present', to_regclass('public.cars_catalog') IS NOT NULL
 UNION ALL SELECT 'operation_and_audit_tables_protected',
   count(*)=2 AND coalesce(bool_and(c.relrowsecurity AND NOT
     (has_table_privilege('anon',c.oid,'SELECT') OR has_table_privilege('authenticated',c.oid,'SELECT'))),false)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('backend_operations','backend_audit_events')
 UNION ALL SELECT 'command_execute_roles',
   coalesce(has_function_privilege('authenticated',to_regprocedure('public.backend_car_command(text,jsonb,uuid,uuid)'),'EXECUTE'),false)
   AND NOT coalesce(has_function_privilege('anon',to_regprocedure('public.backend_car_command(text,jsonb,uuid,uuid)'),'EXECUTE'),false)
 UNION ALL SELECT 'worker_execute_service_only',
   coalesce(has_function_privilege('service_role',to_regprocedure('public.backend_sheet_lease(uuid,boolean)'),'EXECUTE'),false)
   AND NOT coalesce(has_function_privilege('anon',to_regprocedure('public.backend_sheet_lease(uuid,boolean)'),'EXECUTE'),false)
   AND NOT coalesce(has_function_privilege('authenticated',to_regprocedure('public.backend_sheet_lease(uuid,boolean)'),'EXECUTE'),false)
),
request_tables(name) AS (VALUES ('car_purchase_requests'),('car_auction_requests'),
 ('dealer_applications'),('contact_messages'),('pdi_requests'),('c2c_deal_requests'),('sell_requests')),
private_columns(name) AS (VALUES ('seller_name'),('seller_phone'),('seller_notes'),
 ('highest_bidder_id_buyer'),('highest_bidder_id_dealer'),('documents'),('vin_number'),('engine_number'),
 ('base_price_dealer'),('current_bid_dealer'),('negotiation_notes')),
access_checks AS (
 SELECT 'profile_guard_active' AS name, EXISTS(
   SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.profiles')
   AND tgname='backend_profile_guard' AND tgenabled IN ('O','A') AND NOT tgisinternal) AS ok
 UNION ALL SELECT 'profile_policy_set', count(*)=3 AND
   coalesce(bool_and(policyname IN ('backend_profiles_read','backend_profiles_insert','backend_profiles_update')),false)
 FROM pg_policies WHERE schemaname='public' AND tablename='profiles'
 UNION ALL SELECT 'request_guards_active', bool_and(
   EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.'||r.name)
     AND tgname='backend_validate_submission' AND tgenabled IN ('O','A') AND NOT tgisinternal)
   AND EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.'||r.name)
     AND tgname='backend_request_guard' AND tgenabled IN ('O','A') AND NOT tgisinternal)) FROM request_tables r
 UNION ALL SELECT 'request_row_security_enabled', bool_and(coalesce(
   (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.'||r.name)),false)) FROM request_tables r
 UNION ALL SELECT 'cars_and_bids_row_security_enabled', count(*)=2 AND coalesce(bool_and(c.relrowsecurity),false)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('cars','car_bids')
 UNION ALL SELECT 'raw_private_car_columns_blocked', count(*)=2*(SELECT count(*) FROM private_columns) AND
   coalesce(bool_and(NOT has_column_privilege(r.name,a.attrelid,a.attnum,'SELECT')),false)
 FROM (VALUES ('anon'),('authenticated')) r(name) CROSS JOIN private_columns p
 JOIN pg_attribute a ON a.attrelid=to_regclass('public.cars') AND a.attname=p.name AND NOT a.attisdropped
 UNION ALL SELECT 'direct_car_and_bid_writes_blocked', bool_and(
   to_regclass('public.'||t.name) IS NOT NULL AND
   NOT coalesce(has_any_column_privilege(r.name,to_regclass('public.'||t.name),'INSERT'),true) AND
   NOT coalesce(has_any_column_privilege(r.name,to_regclass('public.'||t.name),'UPDATE'),true) AND
   NOT coalesce(has_table_privilege(r.name,to_regclass('public.'||t.name),'DELETE'),true))
 FROM (VALUES ('anon'),('authenticated')) r(name) CROSS JOIN (VALUES ('cars'),('car_bids')) t(name)
 UNION ALL SELECT 'private_document_buckets', count(*)=2 AND coalesce(bool_and(NOT public),false)
 FROM storage.buckets WHERE id IN ('dealer-docs','sell-requests-media')
 UNION ALL SELECT 'storage_row_security_enabled', coalesce(
   (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('storage.objects')),false)
 UNION ALL SELECT 'legacy_negotiation_view_blocked',
   to_regclass('public.cars_negotiation_queue') IS NOT NULL AND
   NOT coalesce(has_table_privilege('anon',to_regclass('public.cars_negotiation_queue'),'SELECT'),true) AND
   NOT coalesce(has_table_privilege('authenticated',to_regclass('public.cars_negotiation_queue'),'SELECT'),true)
),
summary AS (
 SELECT (SELECT bool_and(ok) FROM command_checks) AS commands_ok,
        (SELECT bool_and(ok) FROM access_checks) AS access_ok,
        to_regprocedure('public.backend_car_command(text,jsonb,uuid,uuid)') IS NOT NULL AS command_found
)
SELECT jsonb_build_object(
 'checked_at',statement_timestamp(),
 'scope','database_configuration_only',
 'edge_and_netlify','not_checked',
 'state',CASE WHEN commands_ok AND access_ok THEN 'database_checks_passed'
   WHEN commands_ok THEN 'commands_ready_access_pending'
   WHEN NOT command_found THEN 'commands_not_installed' ELSE 'review_needed' END,
 'next_step',CASE WHEN commands_ok AND access_ok THEN
   'Verify deployed Edge/frontend and authenticated buyer/dealer/staff workflows.'
   WHEN commands_ok THEN
   'Verify matching Edge/frontend deployment before applying backend_access_v3.sql; inspect failed checks.'
   WHEN NOT command_found THEN
   'Test backend_commands_v3.sql on a restored staging copy first, then coordinate deployment.'
   ELSE 'Inspect failed command checks before proceeding.' END,
 'command_checks',(SELECT jsonb_object_agg(name,ok) FROM command_checks),
 'access_checks',(SELECT jsonb_object_agg(name,ok) FROM access_checks)
) AS backend_release_status FROM summary;
