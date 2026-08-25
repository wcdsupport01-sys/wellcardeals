-- =============================================================================
-- Dealer post-approval access code (SMS / WhatsApp verification)
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run.
--
-- Flow this supports:
--   1. Dealer signs up  -> profiles.status = 'pending'
--   2. Admin approves    -> profiles.status = 'approved' AND a fresh 6-digit
--                           `dealer_access_code` is generated here, with
--                           `dealer_access_code_verified = false`.
--                           The frontend then calls the `send-access-code`
--                           Edge Function to text/WhatsApp that code to the
--                           dealer from +91 9540102163 (Twilio).
--   3. Dealer logs in    -> allowed in, but routed to a "enter code" screen
--                           until `dealer_access_code_verified = true`.
--   4. Dealer enters code -> frontend calls verify_dealer_access_code(code),
--                           which flips the verified flag if it matches.
--                           Only then can they reach the dashboard / live
--                           auctions as a dealer.
--
-- NOTE: this is a different, separate mechanism from the `access_codes`
-- table in schema.sql (that one is a buyer/guest "bidding pass" code for the
-- Live Auctions demo — unrelated to dealer approval).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Columns on profiles
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists dealer_access_code           text,
  add column if not exists dealer_access_code_verified  boolean not null default false,
  add column if not exists dealer_access_code_sent_at   timestamptz,
  add column if not exists dealer_access_code_attempts  int not null default 0;

-- ---------------------------------------------------------------------------
-- 2. generate_dealer_access_code(dealer_id)
--    Admin-only. Creates a fresh random 6-digit code for a dealer, resets
--    the verified flag + attempt counter. Returns the new code so the
--    frontend can immediately pass it to the send-access-code Edge Function.
-- ---------------------------------------------------------------------------
drop function if exists public.generate_dealer_access_code(uuid);
create or replace function public.generate_dealer_access_code(p_dealer_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Only an admin can generate a dealer access code.';
  end if;

  if not exists (
    select 1 from public.profiles where id = p_dealer_id and role = 'dealer'
  ) then
    raise exception 'Target user is not a dealer.';
  end if;

  -- 6-digit numeric code, e.g. "042817"
  v_code := lpad(floor(random() * 1000000)::int::text, 6, '0');

  update public.profiles
  set dealer_access_code = v_code,
      dealer_access_code_verified = false,
      dealer_access_code_attempts = 0,
      dealer_access_code_sent_at = now()
  where id = p_dealer_id;

  return v_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. verify_dealer_access_code(code)
--    Called by the logged-in dealer themself. Compares against their own
--    row only (auth.uid()), so one dealer can never brute-force another's
--    code through this function. Locks after 5 wrong attempts (admin can
--    re-generate a code to unlock).
-- ---------------------------------------------------------------------------
drop function if exists public.verify_dealer_access_code(text);
create or replace function public.verify_dealer_access_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.profiles;
begin
  select * into v_row from public.profiles where id = auth.uid() and role = 'dealer';

  if v_row.id is null then
    raise exception 'Not signed in as a dealer.';
  end if;

  if v_row.status <> 'approved' then
    raise exception 'Dealer account is not approved yet.';
  end if;

  if v_row.dealer_access_code_verified then
    return true;
  end if;

  if v_row.dealer_access_code_attempts >= 5 then
    raise exception 'Too many incorrect attempts. Ask admin to resend a new code.';
  end if;

  if v_row.dealer_access_code is null or trim(p_code) <> v_row.dealer_access_code then
    update public.profiles
    set dealer_access_code_attempts = dealer_access_code_attempts + 1
    where id = auth.uid();
    return false;
  end if;

  update public.profiles
  set dealer_access_code_verified = true
  where id = auth.uid();

  return true;
end;
$$;

grant execute on function public.generate_dealer_access_code(uuid) to authenticated;
grant execute on function public.verify_dealer_access_code(text) to authenticated;
