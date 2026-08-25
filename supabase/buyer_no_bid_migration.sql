-- =============================================================================
-- Buyer-cannot-bid migration
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run.
--
-- Buyers keep their account, dashboard, and can still LIST their own car
-- for sale — they just can no longer place a bid. Only approved dealers
-- can bid. This is enforced at the RLS level (not just hidden in the UI),
-- so it can't be bypassed by calling the REST API directly.
-- =============================================================================

drop policy if exists "car_bids: self insert" on public.car_bids;

create policy "car_bids: dealer self insert"
  on public.car_bids for insert
  with check (
    bidder_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'dealer'
        and p.status = 'approved'
    )
  );
