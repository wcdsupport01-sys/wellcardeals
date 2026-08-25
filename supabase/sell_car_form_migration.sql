-- ============================================================
-- Adds the extra fields captured by the new public "Sell Your Car"
-- form (Navbar -> Sell Car / Buyer Dashboard -> Sell Your Car) to
-- the existing car_auction_requests table.
-- Safe to re-run.
-- ============================================================

alter table car_auction_requests
  add column if not exists customer_name       text,
  add column if not exists customer_email      text,
  add column if not exists registration_number text,
  add column if not exists brand               text,
  add column if not exists model               text,
  add column if not exists variant             text,
  add column if not exists odo_range           text,   -- e.g. '0-10000', '10000-20000'
  add column if not exists landmark            text,
  add column if not exists latitude            numeric,
  add column if not exists longitude           numeric;
