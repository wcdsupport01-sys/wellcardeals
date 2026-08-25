-- Adds a listing_type column so a car can be marked as either a normal
-- auction (bidding enabled) or a "Buy Now Only" fixed-price listing
-- (no bidding UI shown to buyers — they can only purchase at buy_now_price).
--
-- Run this once in the Supabase SQL editor.

alter table public.cars
  add column if not exists listing_type text not null default 'auction'
    check (listing_type in ('auction', 'buy_now_only'));

create index if not exists cars_listing_type_idx on public.cars (listing_type);

-- Buy-Now-Only cars must have a buy_now_price set, otherwise there's
-- nothing for a buyer to purchase at.
alter table public.cars
  add constraint cars_buy_now_only_requires_price
  check (listing_type <> 'buy_now_only' or buy_now_price is not null);
