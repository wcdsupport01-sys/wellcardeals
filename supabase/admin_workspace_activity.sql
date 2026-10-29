-- Additive, read-only RPC for the approved admin Activity log.
-- Existing write commands, raw-table privileges and audit records are unchanged.
BEGIN;
CREATE OR REPLACE FUNCTION public.backend_staff_activity(
 p_before_time timestamptz DEFAULT NULL,
 p_before_id uuid DEFAULT NULL,
 p_limit integer DEFAULT 50,
 p_as_of timestamptz DEFAULT NULL,
 p_action text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $activity$
DECLARE v_as_of timestamptz := coalesce(p_as_of, clock_timestamp()); v_result jsonb;
BEGIN
 IF NOT public.backend_is_staff(ARRAY['admin','manager','team_lead']) THEN
  RAISE EXCEPTION 'Active staff access required.' USING ERRCODE='42501';
 END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 OR (p_before_time IS NULL) <> (p_before_id IS NULL) THEN
  RAISE EXCEPTION 'Invalid activity cursor or page size.' USING ERRCODE='22023';
 END IF;
 IF p_action IS NOT NULL AND p_action <> ALL(ARRAY['create','update','agent_submit','agent_review','purchase_request','purchase_complete','sale','archive','relist','dealer_finalize']) THEN
  RAISE EXCEPTION 'Invalid activity filter.' USING ERRCODE='22023';
 END IF;
 WITH candidates AS (
  SELECT e.id,e.created_at,e.actor_id,e.action,e.entity_id,
   p.full_name AS actor_name,
   jsonb_strip_nulls(jsonb_build_object('status',e.details->'status','purchase_request_id',e.details->'purchase_request_id')) AS details
  FROM public.backend_audit_events e LEFT JOIN public.profiles p ON p.id=e.actor_id
  WHERE e.created_at <= v_as_of
   AND (p_action IS NULL OR e.action=p_action)
   AND (p_before_time IS NULL OR (e.created_at,e.id)<(p_before_time,p_before_id))
  ORDER BY e.created_at DESC,e.id DESC LIMIT p_limit+1
 ), page AS (SELECT * FROM candidates ORDER BY created_at DESC,id DESC LIMIT p_limit)
 SELECT jsonb_build_object(
  'rows',coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY created_at DESC,id DESC) FROM page),'[]'::jsonb),
  'as_of',v_as_of,
  'next_cursor',CASE WHEN (SELECT count(*) FROM candidates)>p_limit THEN
   (SELECT jsonb_build_object('time',created_at,'id',id) FROM page ORDER BY created_at,id LIMIT 1)
   ELSE NULL END
 ) INTO v_result;
 RETURN v_result;
END;
$activity$;
REVOKE ALL ON FUNCTION public.backend_staff_activity(timestamptz,uuid,integer,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.backend_staff_activity(timestamptz,uuid,integer,timestamptz,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
