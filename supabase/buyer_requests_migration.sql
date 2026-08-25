-- ============================================================
-- Buyer-facing requests: (1) "Buy Now" purchase requests on a
-- listed car, (2) "List my car for auction" requests.
-- Both are buyer-only actions reviewed by Admin.
-- ============================================================

-- 1) Direct "Buy Now" requests from a buyer on an existing car listing.
create table if not exists car_purchase_requests (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references cars(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  buyer_name text,
  buyer_phone text,
  offer_price numeric,
  message text,
  status text not null default 'pending' check (status in ('pending', 'contacted', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_purchase_requests_car on car_purchase_requests(car_id);
create index if not exists idx_purchase_requests_buyer on car_purchase_requests(buyer_id);

alter table car_purchase_requests enable row level security;

-- Buyers can create + read their own requests.
create policy "buyer_insert_own_purchase_request" on car_purchase_requests
  for insert to authenticated
  with check (buyer_id = auth.uid());

create policy "buyer_read_own_purchase_request" on car_purchase_requests
  for select to authenticated
  using (buyer_id = auth.uid());

-- Admin manages everything (service role / admin edge functions bypass RLS anyway;
-- this policy just also allows an authenticated admin profile through the client).
create policy "admin_full_access_purchase_request" on car_purchase_requests
  for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));


-- 2) "List my car for auction" requests submitted by a buyer.
create table if not exists car_auction_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles(id) on delete cascade,
  buyer_name text,
  buyer_phone text,
  vehicle_title text not null,
  year int,
  km_driven numeric,
  expected_price numeric,
  description text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_auction_requests_buyer on car_auction_requests(buyer_id);

alter table car_auction_requests enable row level security;

create policy "buyer_insert_own_auction_request" on car_auction_requests
  for insert to authenticated
  with check (buyer_id = auth.uid());

create policy "buyer_read_own_auction_request" on car_auction_requests
  for select to authenticated
  using (buyer_id = auth.uid());

create policy "admin_full_access_auction_request" on car_auction_requests
  for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
