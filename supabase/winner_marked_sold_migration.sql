-- Run in: Supabase Dashboard → SQL Editor → New query → Run. Safe to re-run.
-- Required by supabase/functions/push-winner-to-sheet.
alter table public.cars
  add column if not exists buyer_winner_marked_sold     boolean not null default false,
  add column if not exists buyer_winner_marked_sold_at   timestamptz,
  add column if not exists dealer_winner_marked_sold     boolean not null default false,
  add column if not exists dealer_winner_marked_sold_at  timestamptz;

notify pgrst, 'reload schema';
