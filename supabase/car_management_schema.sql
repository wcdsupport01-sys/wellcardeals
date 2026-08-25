-- =============================================================================
-- Car Management & Dynamic Lookups schema
-- Run this whole file in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run.
--
-- IMPORTANT — read this before you run it:
-- In this project, user accounts (buyer / dealer / admin) live in Firebase
-- Auth + Firestore, NOT in this Supabase project. That means Postgres RLS
-- policies like `using (auth.uid() = ...)` or `public.is_admin()` (which
-- depend on Supabase Auth) have nothing to check here — there is no
-- Supabase-side session for a Firebase-authenticated admin.
--
-- So, for now, the tables below are readable AND writable by anyone holding
-- the public anon key (which is what the app's frontend uses) — the Admin
-- panel's own /admin-login screen is what stops a random visitor from
-- finding the "Add Car" page, but it does NOT stop someone from calling the
-- Supabase REST API directly with the anon key and writing to `cars`.
--
-- That's fine to get things running end-to-end, but before this goes to
-- real users, lock it down properly — the standard way is a Supabase Edge
-- Function (or any small backend) that verifies the Firebase ID token on
-- write requests and only then uses the `service_role` key to write. Ask
-- for that as a follow-up whenever you're ready for it.
-- =============================================================================

create extension if not exists pgcrypto; -- for gen_random_uuid()

-- ---------------------------------------------------------------------------
-- 1. Dynamic dropdown / lookup tables
--    Admin manages these from Settings; Add Car form reads from them live.
-- ---------------------------------------------------------------------------
create table if not exists public.states (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.cities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  state_id   uuid references public.states(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (name, state_id)
);

create table if not exists public.brands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  logo_url   text,
  created_at timestamptz not null default now()
);

create table if not exists public.models (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references public.brands(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (brand_id, name)
);

create table if not exists public.fuel_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists public.body_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists public.transmissions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists public.colors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  hex  text
);

create table if not exists public.vehicle_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

-- Features are grouped by category so the Add Car form can render them under
-- Safety / Comfort / Exterior / Interior / Infotainment sections.
create table if not exists public.features (
  id         uuid primary key default gen_random_uuid(),
  category   text not null check (category in ('safety','comfort','exterior','interior','infotainment')),
  name       text not null,
  created_at timestamptz not null default now(),
  unique (category, name)
);

-- Generic key/value spec catalogue (e.g. "Ground Clearance" -> free value per car).
create table if not exists public.specification_keys (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique
);

-- ---------------------------------------------------------------------------
-- 2. Cars table — every field from the Add Car form
-- ---------------------------------------------------------------------------
create table if not exists public.cars (
  id                  uuid primary key default gen_random_uuid(),

  -- Ownership / channel. dealer_id / created_by store the Firebase uid of
  -- the dealer/admin who created the listing — plain text, not a foreign
  -- key, since those users live in Firebase, not in this database.
  dealer_id           text,
  created_by          text,
  channel             text not null default 'buyer' check (channel in ('buyer','dealer')),

  -- Identity
  vehicle_title        text not null,
  brand_id             uuid references public.brands(id),
  model_id             uuid references public.models(id),
  variant              text,
  year                 int,
  registration_year    int,
  mileage_km           numeric,
  fuel_type_id         uuid references public.fuel_types(id),
  transmission_id      uuid references public.transmissions(id),
  body_type_id         uuid references public.body_types(id),
  color_id             uuid references public.colors(id),
  category_id          uuid references public.vehicle_categories(id),
  ownership            text,                          -- '1st','2nd','3rd','4th+'

  -- Technical
  vin_number           text,
  engine_number        text,
  engine_capacity      text,
  horsepower           numeric,
  torque               text,
  drive_type           text,                          -- FWD/RWD/AWD/4WD
  seating_capacity     int,
  doors                int,

  -- Location / compliance
  location             text,
  registration_state   text,
  insurance_validity   date,
  rc_status            text,
  puc_status            text,
  service_history       text,
  accidental_history    text,
  number_of_keys        int,
  finance_status        text,

  -- Narrative
  description           text,
  seller_notes           text,

  -- Feature groups (arrays of feature names/ids picked from `features`)
  safety_features        jsonb not null default '[]',
  comfort_features        jsonb not null default '[]',
  exterior_features        jsonb not null default '[]',
  interior_features         jsonb not null default '[]',
  infotainment_features      jsonb not null default '[]',
  specifications              jsonb not null default '{}',  -- {"Ground Clearance":"185mm", ...}

  -- Pricing / auction
  reserve_price          numeric,
  starting_bid           numeric,
  buy_now_price          numeric,
  minimum_increment      numeric not null default 5000,
  auction_start          timestamptz,
  auction_end            timestamptz,
  status                 text not null default 'draft'
                           check (status in ('draft','upcoming','live','closed','sold')),
  visibility             text not null default 'hidden'
                           check (visibility in ('visible','hidden')),
  is_featured            boolean not null default false,
  is_verified            boolean not null default false,

  -- Media
  thumbnail_url          text,
  images                 jsonb not null default '[]',   -- [url, url, ...]
  images_360             jsonb not null default '[]',
  videos                 jsonb not null default '[]',
  documents              jsonb not null default '[]',    -- [{"name":"RC.pdf","url":"..."}]

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists cars_status_idx on public.cars (status);
create index if not exists cars_channel_idx on public.cars (channel);
create index if not exists cars_brand_idx on public.cars (brand_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cars_set_updated_at on public.cars;
create trigger cars_set_updated_at
  before update on public.cars
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
--    No Supabase-Auth-based admin check is possible here (see notice at the
--    top) — so lookups and cars are readable AND writable by the anon key.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'states','cities','brands','models','fuel_types','body_types',
    'transmissions','colors','vehicle_categories','features','specification_keys'
  ])
  loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists "%1$s_public_read" on public.%1$s;', t);
    execute format(
      'create policy "%1$s_public_read" on public.%1$s for select using (true);', t
    );

    execute format('drop policy if exists "%1$s_public_write" on public.%1$s;', t);
    execute format(
      'create policy "%1$s_public_write" on public.%1$s for all using (true) with check (true);', t
    );
  end loop;
end $$;

alter table public.cars enable row level security;

drop policy if exists "cars_public_read" on public.cars;
create policy "cars_public_read" on public.cars
  for select using (true);

drop policy if exists "cars_public_write" on public.cars;
create policy "cars_public_write" on public.cars
  for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 4. Storage bucket for car media
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('car-media', 'car-media', true)
on conflict (id) do nothing;

drop policy if exists "car_media_public_read" on storage.objects;
create policy "car_media_public_read" on storage.objects
  for select using (bucket_id = 'car-media');

drop policy if exists "car_media_public_write" on storage.objects;
create policy "car_media_public_write" on storage.objects
  for all using (bucket_id = 'car-media') with check (bucket_id = 'car-media');

-- ---------------------------------------------------------------------------
-- 5. Seed a starter set of lookup values so the Add Car form isn't empty
--    on first run. Admin can add more any time from Settings.
-- ---------------------------------------------------------------------------
insert into public.fuel_types (name) values
  ('Petrol'),('Diesel'),('CNG'),('Electric'),('Hybrid')
on conflict (name) do nothing;

insert into public.body_types (name) values
  ('Sedan'),('Hatchback'),('SUV'),('MUV'),('Coupe'),('Convertible'),('Pickup Truck')
on conflict (name) do nothing;

insert into public.transmissions (name) values
  ('Manual'),('Automatic'),('AMT'),('CVT'),('DCT')
on conflict (name) do nothing;

insert into public.colors (name, hex) values
  ('White','#FFFFFF'),('Black','#000000'),('Silver','#C0C0C0'),
  ('Grey','#808080'),('Red','#C0392B'),('Blue','#2980B9')
on conflict (name) do nothing;

insert into public.vehicle_categories (name) values
  ('Luxury'),('Sports'),('Vintage'),('Commercial'),('Standard')
on conflict (name) do nothing;

insert into public.brands (name) values
  ('Maruti Suzuki'),('Hyundai'),('Tata'),('Mahindra'),('Honda'),
  ('Toyota'),('BMW'),('Mercedes-Benz'),('Audi'),('Kia')
on conflict (name) do nothing;

insert into public.features (category, name) values
  ('safety','ABS'),('safety','Airbags'),('safety','ESP'),('safety','Parking Sensors'),
  ('comfort','Automatic Climate Control'),('comfort','Cruise Control'),('comfort','Keyless Entry'),
  ('exterior','Alloy Wheels'),('exterior','Sunroof'),('exterior','LED Headlamps'),
  ('interior','Leather Seats'),('interior','Rear Armrest'),
  ('infotainment','Touchscreen Display'),('infotainment','Android Auto / CarPlay'),('infotainment','Premium Sound System')
on conflict (category, name) do nothing;
