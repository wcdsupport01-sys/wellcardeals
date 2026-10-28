-- Owner confirmed on 2026-10-28: the Thar, Venue and i20 legacy bids were tests.
-- Run the WHOLE file in the production SQL Editor as the database owner.
-- Reviewed against encrypted backup / GitHub run 40653635130 (2026-10-28).
-- Copies the exact five bid records into a protected archive before removing
-- them from active bidding. Cars, prices, accounts and sale status are unchanged.
-- Any changed car/bid, partial archive or missing record rolls back everything.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL timezone = 'UTC';

CREATE TABLE IF NOT EXISTS public.backend_test_bid_archive (
  bid_id uuid PRIMARY KEY,
  car_id uuid NOT NULL,
  batch_id text NOT NULL,
  original_bid jsonb NOT NULL,
  original_car jsonb NOT NULL,
  reason text NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  archived_db_user text NOT NULL DEFAULT session_user,
  CHECK (jsonb_typeof(original_bid) = 'object'),
  CHECK ((original_bid->>'id')::uuid = bid_id),
  CHECK ((original_bid->>'car_id')::uuid = car_id),
  CHECK ((original_car->>'id')::uuid = car_id)
);
COMMENT ON TABLE public.backend_test_bid_archive IS
  'Owner-confirmed test bids retained verbatim, outside active bidding and sale calculations.';
CREATE INDEX IF NOT EXISTS backend_test_bid_archive_car_idx
  ON public.backend_test_bid_archive(car_id);
ALTER TABLE public.backend_test_bid_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.backend_test_bid_archive FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.backend_test_bid_archive TO authenticated;
GRANT ALL ON public.backend_test_bid_archive TO service_role;
DROP POLICY IF EXISTS backend_test_bid_archive_admin_read ON public.backend_test_bid_archive;
CREATE POLICY backend_test_bid_archive_admin_read ON public.backend_test_bid_archive
  FOR SELECT TO authenticated USING (public.backend_is_staff(ARRAY['admin']));

-- Fingerprints cover every original car field and every bid field, including
-- identities/timestamps/request IDs. No bidder names or contact data in source.
CREATE TEMP TABLE backend_confirmed_test_bid_targets (
  car_id uuid PRIMARY KEY,
  expected_count integer NOT NULL,
  car_sha256 text NOT NULL,
  bids_sha256 text NOT NULL
) ON COMMIT DROP;
INSERT INTO backend_confirmed_test_bid_targets VALUES
 ('a90873bb-18ef-4062-b2dd-817e6632881a', 1, '913dfb5e3c4da35754756978e1e5d1ad1dc9c3df7c89bf6f9d7a08df27db0ff4', '390cb3b4cca60103d6b1c1a33544ee99e115772f11b0d012c0fd01cf8dfc6400'),
 ('e5b6fd60-3b7f-416e-be57-d4a87f819fd6', 2, 'b8e9db2b8572a44ba4bac71acd96a6dbea7b6e817fc56940e37ef92cf9e65aec', 'e373bd115222773fb24163497473bea124c1f208903222e9822ea0939168d17e'),
 ('f3115ef2-f815-4723-95bd-095477d77d2e', 2, '3b61e7d0e709cd99510e277c0eae421502fcce99adfccd703efe57e95f6fcfb5', '878784a5cd82f1df1ba580a1953a1beb69cbbba2457eaf45629b1a0b8bb19e52');

DO $cleanup$
DECLARE
  v_batch constant text := 'owner-confirmed-test-bids-20261028';
  v_target record;
  v_car public.cars;
  v_count integer;
  v_hash text;
  v_archived integer;
  v_removed integer;
BEGIN
  -- Parent rows first, matching the normal bidding lock order. The short table
  -- lock also prevents a privileged concurrent insert changing the bid set.
  PERFORM c.id FROM public.cars c
    JOIN pg_temp.backend_confirmed_test_bid_targets t ON t.car_id = c.id
    ORDER BY c.id FOR UPDATE OF c;
  LOCK TABLE public.car_bids IN SHARE ROW EXCLUSIVE MODE;

  SELECT count(*) INTO v_archived FROM public.backend_test_bid_archive
    WHERE batch_id = v_batch;
  IF v_archived > 0 THEN
    IF v_archived <> 5 OR EXISTS (
      SELECT 1 FROM public.car_bids b JOIN public.backend_test_bid_archive a ON a.bid_id = b.id
      WHERE a.batch_id = v_batch
    ) THEN
      RAISE EXCEPTION 'Partial/conflicting test-bid archive. Review before continuing.';
    END IF;
    FOR v_target IN SELECT * FROM pg_temp.backend_confirmed_test_bid_targets LOOP
      SELECT count(*), encode(sha256(convert_to(
        coalesce(jsonb_agg(a.original_bid ORDER BY a.bid_id)::text, '[]'), 'UTF8')), 'hex')
        INTO v_count, v_hash FROM public.backend_test_bid_archive a
        WHERE a.batch_id = v_batch AND a.car_id = v_target.car_id;
      IF v_count <> v_target.expected_count OR v_hash <> v_target.bids_sha256 OR EXISTS (
        SELECT 1 FROM public.backend_test_bid_archive a
        WHERE a.batch_id = v_batch AND a.car_id = v_target.car_id
          AND encode(sha256(convert_to(a.original_car::text, 'UTF8')), 'hex') <> v_target.car_sha256
      ) THEN
        RAISE EXCEPTION 'Archived test-bid fingerprint mismatch. Nothing changed.';
      END IF;
    END LOOP;
    -- A later legitimate listing/bid is never reset when this file is rerun.
    RAISE NOTICE 'These five test bids are already archived; no data changes.';
    RETURN;
  END IF;

  -- Check ALL three targets before copying or removing any bid.
  FOR v_target IN SELECT * FROM pg_temp.backend_confirmed_test_bid_targets ORDER BY car_id LOOP
    SELECT * INTO v_car FROM public.cars WHERE id = v_target.car_id;
    IF NOT FOUND OR v_car.status IS DISTINCT FROM 'closed'
      OR v_car.buyer_winner_marked_sold IS DISTINCT FROM false
      OR v_car.dealer_winner_marked_sold IS DISTINCT FROM false
      OR v_car.highest_bidder_id_dealer IS NOT NULL
      OR nullif(trim(v_car.highest_bidder_name_dealer), '') IS NOT NULL
      OR v_car.current_bid_dealer IS DISTINCT FROM v_car.base_price_dealer
      OR encode(sha256(convert_to(to_jsonb(v_car)::text, 'UTF8')), 'hex') <> v_target.car_sha256 THEN
      RAISE EXCEPTION 'Reviewed car changed or has a winner/sale. Nothing changed; inspect current records.';
    END IF;
    SELECT count(*), encode(sha256(convert_to(
      coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.id)::text, '[]'), 'UTF8')), 'hex')
      INTO v_count, v_hash FROM public.car_bids b WHERE b.car_id = v_target.car_id;
    IF v_count <> v_target.expected_count OR v_hash <> v_target.bids_sha256 OR EXISTS (
      SELECT 1 FROM public.car_bids b WHERE b.car_id = v_target.car_id
        AND (b.bidder_role IS DISTINCT FROM 'dealer' OR b.request_id IS NOT NULL)
    ) THEN
      RAISE EXCEPTION 'Reviewed bid set changed. Nothing changed; inspect current records.';
    END IF;
  END LOOP;

  INSERT INTO public.backend_test_bid_archive
    (bid_id, car_id, batch_id, original_bid, original_car, reason)
    SELECT b.id, b.car_id, v_batch, to_jsonb(b), to_jsonb(c),
      'Repository owner confirmed on 2026-10-28: these legacy bids were tests, not genuine offers.'
    FROM public.car_bids b
    JOIN pg_temp.backend_confirmed_test_bid_targets t ON t.car_id = b.car_id
    JOIN public.cars c ON c.id = b.car_id;
  GET DIAGNOSTICS v_archived = ROW_COUNT;
  IF v_archived <> 5 THEN RAISE EXCEPTION 'Expected exactly five archived test bids.'; END IF;

  DELETE FROM public.car_bids b USING public.backend_test_bid_archive a
    WHERE a.batch_id = v_batch AND a.bid_id = b.id
      AND a.original_bid = to_jsonb(b);
  GET DIAGNOSTICS v_removed = ROW_COUNT;
  IF v_removed <> 5 THEN RAISE EXCEPTION 'Active-bid removal mismatch; archive transaction rolled back.'; END IF;
  IF EXISTS (SELECT 1 FROM public.car_bids b
    JOIN pg_temp.backend_confirmed_test_bid_targets t ON t.car_id = b.car_id) THEN
    RAISE EXCEPTION 'Unexpected bid remains on a reviewed test auction; rolled back.';
  END IF;
END
$cleanup$;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Final read-only result stays visible in SQL Editor after the commit.
SELECT jsonb_build_object(
  'batch', 'owner-confirmed-test-bids-20261028',
  'archived_test_bids', (SELECT count(*) FROM public.backend_test_bid_archive
    WHERE batch_id = 'owner-confirmed-test-bids-20261028'),
  'active_bids_on_reviewed_auctions', (SELECT count(*) FROM public.car_bids b
    WHERE b.car_id IN (SELECT a.car_id FROM public.backend_test_bid_archive a
      WHERE a.batch_id = 'owner-confirmed-test-bids-20261028')),
  'cars_changed', 0
) AS test_bid_cleanup;
