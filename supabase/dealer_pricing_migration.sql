-- =============================================================================
-- Dealer-exclusive inventory + dual pricing migration
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run.
--
-- Adds:
--   - cars.access_type       ('all' | 'dealer_only') — who can see the listing
--   - cars.base_price_buyer / cars.base_price_dealer   — starting price per audience
--   - cars.current_bid_buyer / cars.current_bid_dealer — live bid per audience
--
-- Existing `starting_bid` / `reserve_price` columns are left untouched and
-- backfilled into the new *_buyer columns so nothing that already reads them
-- breaks. New listings created from Add Car should populate both.
--
-- ⚠️ SECURITY NOTE — read this before relying on `dealer_only` in production:
-- Just like every other table in car_management_schema.sql, `cars` has no
-- Supabase-Auth-based RLS (your users are in Firebase, not here — see the
-- notice at the top of that file). That means `access_type = 'dealer_only'`
-- and the *_dealer price columns are filtered client-side only right now —
-- anyone calling the Supabase REST API directly with the public anon key can
-- still read every row, dealer-only or not. This migration does NOT change
-- that. Before dealer pricing needs to be truly private, put reads/writes
-- behind a Supabase Edge Function that verifies the Firebase ID token
-- server-side (same fix already flagged for the rest of `cars`).
-- =============================================================================

alter table public.cars
  add column if not exists access_type text not null default 'all'
    check (access_type in ('all', 'dealer_only')),
  add column if not exists base_price_buyer   numeric,
  add column if not exists base_price_dealer  numeric,
  add column if not exists current_bid_buyer  numeric,
  add column if not exists current_bid_dealer numeric;

-- Backfill from the existing single-price fields so current rows keep working.
update public.cars
set
  base_price_buyer   = coalesce(base_price_buyer, starting_bid, reserve_price),
  current_bid_buyer  = coalesce(current_bid_buyer, starting_bid, reserve_price)
where base_price_buyer is null or current_bid_buyer is null;

create index if not exists cars_access_type_idx on public.cars (access_type);
