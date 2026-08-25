-- =============================================================================
-- PHASE 6 + PHASE 7 — Dealer ID + Password login, auto-generated temp
-- password on approval, emailed to the dealer, forced change on first login.
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run. Safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. profiles: dealer_id (human-readable login ID) + must_change_password
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists dealer_id text unique;

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

create index if not exists idx_profiles_dealer_id on public.profiles(dealer_id);

-- ---------------------------------------------------------------------------
-- 2. dealer_applications: link back to the auth account created on approval
-- ---------------------------------------------------------------------------
alter table public.dealer_applications
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 3. generate_dealer_id(): same DLR-000001 sequence as before, but with NO
--    auth.uid() admin check inside it. It's only ever called from the
--    approve-dealer-application Edge Function, which already verified the
--    caller is an admin/manager via requireStaff() BEFORE calling this —
--    and only service_role (not anon/authenticated) is granted execute.
-- ---------------------------------------------------------------------------
create or replace function public.generate_dealer_id()
returns text
language sql
security definer
set search_path = public
as $$
  select 'DLR-' || lpad(nextval('public.dealer_id_seq')::text, 6, '0');
$$;

revoke all on function public.generate_dealer_id() from public, anon, authenticated;
grant execute on function public.generate_dealer_id() to service_role;
