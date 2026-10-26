-- READ ONLY. Aggregate data checks before a coordinated production release.
-- No customer details, auth tokens, object names or function bodies are returned.
-- Nonzero counters need review; this file does not rewrite auction history.
SELECT jsonb_build_object(
 'checked_at',statement_timestamp(),
 'scope','aggregate_data_preflight',
 'cars_total',(SELECT count(*) FROM public.cars),
 'dealer_bids_total',(SELECT count(*) FROM public.car_bids WHERE bidder_role='dealer'),
 'profiles_null_role_or_status',(SELECT count(*) FROM public.profiles WHERE role IS NULL OR status IS NULL),
 'dealer_price_below_history',(SELECT count(*) FROM public.cars c WHERE coalesce(c.current_bid_dealer,0)<coalesce((SELECT max(b.amount) FROM public.car_bids b WHERE b.car_id=c.id AND b.bidder_role='dealer'),0)),
 'submitted_requests_without_car',(SELECT count(*) FROM public.car_auction_requests WHERE agent_status='submitted' AND car_id IS NULL),
 'live_auction_invalid_clock',(SELECT count(*) FROM public.cars WHERE status='live' AND listing_type='auction' AND (auction_end IS NULL OR (auction_start IS NOT NULL AND auction_end<=auction_start))),
 'live_buy_now_invalid_price',(SELECT count(*) FROM public.cars WHERE status='live' AND listing_type='buy_now_only' AND (buy_now_price IS NULL OR buy_now_price<=0)),
 'outbox_pending',(SELECT count(*) FROM public.sheet_sync_queue WHERE status='pending'),
 'outbox_failed',(SELECT count(*) FROM public.sheet_sync_queue WHERE status='failed'),
 'legacy_private_buckets_public',(SELECT count(*) FROM storage.buckets WHERE id IN ('dealer-docs','sell-requests-media') AND public)
) AS backend_data_preflight;
