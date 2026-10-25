-- Stage 1: transactional commands and compatible read model.
-- Reviewed against the production schema export (2026-10-25). Apply on staging
-- first, then production, deploy Edge/frontend, THEN apply backend_access_v3.sql.
BEGIN;
-- Preserve existing values; new self-service profiles no longer fail a missing
-- NOT NULL flag that is not supplied by the signup/Auth handlers.
ALTER TABLE public.profiles ALTER COLUMN must_change_password SET DEFAULT false;
CREATE TABLE IF NOT EXISTS public.backend_operations (
 id uuid PRIMARY KEY, actor_id uuid NOT NULL, action text NOT NULL,
 fingerprint text NOT NULL, result jsonb, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS public.backend_audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL,
 action text NOT NULL, entity_id text, operation_id uuid NOT NULL UNIQUE,
 details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.backend_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backend_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.backend_operations,public.backend_audit_events FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.backend_operations,public.backend_audit_events TO service_role;

CREATE OR REPLACE FUNCTION public.backend_is_staff(p_roles text[] DEFAULT ARRAY['admin','manager','team_lead'])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND status='approved' AND role=ANY(p_roles))
$$;
CREATE OR REPLACE FUNCTION public.backend_actor(p_actor uuid,p_roles text[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid:=auth.uid(); v_profile public.profiles;
BEGIN
 IF v_id IS NULL AND auth.role()='service_role' THEN v_id:=p_actor; END IF;
 IF v_id IS NULL OR (p_actor IS NOT NULL AND p_actor<>v_id) THEN RAISE EXCEPTION 'Sign in required.' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_profile FROM public.profiles WHERE id=v_id FOR SHARE;
 IF v_profile.role IS NULL OR v_profile.role<>ALL(p_roles) OR v_profile.status IS DISTINCT FROM 'approved' THEN
  RAISE EXCEPTION 'This account cannot perform this action.' USING ERRCODE='42501';
 END IF;
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.backend_car_json(p_car public.cars)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb:=to_jsonb(p_car);
BEGIN
 IF auth.role()='service_role' OR public.backend_is_staff() OR (p_car.submitted_by_agent_id=auth.uid() AND public.backend_is_staff(ARRAY['agent'])) THEN RETURN v; END IF;
 v:=v-ARRAY['seller_name','seller_phone','seller_notes','created_by','dealer_id','handled_by','handled_at','submitted_by_agent_id','tl_reviewed_by','tl_reviewed_at','tl_rejection_reason','negotiated_price','negotiation_notes','negotiation_updated_at','highest_bidder_name','highest_bidder_name_buyer','highest_bidder_name_dealer'];
 v:=jsonb_set(v,'{highest_bidder_id_dealer}',CASE WHEN p_car.highest_bidder_id_dealer=auth.uid() THEN to_jsonb(auth.uid()) ELSE 'null'::jsonb END);
 v:=jsonb_set(v,'{highest_bidder_id_buyer}',CASE WHEN p_car.highest_bidder_id_buyer=auth.uid() THEN to_jsonb(auth.uid()) ELSE 'null'::jsonb END);
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='dealer' AND status='approved') THEN
  v:=v-ARRAY['vin_number','engine_number','base_price_dealer','current_bid_dealer']; v:=jsonb_set(v,'{documents}','[]');
 END IF;
 RETURN v;
END $$;
-- Owner view, with explicit row authorization and field redaction. Do not add
-- security_invoker=true: raw-table grants are removed in stage 2.
DO $$ DECLARE v_columns text;
BEGIN
 SELECT string_agg(CASE
 WHEN a.attname=ANY(ARRAY['seller_name','seller_phone','seller_notes','created_by','dealer_id','handled_by','handled_at','submitted_by_agent_id','tl_reviewed_by','tl_reviewed_at','tl_rejection_reason','negotiated_price','negotiation_notes','negotiation_updated_at','highest_bidder_name','highest_bidder_name_buyer','highest_bidder_name_dealer'])
 THEN format('CASE WHEN public.backend_is_staff() OR (c.submitted_by_agent_id=auth.uid() AND public.backend_is_staff(ARRAY[''agent''])) THEN c.%1$I END AS %1$I',a.attname)
 WHEN a.attname=ANY(ARRAY['base_price_dealer','current_bid_dealer','documents','vin_number','engine_number'])
 THEN format('CASE WHEN public.backend_is_staff() OR (c.submitted_by_agent_id=auth.uid() AND public.backend_is_staff(ARRAY[''agent''])) OR public.backend_is_staff(ARRAY[''dealer'']) THEN c.%1$I END AS %1$I',a.attname)
 WHEN a.attname=ANY(ARRAY['highest_bidder_id_buyer','highest_bidder_id_dealer'])
 THEN format('CASE WHEN public.backend_is_staff() OR c.%1$I=auth.uid() THEN c.%1$I END AS %1$I',a.attname)
 ELSE format('c.%I',a.attname) END,',' ORDER BY a.attnum) INTO v_columns
 FROM pg_attribute a WHERE a.attrelid='public.cars'::regclass AND a.attnum>0 AND NOT a.attisdropped;
 EXECUTE 'CREATE OR REPLACE VIEW public.cars_catalog WITH (security_barrier=true) AS SELECT '||v_columns||'
 FROM public.cars c
 WHERE public.backend_is_staff() OR (c.submitted_by_agent_id=auth.uid() AND public.backend_is_staff(ARRAY[''agent'']))
 OR (public.backend_is_staff(ARRAY[''dealer''])
   AND ((c.visibility=''visible'' AND c.status IN (''live'',''closed'',''sold'')) OR EXISTS(SELECT 1 FROM public.car_bids b WHERE b.car_id=c.id AND b.bidder_id=auth.uid())))
 OR (c.status=''live'' AND c.visibility=''visible'' AND c.access_type=''all'' AND c.listing_type=''buy_now_only'' AND coalesce(c.tl_review_status,''approved'')=''approved'')
 OR EXISTS(SELECT 1 FROM public.car_purchase_requests q WHERE q.car_id=c.id AND q.buyer_id=auth.uid())';
END $$;
GRANT SELECT ON public.cars_catalog TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.backend_is_staff(text[]),public.backend_car_json(public.cars) TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.backend_actor(uuid,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.backend_actor(uuid,text[]) TO service_role;

-- A composite record preserves production defaults for omitted fields. Identifier
-- quoting comes from actual column names; values are always bound parameters.
CREATE OR REPLACE FUNCTION public.backend_write_car(p_fields jsonb,p_car_id uuid DEFAULT NULL)
RETURNS public.cars LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_key text; v_cols text; v_values text; v_car public.cars; v_next public.cars;
BEGIN
 IF jsonb_typeof(p_fields) IS DISTINCT FROM 'object' OR octet_length(p_fields::text)>131072 THEN RAISE EXCEPTION 'Invalid listing fields.' USING ERRCODE='22023'; END IF;
 FOR v_key IN SELECT jsonb_object_keys(p_fields) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.cars'::regclass AND attname=v_key AND attnum>0 AND NOT attisdropped) THEN RAISE EXCEPTION 'Unknown listing field: %',v_key USING ERRCODE='22023'; END IF;
 END LOOP;
 IF p_car_id IS NULL THEN
  SELECT string_agg(format('%I',key),','),string_agg(format('r.%I',key),',') INTO v_cols,v_values FROM jsonb_object_keys(p_fields) key;
  EXECUTE format('INSERT INTO public.cars(%s) SELECT %s FROM jsonb_populate_record(NULL::public.cars,$1) r RETURNING *',v_cols,v_values) INTO v_car USING p_fields;
 ELSE
  SELECT * INTO v_car FROM public.cars WHERE id=p_car_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Car not found.' USING ERRCODE='P0002'; END IF;
  v_next:=jsonb_populate_record(v_car,p_fields);
  SELECT string_agg(format('%I=($1).%I',key,key),',') INTO v_cols FROM jsonb_object_keys(p_fields) key;
  IF v_cols IS NULL THEN RETURN v_car; END IF;
  EXECUTE format('UPDATE public.cars SET %s WHERE id=$2 RETURNING *',v_cols) INTO v_car USING v_next,p_car_id;
 END IF;
 RETURN v_car;
END $$;
REVOKE ALL ON FUNCTION public.backend_write_car(jsonb,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.backend_car_command(p_action text,p_payload jsonb,p_operation_id uuid,p_actor_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid; v_roles text[]; v_op public.backend_operations; v_car public.cars;
 v_request public.car_auction_requests; v_purchase public.car_purchase_requests;
 v_fields jsonb:=coalesce(p_payload->'fields','{}'); v_result jsonb; v_id uuid; v_key text;
 v_hash text; v_base jsonb; v_next public.cars; v_exists boolean; v_profile public.profiles; v_app public.dealer_applications; v_dealer_id text;
BEGIN
 v_roles:=CASE WHEN p_action='agent_submit' THEN ARRAY['agent'] WHEN p_action='agent_review' THEN ARRAY['admin','manager','team_lead'] ELSE ARRAY['admin','manager'] END;
 v_actor:=public.backend_actor(p_actor_id,v_roles);
 IF p_operation_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR octet_length(p_payload::text)>131072 THEN RAISE EXCEPTION 'Invalid command.' USING ERRCODE='22023'; END IF;
 v_hash:=encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
 INSERT INTO public.backend_operations(id,actor_id,action,fingerprint) VALUES(p_operation_id,v_actor,p_action,v_hash) ON CONFLICT DO NOTHING;
 SELECT * INTO v_op FROM public.backend_operations WHERE id=p_operation_id FOR UPDATE;
 IF v_op.actor_id<>v_actor OR v_op.action<>p_action OR v_op.fingerprint<>v_hash THEN RAISE EXCEPTION 'Request ID belongs to another command.' USING ERRCODE='22023'; END IF;
 IF v_op.result IS NOT NULL THEN RETURN v_op.result; END IF;

 IF p_action IN ('create','update','agent_submit') THEN
  IF jsonb_typeof(v_fields) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Listing fields required.' USING ERRCODE='22023'; END IF;
  FOR v_key IN SELECT jsonb_object_keys(v_fields) LOOP
   IF v_key=ANY(ARRAY['id','created_at','updated_at','highest_bidder_id_buyer','highest_bidder_id_dealer','highest_bidder_name','highest_bidder_name_buyer','highest_bidder_name_dealer','current_bid_buyer','current_bid_dealer','buyer_winner_marked_sold','dealer_winner_marked_sold','buyer_winner_marked_sold_at','dealer_winner_marked_sold_at','inspected_by','inspected_at','tl_reviewed_by','tl_reviewed_at','submitted_by_agent_id','tl_review_status','handled_at','dealer_winner_contacted_at','buyer_winner_contacted_at']) THEN RAISE EXCEPTION 'Server-controlled listing field: %',v_key USING ERRCODE='22023'; END IF;
  END LOOP;
  IF v_fields->>'status'='sold' THEN RAISE EXCEPTION 'Use the sale confirmation action.' USING ERRCODE='22023'; END IF;
  FOR v_key IN SELECT unnest(ARRAY['base_price_buyer','base_price_dealer','starting_bid','reserve_price','buy_now_price','minimum_increment','negotiated_price']) LOOP
   IF v_fields ? v_key AND v_fields->v_key<>'null'::jsonb AND ((v_fields->>v_key)::numeric<0 OR (v_fields->>v_key)::numeric>9007199254740991 OR (v_fields->>v_key)::numeric::text IN ('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Invalid price.' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF v_fields ? 'minimum_increment' AND (coalesce((v_fields->>'minimum_increment')::numeric,0)<=0 OR trunc((v_fields->>'minimum_increment')::numeric)<>(v_fields->>'minimum_increment')::numeric) THEN RAISE EXCEPTION 'Increment must be positive.' USING ERRCODE='22023'; END IF;
  IF p_action IN ('create','agent_submit') AND length(trim(coalesce(v_fields->>'vehicle_title','')))=0 THEN RAISE EXCEPTION 'Vehicle title required.' USING ERRCODE='22023'; END IF;
  v_next:=jsonb_populate_record(NULL::public.cars,v_fields);
  IF v_next.auction_start IS NOT NULL AND v_next.auction_end IS NOT NULL AND v_next.auction_end<=v_next.auction_start THEN RAISE EXCEPTION 'Auction end must be after its start.' USING ERRCODE='22023'; END IF;
  IF v_fields ? 'inspection' THEN
   IF jsonb_typeof(v_fields->'inspection')<>'object' THEN RAISE EXCEPTION 'Inspection must be an object.' USING ERRCODE='22023'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_each(v_fields->'inspection') e WHERE e.value->>'status' IN ('good','fair','poor')) THEN
    v_fields:=v_fields||jsonb_build_object('inspected_by',v_actor,'inspected_at',clock_timestamp());
   ELSE v_fields:=v_fields||jsonb_build_object('inspected_by',NULL,'inspected_at',NULL); END IF;
  END IF;
 END IF;
 IF p_action='agent_submit' THEN
  IF v_fields ?| ARRAY['handled_by','created_by','dealer_id','is_verified','is_featured','c2c_enabled','negotiated_price','negotiation_notes','negotiation_updated_at','tl_rejection_reason'] THEN RAISE EXCEPTION 'Staff-controlled fields.' USING ERRCODE='42501'; END IF;
  IF nullif(p_payload->>'request_id','') IS NOT NULL THEN
   SELECT * INTO v_request FROM public.car_auction_requests WHERE id=(p_payload->>'request_id')::uuid FOR UPDATE;
   IF NOT FOUND OR v_request.listing_type IS NULL OR v_request.assigned_agent_id IS DISTINCT FROM v_actor OR v_request.status<>'approved' THEN RAISE EXCEPTION 'Approved assigned request required.' USING ERRCODE='42501'; END IF;
   IF v_request.car_id IS NOT NULL THEN SELECT * INTO v_car FROM public.cars WHERE id=v_request.car_id; v_exists:=true; END IF;
   IF NOT coalesce(v_exists,false) AND v_request.agent_status='submitted' THEN RAISE EXCEPTION 'Submission needs reconciliation.' USING ERRCODE='22023'; END IF;
  END IF;
  IF NOT coalesce(v_exists,false) THEN
   v_fields:=v_fields||jsonb_build_object('submitted_by_agent_id',v_actor,'tl_review_status','pending','status','draft','visibility','hidden','listing_type',coalesce(v_request.listing_type,'buy_now_only'),'channel',CASE WHEN v_request.listing_type='auction' THEN 'dealer' ELSE 'buyer' END);
   IF v_fields->>'listing_type'='buy_now_only' AND nullif(v_fields->>'buy_now_price','') IS NULL THEN RAISE EXCEPTION 'Enter the expected purchase price before submitting.' USING ERRCODE='22023'; END IF;
   v_base:=CASE WHEN v_fields->>'listing_type'='buy_now_only' THEN v_fields->'buy_now_price' ELSE coalesce(nullif(v_fields->'starting_bid','null'),v_fields->'reserve_price') END;
   v_fields:=v_fields||jsonb_build_object('base_price_buyer',v_base,'base_price_dealer',v_base,'current_bid_buyer',v_base,'current_bid_dealer',v_base);
   v_car:=public.backend_write_car(v_fields);
   IF v_request.id IS NOT NULL THEN UPDATE public.car_auction_requests SET car_id=v_car.id,agent_status='submitted',updated_at=clock_timestamp() WHERE id=v_request.id; END IF;
  END IF;
 ELSIF p_action='create' THEN
  v_fields:=v_fields||jsonb_build_object('handled_by',v_actor,'handled_at',clock_timestamp());
  v_base:=CASE WHEN v_fields->>'listing_type'='buy_now_only' THEN v_fields->'buy_now_price' ELSE coalesce(nullif(v_fields->'starting_bid','null'),v_fields->'reserve_price') END;
  v_fields:=v_fields||jsonb_build_object('base_price_buyer',coalesce(nullif(v_fields->'base_price_buyer','null'),v_base),'base_price_dealer',coalesce(nullif(v_fields->'base_price_dealer','null'),v_base));
  v_fields:=v_fields||jsonb_build_object('current_bid_buyer',v_fields->'base_price_buyer','current_bid_dealer',v_fields->'base_price_dealer');
  v_car:=public.backend_write_car(v_fields);
 ELSIF p_action IN ('update','agent_review','sale','archive') THEN
  v_id:=(p_payload->>'id')::uuid;
  SELECT * INTO v_car FROM public.cars WHERE id=v_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Car not found.' USING ERRCODE='P0002'; END IF;
  IF p_action='update' THEN
   IF v_car.status='sold' AND EXISTS(SELECT 1 FROM jsonb_object_keys(v_fields) key WHERE key<>ALL(ARRAY['dealer_winner_contacted','buyer_winner_contacted','visibility'])) THEN RAISE EXCEPTION 'Sold cars cannot be edited.' USING ERRCODE='22023'; END IF;
   v_exists:=EXISTS(SELECT 1 FROM public.car_bids WHERE car_id=v_id);
   v_next:=jsonb_populate_record(v_car,v_fields);
   IF v_next.auction_start IS NOT NULL AND v_next.auction_end IS NOT NULL AND v_next.auction_end<=v_next.auction_start THEN RAISE EXCEPTION 'Auction end must be after its start.' USING ERRCODE='22023'; END IF;
   IF v_exists AND EXISTS(SELECT 1 FROM jsonb_each(v_fields) f WHERE f.key=ANY(ARRAY['base_price_buyer','base_price_dealer','starting_bid','reserve_price','minimum_increment','auction_start','auction_end','listing_type']) AND to_jsonb(v_next)->f.key IS DISTINCT FROM to_jsonb(v_car)->f.key) THEN RAISE EXCEPTION 'Auction terms cannot change after bids exist.' USING ERRCODE='22023'; END IF;
   IF NOT v_exists AND v_fields ? 'base_price_buyer' THEN v_fields:=v_fields||jsonb_build_object('current_bid_buyer',v_fields->'base_price_buyer'); END IF;
   IF NOT v_exists AND v_fields ? 'base_price_dealer' THEN v_fields:=v_fields||jsonb_build_object('current_bid_dealer',v_fields->'base_price_dealer'); END IF;
   IF v_fields ? 'handled_by' THEN
    IF v_fields->'handled_by'<>'null' AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=(v_fields->>'handled_by')::uuid AND role=ANY(ARRAY['admin','manager','team_lead']) AND status='approved') THEN RAISE EXCEPTION 'Active staff handler required.' USING ERRCODE='22023'; END IF;
    v_fields:=v_fields||jsonb_build_object('handled_at',clock_timestamp());
   END IF;
   FOR v_key IN SELECT unnest(ARRAY['dealer_winner_contacted','buyer_winner_contacted']) LOOP
    IF v_fields ? v_key THEN v_fields:=v_fields||jsonb_build_object(v_key||'_at',CASE WHEN (v_fields->>v_key)::boolean THEN clock_timestamp() ELSE NULL END); END IF;
   END LOOP;
   v_car:=public.backend_write_car(v_fields,v_id);
  ELSIF p_action='agent_review' THEN
   IF v_car.submitted_by_agent_id IS NULL OR v_car.status NOT IN ('draft','upcoming') OR v_car.tl_review_status IS DISTINCT FROM 'pending' THEN RAISE EXCEPTION 'Agent submission required.' USING ERRCODE='22023'; END IF;
   IF p_payload->>'decision' NOT IN ('approved','rejected') OR p_payload->>'decision' IS NULL THEN RAISE EXCEPTION 'Review decision required.' USING ERRCODE='22023'; END IF;
   IF p_payload->>'decision'='approved' THEN
    IF v_car.listing_type='auction' AND (v_car.auction_end IS NULL OR v_car.auction_end<=clock_timestamp()) THEN RAISE EXCEPTION 'Set a future auction end in Inventory before approving.' USING ERRCODE='22023'; END IF;
    IF v_car.listing_type='buy_now_only' AND coalesce(v_car.buy_now_price,0)<=0 THEN RAISE EXCEPTION 'Set a valid purchase price before approval.' USING ERRCODE='22023'; END IF;
    v_fields:=jsonb_build_object('tl_review_status','approved','tl_reviewed_by',v_actor,'tl_reviewed_at',clock_timestamp(),'status','live','visibility','visible','access_type',CASE WHEN v_car.listing_type='auction' THEN 'dealer_only' ELSE 'all' END,'tl_rejection_reason',NULL);
   ELSE
    IF length(trim(coalesce(p_payload->>'reason','')))<1 THEN RAISE EXCEPTION 'Rejection reason required.' USING ERRCODE='22023'; END IF;
    v_fields:=jsonb_build_object('tl_review_status','rejected','tl_reviewed_by',v_actor,'tl_reviewed_at',clock_timestamp(),'status','draft','visibility','hidden','tl_rejection_reason',left(p_payload->>'reason',2000));
   END IF;
   FOR v_key IN SELECT unnest(ARRAY['dealer_winner_contacted','buyer_winner_contacted']) LOOP
    IF v_fields ? v_key THEN v_fields:=v_fields||jsonb_build_object(v_key||'_at',CASE WHEN (v_fields->>v_key)::boolean THEN clock_timestamp() ELSE NULL END); END IF;
   END LOOP;
   v_car:=public.backend_write_car(v_fields,v_id);
  ELSIF p_action='archive' THEN
   IF v_car.status='sold' THEN RAISE EXCEPTION 'Sold cars must retain their final status.' USING ERRCODE='22023'; END IF;
   v_car:=public.backend_write_car(jsonb_build_object('status','delisted','visibility','hidden'),v_id);
  ELSE
   IF p_payload->>'track' IS DISTINCT FROM 'dealer' THEN RAISE EXCEPTION 'Direct buyer sales must complete a purchase request.' USING ERRCODE='22023'; END IF;
   IF v_car.status='sold' THEN
    IF NOT v_car.dealer_winner_marked_sold THEN RAISE EXCEPTION 'Car already sold to another buyer.' USING ERRCODE='22023'; END IF;
   ELSE
    IF v_car.status NOT IN ('live','closed') OR v_car.auction_end IS NULL OR v_car.auction_end>clock_timestamp() OR v_car.highest_bidder_id_dealer IS NULL OR NOT EXISTS(SELECT 1 FROM public.car_bids WHERE car_id=v_id AND bidder_id=v_car.highest_bidder_id_dealer AND amount=v_car.current_bid_dealer AND bidder_role='dealer') OR coalesce(v_car.current_bid_dealer,0)<=0 THEN RAISE EXCEPTION 'Closed auction with a verified highest bidder required.' USING ERRCODE='22023'; END IF;
    v_car:=public.backend_write_car(jsonb_build_object('status','sold','dealer_winner_marked_sold',true,'dealer_winner_marked_sold_at',clock_timestamp()),v_id);
   END IF;
  END IF;
 ELSIF p_action='purchase_complete' THEN
  SELECT * INTO v_purchase FROM public.car_purchase_requests WHERE id=(p_payload->>'id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase request not found.' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_car FROM public.cars WHERE id=v_purchase.car_id FOR UPDATE;
  IF v_purchase.status<>'completed' THEN
   IF v_purchase.status='cancelled' OR v_car.status<>'live' OR v_car.listing_type<>'buy_now_only' OR coalesce(v_car.buy_now_price,0)<=0 THEN RAISE EXCEPTION 'This purchase cannot be completed.' USING ERRCODE='22023'; END IF;
   v_car:=public.backend_write_car(jsonb_build_object('status','sold','highest_bidder_id_buyer',v_purchase.buyer_id,'buyer_winner_marked_sold',true,'buyer_winner_marked_sold_at',clock_timestamp()),v_car.id);
   UPDATE public.car_purchase_requests SET status='completed',updated_at=clock_timestamp() WHERE id=v_purchase.id;
  END IF;
 ELSIF p_action IN ('dealer_approve','dealer_code') THEN
  SELECT * INTO v_profile FROM public.profiles WHERE id=(p_payload->>'id')::uuid FOR UPDATE;
  IF NOT FOUND OR v_profile.role<>'dealer' OR (p_action='dealer_code' AND v_profile.status IS DISTINCT FROM 'approved') THEN RAISE EXCEPTION 'Eligible dealer profile required.' USING ERRCODE='22023'; END IF;
  v_dealer_id:=coalesce(v_profile.dealer_id,public.generate_dealer_id());
  UPDATE public.profiles SET status='approved',dealer_id=v_dealer_id,
   dealer_access_code=lpad(((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,15))::bit(60)::bigint)%1000000)::text,6,'0'),
   dealer_access_code_verified=false,dealer_access_code_sent_at=clock_timestamp(),dealer_access_code_attempts=0
   WHERE id=v_profile.id RETURNING * INTO v_profile;
  v_result:=jsonb_build_object('id',v_profile.id,'dealer_id',v_dealer_id,'code',v_profile.dealer_access_code);
 ELSIF p_action='dealer_finalize' THEN
  SELECT * INTO v_app FROM public.dealer_applications WHERE id=(p_payload->>'application_id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found.' USING ERRCODE='P0002'; END IF;
  v_id:=(p_payload->>'auth_user_id')::uuid;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_id AND lower(email)=lower(v_app.email) AND raw_app_meta_data->>'dealer_application_id'=v_app.id::text) THEN RAISE EXCEPTION 'This login was not provisioned for this application.' USING ERRCODE='42501'; END IF;
  IF v_app.status='approved' AND v_app.auth_user_id IS DISTINCT FROM v_id THEN RAISE EXCEPTION 'Application already provisioned.' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id=v_id;
  IF v_app.status='rejected' THEN RAISE EXCEPTION 'Rejected application needs staff review before approval.' USING ERRCODE='22023'; END IF;
  IF v_profile.role IS NOT NULL AND v_profile.role<>ALL(ARRAY['buyer','dealer']) THEN RAISE EXCEPTION 'Cannot replace an internal account.' USING ERRCODE='42501'; END IF;
  v_dealer_id:=coalesce(v_app.dealer_id,v_profile.dealer_id,public.generate_dealer_id());
  INSERT INTO public.profiles(id,role,status,email,full_name,phone,business_name,dealer_id,dealer_access_code_verified) VALUES(v_id,'dealer','approved',v_app.email,v_app.dealer_name,v_app.mobile_number,v_app.business_name,v_dealer_id,true)
   ON CONFLICT(id) DO UPDATE SET role='dealer',status='approved',email=excluded.email,full_name=excluded.full_name,phone=excluded.phone,business_name=excluded.business_name,dealer_id=excluded.dealer_id,dealer_access_code_verified=true;
  UPDATE public.dealer_applications SET status='approved',dealer_id=v_dealer_id,auth_user_id=v_id,updated_at=clock_timestamp() WHERE id=v_app.id RETURNING * INTO v_app;
  v_result:=to_jsonb(v_app);
 ELSE RAISE EXCEPTION 'Unknown backend command.' USING ERRCODE='22023';
 END IF;
 v_result:=coalesce(v_result,jsonb_build_object('car',to_jsonb(v_car),'car_id',v_car.id));
 INSERT INTO public.backend_audit_events(actor_id,action,entity_id,operation_id,details) VALUES(v_actor,p_action,coalesce(v_car.id::text,v_app.id::text,v_profile.id::text),p_operation_id,jsonb_build_object('status',coalesce(v_car.status,v_app.status),'purchase_request_id',v_purchase.id));
 UPDATE public.backend_operations SET result=v_result WHERE id=p_operation_id;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.backend_car_command(text,jsonb,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.backend_car_command(text,jsonb,uuid,uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.backend_is_staff(text[]),public.backend_car_json(public.cars) FROM PUBLIC;
-- Refresh reviewed auction reads to use the same privacy rules.
CREATE OR REPLACE FUNCTION public.dealer_auction_snapshot(p_car_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result jsonb; v_now timestamptz := clock_timestamp();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'dealer' AND status = 'approved') THEN
    RAISE EXCEPTION 'Only approved dealers can access auctions.' USING ERRCODE = '42501';
  END IF;
  -- One MVCC snapshot: price, own latest bid and count cannot disagree because
  -- another transaction committed between separate SELECT statements.
  SELECT jsonb_build_object('car', public.backend_car_json(c), 'server_time', v_now,
    'my_bid', (SELECT to_jsonb(b) FROM public.car_bids b WHERE b.car_id=c.id AND b.bidder_id=auth.uid() ORDER BY b.created_at DESC,b.id DESC LIMIT 1),
    'my_bid_count', (SELECT count(*) FROM public.car_bids b WHERE b.car_id=c.id AND b.bidder_id=auth.uid()),
    'recent_bids', coalesce((SELECT jsonb_agg(to_jsonb(recent)) FROM (
      SELECT b.id::text AS id, b.amount, b.created_at FROM public.car_bids b WHERE b.car_id=c.id AND b.bidder_id=auth.uid() ORDER BY b.created_at DESC,b.id DESC LIMIT 5
    ) recent), '[]'::jsonb)) INTO v_result FROM public.cars c WHERE c.id=p_car_id AND ((c.visibility='visible' AND c.status IN ('live','closed','sold')) OR EXISTS(SELECT 1 FROM public.car_bids b WHERE b.car_id=c.id AND b.bidder_id=auth.uid())) AND c.listing_type IS DISTINCT FROM 'buy_now_only';
  IF v_result IS NULL THEN RAISE EXCEPTION 'Auction not found.' USING ERRCODE = 'P0002'; END IF;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.dealer_bid_receipt(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_bid public.car_bids; v_car public.cars;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_bid FROM public.car_bids WHERE request_id = p_request_id AND bidder_id = auth.uid();
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO v_car FROM public.cars WHERE id = v_bid.car_id;
  RETURN jsonb_build_object('bid_id', v_bid.id::text, 'request_id', v_bid.request_id, 'amount', v_bid.amount,
    'accepted_at', v_bid.created_at, 'server_time', clock_timestamp(), 'car', public.backend_car_json(v_car));
END $$;

CREATE OR REPLACE FUNCTION public.place_dealer_bid_v2(p_car_id uuid, p_amount numeric, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_car public.cars; v_bid public.car_bids; v_profile public.profiles;
  v_min numeric; v_increment numeric; v_now timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required.' USING ERRCODE = '42501'; END IF;
  IF p_request_id IS NULL OR p_amount IS NULL OR p_amount::text IN ('NaN', 'Infinity', '-Infinity')
    OR p_amount <= 0 OR p_amount > 9007199254740991 OR trunc(p_amount) <> p_amount THEN
    RAISE EXCEPTION 'Enter a valid whole-rupee bid and request ID.' USING ERRCODE = '22023';
  END IF;
  -- Approval cannot be revoked halfway through this transaction.
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid() FOR SHARE;
  IF v_profile.role IS DISTINCT FROM 'dealer' OR v_profile.status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Only approved dealers can bid.' USING ERRCODE = '42501';
  END IF;
  -- Serialize all bids for this car. Check the actual clock AFTER acquiring the lock.
  SELECT * INTO v_car FROM public.cars WHERE id = p_car_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auction not found.' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_bid FROM public.car_bids WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_bid.bidder_id IS DISTINCT FROM auth.uid() OR v_bid.car_id IS DISTINCT FROM p_car_id OR v_bid.amount <> p_amount THEN
      RAISE EXCEPTION 'Request ID already belongs to another bid.' USING ERRCODE = '22023';
    END IF;
    RETURN public.dealer_bid_receipt(p_request_id);
  END IF;
  v_now := clock_timestamp();
  IF v_car.listing_type = 'buy_now_only' OR v_car.status IS DISTINCT FROM 'live'
    OR v_car.visibility IS DISTINCT FROM 'visible' OR (v_car.auction_start IS NOT NULL AND v_car.auction_start>v_now)
    OR v_car.auction_end IS NULL OR v_car.auction_end <= v_now THEN
    RAISE EXCEPTION 'This auction is not open for bidding.' USING ERRCODE = '22023';
  END IF;
  v_increment := coalesce(nullif(v_car.minimum_increment, 0), 5000);
  IF v_increment < 0 THEN RAISE EXCEPTION 'Invalid auction increment.' USING ERRCODE = '22023'; END IF;
  v_min := ceil(greatest(coalesce(nullif(v_car.current_bid_dealer, 0), v_car.base_price_dealer, v_car.starting_bid, 0)
    + v_increment, coalesce(v_car.reserve_price, 0)));
  IF p_amount < v_min THEN RAISE EXCEPTION 'Bid must be at least Rs %. Refresh and review the new price.', v_min USING ERRCODE = '22023'; END IF;

  INSERT INTO public.car_bids(car_id, bidder_id, bidder_name, bidder_role, amount, request_id, created_at, is_custom)
    VALUES (p_car_id, auth.uid(), coalesce(nullif(v_profile.business_name, ''), nullif(v_profile.full_name, ''), 'Dealer'),
      'dealer', p_amount, p_request_id, v_now, true) RETURNING * INTO v_bid;
  UPDATE public.cars SET current_bid_dealer = p_amount, highest_bidder_id_dealer = auth.uid(),
    highest_bidder_name_dealer = v_bid.bidder_name WHERE id = p_car_id;
  RETURN public.dealer_bid_receipt(p_request_id);
END $$;

CREATE OR REPLACE FUNCTION public.get_dealer_auction_dashboard(p_tab text DEFAULT 'live', p_search text DEFAULT '', p_offset integer DEFAULT 0, p_limit integer DEFAULT 24)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result jsonb; v_now timestamptz := clock_timestamp();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'dealer' AND status = 'approved') THEN
    RAISE EXCEPTION 'Only approved dealers can access auctions.' USING ERRCODE = '42501';
  END IF;
  IF p_tab IS NULL OR p_limit IS NULL OR p_offset IS NULL OR p_tab NOT IN ('live', 'bids', 'watchlist', 'results') OR p_limit NOT BETWEEN 1 AND 100 OR p_offset < 0 THEN
    RAISE EXCEPTION 'Invalid auction filters.' USING ERRCODE = '22023';
  END IF;
  WITH eligible AS (
    SELECT c.*, (c.status = 'live' AND c.visibility='visible' AND c.auction_end > v_now AND (c.auction_start IS NULL OR c.auction_start<=v_now)) AS is_live,
      b.last_bid, coalesce(b.bid_count, 0) AS my_bid_count,
      EXISTS(SELECT 1 FROM public.wishlist w WHERE w.car_id = c.id AND w.buyer_id = auth.uid()) AS watchlisted
    FROM public.cars c
    LEFT JOIN LATERAL (
      SELECT (array_agg(to_jsonb(cb) ORDER BY cb.created_at DESC, cb.id DESC))[1] AS last_bid, count(*) AS bid_count
      FROM public.car_bids cb WHERE cb.car_id = c.id AND cb.bidder_id = auth.uid()
    ) b ON true
    WHERE c.listing_type IS DISTINCT FROM 'buy_now_only' AND ((c.status IN ('live','closed','sold') AND c.visibility='visible') OR b.bid_count>0)
  ), filtered AS (
    SELECT * FROM eligible WHERE
      (CASE p_tab WHEN 'live' THEN coalesce(is_live, false) WHEN 'bids' THEN my_bid_count > 0
        WHEN 'watchlist' THEN watchlisted WHEN 'results' THEN my_bid_count > 0 AND NOT coalesce(is_live, false) END)
      AND (coalesce(vehicle_title, '') || ' ' || coalesce(location, '')) ILIKE '%' || coalesce(p_search, '') || '%'
  ), page AS (
    SELECT * FROM filtered ORDER BY CASE WHEN is_live THEN auction_end END ASC NULLS LAST, auction_end DESC NULLS LAST, id
    LIMIT p_limit OFFSET p_offset
  ) SELECT jsonb_build_object('server_time', v_now,
    'summary', (SELECT jsonb_build_object('live', count(*) FILTER(WHERE is_live),
      'bids', count(*) FILTER(WHERE my_bid_count > 0), 'watchlist', count(*) FILTER(WHERE watchlisted),
      'results', count(*) FILTER(WHERE my_bid_count > 0 AND NOT coalesce(is_live, false))) FROM eligible),
    'total', (SELECT count(*) FROM filtered), 'items', coalesce((SELECT jsonb_agg(public.backend_car_json(jsonb_populate_record(NULL::public.cars,to_jsonb(page))) || jsonb_build_object('is_live',page.is_live,'last_bid',page.last_bid,'my_bid_count',page.my_bid_count,'watchlisted',page.watchlisted)) FROM page), '[]'::jsonb)) INTO v_result;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.get_dealer_bid_audit_page(
  p_before_time timestamptz DEFAULT NULL, p_before_id text DEFAULT NULL,
  p_limit integer DEFAULT 500, p_as_of timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result jsonb; v_cutoff timestamptz := coalesce(p_as_of, clock_timestamp());
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'team_lead') AND status='approved') THEN
    RAISE EXCEPTION 'Staff access required.' USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 OR (p_before_time IS NULL) <> (p_before_id IS NULL) THEN
    RAISE EXCEPTION 'Invalid export cursor or page size.' USING ERRCODE = '22023';
  END IF;
  WITH page AS (
    SELECT to_jsonb(b) || jsonb_build_object('id', b.id::text) AS record,
      coalesce(b.created_at, '-infinity'::timestamptz) AS sort_time, b.id::text AS sort_id
    FROM public.car_bids b
    WHERE coalesce(b.created_at, '-infinity'::timestamptz) <= v_cutoff
      AND (p_before_time IS NULL OR
        (coalesce(b.created_at, '-infinity'::timestamptz), b.id::text) < (p_before_time, p_before_id))
    ORDER BY coalesce(b.created_at, '-infinity'::timestamptz) DESC, b.id::text DESC LIMIT p_limit
  ) SELECT jsonb_build_object(
    'rows', coalesce(jsonb_agg(record ORDER BY sort_time DESC, sort_id DESC), '[]'::jsonb),
    'as_of', v_cutoff,
    'next_cursor', CASE WHEN count(*) = p_limit THEN
      (SELECT jsonb_build_object('time', sort_time, 'id', sort_id) FROM page ORDER BY sort_time, sort_id LIMIT 1)
      ELSE NULL END) INTO v_result FROM page;
  RETURN v_result;
END $$;

-- Staff reporting uses SQL aggregates, so the PostgREST row cap cannot silently
-- truncate counts or the 14-day chart. The timestamp and all counts share a snapshot.
CREATE OR REPLACE FUNCTION public.backend_staff_dashboard()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;
BEGIN
 IF NOT public.backend_is_staff() THEN RAISE EXCEPTION 'Active staff access required.' USING ERRCODE='42501'; END IF;
 WITH car_stats AS (SELECT count(*) total,count(*) FILTER(WHERE status='sold') sold,
 count(*) FILTER(WHERE listing_type='auction' AND status='live' AND auction_end>now() AND (auction_start IS NULL OR auction_start<=now())) live,
 count(*) FILTER(WHERE auction_end<=now() AND ((highest_bidder_id_buyer IS NOT NULL AND NOT buyer_winner_contacted) OR (highest_bidder_id_dealer IS NOT NULL AND NOT dealer_winner_contacted))) followup FROM public.cars)
 SELECT jsonb_build_object('stats',jsonb_build_object('totalCars',total,'soldTotal',sold,'liveAuctions',live,'needsFollowup',followup,
 'dealers',(SELECT count(*) FROM public.profiles WHERE role='dealer' AND status='approved'),
 'pendingDealers',(SELECT count(*) FROM public.profiles WHERE role='dealer' AND status='pending'),
 'pendingAuctionRequests',(SELECT count(*) FROM public.car_auction_requests WHERE status='pending'),
 'pendingBuyRequests',(SELECT count(*) FROM public.car_purchase_requests WHERE status='pending'),
 'negotiationQueue',(SELECT count(*) FROM public.cars c WHERE c.auction_end<now() AND c.status NOT IN ('sold','delisted') AND c.negotiation_status NOT IN ('deal_done','rejected') AND NOT EXISTS(SELECT 1 FROM public.car_bids b WHERE b.car_id=c.id))),
 'pending_cars',coalesce((SELECT jsonb_agg(to_jsonb(recent)) FROM (SELECT id,vehicle_title,status,created_at,dealer_id FROM public.cars WHERE status='draft' ORDER BY created_at DESC,id LIMIT 5) recent),'[]'),
 'chart', (SELECT jsonb_agg(jsonb_build_object('date',d::date,'listings',(SELECT count(*) FROM public.cars WHERE created_at>=d AND created_at<d+interval '1 day')) ORDER BY d) FROM generate_series(date_trunc('day',now())-interval '13 days',date_trunc('day',now()),interval '1 day') d)) INTO v FROM car_stats;
 RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.backend_staff_dashboard() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.backend_staff_dashboard() TO authenticated;
CREATE OR REPLACE VIEW public.backend_negotiation_queue WITH (security_barrier=true) AS
 SELECT c.* FROM public.cars_catalog c WHERE public.backend_is_staff() AND c.auction_end<now() AND c.status NOT IN ('sold','delisted')
 AND c.negotiation_status NOT IN ('deal_done','rejected') AND NOT EXISTS(SELECT 1 FROM public.car_bids b WHERE b.car_id=c.id);
GRANT SELECT ON public.backend_negotiation_queue TO authenticated;

CREATE TABLE IF NOT EXISTS public.backend_worker_leases(name text PRIMARY KEY,token uuid,expires_at timestamptz NOT NULL DEFAULT '-infinity');
ALTER TABLE public.backend_worker_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.backend_worker_leases FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.backend_sheet_lease(p_token uuid,p_release boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_token IS NULL THEN RAISE EXCEPTION 'Worker access required.' USING ERRCODE='42501'; END IF;
 INSERT INTO public.backend_worker_leases(name) VALUES('sheets') ON CONFLICT DO NOTHING;
 IF p_release THEN
  UPDATE public.backend_worker_leases SET token=NULL,expires_at='-infinity' WHERE name='sheets' AND token=p_token;
 ELSE
  UPDATE public.backend_worker_leases SET token=p_token,expires_at=clock_timestamp()+interval '5 minutes' WHERE name='sheets' AND (token=p_token OR expires_at<clock_timestamp());
 END IF;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.backend_sheet_lease(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.backend_sheet_lease(uuid,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.generate_dealer_access_code(p_dealer_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RETURN public.backend_car_command('dealer_code',jsonb_build_object('id',p_dealer_id),gen_random_uuid())->>'code'; END $$;
CREATE OR REPLACE FUNCTION public.verify_dealer_access_code(p_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.profiles;
BEGIN
 SELECT * INTO v FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR v.role IS DISTINCT FROM 'dealer' OR v.status IS DISTINCT FROM 'approved' THEN RAISE EXCEPTION 'Approved dealer required.' USING ERRCODE='42501'; END IF;
 IF v.dealer_access_code_verified THEN RETURN true; END IF;
 IF v.dealer_access_code_attempts>=5 THEN RETURN false; END IF;
 IF p_code IS NULL OR v.dealer_access_code IS NULL OR trim(p_code) IS DISTINCT FROM v.dealer_access_code THEN
  UPDATE public.profiles SET dealer_access_code_attempts=dealer_access_code_attempts+1 WHERE id=v.id; RETURN false;
 END IF;
 UPDATE public.profiles SET dealer_access_code_verified=true WHERE id=v.id; RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.generate_dealer_access_code(uuid),public.verify_dealer_access_code(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.generate_dealer_access_code(uuid),public.verify_dealer_access_code(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.backend_staff_bid_counts()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.backend_is_staff() THEN RAISE EXCEPTION 'Active staff access required.' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_object_agg(car_id,n) FROM (SELECT car_id,count(*) n FROM public.car_bids GROUP BY car_id) counts),'{}');
END $$;
REVOKE ALL ON FUNCTION public.backend_staff_bid_counts() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.backend_staff_bid_counts() TO authenticated;
CREATE OR REPLACE FUNCTION public.backend_vehicle_options(p_field text,p_brand text DEFAULT NULL,p_model text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_field IS NULL OR p_field NOT IN ('brand','model','variant') OR length(coalesce(p_brand,''))>200 OR length(coalesce(p_model,''))>200 THEN RAISE EXCEPTION 'Invalid vehicle lookup.' USING ERRCODE='22023'; END IF;
 RETURN coalesce((SELECT jsonb_agg(value ORDER BY value) FROM (SELECT DISTINCT
 CASE p_field WHEN 'brand' THEN oem WHEN 'model' THEN model ELSE variant END value FROM public.car_master_data
 WHERE (p_brand IS NULL OR oem=p_brand) AND (p_model IS NULL OR model=p_model)) options WHERE value IS NOT NULL AND trim(value)<>''),'[]');
END $$;
REVOKE ALL ON FUNCTION public.backend_vehicle_options(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backend_vehicle_options(text,text,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
