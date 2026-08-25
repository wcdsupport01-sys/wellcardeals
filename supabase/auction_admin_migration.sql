-- =============================================================================
-- Auction Admin Monitoring — Supabase migration
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run.
--
-- This adds everything the new Admin → "Live Bids" page needs:
--   1. public.car_bids        — full bid history (who bid, how much, when),
--                                referenced by src/pages/RealCarDetail.jsx
--                                already, but never had a migration of its
--                                own — this creates it for real.
--   2. cars.highest_bidder_id_buyer / _dealer   — WHO currently holds the
--      cars.highest_bidder_name_buyer / _dealer   top bid, per price track
--                                                   (buyer track vs dealer
--                                                   track — see
--                                                   dealer_pricing_migration.sql).
--   3. cars.buyer_winner_contacted / dealer_winner_contacted (+ _at) — lets
--      the admin tick "contacted" once someone from the team has reached
--      out to the winner, so nobody gets called twice or missed.
--   4. RLS so a signed-in buyer/dealer can insert + read their own bids,
--      and admins can read every bid (needed for the admin page).
--   5. Realtime — adds `cars` and `car_bids` to the realtime publication so
--      the admin page (and the live bidding page) update instantly without
--      a page refresh. (`cars` was previously never added, even though
--      RealCarDetail.jsx already subscribes to it.)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. car_bids — full bid history
-- ---------------------------------------------------------------------------
create table if not exists public.car_bids (
  id           bigint generated always as identity primary key,
  car_id       uuid not null references public.cars(id) on delete cascade,
  bidder_id    uuid references auth.users(id) on delete set null,
  bidder_name  text not null,
  bidder_role  text not null default 'buyer' check (bidder_role in ('buyer', 'dealer')),
  amount       numeric not null,
  is_custom    boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists car_bids_car_id_idx on public.car_bids (car_id);
create index if not exists car_bids_bidder_id_idx on public.car_bids (bidder_id);
create index if not exists car_bids_created_at_idx on public.car_bids (created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Winner-tracking columns on cars
-- ---------------------------------------------------------------------------
alter table public.cars
  add column if not exists highest_bidder_id_buyer     uuid references auth.users(id) on delete set null,
  add column if not exists highest_bidder_name_buyer    text,
  add column if not exists highest_bidder_id_dealer     uuid references auth.users(id) on delete set null,
  add column if not exists highest_bidder_name_dealer   text,
  add column if not exists buyer_winner_contacted       boolean not null default false,
  add column if not exists buyer_winner_contacted_at    timestamptz,
  add column if not exists dealer_winner_contacted      boolean not null default false,
  add column if not exists dealer_winner_contacted_at   timestamptz;

create index if not exists cars_auction_end_idx on public.cars (auction_end);

-- Backfill the new per-track winner columns from the old shared
-- highest_bidder_name column so cars that already had bids before this
-- migration still show a name on the admin page (id will stay empty for
-- these until someone bids again — that's fine, name-only is still useful).
update public.cars
set
  highest_bidder_name_buyer  = coalesce(highest_bidder_name_buyer, highest_bidder_name)
where highest_bidder_name is not null
  and highest_bidder_name_buyer is null
  and highest_bidder_name_dealer is null;

-- ---------------------------------------------------------------------------
-- 3. Row Level Security on car_bids
--    (cars itself is already public-read/write per car_management_schema.sql
--    — see the security note in that file. Not changing that here.)
-- ---------------------------------------------------------------------------
alter table public.car_bids enable row level security;

drop policy if exists "car_bids: self insert" on public.car_bids;
create policy "car_bids: self insert"
  on public.car_bids for insert
  with check (bidder_id = auth.uid());

drop policy if exists "car_bids: read own" on public.car_bids;
create policy "car_bids: read own"
  on public.car_bids for select
  using (bidder_id = auth.uid());

-- Admins can read every bid — needed for the Admin → Live Bids page.
drop policy if exists "car_bids: admin read all" on public.car_bids;
create policy "car_bids: admin read all"
  on public.car_bids for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Realtime — so new bids & winner updates push live into the admin page
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'car_bids'
  ) then
    alter publication supabase_realtime add table public.car_bids;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'cars'
  ) then
    alter publication supabase_realtime add table public.cars;
  end if;
end $$;
