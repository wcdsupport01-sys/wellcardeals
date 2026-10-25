-- Disposable local test database ONLY. Never run against a real Supabase project.
CREATE TABLE public.auction_test_marker(disposable boolean NOT NULL DEFAULT true);
INSERT INTO public.auction_test_marker VALUES (true);
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
CREATE TABLE public.profiles (id uuid PRIMARY KEY, role text, status text, business_name text, full_name text);
CREATE TABLE public.cars (
  id uuid PRIMARY KEY, vehicle_title text, location text, year int, status text,
  listing_type text, auction_end timestamptz, minimum_increment numeric, starting_bid numeric,
  base_price_dealer numeric, reserve_price numeric, current_bid_dealer numeric,
  highest_bidder_id_dealer uuid, highest_bidder_name_dealer text
);
CREATE TABLE public.car_bids (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, car_id uuid NOT NULL REFERENCES public.cars ON DELETE CASCADE,
  bidder_id uuid, bidder_name text NOT NULL, bidder_role text NOT NULL, amount numeric NOT NULL,
  is_custom boolean DEFAULT false, created_at timestamptz DEFAULT now()
);
CREATE TABLE public.wishlist (id uuid DEFAULT gen_random_uuid(), buyer_id uuid, car_id uuid REFERENCES public.cars, UNIQUE(buyer_id,car_id));
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
INSERT INTO public.profiles VALUES
 ('00000000-0000-0000-0000-000000000001','dealer','approved','First Dealer','First'),
 ('00000000-0000-0000-0000-000000000002','dealer','approved','Second Dealer','Second'),
 ('00000000-0000-0000-0000-000000000003','buyer','approved',NULL,'Buyer'),
 ('00000000-0000-0000-0000-000000000004','dealer','pending',NULL,'Pending'),
 ('00000000-0000-0000-0000-000000000005','admin','approved',NULL,'Admin');
