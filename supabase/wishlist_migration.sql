-- =============================================================================
-- Wishlist / "Saved Cars" — backs the buyer dashboard's Saved Cars stat + list
-- Run in: Supabase Dashboard → SQL Editor → New query → Run. Safe to re-run.
-- =============================================================================

create table if not exists public.wishlist (
  id         uuid primary key default gen_random_uuid(),
  buyer_id   uuid not null references public.profiles(id) on delete cascade,
  car_id     uuid not null references public.cars(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (buyer_id, car_id)
);

create index if not exists wishlist_buyer_idx on public.wishlist (buyer_id);

alter table public.wishlist enable row level security;

drop policy if exists "wishlist: self insert" on public.wishlist;
create policy "wishlist: self insert"
  on public.wishlist for insert to authenticated
  with check (buyer_id = auth.uid());

drop policy if exists "wishlist: self read" on public.wishlist;
create policy "wishlist: self read"
  on public.wishlist for select to authenticated
  using (buyer_id = auth.uid());

drop policy if exists "wishlist: self delete" on public.wishlist;
create policy "wishlist: self delete"
  on public.wishlist for delete to authenticated
  using (buyer_id = auth.uid());

notify pgrst, 'reload schema';
