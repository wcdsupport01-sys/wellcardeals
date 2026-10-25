-- Dealer auction v2. Apply AFTER the existing auth/car/auction/wishlist migrations.
-- Keep a schema backup first. Deploy the frontend only after this succeeds.
-- Existing bids are preserved. Browser roles lose direct bid writes and the old
-- dealer bid RPC is retired; service_role/SQL admin maintenance still works.
BEGIN;
ALTER TABLE public.car_bids ADD COLUMN IF NOT EXISTS request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS car_bids_request_id_key ON public.car_bids(request_id);
CREATE INDEX IF NOT EXISTS car_bids_dealer_latest_idx ON public.car_bids(bidder_id, car_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.dealer_auction_snapshot(p_car_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result jsonb; v_now timestamptz := clock_timestamp();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'dealer' AND status = 'approved') THEN
    RAISE EXCEPTION 'Only approved dealers can access auctions.' USING ERRCODE = '42501';
  END IF;
  -- One MVCC snapshot: price, own latest bid and count cannot disagree because
  -- another transaction committed between separate SELECT statements.
  SELECT jsonb_build_object('car', to_jsonb(c), 'server_time', v_now,
    'my_bid', (SELECT to_jsonb(b) FROM public.car_bids b WHERE b.car_id=c.id AND b.bidder_id=auth.uid() ORDER BY b.created_at DESC,b.id DESC LIMIT 1),
    'my_bid_count', (SELECT count(*) FROM public.car_bids b WHERE b.car_id=c.id AND b.bidder_id=auth.uid()),
    'recent_bids', coalesce((SELECT jsonb_agg(to_jsonb(recent)) FROM (
      SELECT id::text AS id, amount, created_at FROM public.car_bids WHERE car_id=c.id AND bidder_id=auth.uid() ORDER BY created_at DESC,id DESC LIMIT 5
    ) recent), '[]'::jsonb)) INTO v_result FROM public.cars c WHERE c.id=p_car_id AND c.listing_type IS DISTINCT FROM 'buy_now_only';
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
    'accepted_at', v_bid.created_at, 'server_time', clock_timestamp(), 'car', to_jsonb(v_car));
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
    OR v_car.auction_end IS NULL OR v_car.auction_end <= v_now THEN
    RAISE EXCEPTION 'This auction is not open for bidding.' USING ERRCODE = '22023';
  END IF;
  v_increment := coalesce(nullif(v_car.minimum_increment, 0), 5000);
  IF v_increment < 0 THEN RAISE EXCEPTION 'Invalid auction increment.' USING ERRCODE = '22023'; END IF;
  v_min := ceil(greatest(coalesce(nullif(v_car.current_bid_dealer, 0), v_car.base_price_dealer, v_car.starting_bid, 0)
    + v_increment, coalesce(v_car.reserve_price, 0)));
  IF p_amount < v_min THEN RAISE EXCEPTION 'Bid must be at least Rs %. Refresh and review the new price.', v_min USING ERRCODE = '22023'; END IF;

  INSERT INTO public.car_bids(car_id, bidder_id, bidder_name, bidder_role, amount, request_id, created_at)
    VALUES (p_car_id, auth.uid(), coalesce(nullif(v_profile.business_name, ''), nullif(v_profile.full_name, ''), 'Dealer'),
      'dealer', p_amount, p_request_id, v_now) RETURNING * INTO v_bid;
  UPDATE public.cars SET current_bid_dealer = p_amount, highest_bidder_id_dealer = auth.uid(),
    highest_bidder_name_dealer = v_bid.bidder_name WHERE id = p_car_id;
  RETURN public.dealer_bid_receipt(p_request_id);
END $$;

-- Block direct table writes even if a legacy permissive RLS policy remains.
-- SECURITY DEFINER routines execute as the table owner, not the browser role.
CREATE OR REPLACE FUNCTION public.guard_dealer_bid_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Auction records must use verified server endpoints.' USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS guard_dealer_bids ON public.car_bids;
CREATE TRIGGER guard_dealer_bids BEFORE INSERT OR UPDATE OR DELETE ON public.car_bids FOR EACH ROW EXECUTE FUNCTION public.guard_dealer_bid_fields();
DROP TRIGGER IF EXISTS guard_dealer_bid_fields ON public.cars;
CREATE TRIGGER guard_dealer_bid_fields BEFORE INSERT OR UPDATE OR DELETE ON public.cars FOR EACH ROW EXECUTE FUNCTION public.guard_dealer_bid_fields();
REVOKE INSERT, UPDATE, DELETE ON public.car_bids, public.cars FROM anon, authenticated;

-- Preserve bid history if an administrator attempts to delete an auction car.
-- Archive sold/withdrawn cars instead of cascading away their bid records.
DO $$ DECLARE v_constraint record;
BEGIN
  FOR v_constraint IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.car_bids'::regclass
    AND confrelid = 'public.cars'::regclass AND contype = 'f'
  LOOP EXECUTE format('ALTER TABLE public.car_bids DROP CONSTRAINT %I', v_constraint.conname); END LOOP;
END $$;
ALTER TABLE public.car_bids ADD CONSTRAINT car_bids_car_id_fkey FOREIGN KEY(car_id) REFERENCES public.cars(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.get_dealer_auction_dashboard(p_tab text DEFAULT 'live', p_search text DEFAULT '', p_offset integer DEFAULT 0, p_limit integer DEFAULT 24)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result jsonb; v_now timestamptz := clock_timestamp();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'dealer' AND status = 'approved') THEN
    RAISE EXCEPTION 'Only approved dealers can access auctions.' USING ERRCODE = '42501';
  END IF;
  IF p_tab NOT IN ('live', 'bids', 'watchlist', 'results') OR p_limit NOT BETWEEN 1 AND 100 OR p_offset < 0 THEN
    RAISE EXCEPTION 'Invalid auction filters.' USING ERRCODE = '22023';
  END IF;
  WITH eligible AS (
    SELECT c.*, (c.status = 'live' AND c.auction_end > v_now) AS is_live,
      b.last_bid, coalesce(b.bid_count, 0) AS my_bid_count,
      EXISTS(SELECT 1 FROM public.wishlist w WHERE w.car_id = c.id AND w.buyer_id = auth.uid()) AS watchlisted
    FROM public.cars c
    LEFT JOIN LATERAL (
      SELECT (array_agg(to_jsonb(cb) ORDER BY cb.created_at DESC, cb.id DESC))[1] AS last_bid, count(*) AS bid_count
      FROM public.car_bids cb WHERE cb.car_id = c.id AND cb.bidder_id = auth.uid()
    ) b ON true
    WHERE c.listing_type IS DISTINCT FROM 'buy_now_only'
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
    'total', (SELECT count(*) FROM filtered), 'items', coalesce((SELECT jsonb_agg(to_jsonb(page)) FROM page), '[]'::jsonb)) INTO v_result;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.get_dealer_bid_audit(p_before_id bigint DEFAULT NULL, p_limit integer DEFAULT 500)
RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'team_lead')) THEN
    RAISE EXCEPTION 'Staff access required.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT to_jsonb(b) || jsonb_build_object('id', b.id::text) FROM public.car_bids b WHERE (p_before_id IS NULL OR b.id < p_before_id)
    ORDER BY b.id DESC LIMIT least(greatest(p_limit, 1), 500);
END $$;

-- Retire every legacy overload; older open tabs must reload after deployment.
DO $$ DECLARE v_function record;
BEGIN
  FOR v_function IN SELECT oid::regprocedure AS signature FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace AND proname = 'place_dealer_bid'
  LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_function.signature); END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.place_dealer_bid_v2(uuid,numeric,uuid), public.dealer_bid_receipt(uuid),
  public.dealer_auction_snapshot(uuid), public.get_dealer_auction_dashboard(text,text,integer,integer),
  public.get_dealer_bid_audit(bigint,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_dealer_bid_v2(uuid,numeric,uuid), public.dealer_bid_receipt(uuid),
  public.dealer_auction_snapshot(uuid), public.get_dealer_auction_dashboard(text,text,integer,integer),
  public.get_dealer_bid_audit(bigint,integer) TO authenticated;
-- Existing installations normally publish these already. Polling remains a
-- fallback when Realtime is unavailable; do not assume subscription means fresh data.
DO $$ DECLARE v_table text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    FOREACH v_table IN ARRAY ARRAY['cars','car_bids'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=v_table) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
      END IF;
    END LOOP;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
