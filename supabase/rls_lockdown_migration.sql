-- =============================================================================
-- RLS LOCKDOWN — cars, car_bids, and all lookup tables
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run.
--
-- Before this: cars/lookups had "using (true) with check (true)" policies,
-- meaning ANY anon-key holder could insert/update/delete them directly via
-- the REST API, bypassing the admin UI entirely.
--
-- After this: anon + logged-in users can only SELECT (read) these tables.
-- All insert/update/delete now go ONLY through the Edge Functions
-- (add-car, update-car, delete-car, mark-sold, manage-lookup), which use
-- the service_role key server-side after verifying the caller is a
-- signed-in admin. service_role bypasses RLS entirely, so it's unaffected
-- by the policies below.
--
-- car_bids stays as-is: buyers/dealers still need direct insert (their own
-- bid) + admin read-all, both already correctly scoped by auth.uid() in
-- auction_admin_migration.sql. This file only removes the leftover
-- "_public_write" blanket policies that don't belong there.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Lookup tables — drop the wide-open write policy, keep public read
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
    execute format('drop policy if exists "%1$s_public_write" on public.%1$s;', t);
    -- read policy ("%1$s_public_read") stays untouched.
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. cars — drop the wide-open write policy, keep public read
-- ---------------------------------------------------------------------------
drop policy if exists "cars_public_write" on public.cars;
-- "cars_public_read" stays untouched.

-- ---------------------------------------------------------------------------
-- 3. car_bids — remove any stray public-write policy if one exists
--    (none should exist per auction_admin_migration.sql, but this makes the
--    lockdown airtight even if something was added manually later).
-- ---------------------------------------------------------------------------
drop policy if exists "car_bids_public_write" on public.car_bids;
drop policy if exists "car_bids: public write" on public.car_bids;

-- ---------------------------------------------------------------------------
-- 4. Sanity check — list every remaining policy on these tables so you can
--    eyeball that only reads (and the auth.uid()-scoped bid policies)
--    survive. Run this SELECT separately after the migration if you want.
-- ---------------------------------------------------------------------------
-- select schemaname, tablename, policyname, cmd, qual, with_check
-- from pg_policies
-- where tablename in (
--   'cars','car_bids','states','cities','brands','models','fuel_types',
--   'body_types','transmissions','colors','vehicle_categories','features',
--   'specification_keys'
-- )
-- order by tablename, policyname;
