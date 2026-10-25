-- Stage 2: apply ONLY after backend_commands_v3 + matching Edge/frontend deploy.
-- Closes known permissive policies without converting/deleting user records.
BEGIN;
-- Invoker trigger uses role-check helper for recursion-safe access.
CREATE OR REPLACE FUNCTION public.backend_profile_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid(); v_allowed text[]:=ARRAY['full_name','phone','business_name','dealer_name','mobile_number','business_address','state','city','gst_number','pan_number','license_url','profile_image_url','business_logo_url','pan_photo_url'];
BEGIN
 IF current_user NOT IN ('anon','authenticated') THEN RETURN NEW; END IF;
 IF v_actor IS NULL THEN RAISE EXCEPTION 'Sign in required.' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.id IS DISTINCT FROM v_actor OR NEW.role<>ALL(ARRAY['buyer','dealer']) OR (NEW.role='dealer' AND NEW.status IS DISTINCT FROM 'pending') OR (NEW.role='buyer' AND NEW.status IS DISTINCT FROM 'approved')
   OR NEW.dealer_id IS NOT NULL OR NEW.agent_code IS NOT NULL OR NEW.dealer_access_code IS NOT NULL OR NEW.dealer_access_code_verified IS DISTINCT FROM false OR NEW.dealer_access_code_sent_at IS NOT NULL OR NEW.dealer_access_code_attempts IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'Invalid self-service profile.' USING ERRCODE='42501'; END IF;
  IF NEW.must_change_password IS DISTINCT FROM false THEN RAISE EXCEPTION 'Protected account settings.' USING ERRCODE='42501'; END IF;
  NEW.created_at:=clock_timestamp(); RETURN NEW;
 END IF;
 IF public.backend_is_staff(ARRAY['admin']) THEN RETURN NEW; END IF;
 IF public.backend_is_staff(ARRAY['manager']) AND OLD.role='dealer' AND NEW.role='dealer' THEN v_allowed:=v_allowed||ARRAY['status'];
 ELSIF OLD.id=v_actor THEN
  IF OLD.role='buyer' AND NEW.role='dealer' AND NEW.status='pending' THEN v_allowed:=v_allowed||ARRAY['role','status']; END IF;
 ELSE RAISE EXCEPTION 'This profile cannot be edited.' USING ERRCODE='42501'; END IF;
 IF (to_jsonb(NEW)-v_allowed) IS DISTINCT FROM (to_jsonb(OLD)-v_allowed) THEN RAISE EXCEPTION 'Protected account fields cannot be edited.' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_prevent_self_privilege_escalation ON public.profiles;
DROP TRIGGER IF EXISTS backend_profile_guard ON public.profiles;
CREATE TRIGGER backend_profile_guard BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.backend_profile_guard();
DO $$ DECLARE p record;
BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles' LOOP EXECUTE format('DROP POLICY %I ON public.profiles',p.policyname); END LOOP; END $$;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_profiles_read ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid() OR public.backend_is_staff());
CREATE POLICY backend_profiles_insert ON public.profiles FOR INSERT TO authenticated WITH CHECK(id=auth.uid() AND role=ANY(ARRAY['buyer','dealer']));
CREATE POLICY backend_profiles_update ON public.profiles FOR UPDATE TO authenticated USING(id=auth.uid() OR public.backend_is_staff(ARRAY['admin']) OR (role='dealer' AND public.backend_is_staff(ARRAY['manager']))) WITH CHECK(id=auth.uid() OR public.backend_is_staff(ARRAY['admin']) OR (role='dealer' AND public.backend_is_staff(ARRAY['manager'])));

-- Submission throttles contain hashes, not raw phone numbers/emails. Expired
-- counters are reused, avoiding an ever-growing event row per public request.
CREATE TABLE IF NOT EXISTS public.backend_submission_limits(key text PRIMARY KEY,window_start timestamptz NOT NULL,count int NOT NULL);
ALTER TABLE public.backend_submission_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.backend_submission_limits FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.backend_validate_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb:=to_jsonb(NEW); k text; val jsonb; v_contact text; v_count int; v_car public.cars;
BEGIN
 IF auth.role() NOT IN ('anon','authenticated') THEN RETURN NEW; END IF;
 IF v->>'status' IS DISTINCT FROM (CASE WHEN TG_TABLE_NAME='contact_messages' THEN 'new' ELSE 'pending' END) THEN RAISE EXCEPTION 'New requests must start pending.' USING ERRCODE='22023'; END IF;
 FOR k,val IN SELECT * FROM jsonb_each(v) LOOP
  IF jsonb_typeof(val)='string' AND length(val#>>'{}')>5000 THEN RAISE EXCEPTION 'Request text is too long.' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF TG_TABLE_NAME IN ('car_purchase_requests','car_auction_requests') THEN
  IF (v->>'buyer_id')::uuid IS DISTINCT FROM auth.uid() OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='buyer' AND coalesce(status,'approved')='approved') THEN RAISE EXCEPTION 'Buyer ownership required.' USING ERRCODE='42501'; END IF;
 END IF;
 IF TG_TABLE_NAME='car_auction_requests' AND (v->>'assigned_agent_id' IS NOT NULL OR v->>'car_id' IS NOT NULL OR v->>'listing_type' IS NOT NULL OR v->>'admin_notes' IS NOT NULL OR v->>'agent_status' IS DISTINCT FROM 'unassigned') THEN RAISE EXCEPTION 'Assignment fields are staff controlled.' USING ERRCODE='22023'; END IF;
 IF TG_TABLE_NAME='sell_requests' AND ((v->>'submitted_by')::uuid IS DISTINCT FROM auth.uid() OR v->>'admin_notes' IS NOT NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role=v->>'submitted_by_role' AND role IN ('buyer','dealer') AND status='approved')) THEN RAISE EXCEPTION 'Invalid seller identity or staff fields.' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='dealer_applications' AND (v->>'dealer_id' IS NOT NULL OR v->>'auth_user_id' IS NOT NULL) THEN RAISE EXCEPTION 'Dealer login fields are staff controlled.' USING ERRCODE='22023'; END IF;
 IF TG_TABLE_NAME='car_purchase_requests' THEN
  SELECT * INTO v_car FROM public.cars WHERE id=(v->>'car_id')::uuid;
  IF NOT FOUND OR v_car.listing_type<>'buy_now_only' OR v_car.status<>'live' OR v_car.visibility<>'visible' OR v_car.access_type<>'all' THEN RAISE EXCEPTION 'This car is not available for direct purchase.' USING ERRCODE='22023'; END IF;
 END IF;
 FOR k IN SELECT unnest(ARRAY['offer_price','expected_price','km_driven','odometer_km']) LOOP
  IF v->>k IS NOT NULL AND ((v->>k)::numeric<0 OR (v->>k)::numeric>9007199254740991 OR (v->>k)::numeric::text IN ('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Invalid nonnegative value: %',k USING ERRCODE='22023'; END IF;
 END LOOP;
 IF v->>'latitude' IS NOT NULL AND NOT ((v->>'latitude')::numeric BETWEEN -90 AND 90) THEN RAISE EXCEPTION 'Invalid latitude.' USING ERRCODE='22023'; END IF;
 IF v->>'longitude' IS NOT NULL AND NOT ((v->>'longitude')::numeric BETWEEN -180 AND 180) THEN RAISE EXCEPTION 'Invalid longitude.' USING ERRCODE='22023'; END IF;
 IF TG_TABLE_NAME='c2c_deal_requests' THEN
  IF v->>'buyer_id' IS NOT NULL AND (v->>'buyer_id')::uuid IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Invalid buyer identity.' USING ERRCODE='42501'; END IF;
  IF coalesce((v->>'commission_percent')::numeric,3)<>3 OR v->>'admin_notes' IS NOT NULL THEN RAISE EXCEPTION 'Staff-controlled deal fields.' USING ERRCODE='22023'; END IF;
 END IF;
 v_contact:=coalesce(auth.uid()::text,nullif(lower(trim(coalesce(v->>'email',''))),''),nullif(regexp_replace(coalesce(v->>'phone',v->>'mobile_number',v->>'buyer_phone',''),'[^0-9]','','g'),''));
 IF v_contact IS NULL THEN RAISE EXCEPTION 'Contact information required.' USING ERRCODE='22023'; END IF;
 INSERT INTO public.backend_submission_limits AS lim VALUES(encode(sha256(convert_to(TG_TABLE_NAME||':'||v_contact,'UTF8')),'hex'),clock_timestamp(),1)
 ON CONFLICT(key) DO UPDATE SET window_start=CASE WHEN lim.window_start<clock_timestamp()-interval '10 minutes' THEN clock_timestamp() ELSE lim.window_start END,
 count=CASE WHEN lim.window_start<clock_timestamp()-interval '10 minutes' THEN 1 ELSE lim.count+1 END RETURNING count INTO v_count;
 IF v_count>10 THEN RAISE EXCEPTION 'Too many requests for this contact. Please wait before retrying.' USING ERRCODE='22023'; END IF;
 NEW:=jsonb_populate_record(NEW,jsonb_build_object('created_at',clock_timestamp(),'updated_at',clock_timestamp()));
 RETURN NEW;
END $$;
DO $$ DECLARE t text;
BEGIN FOREACH t IN ARRAY ARRAY['car_purchase_requests','car_auction_requests','dealer_applications','contact_messages','pdi_requests','c2c_deal_requests','sell_requests'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS backend_validate_submission ON public.%I',t);
 EXECUTE format('CREATE TRIGGER backend_validate_submission BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.backend_validate_submission()',t);
END LOOP; END $$;
-- Replace permissive policies as a set: adding a restrictive-looking policy
-- alongside an older permissive policy would still grant the older access.
DO $$ DECLARE t text; p record;
BEGIN FOREACH t IN ARRAY ARRAY['car_auction_requests','car_purchase_requests','dealer_applications','contact_messages','pdi_requests','c2c_deal_requests','sell_requests'] LOOP
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t); END LOOP;
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY backend_staff_read ON public.%I FOR SELECT TO authenticated USING(public.backend_is_staff())',t);
 EXECUTE format('CREATE POLICY backend_staff_manage ON public.%I FOR UPDATE TO authenticated USING(public.backend_is_staff(ARRAY[''admin'',''manager''])) WITH CHECK(public.backend_is_staff(ARRAY[''admin'',''manager'']))',t);
 IF t IN ('car_purchase_requests','car_auction_requests') THEN
  EXECUTE format('CREATE POLICY backend_buyer_insert ON public.%I FOR INSERT TO authenticated WITH CHECK(buyer_id=auth.uid())',t);
  EXECUTE format('CREATE POLICY backend_buyer_read ON public.%I FOR SELECT TO authenticated USING(buyer_id=auth.uid())',t);
 ELSIF t='sell_requests' THEN
  EXECUTE format('CREATE POLICY backend_seller_insert ON public.%I FOR INSERT TO authenticated WITH CHECK(submitted_by=auth.uid())',t);
  EXECUTE format('CREATE POLICY backend_seller_read ON public.%I FOR SELECT TO authenticated USING(submitted_by=auth.uid())',t);
 ELSIF t='c2c_deal_requests' THEN
  EXECUTE format('CREATE POLICY backend_contact_insert ON public.%I FOR INSERT TO anon,authenticated WITH CHECK(true)',t);
  EXECUTE format('CREATE POLICY backend_buyer_read ON public.%I FOR SELECT TO authenticated USING(buyer_id=auth.uid())',t);
 ELSE
  EXECUTE format('CREATE POLICY backend_contact_insert ON public.%I FOR INSERT TO anon,authenticated WITH CHECK(true)',t);
 END IF;
 IF t IN ('contact_messages','pdi_requests','c2c_deal_requests') THEN
  EXECUTE format('CREATE POLICY backend_admin_remove ON public.%I FOR DELETE TO authenticated USING(public.backend_is_staff(ARRAY[''admin'']))',t);
 END IF;
END LOOP; END $$;
CREATE POLICY backend_assigned_agent_read ON public.car_auction_requests FOR SELECT TO authenticated USING(assigned_agent_id=auth.uid() AND public.backend_is_staff(ARRAY['agent']));
CREATE OR REPLACE FUNCTION public.backend_request_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE allowed text[]:=ARRAY['status','updated_at'];
BEGIN
 IF current_user NOT IN ('anon','authenticated') THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='car_auction_requests' THEN
  allowed:=allowed||ARRAY['assigned_agent_id','agent_status','listing_type','admin_notes'];
  IF NEW.assigned_agent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=NEW.assigned_agent_id AND role='agent' AND status='approved') THEN RAISE EXCEPTION 'Active agent required.' USING ERRCODE='22023'; END IF;
  IF OLD.car_id IS NOT NULL AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.assigned_agent_id IS DISTINCT FROM OLD.assigned_agent_id OR NEW.listing_type IS DISTINCT FROM OLD.listing_type OR NEW.agent_status IS DISTINCT FROM OLD.agent_status) THEN RAISE EXCEPTION 'Submitted requests cannot be reassigned.' USING ERRCODE='22023'; END IF;
  IF NEW.agent_status='submitted' AND OLD.agent_status IS DISTINCT FROM 'submitted' THEN RAISE EXCEPTION 'Use the submission command.' USING ERRCODE='42501'; END IF;
  NEW.agent_status:=CASE WHEN NEW.assigned_agent_id IS NULL THEN 'unassigned' WHEN OLD.car_id IS NOT NULL THEN 'submitted' ELSE 'assigned' END;
 ELSIF TG_TABLE_NAME='car_purchase_requests' THEN
  IF OLD.status='completed' OR NEW.status='completed' THEN RAISE EXCEPTION 'Use the verified purchase command.' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME='dealer_applications' THEN
  IF OLD.status='approved' OR NEW.status='approved' THEN RAISE EXCEPTION 'Use the verified dealer approval.' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME='sell_requests' THEN allowed:=allowed||ARRAY['admin_notes','appointment_date','appointment_time'];
 ELSIF TG_TABLE_NAME='c2c_deal_requests' THEN allowed:=allowed||ARRAY['admin_notes'];
 END IF;
 IF (to_jsonb(NEW)-allowed) IS DISTINCT FROM (to_jsonb(OLD)-allowed) THEN RAISE EXCEPTION 'Request identity and financial fields cannot be rewritten.' USING ERRCODE='42501'; END IF;
 NEW:=jsonb_populate_record(NEW,jsonb_build_object('updated_at',clock_timestamp())); RETURN NEW;
END $$;
DO $$ DECLARE t text;
BEGIN FOREACH t IN ARRAY ARRAY['car_auction_requests','car_purchase_requests','dealer_applications','contact_messages','pdi_requests','c2c_deal_requests','sell_requests'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS backend_request_guard ON public.%I',t);
 EXECUTE format('CREATE TRIGGER backend_request_guard BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.backend_request_guard()',t);
END LOOP; END $$;
-- The centralized write guard and command policies replace this older,
-- undocumented price guard that conflicts with authorized team-lead review.
DROP TRIGGER IF EXISTS trg_prevent_non_admin_price_tampering ON public.cars;

-- Known public storage policies are replaced together; unrelated buckets stay.
DO $$ DECLARE p record;
BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND (coalesce(qual,'')||coalesce(with_check,''))~'(car-media|dealer-docs|sell-requests-media)' LOOP EXECUTE format('DROP POLICY %I ON storage.objects',p.policyname); END LOOP; END $$;
CREATE POLICY backend_media_public_read ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='car-media');
CREATE POLICY backend_media_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='car-media' AND (storage.foldername(name))[1]=auth.uid()::text AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role=ANY(ARRAY['admin','manager','agent']) AND status='approved'));
CREATE POLICY backend_media_staff_edit ON storage.objects FOR ALL TO authenticated USING(bucket_id='car-media' AND public.backend_is_staff(ARRAY['admin','manager'])) WITH CHECK(bucket_id='car-media' AND public.backend_is_staff(ARRAY['admin','manager']));
CREATE POLICY backend_private_media_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id IN ('dealer-docs','sell-requests-media') AND ((storage.foldername(name))[1]=auth.uid()::text OR public.backend_is_staff()));
CREATE POLICY backend_private_media_write ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id IN ('dealer-docs','sell-requests-media') AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY backend_private_media_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id IN ('dealer-docs','sell-requests-media') AND (storage.foldername(name))[1]=auth.uid()::text) WITH CHECK(bucket_id IN ('dealer-docs','sell-requests-media') AND (storage.foldername(name))[1]=auth.uid()::text);
UPDATE storage.buckets SET public=false,file_size_limit=10485760,allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','application/pdf'] WHERE id IN ('dealer-docs','sell-requests-media');
UPDATE storage.buckets SET file_size_limit=104857600,allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm','application/pdf'] WHERE id='car-media';
-- Read-model rollout: raw rows only grant fields needed by explicit FK embeds.
DO $$ DECLARE p record; cols text; all_cols text;
BEGIN
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='cars' LOOP EXECUTE format('DROP POLICY %I ON public.cars',p.policyname); END LOOP;
 SELECT string_agg(quote_ident(attname),',') INTO cols FROM pg_attribute WHERE attrelid='public.cars'::regclass AND attnum>0 AND NOT attisdropped AND attname<>ALL(ARRAY['seller_name','seller_phone','seller_notes','created_by','dealer_id','handled_by','handled_at','submitted_by_agent_id','tl_reviewed_by','tl_reviewed_at','tl_rejection_reason','negotiated_price','negotiation_notes','negotiation_updated_at','highest_bidder_id_buyer','highest_bidder_id_dealer','highest_bidder_name','highest_bidder_name_buyer','highest_bidder_name_dealer','base_price_dealer','current_bid_dealer','documents','vin_number','engine_number']);
 SELECT string_agg(quote_ident(attname),',') INTO all_cols FROM pg_attribute WHERE attrelid='public.cars'::regclass AND attnum>0 AND NOT attisdropped;
 REVOKE SELECT ON public.cars FROM PUBLIC,anon,authenticated;
 EXECUTE format('REVOKE SELECT(%s) ON public.cars FROM PUBLIC,anon,authenticated',all_cols);
 EXECUTE format('GRANT SELECT(%s) ON public.cars TO anon,authenticated',cols);
END $$;
CREATE POLICY backend_cars_read ON public.cars FOR SELECT TO anon,authenticated USING(public.backend_is_staff() OR (public.backend_is_staff(ARRAY['dealer']) AND ((visibility='visible' AND status IN ('live','closed','sold')) OR EXISTS(SELECT 1 FROM public.car_bids b WHERE b.car_id=cars.id AND b.bidder_id=auth.uid()))) OR (status='live' AND visibility='visible' AND access_type='all' AND listing_type='buy_now_only' AND coalesce(tl_review_status,'approved')='approved') OR EXISTS(SELECT 1 FROM public.car_purchase_requests q WHERE q.car_id=cars.id AND q.buyer_id=auth.uid()));
ALTER TABLE public.car_bids ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='car_bids' LOOP EXECUTE format('DROP POLICY %I ON public.car_bids',p.policyname); END LOOP; END $$;
CREATE POLICY backend_bids_read ON public.car_bids FOR SELECT TO authenticated USING(bidder_id=auth.uid() OR public.backend_is_staff());
REVOKE SELECT ON public.car_bids FROM PUBLIC,anon;
-- Unused demo bid tables expose bidder names but have no live application
-- caller. Retain data and SQL/service access; remove browser exposure.
REVOKE ALL ON public.bids,public.cars_state,public.access_codes FROM PUBLIC,anon,authenticated;
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='car_price_status_history' LOOP EXECUTE format('DROP POLICY %I ON public.car_price_status_history',p.policyname); END LOOP; END $$;
CREATE POLICY backend_history_read ON public.car_price_status_history FOR SELECT TO authenticated USING(public.backend_is_staff());
-- Retire publicly callable legacy mutation surfaces; active application routes
-- use the verified dealer bid and backend command APIs.
DO $$ DECLARE f record;
BEGIN FOR f IN SELECT oid::regprocedure sig FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY(ARRAY['approve_dealer_application','generate_dealer_id','place_custom_bid','place_quick_bid','close_expired_auctions']) LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.sig); END LOOP; END $$;
GRANT EXECUTE ON FUNCTION public.generate_dealer_id() TO service_role;
REVOKE ALL ON public.sheet_sync_queue FROM PUBLIC,anon,authenticated;
-- View is an undocumented owner read model; current frontend uses cars_catalog.
REVOKE ALL ON public.cars_negotiation_queue FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
