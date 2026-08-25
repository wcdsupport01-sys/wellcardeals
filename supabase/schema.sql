-- =============================================================================
-- Live Vehicle Auctions — Supabase schema (bidding demo + access codes)
-- Run this whole file in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run: it won't duplicate data or reset auctions already in progress.
--
-- NOTE on the hybrid setup: user accounts (buyers/dealers/admin) live in
-- Firebase, NOT in this database, so none of this relies on Supabase Auth —
-- everything here is reachable with just the anon key, gated only by the
-- SECURITY DEFINER functions below (bid amounts are always validated
-- server-side, never trusted from the client).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table if not exists public.cars_state (
  car_id       integer primary key,
  current_bid  numeric not null,
  bid_count    integer not null default 0,
  end_time     timestamptz not null
);

create table if not exists public.bids (
  id           bigint generated always as identity primary key,
  car_id       integer not null references public.cars_state(car_id),
  bidder_name  text not null,
  amount       numeric not null,
  is_custom    boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.access_codes (
  code          text primary key,
  name          text,
  email         text,
  phone         text,
  city          text,
  redeemed      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Row Level Security
--    Anon (browser) key can only READ cars_state/bids directly.
--    All writes go through the SECURITY DEFINER functions below.
-- ---------------------------------------------------------------------------

alter table public.cars_state  enable row level security;
alter table public.bids        enable row level security;
alter table public.access_codes enable row level security;

drop policy if exists "cars_state_read" on public.cars_state;
create policy "cars_state_read" on public.cars_state
  for select using (true);

drop policy if exists "bids_read" on public.bids;
create policy "bids_read" on public.bids
  for select using (true);

-- No public policies on access_codes at all — it's only touched via the
-- SECURITY DEFINER functions below, never read/written directly by the browser.

-- ---------------------------------------------------------------------------
-- 3. Seed the 8 demo cars (matches src/data/auctionCars.js)
--    Countdown timers are set relative to "now" at the moment you run this.
-- ---------------------------------------------------------------------------

insert into public.cars_state (car_id, current_bid, bid_count, end_time) values
  (1, 3450000, 18, now() + interval '42 minutes'),
  (2, 6120000, 27, now() + interval '18 minutes'),
  (3, 2740000, 12, now() + interval '65 minutes'),
  (4, 4260000,  9, now() + interval '120 minutes'),
  (5, 3810000, 21, now() + interval '9 minutes'),
  (6, 3015000, 14, now() + interval '51 minutes'),
  (7, 6890000, 33, now() + interval '25 minutes'),
  (8, 1885000,  7, now() + interval '88 minutes')
on conflict (car_id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Bidding functions
-- ---------------------------------------------------------------------------

-- Quick bid: server decides the increment (min ₹10,000, or 1% of current bid).
drop function if exists public.place_quick_bid(integer, text);
create or replace function public.place_quick_bid(p_car_id integer, p_bidder text)
returns public.cars_state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.cars_state;
  v_increment numeric;
  v_new_bid numeric;
begin
  select * into v_row from public.cars_state where car_id = p_car_id for update;

  if v_row is null then
    raise exception 'Car not found';
  end if;

  if now() > v_row.end_time then
    raise exception 'This auction has ended';
  end if;

  v_increment := greatest(10000, round((v_row.current_bid * 0.01) / 500) * 500);
  v_new_bid   := v_row.current_bid + v_increment;

  update public.cars_state
    set current_bid = v_new_bid,
        bid_count = bid_count + 1
    where car_id = p_car_id
    returning * into v_row;

  insert into public.bids (car_id, bidder_name, amount, is_custom)
    values (p_car_id, coalesce(p_bidder, 'Someone'), v_new_bid, false);

  return v_row;
end;
$$;

-- Custom bid: bidder sets their own exact amount (must clear a minimum step).
drop function if exists public.place_custom_bid(integer, numeric, text);
create or replace function public.place_custom_bid(p_car_id integer, p_amount numeric, p_bidder text)
returns public.cars_state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.cars_state;
  v_min_step numeric;
  v_min_allowed numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter a valid bid amount';
  end if;

  select * into v_row from public.cars_state where car_id = p_car_id for update;

  if v_row is null then
    raise exception 'Car not found';
  end if;

  if now() > v_row.end_time then
    raise exception 'This auction has ended';
  end if;

  v_min_step    := greatest(5000, round((v_row.current_bid * 0.005) / 500) * 500);
  v_min_allowed := v_row.current_bid + v_min_step;

  if p_amount < v_min_allowed then
    raise exception 'Your bid must be at least ₹%', to_char(v_min_allowed, 'FM99,99,99,999');
  end if;

  update public.cars_state
    set current_bid = p_amount,
        bid_count = bid_count + 1
    where car_id = p_car_id
    returning * into v_row;

  insert into public.bids (car_id, bidder_name, amount, is_custom)
    values (p_car_id, coalesce(p_bidder, 'Someone'), p_amount, true);

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Access-code functions (bidding pass gate)
-- ---------------------------------------------------------------------------

drop function if exists public.request_access(text, text, text, text);
create or replace function public.request_access(p_name text, p_email text, p_phone text, p_city text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_ok boolean := false;
begin
  while not v_ok loop
    v_code := 'AH-';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;

    begin
      insert into public.access_codes (code, name, email, phone, city)
        values (v_code, p_name, p_email, p_phone, p_city);
      v_ok := true;
    exception when unique_violation then
      v_ok := false; -- collision, try another code
    end;
  end loop;

  return v_code;
end;
$$;

drop function if exists public.redeem_access_code(text);
create or replace function public.redeem_access_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_found boolean;
begin
  select exists(select 1 from public.access_codes where code = upper(trim(p_code)))
    into v_found;

  if v_found then
    update public.access_codes set redeemed = true where code = upper(trim(p_code));
  end if;

  return v_found;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Realtime — so bid updates push live to every open browser tab
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'cars_state'
  ) then
    alter publication supabase_realtime add table public.cars_state;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'bids'
  ) then
    alter publication supabase_realtime add table public.bids;
  end if;
end $$;
