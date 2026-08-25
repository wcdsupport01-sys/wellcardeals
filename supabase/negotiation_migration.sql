-- =============================================================================
-- Negotiation panel migration
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run.
--
-- Any listed car (buyer or dealer channel) whose auction has ended with
-- ZERO bids, and isn't already sold or already closed out by the admin,
-- shows up in the admin "Negotiate" panel so the team can reach out and
-- work a deal directly instead of losing the listing.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Columns on cars — tracks the admin's manual negotiation workflow
-- ---------------------------------------------------------------------------
alter table public.cars
  add column if not exists negotiation_status text not null default 'none'
    check (negotiation_status in ('none', 'contacted', 'negotiating', 'deal_done', 'rejected')),
  add column if not exists negotiation_notes      text,
  add column if not exists negotiated_price       numeric,
  add column if not exists negotiation_updated_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Queue view — "no bid found" cars whose auction has ended, not sold,
--    and not already closed out (deal_done / rejected) by the admin.
--    negotiation_status = 'none' shows in the UI as "Pending" (untouched).
-- ---------------------------------------------------------------------------
create or replace view public.cars_negotiation_queue as
select c.*
from public.cars c
where c.auction_end is not null
  and c.auction_end < now()
  and c.status <> 'sold'
  and c.negotiation_status not in ('deal_done', 'rejected')
  and not exists (
    select 1 from public.car_bids b where b.car_id = c.id
  )
order by c.auction_end desc;

notify pgrst, 'reload schema';

-- PostgREST-exposed views need explicit grants (they don't inherit the
-- underlying table's RLS policies the way a normal `select` from cars
-- would through the app). cars itself is public-read already, so this
-- view is exposing nothing extra -- just narrowing to "needs negotiation".
grant select on public.cars_negotiation_queue to anon, authenticated;
